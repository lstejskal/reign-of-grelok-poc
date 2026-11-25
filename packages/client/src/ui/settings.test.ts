import { describe, expect, it } from 'vitest';
import { DEFAULT_VERBS } from '@grelok/engine';
import { MemoryStore } from '../save/saveGame';
import { cycleTextSpeed, loadTextSpeed } from './settings';
import { verbKeys } from './verbs';

describe('text speed', () => {
  it('starts at NORMAL, cycles SLOW -> NORMAL -> FAST and remembers the choice', () => {
    const store = new MemoryStore();
    let speed = loadTextSpeed(store);
    expect(speed.label).toBe('NORMAL');
    speed = cycleTextSpeed(store, speed);
    expect(speed.label).toBe('FAST');
    expect(loadTextSpeed(store).label).toBe('FAST');
    expect(cycleTextSpeed(store, speed).label).toBe('SLOW');
  });
});

describe('verb shortcuts', () => {
  it('gives each verb the first free letter of its label, never M or F', () => {
    expect([...verbKeys(DEFAULT_VERBS)]).toEqual([
      ['G', 'give'], ['P', 'pick_up'], ['U', 'use'], ['L', 'look_at'], ['T', 'talk_to'], ['S', 'push'],
    ]);
    expect(verbKeys([{ verb: 'feel', label: 'Feel', objects: 1 }]).get('E')).toBe('feel'); // F is fullscreen
  });
});
