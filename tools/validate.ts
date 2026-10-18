// Checks a game's data files: `npm run validate` (or `npm run validate -- demo`).
import { validateGame } from '../packages/engine/src';
import { assetExistsFor, imageSizeFor, loadGameBundle } from '../packages/engine/node/loadGameBundle';

const id = process.argv[2] ?? 'grelok';

try {
    const bundle = loadGameBundle(id);
    const errors = validateGame(bundle, assetExistsFor(id), imageSizeFor(id));

    if (errors.length > 0) {
        console.error(`${errors.length} problem(s) in game "${id}":`);
        errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
    }

    const hotspots = Object.values(bundle.scenes).reduce((n, s) => n + s.hotspots.length, 0);
    console.log(`OK: "${id}" - ${Object.keys(bundle.logic.locations).length} locations, ${Object.keys(bundle.scenes).length} scenes, ${hotspots} hotspots`);
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
