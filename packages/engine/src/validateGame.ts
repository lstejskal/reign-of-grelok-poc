import { ART_SCALE, ICON_HEIGHT, ICON_WIDTH, MAX_VERBS, MAX_VERB_LABEL, PLAYER_FACING_ROWS, PLAYER_SHEET_COLUMNS, REQUIRED_PLAYER_ANIMATIONS, playerSizeSheet, SCENE_HEIGHT, SCENE_WIDTH, iconPath, musicPath, sfxPath } from './sceneTypes';
import type { GameBundle, VerbSpec } from './sceneTypes';
import { parseStep } from './cutscene';

/**
 * Checks that a game's data hangs together: every location has a scene, every hotspot points at a real
 * thing, every exit matches the location's directions, every referenced asset exists...
 * Returns a list of human-readable problems (empty = all good).
 *
 * `assetExists` takes a path relative to the game's `assets/` folder; the caller decides how to check.
 * `imageSize` (optional) lets the caller also have background / walkmask image dimensions verified.
 */
export function validateGame(
    bundle: GameBundle,
    assetExists: (assetPath: string) => boolean,
    imageSize?: (assetPath: string) => { width: number; height: number } | undefined,
): string[] {
    const errors: string[] = [];
    const { config, logic, scenes } = bundle;
    const problem = (where: string, message: string) => errors.push(`${where}: ${message}`);

    if (!config?.title) problem('game.yml', 'missing "title"');
    if (!config || !(config.start in logic.locations)) problem('game.yml', `start location "${config?.start}" does not exist`);

    const player = config?.player;
    if (!player) {
        problem('game.yml', 'missing "player" (sprite, frameWidth, frameHeight)');
    } else {
        const { sprite, frameWidth, frameHeight } = player;
        if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight) || frameWidth <= 0 || frameHeight <= 0) {
            problem('game.yml', 'player frameWidth and frameHeight must be positive whole numbers');
        } else if (!assetExists(sprite)) {
            problem('game.yml', `player sprite not found: assets/${sprite}`);
        } else if (player.animations === undefined) {
            const size = imageSize?.(sprite);
            const [w, h] = [frameWidth * PLAYER_SHEET_COLUMNS, frameHeight * PLAYER_FACING_ROWS.length];
            if (size !== undefined && (size.width !== w || size.height !== h)) {
                problem('game.yml', `player sprite sheet must be ${w}x${h} pixels (${PLAYER_SHEET_COLUMNS} columns x ${PLAYER_FACING_ROWS.length} rows of ${frameWidth}x${frameHeight}), but assets/${sprite} is ${size.width}x${size.height}`);
            }
        } else {
            // a sheet with named animations: `columns` frames per row, as many rows as it needs
            const columns = player.columns ?? PLAYER_SHEET_COLUMNS;
            const size = imageSize?.(sprite);
            let frames = Infinity;
            if (size !== undefined) {
                if (size.width !== frameWidth * columns || size.height % frameHeight !== 0) {
                    problem('game.yml', `player sprite sheet must be ${frameWidth * columns} pixels wide (${columns} columns of ${frameWidth}) and a whole number of ${frameHeight}-pixel rows high, but assets/${sprite} is ${size.width}x${size.height}`);
                }
                frames = columns * Math.floor(size.height / frameHeight);
            }
            for (const name of REQUIRED_PLAYER_ANIMATIONS) {
                if (!(name in player.animations)) problem('game.yml', `player animations: missing "${name}"`);
            }
            for (const [name, list] of Object.entries(player.animations)) {
                if (!Array.isArray(list) || list.length === 0) problem('game.yml', `player animation "${name}" needs a list of frame numbers`);
                else if (!list.every((i) => Number.isInteger(i) && i >= 0 && i < frames)) problem('game.yml', `player animation "${name}" uses frames outside the sheet (it has ${frames})`);
            }
        }
        if (player.sizes !== undefined) {
            const sizes = player.sizes;
            const ok = Array.isArray(sizes) && sizes.every((h, i) => Number.isInteger(h) && h > 0 && h < frameHeight && (i === 0 || h < sizes[i - 1]!));
            if (!ok) problem('game.yml', `player sizes must be whole numbers below frameHeight (${frameHeight}), largest first`);
            const main = assetExists(sprite) ? imageSize?.(sprite) : undefined;
            for (const h of Array.isArray(sizes) ? sizes : []) {
                const file = playerSizeSheet(sprite, h);
                if (!assetExists(file)) {
                    problem('game.yml', `player size ${h} not found: assets/${file} (npm run import-art writes it)`);
                    continue;
                }
                const size = imageSize?.(file);
                if (main && size && (size.width !== main.width || size.height !== main.height)) {
                    problem('game.yml', `assets/${file} must be the same size as assets/${sprite} (${main.width}x${main.height}), but is ${size.width}x${size.height}`);
                }
            }
        }
        if (player.walkStride !== undefined && !(typeof player.walkStride === 'number' && player.walkStride > 0)) {
            problem('game.yml', `player walkStride must be a number above 0, got ${JSON.stringify(player.walkStride)}`);
        }
    }
    if (config?.startPosition !== undefined) checkPoint(config.startPosition, 'startPosition', 'game.yml', problem);

    // everything the player can carry is shown in the inventory, so it needs an icon
    for (const thing of Object.values(logic.things)) {
        if (!thing.pickable) continue;
        const icon = iconPath(thing.alias);
        if (!assetExists(icon)) {
            problem(`things.yml`, `pickable thing "${thing.alias}" has no icon: assets/${icon}`);
            continue;
        }
        const size = imageSize?.(icon);
        if (size !== undefined && (size.width !== ICON_WIDTH * ART_SCALE || size.height !== ICON_HEIGHT * ART_SCALE)) {
            problem(`things.yml`, `icon must be ${ICON_WIDTH * ART_SCALE}x${ICON_HEIGHT * ART_SCALE} pixels, but assets/${icon} is ${size.width}x${size.height}`);
        }
    }

    checkVerbs(config?.verbs, problem);

    const { speakers } = bundle;
    if (!(speakers.default in speakers.speakers)) problem('speakers.yml', `default speaker "${speakers.default}" is not listed under speakers`);
    for (const [id, speaker] of Object.entries(speakers.speakers)) {
        const where = `speakers.yml (${id})`;
        if (!/^#[0-9a-fA-F]{6}$/.test(speaker.color ?? '')) problem(where, `color must look like "#rrggbb", not "${speaker.color}"`);
        if (!speaker.name) problem(where, 'missing "name"');
        for (const thing of [speaker.thing, ...(speaker.topics ?? [])]) {
            if (thing !== undefined && !(thing in logic.things)) problem(where, `there is no thing "${thing}" in logic/things.yml`);
        }
        // The talk menu sends "talk to X" / "ask X about Y"; these naming rules are how the data answers them
        const answered = (key: string) => key in logic.messages || key in logic.customActions;
        if (speaker.thing !== undefined && speaker.thing in logic.things) {
            if (!answered(`talk_to_${speaker.thing}`)) {
                problem(where, `nobody answers "talk to ${speaker.thing}": add a "talk_to_${speaker.thing}" message (or custom action)`);
            }
            for (const topic of speaker.topics ?? []) {
                if (!answered(`ask_${speaker.thing}_about_${topic}`) && !answered(`ask_${speaker.thing}_about_anything`)) {
                    problem(where, `nobody answers "ask ${speaker.thing} about ${topic}": add "ask_${speaker.thing}_about_${topic}" (or a catch-all "ask_${speaker.thing}_about_anything") to messages.yml`);
                }
            }
        }
        for (const pattern of speaker.messages ?? []) {
            const matches = Object.keys(logic.messages).some((key) => pattern.endsWith('*') ? key.startsWith(pattern.slice(0, -1)) : key === pattern);
            if (!matches) problem(where, `message pattern "${pattern}" matches no message in logic/messages.yml`);
        }
    }

    for (const [key, steps] of Object.entries(bundle.cutscenes)) {
        const where = `cutscenes.yml (${key})`;
        if (!(key in logic.messages)) problem(where, `"${key}" is not a message key in logic/messages.yml (a cutscene is announced by the message the engine says)`);
        if (!Array.isArray(steps) || steps.length === 0) {
            problem(where, 'needs a list of steps');
            continue;
        }
        steps.forEach((raw, i) => {
            const parsed = parseStep(raw);
            if ('error' in parsed) return problem(where, `step ${i + 1}: ${parsed.error}`);
            const { step } = parsed;
            if (step.type === 'narrate' && step.message !== undefined && !(step.message in logic.messages)) {
                problem(where, `step ${i + 1}: no message "${step.message}" in logic/messages.yml`);
            }
            if (step.type === 'sfx' && !assetExists(sfxPath(step.name))) problem(where, `step ${i + 1}: sound not found: assets/${sfxPath(step.name)}`);
            if (step.type === 'music' && step.name !== 'stop' && !assetExists(musicPath(step.name))) problem(where, `step ${i + 1}: music not found: assets/${musicPath(step.name)}`);
            if (step.type === 'say' && !(step.speaker in speakers.speakers)) problem(where, `step ${i + 1}: unknown speaker "${step.speaker}"`);
        });
    }

    for (const id of Object.keys(scenes)) {
        if (!(id in logic.locations)) problem(`scenes/${id}.yml`, 'there is no such location in logic/locations.yml');
    }

    for (const [locationId, location] of Object.entries(logic.locations)) {
        const where = `scenes/${locationId}.yml`;
        const scene = scenes[locationId];
        if (scene === undefined) {
            problem(where, 'missing scene file for this location');
            continue;
        }

        for (const [field, path] of [['background', scene.background], ['walkmask', scene.walkmask], ['music', scene.music]] as const) {
            if (path !== undefined && !assetExists(path)) problem(where, `${field} asset not found: assets/${path}`);
        }
        // a background and its walkmask cover exactly the scene area: the background is art (ART_SCALE picture pixels
        // per scene pixel), the walkmask is not (one mask pixel per scene pixel)
        for (const [field, path, k] of [['background', scene.background, ART_SCALE], ['walkmask', scene.walkmask, 1]] as const) {
            const size = path !== undefined && assetExists(path) ? imageSize?.(path) : undefined;
            const [w, h] = [SCENE_WIDTH * k, SCENE_HEIGHT * k];
            if (size !== undefined && (size.width !== w || size.height !== h)) {
                problem(where, `${field} must be ${w}x${h} pixels, but assets/${path} is ${size.width}x${size.height}`);
            }
        }
        if (scene.walkArea !== undefined) {
            if (scene.walkmask === undefined) problem(where, 'walkArea needs a "walkmask:" path to be rendered into');
            const { floor, blocked = [] } = scene.walkArea;
            if (!Array.isArray(floor) || floor.length === 0) problem(where, 'walkArea: "floor" needs at least one polygon');
            const inScene = ([x, y]: [number, number]) => x >= 0 && x <= SCENE_WIDTH && y >= 0 && y <= SCENE_HEIGHT;
            for (const [kind, polygons] of [['floor', floor ?? []], ['blocked', blocked]] as const) {
                polygons.forEach((polygon, i) => {
                    if (!Array.isArray(polygon) || polygon.length < 3) return problem(where, `walkArea ${kind} polygon ${i + 1} needs at least 3 points`);
                    if (!polygon.every(inScene)) problem(where, `walkArea ${kind} polygon ${i + 1} has points outside the scene (0-${SCENE_WIDTH}, 0-${SCENE_HEIGHT})`);
                });
            }
        }
        if (scene.scale !== undefined) {
            const { top, bottom } = scene.scale;
            if (![top, bottom].every((n) => typeof n === 'number' && n > 0 && n <= 2)) {
                problem(where, `scale: "top" and "bottom" must be numbers above 0 and at most 2, got ${JSON.stringify(scene.scale)}`);
            }
        }
        const spriteIds = new Set<string>();
        for (const sprite of scene.sprites ?? []) {
            const label = `sprite "${sprite.id}"`;
            if (!sprite.id) problem(where, 'a sprite has no "id"');
            if (spriteIds.has(sprite.id)) problem(where, `${label}: defined twice`);
            spriteIds.add(sprite.id);
            checkPoint([sprite.x, sprite.y], `${label} x, y`, where, problem);
            if (sprite.depth !== undefined && typeof sprite.depth !== 'number') problem(where, `${label}: depth must be a number (a y to sort by)`);
            if (sprite.thing !== undefined && !(sprite.thing in logic.things)) problem(where, `${label}: unknown thing "${sprite.thing}"`);
            if (!sprite.states?.length) problem(where, `${label}: needs "states" (or a single "image")`);
            for (const state of sprite.states ?? []) {
                if (!assetExists(state.image)) problem(where, `${label}: image not found: assets/${state.image}`);
                for (const name of Object.keys(state.when ?? {})) {
                    if (!(name in logic.constraints.boolean)) problem(where, `${label}: "when" uses unknown constraint "${name}" (see logic/constraints.yml)`);
                }
            }
        }

        // hotspots
        const seen = new Set<string>();
        for (const hotspot of scene.hotspots) {
            const label = `hotspot "${hotspot.id}"`;
            if (!(hotspot.id in logic.things)) problem(where, `${label}: no such thing in logic/things.yml`);
            if (seen.has(hotspot.id)) problem(where, `${label}: defined twice`);
            seen.add(hotspot.id);
            checkPolygon(hotspot.polygon, `${label} polygon`, where, problem);
            checkPoint(hotspot.walkTo, `${label} walkTo`, where, problem);
        }

        // things that start in this location need a hotspot, or the player could never interact with them
        for (const thing of Object.values(logic.things)) {
            if (thing.location === locationId && !seen.has(thing.alias)) problem(where, `thing "${thing.alias}" starts here but has no hotspot`);
        }

        // exits must match the directions in logic/locations.yml, one to one
        const exitDirections = new Set<string>();
        for (const exit of scene.exits) {
            const label = `exit "${exit.direction}"`;
            if (!(exit.direction in location.directions)) problem(where, `${label}: location has no such direction`);
            if (exitDirections.has(exit.direction)) problem(where, `${label}: defined twice`);
            exitDirections.add(exit.direction);
            checkPolygon(exit.polygon, `${label} polygon`, where, problem);
            checkPoint(exit.walkTo, `${label} walkTo`, where, problem);
            checkPoint(exit.spawn, `${label} spawn`, where, problem);
        }
        for (const direction of Object.keys(location.directions)) {
            if (!exitDirections.has(direction)) problem(where, `direction "${direction}" has no exit`);
        }
    }

    return errors;
}

type Report = (where: string, message: string) => void;

function checkVerbs(verbs: unknown, report: Report): void {
    if (verbs === undefined) return; // the engine's default buttons
    if (!Array.isArray(verbs) || verbs.length === 0) return report('game.yml', '"verbs" must be a list of buttons');
    if (verbs.length > MAX_VERBS) report('game.yml', `"verbs" has ${verbs.length} buttons but only ${MAX_VERBS} fit on screen`);
    const seen = new Set<string>();
    verbs.forEach((spec: Partial<VerbSpec>, i) => {
        const label = `verbs[${i + 1}]`;
        if (typeof spec?.verb !== 'string' || !/^[a-z][a-z_]*$/.test(spec.verb)) return report('game.yml', `${label}: "verb" must be lower_snake_case, like "pick_up"`);
        if (seen.has(spec.verb)) report('game.yml', `${label}: verb "${spec.verb}" listed twice`);
        seen.add(spec.verb);
        if (typeof spec.label !== 'string' || spec.label === '' || spec.label.length > MAX_VERB_LABEL) {
            report('game.yml', `${label}: "label" must be 1-${MAX_VERB_LABEL} characters to fit the button`);
        }
        if (spec.objects !== 1 && spec.objects !== 2) report('game.yml', `${label}: "objects" must be 1 or 2`);
        if (spec.objects === 2 && !spec.preposition) report('game.yml', `${label}: a two-object verb needs a "preposition" ("with", "to"...)`);
    });
}

function isPoint(value: unknown): boolean {
    return (
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((n) => typeof n === 'number') &&
        value[0] >= 0 && value[0] <= SCENE_WIDTH &&
        value[1] >= 0 && value[1] <= SCENE_HEIGHT
    );
}

function checkPoint(point: unknown, label: string, where: string, report: Report): void {
    if (!isPoint(point)) report(where, `${label}: expected [x, y] inside ${SCENE_WIDTH}x${SCENE_HEIGHT}, got ${JSON.stringify(point)}`);
}

function checkPolygon(polygon: unknown, label: string, where: string, report: Report): void {
    if (!Array.isArray(polygon) || polygon.length < 3 || !polygon.every(isPoint)) {
        report(where, `${label}: expected at least 3 [x, y] points inside ${SCENE_WIDTH}x${SCENE_HEIGHT}`);
    }
}
