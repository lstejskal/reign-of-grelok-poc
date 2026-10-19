// Makes the raw pictures the pipeline needs.
//   npm run gen-image                  prompts of every asset that has no raw picture yet
//   npm run gen-image -- <asset>...    prompts of these assets
//   npm run gen-image -- --all         every asset (also those that already have a picture)
//
// With an image service configured in .env (see tools/art/imageApi.ts) the pictures are generated and saved into
// art/raw/. Without one, the prompts are just printed: paste each into any image generator you like and save the result
// as the file named under it. Either way, the next step is  npm run import-art.
import fs from 'node:fs';
import { expandPrompt, loadArtConfig, projectPath } from './art/config';
import { generate, readSettings, sizeFor } from './art/imageApi';

if (fs.existsSync(projectPath('.env'))) process.loadEnvFile(projectPath('.env'));

const config = loadArtConfig();
const settings = readSettings(process.env);
const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));

for (const id of ids) if (!config.assets.some((a) => a.id === id)) throw new Error(`No asset "${id}" in art/assets.yml`);
const chosen = config.assets.filter((a) => (ids.length > 0 ? ids.includes(a.id) : args.includes('--all') || !fs.existsSync(projectPath(a.rawPath))));

if (!settings) console.log('No IMAGE_API_KEY in .env, so only showing the prompts. Save each picture as the file named under it.\n');

for (const asset of chosen) {
    const prompt = expandPrompt(asset.prompt, config.fragments);
    const target = asset.type === 'sheet' ? `sheet ${asset.grid![0]}x${asset.grid![1]} frames` : `${asset.size![0]}x${asset.size![1]} px target`;
    const shape = sizeFor(asset, settings?.size);
    if (!settings) {
        console.log(`== ${asset.id}  (${asset.type}, ${target}; ask for a ${shape} picture)\n   save as: ${asset.rawPath}\n   ${prompt}\n`);
        continue;
    }
    process.stdout.write(`${asset.id}: generating... `);
    fs.mkdirSync(projectPath('art/raw'), { recursive: true });
    fs.writeFileSync(projectPath(asset.rawPath), await generate({ ...settings, size: shape }, prompt));
    console.log(`saved ${asset.rawPath}`);
}
if (chosen.length === 0) console.log('Every asset already has a raw picture (use --all to list them anyway).');
