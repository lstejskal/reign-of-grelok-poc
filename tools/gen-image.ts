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
// One picture to generate. A multi-part sheet is several pictures, one per part.
interface Job { label: string; type: string; target: string; prompt: string; rawPath: string; sizing: { type: string; grid?: [number, number]; genSize?: string } }
const jobs: Job[] = config.assets.flatMap((asset): Job[] => {
    if (asset.parts) {
        return asset.parts.map((p) => ({
            label: `${asset.id} / ${p.name}`, type: 'sheet part', target: `${p.grid[0]}x${p.grid[1]} cells of ${asset.frame![0]}x${asset.frame![1]}`,
            prompt: p.prompt, rawPath: p.rawPath, sizing: { type: 'sheet', grid: p.grid, genSize: p.genSize },
        }));
    }
    const target = asset.type === 'sheet' ? `sheet ${asset.grid![0]}x${asset.grid![1]} frames` : `${asset.size![0]}x${asset.size![1]} px target`;
    return [{ label: asset.id, type: asset.type, target, prompt: asset.prompt, rawPath: asset.rawPath, sizing: asset }];
});
const chosen = jobs.filter((j) => (ids.length > 0 ? ids.includes(j.label.split(' / ')[0]!) : args.includes('--all') || !fs.existsSync(projectPath(j.rawPath))));

if (!settings) console.log('No IMAGE_API_KEY in .env, so only showing the prompts. Save each picture as the file named under it.\n');

for (const job of chosen) {
    const prompt = expandPrompt(job.prompt, config.fragments);
    const shape = sizeFor(job.sizing, settings?.size);
    if (!settings) {
        console.log(`== ${job.label}  (${job.type}, ${job.target}; ask for a ${shape} picture)\n   save as: ${job.rawPath}\n   ${prompt}\n`);
        continue;
    }
    process.stdout.write(`${job.label}: generating... `);
    fs.mkdirSync(projectPath('art/raw'), { recursive: true });
    fs.writeFileSync(projectPath(job.rawPath), await generate({ ...settings, size: shape }, prompt));
    console.log(`saved ${job.rawPath}`);
}
if (chosen.length === 0) console.log('Every asset already has a raw picture (use --all to list them anyway).');
