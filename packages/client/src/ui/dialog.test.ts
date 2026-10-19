import { describe, expect, it } from 'vitest';
import { choiceAt, choiceRect, dialogChoices } from './dialog';

const name = (a: string) => a.replace(/_/g, ' ');

describe('dialogChoices', () => {
  it('lists topics, then carried things, then Goodbye', () => {
    const got = dialogChoices(['grelok'], ['pebble', 'grelok'], name);
    expect(got.map((c) => c.label)).toEqual(['Ask about grelok', 'Ask about pebble', 'Goodbye']);
    expect(got[2]!.topic).toBeUndefined();
  });

  it('never asks a person about themselves, and keeps Goodbye when there are too many', () => {
    expect(dialogChoices([], ['smith'], name, 'smith').map((c) => c.label)).toEqual(['Goodbye']);
    const many = dialogChoices([], Array.from({ length: 20 }, (_, i) => `t${i}`), name);
    expect(many).toHaveLength(8);
    expect(many.at(-1)!.label).toBe('Goodbye');
  });
});

describe('choice layout', () => {
  it('finds the choice under a point', () => {
    const r1 = choiceRect(1);
    expect(choiceAt(3, r1.x + 2, r1.y + 2)).toBe(1);
    expect(choiceAt(3, r1.x + 2, 10)).toBeUndefined();
    const r4 = choiceRect(4);
    expect(r4.x).toBeGreaterThan(choiceRect(0).x); // the fifth starts a second column
    expect(choiceAt(3, r4.x + 2, r4.y + 2)).toBeUndefined(); // but only 3 exist
  });
});
