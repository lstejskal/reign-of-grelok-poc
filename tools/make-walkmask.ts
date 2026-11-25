// Renders walkmask pictures from the `walkArea:` polygons in scene files.
//   npm run walkmask                      every scene of grelok that has a walkArea
//   npm run walkmask -- demo              every scene of another game
//   npm run walkmask -- grelok plain      just these scenes
// Check the result in the game with F1 (it draws the walk grid).
import fs from 'node:fs';
import path from 'node:path';
import { SCENE_HEIGHT, SCENE_WIDTH } from '../packages/engine/src';
import { GAMES_DIR, loadGameBundle } from '../packages/engine/node/loadGameBundle';
import { encodeWalkmask, renderWalkArea } from './walkmask';

const [gameId = 'grelok', ...only] = process.argv.slice(2);
const bundle = loadGameBundle(gameId);
const chosen = Object.entries(bundle.scenes).filter(([id, scene]) => scene.walkArea && (only.length === 0 || only.includes(id)));

for (const id of only) if (!bundle.scenes[id]?.walkArea) throw new Error(`scenes/${id}.yml has no walkArea`);
if (chosen.length === 0) console.log(`No scene of "${gameId}" has a walkArea yet.`);

for (const [id, scene] of chosen) {
    if (!scene.walkmask) throw new Error(`scenes/${id}.yml: walkArea needs a "walkmask:" path`);
    const pixels = renderWalkArea(scene.walkArea!, SCENE_WIDTH, SCENE_HEIGHT);
    const file = path.join(GAMES_DIR, gameId, 'assets', scene.walkmask);
    fs.writeFileSync(file, encodeWalkmask(pixels, SCENE_WIDTH, SCENE_HEIGHT));
    const floor = pixels.reduce((n, v) => n + (v ? 1 : 0), 0);
    console.log(`${id}: ${Math.round((100 * floor) / pixels.length)}% floor -> games/${gameId}/assets/${scene.walkmask}`);
}
