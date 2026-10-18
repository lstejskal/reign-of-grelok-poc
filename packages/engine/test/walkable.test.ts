import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { GAMES_DIR, loadGameBundle } from '../node/loadGameBundle';
// The grid code lives in the client (it is presentation), but it is plain TypeScript, so a data test can use it.
import { gridFromMask, isWalkable } from '../../client/src/walk/pathfinding';

// Every point where the player is told to stand must be on walkable floor, or he would be placed inside an obstacle.
describe('grelok walkmasks', () => {
    const bundle = loadGameBundle('grelok');

    for (const [location, scene] of Object.entries(bundle.scenes)) {
        it(`${location}: every walkTo, spawn and start point is on the floor`, () => {
            const file = path.join(GAMES_DIR, 'grelok', 'assets', scene.walkmask!);
            const png = PNG.sync.read(fs.readFileSync(file));
            const grid = gridFromMask({ width: png.width, height: png.height, data: png.data });

            const points: [string, [number, number]][] = [
                ...scene.hotspots.map((h): [string, [number, number]] => [`hotspot ${h.id} walkTo`, h.walkTo]),
                ...scene.exits.flatMap((e): [string, [number, number]][] => [
                    [`exit ${e.direction} walkTo`, e.walkTo],
                    [`exit ${e.direction} spawn`, e.spawn],
                ]),
            ];
            if (location === bundle.config.start && bundle.config.startPosition) points.push(['startPosition', bundle.config.startPosition]);

            const blocked = points.filter(([, point]) => !isWalkable(grid, point)).map(([name]) => name);
            expect(blocked).toEqual([]);
        });
    }
});
