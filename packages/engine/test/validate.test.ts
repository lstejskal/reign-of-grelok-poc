import { describe, expect, it } from 'vitest';
import { validateGame } from '../src';
import type { GameBundle } from '../src';
import { assetExistsFor, imageSizeFor, loadGameBundle } from '../node/loadGameBundle';

const everythingExists = () => true;
const fresh = (): GameBundle => structuredClone(loadGameBundle('grelok')); // a copy we can break

describe('validateGame', () => {
    it('accepts the real grelok data', () => {
        expect(validateGame(loadGameBundle('grelok'), everythingExists)).toEqual([]);
    });

    it('accepts the real grelok data including the existence and size of its images', () => {
        expect(validateGame(loadGameBundle('grelok'), assetExistsFor('grelok'), imageSizeFor('grelok'))).toEqual([]);
    });

    it('reports a hotspot that points at an unknown thing', () => {
        const bundle = fresh();
        bundle.scenes.plain!.hotspots[0]!.id = 'no_such_thing';

        const errors = validateGame(bundle, everythingExists);
        expect(errors).toContain('scenes/plain.yml: hotspot "no_such_thing": no such thing in logic/things.yml');
        expect(errors.join()).toContain('thing "standing_stone" starts here but has no hotspot');
    });

    it('reports broken speakers: unknown default, bad colour, unknown thing, a pattern matching no message', () => {
        const bundle = fresh();
        bundle.speakers.default = 'nobody';
        bundle.speakers.speakers.blacksmith!.color = 'orange';
        bundle.speakers.speakers.priest!.thing = 'no_such_thing';
        bundle.speakers.speakers.wizard!.messages = ['no_such_message_*'];

        const errors = validateGame(bundle, everythingExists);
        expect(errors).toContain('speakers.yml: default speaker "nobody" is not listed under speakers');
        expect(errors).toContain('speakers.yml (blacksmith): color must look like "#rrggbb", not "orange"');
        expect(errors).toContain('speakers.yml (priest): there is no thing "no_such_thing" in logic/things.yml');
        expect(errors).toContain('speakers.yml (wizard): message pattern "no_such_message_*" matches no message in logic/messages.yml');
    });

    it('reports broken sprites: unknown thing, unknown constraint, missing image, no states, duplicate id', () => {
        const bundle = fresh();
        const sprites = bundle.scenes.chapel!.sprites!;
        sprites[0]!.thing = 'no_such_thing';
        sprites[0]!.states[0]!.when = { no_such_constraint: true };
        sprites[1]!.states = [];
        sprites[1]!.id = sprites[0]!.id;
        const missing = (path: string) => path !== 'sprites/zombie_down.png';

        const errors = validateGame(bundle, missing);
        expect(errors).toContain('scenes/chapel.yml: sprite "zombie": unknown thing "no_such_thing"');
        expect(errors).toContain('scenes/chapel.yml: sprite "zombie": "when" uses unknown constraint "no_such_constraint" (see logic/constraints.yml)');
        expect(errors).toContain('scenes/chapel.yml: sprite "zombie": image not found: assets/sprites/zombie_down.png');
        expect(errors).toContain('scenes/chapel.yml: sprite "zombie": defined twice');
        expect(errors).toContain('scenes/chapel.yml: sprite "zombie": needs "states" (or a single "image")');
    });

    it('reports a location without a scene, and a scene without a location', () => {
        const bundle = fresh();
        delete bundle.scenes.town;
        bundle.scenes.atlantis = { hotspots: [], exits: [] };

        const errors = validateGame(bundle, everythingExists);
        expect(errors).toContain('scenes/town.yml: missing scene file for this location');
        expect(errors).toContain('scenes/atlantis.yml: there is no such location in logic/locations.yml');
    });

    it('reports exits that do not match the location directions', () => {
        const bundle = fresh();
        bundle.scenes.mountain!.exits = []; // mountain has direction "s"
        bundle.scenes.swamp!.exits[0]!.direction = 'x';

        const errors = validateGame(bundle, everythingExists).join('\n');
        expect(errors).toContain('scenes/mountain.yml: direction "s" has no exit');
        expect(errors).toContain('scenes/swamp.yml: exit "x": location has no such direction');
    });

    it('reports missing asset files and bad coordinates', () => {
        const bundle = fresh();
        bundle.scenes.plain!.background = 'backgrounds/plain.png';
        bundle.scenes.plain!.hotspots[1]!.polygon = [[0, 0], [999, 0]]; // too few points, one outside the scene

        const errors = validateGame(bundle, (asset) => asset !== 'backgrounds/plain.png').join('\n');
        expect(errors).toContain('background asset not found: assets/backgrounds/plain.png');
        expect(errors).toContain('hotspot "pebble" polygon: expected at least 3');
    });

    it('reports a background of the wrong size', () => {
        const bundle = fresh();
        bundle.scenes.plain!.background = 'backgrounds/plain.png';

        const errors = validateGame(bundle, everythingExists, () => ({ width: 640, height: 288 }));
        expect(errors).toContain('scenes/plain.yml: background must be 320x144 pixels, but assets/backgrounds/plain.png is 640x288');
    });

    it('reports a pickable thing without an icon, and an icon of the wrong size', () => {
        const bundle = fresh();
        const errors = validateGame(bundle, (asset) => asset !== 'icons/pebble.png').join('\n');
        expect(errors).toContain('pickable thing "pebble" has no icon: assets/icons/pebble.png');

        const sized = validateGame(bundle, everythingExists, (asset) =>
            asset === 'icons/jug.png' ? { width: 32, height: 32 } : undefined,
        ).join('\n');
        expect(sized).toContain('icon must be 24x16 pixels, but assets/icons/jug.png is 32x32');
    });

    it('reports a missing player, a sprite sheet of the wrong size and a bad scale', () => {
        const bundle = fresh();
        delete (bundle.config as Partial<typeof bundle.config>).player;
        expect(validateGame(bundle, everythingExists).join('\n')).toContain('game.yml: missing "player"');

        const wrong = fresh();
        const sheet = wrong.config.player.sprite;
        const sized = validateGame(wrong, everythingExists, (a) => (a === sheet ? { width: 10, height: 10 } : undefined)).join('\n');
        expect(sized).toContain('player sprite sheet must be 96x192 pixels');

        const scaled = fresh();
        scaled.scenes.plain!.scale = { top: 0, bottom: 5 };
        expect(validateGame(scaled, everythingExists).join('\n')).toContain('scenes/plain.yml: scale:');
    });
});
