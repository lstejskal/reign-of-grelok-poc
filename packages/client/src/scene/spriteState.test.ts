import { describe, expect, it } from 'vitest';
import type { SceneSpriteData } from '@grelok/engine';
import { lookOf } from './spriteState';

const zombie: SceneSpriteData = {
  id: 'zombie',
  thing: 'zombie',
  x: 220,
  y: 110,
  states: [
    { when: { blocks: true }, image: 'standing.png' },
    { image: 'down.png', y: 112 },
  ],
};

const world = (booleans: Record<string, boolean>, visibleThings = ['zombie']) => ({ booleans, visibleThings });

describe('lookOf', () => {
  it('picks the first state whose conditions hold', () => {
    expect(lookOf(zombie, world({ blocks: true }))).toEqual({ image: 'standing.png', at: [220, 110] });
  });

  it('falls through to a state without conditions, which may move the sprite', () => {
    expect(lookOf(zombie, world({ blocks: false }))).toEqual({ image: 'down.png', at: [220, 112] });
  });

  it('draws nothing while its thing is not visible here (picked up, hidden, elsewhere)', () => {
    expect(lookOf(zombie, world({ blocks: true }, []))).toBeUndefined();
  });

  it('draws nothing when no state matches', () => {
    const door: SceneSpriteData = { id: 'door', x: 1, y: 2, states: [{ when: { locked: false }, image: 'open.png' }] };
    expect(lookOf(door, world({ locked: true }))).toBeUndefined();
    expect(lookOf(door, world({ locked: false }))?.image).toBe('open.png');
  });

  it('needs every condition to hold, and an unknown constraint never matches', () => {
    const s: SceneSpriteData = { id: 's', x: 0, y: 0, states: [{ when: { a: true, b: true }, image: 'x.png' }] };
    expect(lookOf(s, world({ a: true, b: false }))).toBeUndefined();
    expect(lookOf(s, world({ a: true }))).toBeUndefined();
    expect(lookOf(s, world({ a: true, b: true }))).toBeDefined();
  });
});
