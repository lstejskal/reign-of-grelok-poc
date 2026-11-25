import type { CutsceneStep, Facing, Point } from '@grelok/engine';

/**
 * Everything a cutscene can make happen. The Sequencer only calls these in order; HOW each one is drawn (tweens,
 * the walking sprite, the text box...) is the scene's business. Methods that return a Promise are waited for:
 * the next step starts when the promise resolves. That is the whole idea of a sequencer.
 */
export interface CutsceneActor {
  walk(to: Point): Promise<void>;
  face(facing: Facing): void;
  narrate(text: string): Promise<void>;
  say(speaker: string, text: string): Promise<void>;
  wait(seconds: number): Promise<void>;
  fade(to: 'out' | 'in'): Promise<void>;
  shake(seconds: number): Promise<void>;
  sfx(name: string): void;
  music(name: string): void;
  sync(): void;
  end(lines: string[]): void;
  /** Skipping: finish whatever is moving right now (the walk, the fade, the shake, a spoken line) at once. */
  hurry(): void;
}

/** Steps that only take time; a skipped cutscene leaves them out. (Walks and fades still happen, instantly.) */
const ONLY_TAKE_TIME: ReadonlySet<CutsceneStep['type']> = new Set(['wait', 'shake', 'say', 'sfx']);

/** A short description of a step, for logs and tests ("wait 0.5", "sfx clang"). */
export function describeStep(step: CutsceneStep): string {
  switch (step.type) {
    case 'walk':
      return `walk ${step.to.join(',')}`;
    case 'face':
      return `face ${step.facing}`;
    case 'narrate':
      return `narrate ${step.message ?? step.text}`;
    case 'say':
      return `say ${step.speaker}`;
    case 'wait':
    case 'shake':
      return `${step.type} ${step.seconds}`;
    case 'fade':
      return `fade ${step.to}`;
    case 'sfx':
    case 'music':
      return `${step.type} ${step.name}`;
    case 'sync':
      return 'sync';
    case 'end':
      return 'end';
  }
}

/**
 * Plays cutscenes: runs the steps one after another, waiting for each to finish. While anything is playing
 * `running` is true, and the scene uses that to lock the player's input.
 *
 * A cutscene started while another plays waits its turn. If a step throws, the error is reported and the
 * cutscene stops - but `running` always goes back to false, so the game can never stay locked.
 */
export class Sequencer {
  private chain: Promise<void> = Promise.resolve();
  private waiting = 0;
  /** What has been played, in order (the last 50 steps): handy in tests and when debugging a cutscene. */
  readonly log: string[] = [];
  /** The player asked to skip the cutscene that plays now. */
  private skipping = false;
  private actorNow: CutsceneActor | undefined;
  /** Resolves the step being waited for when a skip is asked for in the middle of it. */
  private interrupt: (() => void) | undefined;

  constructor(private readonly onError: (error: unknown) => void = console.error) {}

  get running(): boolean {
    return this.waiting > 0;
  }

  /**
   * Skip the cutscene that plays now (Esc). What only takes time (waits, shakes, spoken lines, sounds) is left out;
   * walks and fades finish at once; what changes the story (sync, narration, music, the end screen) still happens, so
   * the world ends up exactly as after watching it. Narration still waits for a click: it is the result to read.
   */
  skip(): void {
    if (!this.running || this.skipping) return;
    this.skipping = true;
    this.actorNow?.hurry();
    this.interrupt?.();
  }

  /** Play `steps` (after any cutscene already playing). Resolves when they are all done. */
  play(steps: readonly CutsceneStep[], actor: CutsceneActor, messageText: (key: string) => string): Promise<void> {
    this.waiting++;
    const run = async () => {
      this.skipping = false;
      this.actorNow = actor;
      try {
        for (const step of steps) {
          this.log.push(describeStep(step));
          if (this.log.length > 50) this.log.shift();
          if (this.skipping && ONLY_TAKE_TIME.has(step.type)) continue;
          const done = this.perform(step, actor, messageText);
          const toRead = step.type === 'narrate' || step.type === 'end';
          if (this.skipping && (step.type === 'walk' || step.type === 'fade')) actor.hurry(); // started while skipping: finish it now
          // a skip asked for in the middle of a step that only moves things along ends that step at once
          if (toRead) await done;
          else await Promise.race([done, new Promise<void>((resolve) => (this.interrupt = resolve))]);
          this.interrupt = undefined;
        }
      } catch (error) {
        this.onError(error);
      } finally {
        this.skipping = false;
        this.actorNow = undefined;
        this.waiting--;
      }
    };
    this.chain = this.chain.then(run);
    return this.chain;
  }

  private async perform(step: CutsceneStep, actor: CutsceneActor, messageText: (key: string) => string): Promise<void> {
    switch (step.type) {
      case 'walk':
        return actor.walk(step.to);
      case 'face':
        return actor.face(step.facing);
      case 'narrate':
        return actor.narrate(step.message !== undefined ? messageText(step.message) : (step.text ?? ''));
      case 'say':
        return actor.say(step.speaker, step.text);
      case 'wait':
        return actor.wait(step.seconds);
      case 'fade':
        return actor.fade(step.to);
      case 'shake':
        return actor.shake(step.seconds);
      case 'sfx':
        return actor.sfx(step.name);
      case 'music':
        return actor.music(step.name);
      case 'sync':
        return actor.sync();
      case 'end':
        return actor.end(step.lines);
    }
  }
}
