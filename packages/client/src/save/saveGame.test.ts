import { describe, expect, it } from 'vitest';
import { Engine } from '@grelok/engine';
import type { LogicData } from '@grelok/engine';
import { MemoryStore, SaveStore, formatSaveTime, makeSave, parseSave, slotLabel } from './saveGame';
import type { KeyValueStore } from './saveGame';

// A tiny game: two rooms and a pebble.
const logic = {
  locations: {
    a: { alias: 'a', name: 'Room A', description: 'A.', directions: { n: 'b' } },
    b: { alias: 'b', name: 'Room B', description: 'B.', directions: { s: 'a' } },
  },
  things: { pebble: { alias: 'pebble', description: 'a pebble', location: 'a', pickable: true } },
  commands: { look_at: ['look'], go: ['go'], pick_up: ['take'] },
  constraints: { locations: {}, boolean: {} },
  customActions: {},
  messages: {},
} as unknown as LogicData;

const player = { x: 100, y: 90, facing: 'e' } as const;

describe('save envelope', () => {
  it('round-trips: an engine saved and loaded again is in the same state, and the player position comes back', () => {
    const engine = new Engine(logic, { startLocation: 'a' });
    engine.perform({ verb: 'pick_up', objects: ['pebble'] });
    engine.perform({ verb: 'go', objects: ['n'] });

    const text = JSON.stringify(makeSave('test', engine, player, 1000));
    const save = parseSave(text, 'test')!;
    expect(save).toMatchObject({ gameId: 'test', savedAt: 1000, location: 'b', player });

    const loaded = Engine.deserialize(logic, save.engine);
    expect(loaded.state.location).toBe('b');
    expect(loaded.state.inventory).toEqual(['pebble']);
  });

  it('rejects anything that is not a valid save of this game', () => {
    const good = JSON.stringify(makeSave('test', new Engine(logic, { startLocation: 'a' }), player));
    expect(parseSave(good, 'test')).toBeDefined();
    expect(parseSave(good, 'other-game')).toBeUndefined();
    expect(parseSave(null, 'test')).toBeUndefined();
    expect(parseSave('not json', 'test')).toBeUndefined();
    expect(parseSave('{"version":99}', 'test')).toBeUndefined();
    expect(parseSave(good.replace('"facing":"e"', '"facing":"up"'), 'test')).toBeUndefined();
  });
});

describe('labels', () => {
  it('formats the time as day.month. hh:mm', () => {
    expect(formatSaveTime(new Date(2026, 9, 19, 11, 7).getTime())).toBe('19.10. 11:07');
    expect(formatSaveTime(new Date(2026, 0, 3, 9, 5).getTime())).toBe('3.1. 09:05');
  });

  it('labels empty and used slots', () => {
    const save = makeSave('test', new Engine(logic, { startLocation: 'b' }), player, new Date(2026, 9, 19, 11, 7).getTime());
    const name = (a: string) => logic.locations[a]!.name;
    expect(slotLabel('2', undefined, name)).toBe('2: Empty');
    expect(slotLabel('2', save, name)).toBe('2: Room B  19.10. 11:07');
    expect(slotLabel('auto', undefined, name)).toBe('Auto: Empty');
  });
});

describe('SaveStore', () => {
  const save = (at: number) => makeSave('test', new Engine(logic, { startLocation: 'a' }), player, at);

  it('keeps slots apart and finds the newest', () => {
    const store = new SaveStore(new MemoryStore(), 'test');
    expect(store.newest()).toBeUndefined();
    expect(store.write('1', save(100))).toBe(true);
    expect(store.write('3', save(300))).toBe(true);
    expect(store.write('auto', save(200))).toBe(true);
    expect(store.all().map((s) => s?.savedAt)).toEqual([100, undefined, 300, 200]);
    expect(store.newest()).toMatchObject({ slot: '3' });
  });

  it('does not mix up games', () => {
    const backing = new MemoryStore();
    new SaveStore(backing, 'one').write('1', save(1));
    expect(new SaveStore(backing, 'two').read('1')).toBeUndefined();
  });

  it('never throws when the browser storage misbehaves', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    };
    const store = new SaveStore(broken, 'test');
    expect(store.write('1', save(1))).toBe(false);
    expect(store.read('1')).toBeUndefined();
    expect(store.newest()).toBeUndefined();
  });
});
