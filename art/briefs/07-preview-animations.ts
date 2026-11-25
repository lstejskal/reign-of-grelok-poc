import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { colorsFor, decodePng, encodePng, loadArtConfig, projectPath, sheetLayout, sizeHeights } from '../../tools/art/config.ts';
import { blank, chromaKey, contentBox, framesPalette, processPartsSheet, sliceGrid, unionBox } from '../../tools/art/pipeline.ts';
import type { Box, Raster } from '../../tools/art/pipeline.ts';

// Run from the repository root with node --import tsx art/briefs/07-preview-animations.ts.
// Preview files are diagnostic. This script reads the raw assets exactly as the game importer would.
const { values: args } = parseArgs({
    options: {
        partial: { type: 'boolean', default: false },
        'input-dir': { type: 'string' },
        'output-dir': { type: 'string', default: import.meta.dirname },
    },
});

function margins(box: Box | undefined, width: number, height: number) {
    return box && { left: box.x, top: box.y, right: width - box.x - box.w, bottom: height - box.y - box.h };
}

function pixelStats(raster: Raster) {
    const colors = new Set<number>();
    let opaque = 0;
    let partial = 0;
    for (let i = 0; i < raster.data.length; i += 4) {
        const [r, g, b, a] = raster.data.subarray(i, i + 4);
        if (a === 255) {
            opaque++;
            colors.add(r! * 65536 + g! * 256 + b!);
        } else if (a !== 0) {
            partial++;
        }
    }
    return { opaquePixels: opaque, partialAlphaPixels: partial, opaqueColors: colors.size };
}

function changedPixels(first: Raster, second: Raster) {
    let count = 0;
    for (let i = 0; i < first.data.length; i += 4) {
        const a = first.data[i + 3];
        const b = second.data[i + 3];
        const sameColor = first.data[i] === second.data[i] && first.data[i + 1] === second.data[i + 1] && first.data[i + 2] === second.data[i + 2];
        if (a !== b || (a !== 0 && !sameColor)) count++;
    }
    return count;
}

const config = loadArtConfig();
const asset = config.assets.find(spec => spec.id === 'grognak');
if (!asset?.frame || !asset.parts?.length) throw Error('No multipart Grognak asset in the manifest.');
const [frameW, frameH] = asset.frame;
const layout = sheetLayout(asset);
const options = { frameW, frameH, outlineColor: config.outline, method: asset.method, colors: colorsFor(asset, config.palette) };
const parts = asset.parts.map(part => {
    const filename = args['input-dir'] ? path.resolve(args['input-dir'], path.basename(part.rawPath)) : projectPath(part.rawPath);
    const raw = fs.existsSync(filename) ? decodePng(fs.readFileSync(filename)) : undefined;
    return { ...part, filename, raw };
});
const missing = parts.filter(part => !part.raw).map(part => part.filename);
if (missing.length && !args.partial) throw Error(`Missing raw sheets. Use --partial to check available parts.\n${missing.join('\n')}`);
const presentParts = new Set(parts.flatMap((part, i) => part.raw ? [i] : []));
if (!presentParts.size) throw Error('No raw sheets are available for preview.');

const slots = layout.slots.filter(slot => presentParts.has(slot.part));
const inputs = parts.map(({ raw, grid }) => ({ raw: raw ?? blank(...grid), grid }));
const cells = inputs.map(({ raw, grid }) => sliceGrid(raw, ...grid));
const rawFrames = slots.map(slot => cells[slot.part]![slot.cell]!);
const rawBounds = rawFrames.map(frame => contentBox(chromaKey(frame)));
const visibleBoxes = rawBounds.filter((box): box is Box => box !== undefined);
if (!visibleBoxes.length) throw Error('All present cells are empty after chroma key.');
const sharedBounds = unionBox(visibleBoxes);
const palette = asset.palette === 'shared' ? config.palette : framesPalette(rawFrames, options);
if (!palette?.length) throw Error('Could not build the shared frame palette.');

const perspectiveHeight = sizeHeights(asset).at(-1);
const sizes = perspectiveHeight ? [frameH, perspectiveHeight] : [frameH];
const previews = sizes.map(height => {
    const atlas = processPartsSheet(inputs, slots, layout.columns, layout.rows, { ...options, palette, fit: height / frameH });
    if (!atlas) throw Error(`No visible art at perspective height ${height}.`);
    return { height, atlas, frames: sliceGrid(atlas, layout.columns, layout.rows), png: encodePng(atlas) };
});
const animations = Object.fromEntries(Object.entries(layout.animations).filter(([, frames]) => slots.some(slot => slot.frame === frames[0])));
const report = {
    complete: missing.length === 0,
    purpose: 'Diagnostic preview. Visual review is separate.',
    missing,
    frameSize: [frameW, frameH],
    atlasGrid: [layout.columns, layout.rows],
    sharedRawBounds: sharedBounds,
    sharedImportScale: Math.min((frameW - 2) / sharedBounds.w, (frameH - 2) / sharedBounds.h),
    palette,
    parts: parts.map((part, index) => {
        if (!part.raw) return { name: part.name, path: part.rawPath, missing: true };
        const [cellW, cellH] = [cells[index]![0]!.width, cells[index]![0]!.height];
        return {
            name: part.name,
            path: part.rawPath,
            rawSize: [part.raw.width, part.raw.height],
            grid: part.grid,
            rawCellSize: [cellW, cellH],
            unusedTrailingColumns: part.raw.width % part.grid[0],
            unusedTrailingRows: part.raw.height % part.grid[1],
            cells: slots.flatMap((slot, i) => slot.part !== index ? [] : [{
                cell: slot.cell,
                atlasFrame: slot.frame,
                rawBounds: rawBounds[i] ?? null,
                rawMargins: margins(rawBounds[i], cellW, cellH) ?? null,
                outputs: previews.map(({ height, frames }) => {
                    const frame = frames[slot.frame]!;
                    const bounds = contentBox(frame);
                    return { height, bounds: bounds ?? null, margins: margins(bounds, frameW, frameH) ?? null, ...pixelStats(frame) };
                }),
            }]),
        };
    }),
    animations: Object.fromEntries(Object.entries(animations).map(([name, frames]) => [name, {
        frames,
        loopChanges: frames.length < 2 ? [] : frames.map((number, i) => {
            const next = frames[(i + 1) % frames.length]!;
            return { from: number, to: next, changedPixels: changedPixels(previews[0]!.frames[number]!, previews[0]!.frames[next]!) };
        }),
    }])),
    atlasStats: previews.map(({ height, atlas }) => ({ height, ...pixelStats(atlas) })),
};

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grognak animation preview</title>
<style>
body { background: #181824; color: #e9e7ed; font: 16px system-ui; margin: 2rem; }
button, select { font: inherit; }
img, canvas { image-rendering: pixelated; background: #81532c; }
img { display: block; max-width: none; }
section { margin-block: 1.5rem; }
.strip { overflow: auto; }
#loops { display: flex; flex-wrap: wrap; gap: 1rem; }
figure { margin: 0; }
figcaption { font-family: ui-monospace, monospace; }
</style>
<h1>Grognak animation preview</h1>
<p>${report.complete ? 'All six raw sheets' : 'Work in progress. Partial batch'} rendered with the game importer’s shared palette and fitting. Visual review is separate.</p>
<section>
  <label>Perspective <select id="size">${previews.map(({ height }) => `<option value="${height}">${height} px</option>`).join('')}</select></label>
  <button id="play" type="button">Pause</button>
  <button id="step" type="button">Next frame</button>
</section>
<section aria-label="Animation loops" id="loops"></section>
<section class="strip" aria-label="Contact sheet"><img id="contact" alt="Grognak’s animation frames in manifest order" width="${frameW * layout.columns * 2}" height="${frameH * layout.rows * 2}"></section>
<script>
const atlasSources = ${JSON.stringify(previews.map(({height,png}) => [height, 'data:image/png;base64,' + png.toString('base64')]))};
const groups = ${JSON.stringify(animations)};
const atlasImages = new Map(atlasSources.map(([height, source]) => {
    const image = new Image();
    image.src = source;
    return [height, image];
}));
const frameW = ${frameW}, frameH = ${frameH}, columns = ${layout.columns};
const size = document.querySelector('#size');
const contact = document.querySelector('#contact');
const play = document.querySelector('#play');
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let tick = 0;
let manualStep = 0;
const tracks = Object.entries(groups).map(([name, frames]) => {
    const figure = document.createElement('figure');
    const label = document.createElement('figcaption');
    label.textContent = name;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * 2;
    canvas.height = frameH * 2;
    figure.append(canvas, label);
    document.querySelector('#loops').append(figure);
    return { name, frames, context: canvas.getContext('2d') };
});
function draw() {
    const atlas = atlasImages.get(Number(size.value));
    if (!atlas.complete || !atlas.naturalWidth) return;
    for (const { name, frames, context } of tracks) {
        const hold = name.startsWith('walk') ? 1 : 4;
        const frame = frames[(Math.floor(tick / hold) + manualStep) % frames.length];
        context.clearRect(0, 0, frameW * 2, frameH * 2);
        context.imageSmoothingEnabled = false;
        context.drawImage(atlas, (frame % columns) * frameW, Math.floor(frame / columns) * frameH,
          frameW, frameH, 0, 0, frameW * 2, frameH * 2);
    }
}
function select() {
    const atlas = atlasImages.get(Number(size.value));
    contact.src = atlas.src;
    if (!atlas.complete) atlas.addEventListener('load', draw, { once: true });
    draw();
}
function label() { play.textContent = playing ? 'Pause' : 'Play'; }
size.addEventListener('change', select);
play.addEventListener('click', () => { playing = !playing; label(); });
document.querySelector('#step').addEventListener('click', () => { playing = false; label(); manualStep++; draw(); });
select(); label();
setInterval(() => { if (playing) { tick++; draw(); } }, 125);
</script>
</html>
`;

const outputDir = path.resolve(args['output-dir']!);
fs.mkdirSync(outputDir, { recursive: true });
const name = report.complete ? '07-animation-preview' : '07-animation-preview-partial';
for (const { height, png } of previews) fs.writeFileSync(path.join(outputDir, `${name}-${height}.png`), png);
fs.writeFileSync(path.join(outputDir, `${name}.html`), html);
fs.writeFileSync(path.join(outputDir, `${name}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(`${slots.length} frames rendered at ${sizes.join(' and ')} px. ${path.join(outputDir, `${name}.html`)}`);
