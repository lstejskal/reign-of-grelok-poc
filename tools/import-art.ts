// The art pipeline: turns pictures from an image generator (art/raw/<asset>.png) into finished game assets.
//   npm run import-art                  imports every asset that has a raw picture
//   npm run import-art -- <asset>...    imports just these
//   npm run import-art -- --list        shows every asset and whether it has a raw picture / was imported
//
// What happens to each picture is described in docs/learn/16-art-pipeline.md and coded in tools/art/pipeline.ts.
import fs from 'node:fs';
import path from 'node:path';
import { colorsFor, loadArtConfig, decodePng, encodePng, outputPath, projectPath, rawPathsOf, sheetLayout } from './art/config';
import type { AssetSpec } from './art/config';
import { composeGrid, makeAtlas, processBackground, processFrames, processPartsSheet, sliceGrid } from './art/pipeline';
import type { Raster } from './art/pipeline';

const config = loadArtConfig();
const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
/** An asset is ready to import once every raw picture it is made from exists. */
const hasRaw = (a: AssetSpec) => rawPathsOf(a).every((p) => fs.existsSync(projectPath(p)));

if (args.includes('--list')) {
    for (const a of config.assets) {
        const raw = hasRaw(a);
        const done = fs.existsSync(outputPath(a));
        console.log(`${raw ? 'raw ready ' : 'no raw    '} ${a.id.padEnd(18)} ${a.type.padEnd(10)} -> ${a.game}/assets/${a.out}${raw && !done ? '  (not imported yet)' : ''}`);
    }
    process.exit(0);
}

for (const id of ids) if (!config.assets.some((a) => a.id === id)) throw new Error(`No asset "${id}" in art/assets.yml (try --list)`);
const chosen = ids.length > 0 ? config.assets.filter((a) => ids.includes(a.id)) : config.assets.filter(hasRaw);
if (chosen.length === 0) console.log('Nothing to import: put pictures into art/raw/<asset>.png (see --list).');

function write(file: string, data: Buffer | string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
}

/** A sheet made of several pictures: one per part, all frames treated together (see processPartsSheet). */
function importPartsSheet(asset: AssetSpec): string {
    const [fw, fh] = asset.frame!;
    const layout = sheetLayout(asset);
    const parts = asset.parts!.map((p) => {
        if (!fs.existsSync(projectPath(p.rawPath))) throw new Error(`${asset.id}: missing ${p.rawPath} (part "${p.name}")`);
        return { raw: decodePng(fs.readFileSync(projectPath(p.rawPath))), grid: p.grid };
    });
    const palette = asset.palette === 'shared' ? config.palette : undefined;
    const result = processPartsSheet(parts, layout.slots, layout.columns, layout.rows, {
        palette, outlineColor: config.outline, method: asset.method, colors: colorsFor(asset, config.palette), frameW: fw, frameH: fh,
    });
    if (!result) throw new Error(`${asset.id}: nothing left after removing the magenta background - is the background really flat #FF00FF?`);
    write(outputPath(asset), encodePng(result));
    const atlas = makeAtlas(path.basename(asset.out), result, fw, fh, layout.columns, layout.rows, layout.animations);
    write(outputPath(asset).replace(/\.png$/, '.json'), JSON.stringify(atlas, null, 2) + '\n');
    // the game reads its animations from game.yml: this is the block that matches this sheet
    const table = Object.entries(layout.animations).map(([name, frames]) => `    ${name}: [${frames.join(', ')}]`).join('\n');
    return `${asset.id}: ${parts.length} parts -> ${result.width}x${result.height}  games/${asset.game}/assets/${asset.out}\n` +
        `  game.yml player: columns: ${layout.columns}, animations:\n${table}`;
}

function importAsset(asset: AssetSpec): string {
    if (asset.parts) return importPartsSheet(asset);
    const rawFile = projectPath(asset.rawPath);
    if (!fs.existsSync(rawFile)) throw new Error(`${asset.id}: missing ${asset.rawPath}`);
    const raw: Raster = decodePng(fs.readFileSync(rawFile));
    const palette = asset.palette === 'shared' ? config.palette : undefined; // otherwise each picture gets its own colours
    const common = { palette, outlineColor: config.outline, method: asset.method, colors: colorsFor(asset, config.palette) };
    let result: Raster;

    if (asset.type === 'background') {
        const [w, h] = asset.size!;
        result = processBackground(raw, w, h, { palette, colors: colorsFor(asset, config.palette), method: asset.method, dither: asset.dither, focus: asset.focus });
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
