import { describe, expect, it } from 'vitest';
import { parseStep } from '@grelok/engine';
import type { CutsceneStep } from '@grelok/engine';
import { Sequencer } from './Sequencer';
import type { CutsceneActor } from './Sequencer';

/** A fake actor: records every call, and lets the test decide when each waiting step finishes. */
function fakeActor() {
  const calls: string[] = [];
  const releases: (() => void)[] = [];
  const hold = (what: string) => {
    calls.push(what);
    return new Promise<void>((resolve) => releases.push(resolve));
  };
  const actor: CutsceneActor = {
    walk: (to) => hold(`walk ${to}`),
    face: (f) => void calls.push(`face ${f}`),
    narrate: (text) => hold(`narrate ${text}`),
    say: (who, text) => hold(`say ${who}: ${text}`),
    wait: (s) => hold(`wait ${s}`),
    fade: (to) => hold(`fade ${to}`),
    shake: (s) => hold(`shake ${s}`),
    sfx: (n) => void calls.push(`sfx ${n}`),
    music: (n) => void calls.push(`music ${n}`),
    sync: () => void calls.push('sync'),
    end: (lines) => void calls.push(`end ${lines.length}`),
    hurry: () => {
      // finishes everything that is moving: the real actor ends walks, fades, shakes and speech
      calls.push('hurry');
      for (const release of releases.splice(0)) release();
    },
  };
  /** Finish the step that is waiting, and give the sequencer a moment to carry on. */
  const finishCurrent = async () => {
    releases.shift()!();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { actor, calls, finishCurrent };
}

const steps = (...raw: unknown[]): CutsceneStep[] =>
  raw.map((r) => {
    const parsed = parseStep(r);
    if ('error' in parsed) throw new Error(parsed.error);
    return parsed.step;
  });

const text = (key: string) => `<${key}>`;

describe('Sequencer', () => {
  it('runs steps in order, waiting for each slow one to finish before the next', async () => {
    const { actor, calls, finishCurrent } = fakeActor();
    const sequencer = new Sequencer();
    const done = sequencer.play(steps({ face: 'e' }, { wait: 1 }, 'sync', { narrate: { message: 'hello' } }, { sfx: 'clang' }), actor, text);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual(['face e', 'wait 1']); // stuck at the wait
    await finishCurrent();
    expect(calls).toEqual(['face e', 'wait 1', 'sync', 'narrate <hello>']); // stuck at the narration
    await finishCurrent();
    await done;
    expect(calls.at(-1)).toBe('sfx clang');
    expect(sequencer.log).toEqual(['face e', 'wait 1', 'sync', 'narrate hello', 'sfx clang']);
  });

  it('skip: leaves out what only takes time, finishes moves at once, but still syncs, narrates and ends', async () => {
    const { actor, calls, finishCurrent } = fakeActor();
    const sequencer = new Sequencer();
    const done = sequencer.play(
      steps({ wait: 2 }, 'sync', { fade: 'out' }, { say: { speaker: 'grelok', text: 'No!' } }, { sfx: 'boom' }, { narrate: { message: 'won' } }, { end: { lines: [] } }),
      actor,
      text,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual(['wait 2']);
    sequencer.skip(); // Esc in the middle of the wait
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual(['wait 2', 'hurry', 'sync', 'fade out', 'hurry', 'narrate <won>']); // no say, no sfx
    expect(sequencer.running).toBe(true); // the result is still there to read
    await finishCurrent();
    await done;
    expect(calls.at(-1)).toBe('end 0');
    expect(sequencer.running).toBe(false);
  });

  it('is running (input locked) from the start until the last step, and not after', async () => {
    const { actor, finishCurrent } = fakeActor();
    const sequencer = new Sequencer();
    expect(sequencer.running).toBe(false);
    const done = sequencer.play(steps({ wait: 1 }), actor, text);
    expect(sequencer.running).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    await finishCurrent();
    await done;
    expect(sequencer.running).toBe(false);
  });

  it('lets a second cutscene wait for the first, and stays locked until both are done', async () => {
    const { actor, calls, finishCurrent } = fakeActor();
    const sequencer = new Sequencer();
    const first = sequencer.play(steps({ wait: 1 }), actor, text);
    const second = sequencer.play(steps({ wait: 2 }), actor, text);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual(['wait 1']); // the second has not started
    await finishCurrent();
    await first;
    expect(sequencer.running).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual(['wait 1', 'wait 2']);
    await finishCurrent();
    await second;
    expect(sequencer.running).toBe(false);
  });

  it('releases the lock even when a step breaks, and reports the error', async () => {
    const { actor } = fakeActor();
    const errors: unknown[] = [];
    const sequencer = new Sequencer((e) => errors.push(e));
    actor.sync = () => {
      throw new Error('boom');
    };
    await sequencer.play(steps('sync', { sfx: 'never' }), actor, text);
    expect(sequencer.running).toBe(false);
    expect(errors).toHaveLength(1);
    expect(sequencer.log).toEqual(['sync']); // it stopped at the broken step
  });
});

describe('parseStep', () => {
  it('reads one-key maps and bare words', () => {
    expect(parseStep({ walk: [10, 20] })).toEqual({ step: { type: 'walk', to: [10, 20] } });
    expect(parseStep('sync')).toEqual({ step: { type: 'sync' } });
    expect(parseStep({ fade: 'out' })).toEqual({ step: { type: 'fade', to: 'out' } });
    expect(parseStep({ end: { lines: ['a', ''] } })).toEqual({ step: { type: 'end', lines: ['a', ''] } });
    expect(parseStep('end')).toEqual({ step: { type: 'end', lines: [] } });
  });

  it('explains what is wrong', () => {
    expect(parseStep({ jump: 1 })).toEqual({ error: 'unknown step "jump"' });
    expect(parseStep({ wait: 'long' })).toHaveProperty('error');
    expect(parseStep({ walk: [999, 0] })).toHaveProperty('error');
    expect(parseStep({ face: 'up' })).toHaveProperty('error');
    expect(parseStep({ wait: 1, fade: 'in' })).toHaveProperty('error'); // two keys in one step
  });
});
