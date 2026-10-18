import { describe, expect, it } from 'vitest';
import { Engine } from '@grelok/engine';
import type { EngineEvent, GameBundle } from '@grelok/engine';
import { GameSession } from './session';

// A tiny made-up game: two rooms and a pebble.
const bundle: GameBundle = {
  id: 'test',
  config: { title: 'Test', start: 'a', player: { sprite: 'p.png', frameWidth: 32, frameHeight: 48 } },
  scenes: {},
  logic: {
    locations: {
      a: { alias: 'a', name: 'Room A', description: 'A.', directions: { n: 'b' } },
      b: { alias: 'b', name: 'Room B', description: 'B.', directions: { s: 'a' } },
    },
    things: { pebble: { alias: 'pebble', description: 'a pebble', location: 'a', pickable: true } },
    commands: { go_north: ['n'], pick_up: ['take'] },
    constraints: { locations: {}, boolean: {} },
    customActions: {},
    messages: {},
  },
};
const newSession = () => new GameSession(bundle, new Engine(bundle.logic, { startLocation: 'a' }));

describe('GameSession', () => {
  it('tells listeners what happened, for both typed and structured commands', () => {
    const session = newSession();
    const seen: EngineEvent[][] = [];
    session.onEvents((events) => seen.push(events));

    session.performText('take pebble');
    session.perform({ verb: 'go', objects: ['n'] });

    expect(seen).toHaveLength(2);
    expect(seen[0]).toContainEqual({ type: 'inventory_changed', inventory: ['pebble'] });
    expect(seen[1]).toEqual([{ type: 'location_changed', from: 'a', to: 'b' }]);
  });

  it('stops notifying after unsubscribe, and stays quiet when nothing happened', () => {
    const session = newSession();
    let calls = 0;
    const unsubscribe = session.onEvents(() => calls++);

    session.performText(''); // nothing happens
    expect(calls).toBe(0);

    unsubscribe();
    session.performText('take pebble');
    expect(calls).toBe(0);
  });
});
