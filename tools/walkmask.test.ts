import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { SCENE_HEIGHT, SCENE_WIDTH } from '../packages/engine/src';
import { GAMES_DIR, loadGameBundle } from '../packages/engine/node/loadGameBundle';
import { encodeWalkmask, renderWalkArea } from './walkmask';

describe('renderWalkArea', () => {
    it('fills a floor polygon and cuts out a blocked one', () => {
        // a 6x4 floor with a 2x2 hole in it
        const pixels = renderWalkArea({ floor: [[[0, 0], [6, 0], [6, 4], [0, 4]]], blocked: [[[2, 1], [4, 1], [4, 3], [2, 3]]] }, 8, 5);
        const rows = [...Array(5).keys()].map((y) => [...pixels.slice(y * 8, y * 8 + 8)].map((v) => (v ? '#' : '.')).join(''));
        expect(rows).toEqual(['######..', '##..##..', '##..##..', '######..', '........']);
    });

    it('encodes a grayscale PNG that reads back the same', () => {
        const pixels = renderWalkArea({ floor: [[[0, 0], [3, 0], [0, 3]]] }, 4, 4);
        const png = PNG.sync.read(encodeWalkmask(pixels, 4, 4));
        expect([...Array(16).keys()].map((i) => png.data[i * 4])).toEqual([...pixels]);
    });
});

// The walkmask picture must be what its polygons say: edit the scene file, then run `npm run walkmask`.
describe('walkmask pictures are up to date with their walkArea', () => {
    for (const gameId of ['grelok', 'demo']) {
        for (const [id, scene] of Object.entries(loadGameBundle(gameId).scenes)) {
            if (!scene.walkArea) continue;
            it(`${gameId}/${id}`, () => {
                const png = PNG.sync.read(fs.readFileSync(path.join(GAMES_DIR, gameId, 'assets', scene.walkmask!)));
                const expected = renderWalkArea(scene.walkArea!, SCENE_WIDTH, SCENE_HEIGHT);
                const actual = Uint8Array.from({ length: expected.length }, (_, i) => png.data[i * 4]!);
                expect(actual.every((v, i) => v === expected[i]), 'run `npm run walkmask` after changing walkArea').toBe(true);
            });
        }
    }
});
