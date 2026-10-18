import { ICON_HEIGHT, ICON_WIDTH, PLAYER_FACING_ROWS, PLAYER_SHEET_COLUMNS, SCENE_HEIGHT, SCENE_WIDTH, iconPath } from './sceneTypes';
import type { GameBundle } from './sceneTypes';

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
        } else {
            const size = imageSize?.(sprite);
            const [w, h] = [frameWidth * PLAYER_SHEET_COLUMNS, frameHeight * PLAYER_FACING_ROWS.length];
            if (size !== undefined && (size.width !== w || size.height !== h)) {
                problem('game.yml', `player sprite sheet must be ${w}x${h} pixels (${PLAYER_SHEET_COLUMNS} columns x ${PLAYER_FACING_ROWS.length} rows of ${frameWidth}x${frameHeight}), but assets/${sprite} is ${size.width}x${size.height}`);
            }
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
        if (size !== undefined && (size.width !== ICON_WIDTH || size.height !== ICON_HEIGHT)) {
            problem(`things.yml`, `icon must be ${ICON_WIDTH}x${ICON_HEIGHT} pixels, but assets/${icon} is ${size.width}x${size.height}`);
        }
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
        // a background and its walkmask cover exactly the scene area, one image pixel per game pixel
        for (const [field, path] of [['background', scene.background], ['walkmask', scene.walkmask]] as const) {
            const size = path !== undefined && assetExists(path) ? imageSize?.(path) : undefined;
            if (size !== undefined && (size.width !== SCENE_WIDTH || size.height !== SCENE_HEIGHT)) {
                problem(where, `${field} must be ${SCENE_WIDTH}x${SCENE_HEIGHT} pixels, but assets/${path} is ${size.width}x${size.height}`);
            }
        }
        if (scene.scale !== undefined) {
            const { top, bottom } = scene.scale;
            if (![top, bottom].every((n) => typeof n === 'number' && n > 0 && n <= 2)) {
                problem(where, `scale: "top" and "bottom" must be numbers above 0 and at most 2, got ${JSON.stringify(scene.scale)}`);
            }
        }
        for (const sprite of scene.sprites ?? []) {
            if (!assetExists(sprite.image)) problem(where, `sprite asset not found: assets/${sprite.image}`);
            if (sprite.thing !== undefined && !(sprite.thing in logic.things)) problem(where, `sprite refers to unknown thing "${sprite.thing}"`);
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
