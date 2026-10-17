import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Engine } from '../src';
import type { EngineEvent } from '../src';
import { loadLogicData, GRELOK_LOGIC_DIR } from '../node/loadLogicData';

const data = loadLogicData(GRELOK_LOGIC_DIR);
const walkthrough = fs
    .readFileSync(path.join(GRELOK_LOGIC_DIR, '../walkthrough.txt'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '');

const newEngine = () => new Engine(data);
const says = (events: EngineEvent[]) => events.flatMap((e) => (e.type === 'say' ? [e.text] : []));

describe('walkthrough', () => {
    it('plays from start to victory, and the last event is game_over', () => {
        const engine = newEngine();
        let last: EngineEvent[] = [];
        for (const line of walkthrough) last = engine.performText(line);

        expect(last.at(-1)).toEqual({ type: 'game_over', won: true });
        expect(engine.state.over).toBe(true);
        expect(engine.performText('look')).toEqual([]); // nothing happens after the end
    });
});

describe('structured commands', () => {
    it('pick_up emits inventory_changed', () => {
        const events = newEngine().perform({ verb: 'pick_up', objects: ['pebble'] });
        const change = events.find((e) => e.type === 'inventory_changed');

        expect(change).toEqual({ type: 'inventory_changed', inventory: ['rusty_sword', 'pebble'] });
        expect(says(events)).toEqual(['You picked up pebble.']);
    });

    it('go emits location_changed; look_at with a scripted action reveals a hidden thing', () => {
        const engine = newEngine();
        expect(engine.perform({ verb: 'go', objects: ['n'] })).toEqual([
            { type: 'location_changed', from: 'plain', to: 'mountain' },
        ]);

        const events = engine.perform({ verb: 'look_at', objects: ['rubble'] });
        expect(events[0]).toEqual({ type: 'action_performed', alias: 'look_at_rubble' });
        expect(events).toContainEqual({ type: 'thing_changed', id: 'gemstone' });
        expect(events).toContainEqual({ type: 'say', key: 'look_at_rubble_hidden', text: expect.any(String) });
        expect(engine.visibleThings()).toContain('gemstone');
    });

    it('a blocked exit says why and does not move the player', () => {
        const engine = newEngine();
        engine.performText('east');
        const events = engine.perform({ verb: 'go', objects: ['e'] });

        expect(says(events)).toEqual(['Chapel door is blocked by zombie.']);
        expect(engine.state.location).toBe('chapel');
    });
});

describe('text commands', () => {
    it('describes the new room after moving', () => {
        const lines = says(newEngine().performText('north'));
        expect(lines[0]).toBe('Mountain');
        expect(lines).toHaveLength(4); // name, description, exits, things
    });

    it("cannot drink from a jug you don't carry (bug fixed from the text game)", () => {
        const engine = newEngine();
        expect(says(engine.performText('drink from jug'))).toEqual(["You don't carry any jug."]);

        engine.performText('south');
        engine.performText('tt priest'); // the priest hands you the jug
        expect(says(engine.performText('drink from jug'))).toEqual(['The jug is empty.']);
    });

    it('is deterministic when given a fake random source', () => {
        const engine = new Engine(data, { random: () => 0 });
        expect(says(engine.performText('xyzzy'))).toEqual([data.messages.gibberish1]);
    });
});

describe('save / load', () => {
    it('serialize -> deserialize keeps location, inventory and puzzle state', () => {
        const engine = newEngine();
        for (const line of ['take pebble', 'north', 'look at rubble']) engine.performText(line);

        const restored = Engine.deserialize(data, engine.serialize());

        expect(restored.state.location).toBe('mountain');
        expect(restored.state.inventory).toEqual(['rusty_sword', 'pebble']);
        expect(restored.visibleThings()).toContain('gemstone');
        expect(restored.state).toEqual(engine.state);
    });
});
