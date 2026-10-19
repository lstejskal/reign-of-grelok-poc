// The art pipeline: turns pictures from an image generator (art/raw/<asset>.png) into finished game assets.
//   npm run import-art                  imports every asset that has a raw picture
//   npm run import-art -- <asset>...    imports just these
//   npm run import-art -- --list        shows every asset and whether it has a raw picture / was imported
//
// What happens to each picture is described in docs/learn/16-art-pipeline.md and coded in tools/art/pipeline.ts.
import fs from 'node:fs';
import path from 'node:path';
import { loadArtConfig, decodePng, encodePng, outputPath, projectPath } from './art/config';
import type { AssetSpec } from './art/config';
import { composeGrid, makeAtlas, processBackground, processFrames, sliceGrid } from './art/pipeline';
import type { Raster } from './art/pipeline';

const config = loadArtConfig();
const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));

if (args.includes('--list')) {
    for (const a of config.assets) {
        const raw = fs.existsSync(projectPath(a.rawPath));
        const done = fs.existsSync(outputPath(a));
        console.log(`${raw ? 'raw ready ' : 'no raw    '} ${a.id.padEnd(18)} ${a.type.padEnd(10)} -> ${a.game}/assets/${a.out}${raw && !done ? '  (not imported yet)' : ''}`);
    }
    process.exit(0);
}

for (const id of ids) if (!config.assets.some((a) => a.id === id)) throw new Error(`No asset "${id}" in art/assets.yml (try --list)`);
const chosen = ids.length > 0 ? config.assets.filter((a) => ids.includes(a.id)) : config.assets.filter((a) => fs.existsSync(projectPath(a.rawPath)));
if (chosen.length === 0) console.log('Nothing to import: put pictures into art/raw/<asset>.png (see --list).');

function write(file: string, data: Buffer | string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
}

function importAsset(asset: AssetSpec): string {
    const rawFile = projectPath(asset.rawPath);
    if (!fs.existsSync(rawFile)) throw new Error(`${asset.id}: missing ${asset.rawPath}`);
    const raw: Raster = decodePng(fs.readFileSync(rawFile));
    const common = { palette: config.palette, outlineColor: config.outline, method: asset.method };
    let result: Raster;

    if (asset.type === 'background') {
        const [w, h] = asset.size!;
        result = processBackground(raw, w, h, config.palette, asset.method ?? 'box', asset.dither ?? true);
    } else if (asset.type === 'sheet') {
        const [fw, fh] = asset.frame!;
        const [columns, rows] = asset.grid!;
        const frames = processFrames(sliceGrid(raw, columns, rows), { ...common, frameW: fw, frameH: fh });
        if (!frames) throw new Error(`${asset.id}: nothing left after removing the magenta background - is the background really flat #FF00FF?`);
        result = composeGrid(frames, columns);
        const atlas = makeAtlas(path.basename(asset.out), result, fw, fh, columns, rows, asset.animations);
        write(outputPath(asset).replace(/\.png$/, '.json'), JSON.stringify(atlas, null, 2) + '\n');
    } else {
        const [w, h] = asset.size!;
        const frames = processFrames([raw], { ...common, frameW: w, frameH: h, anchor: asset.type === 'icon' ? 'center' : 'bottom' });
        if (!frames) throw new Error(`${asset.id}: nothing left after removing the magenta background - is the background really flat #FF00FF?`);
        result = frames[0]!;
    }

    write(outputPath(asset), encodePng(result));
    return `${asset.id}: ${raw.width}x${raw.height} -> ${result.width}x${result.height}  games/${asset.game}/assets/${asset.out}`;
}

for (const asset of chosen) console.log(importAsset(asset));
