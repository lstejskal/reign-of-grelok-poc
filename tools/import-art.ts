// The art pipeline: turns pictures from an image generator (art/raw/<asset>.png) into finished game assets.
//   npm run import-art                  imports every asset that has a raw picture
//   npm run import-art -- <asset>...    imports just these
//   npm run import-art -- --list        shows every asset and whether it has a raw picture / was imported
//
// What happens to each picture is described in docs/learn/16-art-pipeline.md and coded in tools/art/pipeline.ts.
import fs from 'node:fs';
import path from 'node:path';
import { colorsFor, loadArtConfig, decodePng, encodePng, outputPath, projectPath, rawPathsOf, sheetLayout, sizeHeights } from './art/config';
import type { AssetSpec } from './art/config';
import { framesPalette, makeAtlas, partCells, processBackground, processFrames, processPartsSheet } from './art/pipeline';
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

/**
 * A sheet: one picture cut into a grid, or several pictures (`parts:`) with every frame treated together (see
 * processPartsSheet). With `sizes:` it is also written at smaller sizes (<out>_<height>.png), each shrunk from the
 * raw pictures with the same palette, so the game can show the character in perspective without scaling him itself.
 */
function importSheet(asset: AssetSpec): string {
    const [fw, fh] = asset.frame!;
    const rawOf = (file: string, what: string) => {
        if (!fs.existsSync(projectPath(file))) throw new Error(`${asset.id}: missing ${file}${what}`);
        return decodePng(fs.readFileSync(projectPath(file)));
    };
    let parts: { raw: Raster; grid: [number, number] }[];
    let layout: { columns: number; rows: number; slots: { part: number; cell: number; frame: number }[]; animations?: Record<string, number[]> };
    if (asset.parts) {
        parts = asset.parts.map((p) => ({ raw: rawOf(p.rawPath, ` (part "${p.name}")`), grid: p.grid }));
        layout = sheetLayout(asset);
    } else {
        const [columns, rows] = asset.grid!;
        parts = [{ raw: rawOf(asset.rawPath, ''), grid: [columns, rows] }];
        layout = { columns, rows, slots: Array.from({ length: columns * rows }, (_, i) => ({ part: 0, cell: i, frame: i })), animations: asset.animations };
    }
    const options = { outlineColor: config.outline, method: asset.method, colors: colorsFor(asset, config.palette), frameW: fw, frameH: fh };
    // one palette for every size: chosen from all the frames this sheet uses (made comparable first, see partCells)
    const palette = asset.palette === 'shared' ? config.palette : framesPalette(partCells(parts, layout.slots), options);
    const render = (fit: number) => {
        const sheet = palette && processPartsSheet(parts, layout.slots, layout.columns, layout.rows, { ...options, palette, fit });
        if (!sheet) throw new Error(`${asset.id}: nothing left after removing the magenta background - is the background really flat #FF00FF?`);
        return sheet;
    };

    const result = render(1);
    write(outputPath(asset), encodePng(result));
    const atlas = makeAtlas(path.basename(asset.out), result, fw, fh, layout.columns, layout.rows, layout.animations);
    write(outputPath(asset).replace(/\.png$/, '.json'), JSON.stringify(atlas, null, 2) + '\n');
    const heights = sizeHeights(asset);
    for (const h of heights) write(outputPath(asset).replace(/\.png$/, `_${h}.png`), encodePng(render(h / fh)));

    let report = `${asset.id}: ${parts.length} picture(s) -> ${result.width}x${result.height}  games/${asset.game}/assets/${asset.out}`;
    if (heights.length > 0) report += ` + ${heights.length} smaller sizes (_${heights[0]} .. _${heights.at(-1)})`;
    // the game reads these from game.yml (player:): print the lines that match this sheet
    if (asset.parts) {
        const table = Object.entries(layout.animations ?? {}).map(([name, frames]) => `    ${name}: [${frames.join(', ')}]`).join('\n');
        report += `\n  game.yml player: columns: ${layout.columns}, animations:\n${table}`;
    }
    if (heights.length > 0) report += `\n  game.yml player: sizes: [${heights.join(', ')}]`;
    return report;
}

function importAsset(asset: AssetSpec): string {
    if (asset.type === 'sheet') return importSheet(asset);
    const rawFile = projectPath(asset.rawPath);
    if (!fs.existsSync(rawFile)) throw new Error(`${asset.id}: missing ${asset.rawPath}`);
    const raw: Raster = decodePng(fs.readFileSync(rawFile));
    const palette = asset.palette === 'shared' ? config.palette : undefined; // otherwise each picture gets its own colours
    const common = { palette, outlineColor: config.outline, method: asset.method, colors: colorsFor(asset, config.palette) };
    let result: Raster;

    if (asset.type === 'background') {
        const [w, h] = asset.size!;
        result = processBackground(raw, w, h, { palette, colors: colorsFor(asset, config.palette), method: asset.method, dither: asset.dither, focus: asset.focus });
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
