import { describe, expect, it } from 'vitest';
import type { SceneData, SceneSpriteData } from '@grelok/engine';
import { conditionsHold, lookOf, withActiveHotspots } from './spriteState';

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
    expect(lookOf(zombie, world({ blocks: true }))).toEqual({ image: 'standing.png', at: [220, 110], depth: 110 });
  });

  it('falls through to a state without conditions, which may move the sprite', () => {
    expect(lookOf(zombie, world({ blocks: false }))).toEqual({ image: 'down.png', at: [220, 112], depth: 112 });
  });

  it('sorts by its own depth when it has one (a gem lying on a heap is drawn in front of it)', () => {
    expect(lookOf({ ...zombie, depth: 125 }, world({ blocks: true }))?.depth).toBe(125);
  });

  it('a state may set its own depth (the fallen zombie lies in front of the grave)', () => {
    const moved = { ...zombie, states: [{ image: 'down.png', x: 145, y: 123, depth: 126 }] };
    expect(lookOf(moved, world({}))).toEqual({ image: 'down.png', at: [145, 123], depth: 126 });
  });

  it('only the hotspots whose `when` holds are active (a moved thing is clicked where it is now)', () => {
    const scene = {
      hotspots: [
        { id: 'zombie', polygon: [], walkTo: [0, 0], when: { blocks: true } },
        { id: 'zombie', polygon: [], walkTo: [1, 1], when: { blocks: false } },
        { id: 'grave', polygon: [], walkTo: [2, 2] },
      ],
      exits: [],
    } as unknown as SceneData;
    expect(withActiveHotspots(scene, { blocks: false }).hotspots.map((h) => h.walkTo)).toEqual([[1, 1], [2, 2]]);
    expect(conditionsHold(undefined, {})).toBe(true);
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
