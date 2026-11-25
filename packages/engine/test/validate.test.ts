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

    it('reports broken cutscenes: unknown message key, bad step, unknown message or speaker', () => {
        const bundle = fresh();
        bundle.cutscenes.no_such_message = [{ wait: 1 }];
        bundle.cutscenes.use_rusty_sword_on_zombie = [{ jump: 1 }, { narrate: { message: 'nope' } }, { say: { speaker: 'nobody', text: 'hi' } }, { wait: 'long' }];

        const errors = validateGame(bundle, everythingExists);
        expect(errors.join('\n')).toContain('cutscenes.yml (no_such_message): "no_such_message" is not a message key');
        expect(errors).toContain('cutscenes.yml (use_rusty_sword_on_zombie): step 1: unknown step "jump"');
        expect(errors).toContain('cutscenes.yml (use_rusty_sword_on_zombie): step 2: no message "nope" in logic/messages.yml');
        expect(errors).toContain('cutscenes.yml (use_rusty_sword_on_zombie): step 3: unknown speaker "nobody"');
        expect(errors).toContain('cutscenes.yml (use_rusty_sword_on_zombie): step 4: wait needs a number of seconds');
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

        const errors = validateGame(bundle, everythingExists, () => ({ width: 320, height: 144 }));
        expect(errors).toContain('scenes/plain.yml: background must be 640x288 pixels, but assets/backgrounds/plain.png is 320x144');
    });

    it('reports a pickable thing without an icon, and an icon of the wrong size', () => {
        const bundle = fresh();
        const errors = validateGame(bundle, (asset) => asset !== 'icons/pebble.png').join('\n');
        expect(errors).toContain('pickable thing "pebble" has no icon: assets/icons/pebble.png');

        const sized = validateGame(bundle, everythingExists, (asset) =>
            asset === 'icons/jug.png' ? { width: 32, height: 32 } : undefined,
        ).join('\n');
        expect(sized).toContain('icon must be 48x32 pixels, but assets/icons/jug.png is 32x32');
    });

    it('reports a missing player, a sprite sheet of the wrong size and a bad scale', () => {
        const bundle = fresh();
        delete (bundle.config as Partial<typeof bundle.config>).player;
        expect(validateGame(bundle, everythingExists).join('\n')).toContain('game.yml: missing "player"');

        const wrong = fresh();
        wrong.config.player = { sprite: wrong.config.player.sprite, frameWidth: 64, frameHeight: 96 }; // the original 3x4 layout
        const sheet = wrong.config.player.sprite;
        const sized = validateGame(wrong, everythingExists, (a) => (a === sheet ? { width: 10, height: 10 } : undefined)).join('\n');
        expect(sized).toContain('player sprite sheet must be 192x384 pixels');

        const scaled = fresh();
        scaled.scenes.plain!.scale = { top: 0, bottom: 5 };
        expect(validateGame(scaled, everythingExists).join('\n')).toContain('scenes/plain.yml: scale:');
    });
    it('checks named player animations: required ones, frames inside the sheet, the sheet width', () => {
        const bundle = fresh();
        const sheet = bundle.config.player.sprite;
        Object.assign(bundle.config.player, { columns: 6, walkStride: 0, animations: { idle_s: [0], idle_n: [1], idle_e: [2], walk_s: [3], walk_e: [6, 7, 99] } });
        const errors = validateGame(bundle, everythingExists, (a) => (a === sheet ? { width: 64 * 6, height: 96 * 2 } : undefined)).join('\n');
        expect(errors).toContain('player animations: missing "walk_n"');
        expect(errors).toContain('player animation "walk_e" uses frames outside the sheet (it has 12)');
        expect(errors).toContain('player walkStride must be a number above 0');
        expect(errors).not.toContain('pixels wide');
        const narrow = validateGame(bundle, everythingExists, (a) => (a === sheet ? { width: 64 * 3, height: 96 * 2 } : undefined)).join('\n');
        expect(narrow).toContain('player sprite sheet must be 384 pixels wide (6 columns of 64)');
    });
    it('checks the player size sheets: order, existence, same dimensions as the main sheet', () => {
        const bundle = fresh();
        const sheet = bundle.config.player.sprite;
        bundle.config.player.sizes = [94, 92, 90];
        const sizeOf = (a: string) => (a === sheet ? { width: 192, height: 384 } : a.endsWith('_92.png') ? { width: 10, height: 10 } : { width: 192, height: 384 });
        const errors = validateGame(bundle, (a) => !a.endsWith('_90.png'), sizeOf).join('\n');
        expect(errors).toContain('player size 90 not found: assets/sprites/grognak_90.png');
        expect(errors).toContain('assets/sprites/grognak_92.png must be the same size as assets/sprites/grognak.png (192x384), but is 10x10');
        expect(errors).not.toContain('@94');
        bundle.config.player.sizes = [90, 94];
        expect(validateGame(bundle, everythingExists).join('\n')).toContain('player sizes must be whole numbers below frameHeight (96), largest first');
    });
    it('reports bad verb buttons: too many, duplicate, bad name, long label, missing preposition', () => {
        const bundle = fresh();
        bundle.config.verbs = [
            { verb: 'use', label: 'Use', objects: 2 },
            { verb: 'use', label: 'A very long label', objects: 1 },
            { verb: 'Pick Up', label: 'Pick', objects: 1 },
            { verb: 'a', label: 'a', objects: 1 },
            { verb: 'b', label: 'b', objects: 1 },
            { verb: 'c', label: 'c', objects: 1 },
            { verb: 'd', label: 'd', objects: 1 },
        ];
        const errors = validateGame(bundle, everythingExists).join('\n');
        expect(errors).toContain('"verbs" has 7 buttons but only 6 fit on screen');
        expect(errors).toContain('verbs[1]: a two-object verb needs a "preposition"');
        expect(errors).toContain('verbs[2]: verb "use" listed twice');
        expect(errors).toContain('verbs[2]: "label" must be 1-9 characters');
        expect(errors).toContain('verbs[3]: "verb" must be lower_snake_case');
    });

    it('reports a speaker nobody answers: no talk_to message, no reply for a topic', () => {
        const bundle = fresh();
        delete bundle.logic.messages.talk_to_blacksmith;
        delete bundle.logic.messages.ask_blacksmith_about_anything;
        bundle.speakers.speakers.blacksmith!.topics = ['grelok', 'standing_stone'];
        delete bundle.logic.messages.ask_blacksmith_about_grelok;

        const errors = validateGame(bundle, everythingExists);
        expect(errors.join('\n')).toContain('nobody answers "talk to blacksmith"');
        expect(errors.join('\n')).toContain('nobody answers "ask blacksmith about grelok"');
    });
    it('reports sound files that do not exist: scene music, cutscene sfx and music', () => {
        const bundle = fresh();
        bundle.scenes.plain!.music = 'music/gone.mp3';
        bundle.cutscenes.use_rusty_sword_on_zombie = [{ sfx: 'no_such_sound' }, { music: 'no_such_tune' }, { music: 'stop' }];
        const only = (path: string) => !path.includes('gone') && !path.includes('no_such');

        const errors = validateGame(bundle, only).join('\n');
        expect(errors).toContain('scenes/plain.yml: music asset not found: assets/music/gone.mp3');
        expect(errors).toContain('step 1: sound not found: assets/sfx/no_such_sound.wav');
        expect(errors).toContain('step 2: music not found: assets/music/no_such_tune.mp3');
        expect(errors).not.toContain('stop');
    });
});
