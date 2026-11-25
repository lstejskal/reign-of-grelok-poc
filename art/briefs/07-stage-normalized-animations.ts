import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decodePng, encodePng, loadArtConfig, projectPath } from '../../tools/art/config.ts';
import { blank, chromaKey, composeGrid, contentBox, crop } from '../../tools/art/pipeline.ts';
import type { Raster } from '../../tools/art/pipeline.ts';

// Run only once the drawings have passed visual review.
// node --import tsx art/briefs/07-stage-normalized-animations.ts <measured-fit.json>
// Input shape: { "parts": { "walk_e": { "sha256": "…", "scale": 0.9,
//   "sourcePelvisX": 180, "sourceBaselineY": 640 }, … } }
// Source anchors are measured from the nominal cell origin. Optional colCuts/rowCuts
// are global source boundaries through blank gutters, and do not move those origins.
// For a deliberate extra translation, optional cellOffsets use fitted pixel units,
// row-major order. Repeated boot/head offsets should stay in the art itself.
// Output remains staged under art/briefs. This script never promotes or imports it.

interface PartFit {
    sha256: string;
    scale: number;
    sourcePelvisX: number;
    sourceBaselineY: number;
    colCuts?: number[];
    rowCuts?: number[];
    cellOffsets?: [number, number][];
    // A generated three-pose strip can replace the side walk's second row.
    replacementRows?: Record<number, Omit<PartFit, 'replacementRows' | 'cellOffsets'> & { rawPath: string }>;
}

interface FitPlan {
    targetPelvisX?: number;
    targetBaselineY?: number;
    parts: Record<string, PartFit>;
}

const CELL = 512;
const KEY_PIXEL = [255, 0, 255, 255];
const MARGIN = 4;
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function cutsFor(axisCuts: number[] | undefined, length: number, cells: number, label: string): number[] {
    const span = Math.floor(length / cells);
    const cuts = axisCuts ?? Array.from({ length: cells + 1 }, (_, i) => i === cells ? length : i * span);
    if (cuts.length !== cells + 1 || cuts[0] !== 0 || cuts.at(-1) !== length ||
        cuts.some((cut, index) => !Number.isInteger(cut) || (index > 0 && cut <= cuts[index - 1]!))) {
        throw Error(`${label} must contain ordered integer boundaries from 0 to ${length}.`);
    }
    return cuts;
}

function writeChecked(file: string, data: Buffer | string) {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    if (fs.existsSync(file)) {
        if (!fs.readFileSync(file).equals(buffer)) throw Error(`Existing file differs. Preserve or move it before restaging: ${file}`);
        return;
    }
    fs.writeFileSync(file, buffer, { flag: 'wx' });
}

function loadSource(rawPath: string, sha256: string) {
    const original = fs.readFileSync(projectPath(rawPath));
    const hash = digest(original);
    if (sha256.toLowerCase() !== hash) throw Error(`${rawPath} changed after its fit was measured.`);
    const raw = decodePng(original);
    return { name: path.basename(rawPath), original, raw, keyed: chromaKey(raw), hash };
}

function checkFit(fit: PartFit | undefined, label: string): asserts fit is PartFit {
    if (!fit || !/^[a-f0-9]{64}$/i.test(fit.sha256) ||
        ![fit.scale, fit.sourcePelvisX, fit.sourceBaselineY].every(Number.isFinite) || fit.scale <= 0) {
        throw Error(`${label} requires a source hash, finite source anchors, and a positive shared scale.`);
    }
}

function fitCell(source: Raster, scale: number, sourceAnchor: [number, number], targetAnchor: [number, number]) {
    const result = blank(CELL, CELL);
    const [sourceX, sourceY] = sourceAnchor;
    const [targetX, targetY] = targetAnchor;
    for (let y = 0; y < CELL; y++) {
        const sy = Math.floor((y + 0.5 - targetY) / scale + sourceY);
        for (let x = 0; x < CELL; x++) {
            const sx = Math.floor((x + 0.5 - targetX) / scale + sourceX);
            const offset = (y * CELL + x) * 4;
            const origin = (sy * source.width + sx) * 4;
            const visible = sx >= 0 && sy >= 0 && sx < source.width && sy < source.height && source.data[origin + 3]! >= 128;
            const rgba = visible ? source.data.subarray(origin, origin + 4) : KEY_PIXEL;
            result.data.set(rgba, offset);
            result.data[offset + 3] = 255;
        }
    }
    return result;
}

const [, , fitPath] = process.argv;
if (!fitPath || process.argv.length !== 3) throw Error('Pass one measured fit JSON file.');
const plan: FitPlan = JSON.parse(fs.readFileSync(fitPath, 'utf8'));
const targetPelvisX = plan.targetPelvisX ?? 256;
const targetBaselineY = plan.targetBaselineY ?? 480;
if (![targetPelvisX, targetBaselineY].every(value => Number.isFinite(value) && value > MARGIN && value < CELL - MARGIN)) {
    throw Error('Target anchors must lie inside the 512×512 cell.');
}

const asset = loadArtConfig().assets.find(spec => spec.id === 'grognak');
if (!asset?.parts?.length) throw Error('No multipart Grognak asset in the manifest.');
if (!plan.parts || Object.keys(plan.parts).length !== asset.parts.length) throw Error('Provide measured fits for all manifest parts.');
const fitted = asset.parts.map(part => {
    const fit = plan.parts[part.name];
    checkFit(fit, part.name);
    const [cols, rows] = part.grid;
    if (fit.cellOffsets && (fit.cellOffsets.length !== cols * rows ||
        fit.cellOffsets.some(offset => !Array.isArray(offset) || offset.length !== 2 || !offset.every(Number.isFinite)))) {
        throw Error(`${part.name} cellOffsets must contain one finite [x,y] pair per cell.`);
    }
    const archive = [loadSource(part.rawPath, fit.sha256)];
    const original = archive[0]!;
    const { raw } = original;
    const baseXCuts = cutsFor(fit.colCuts, raw.width, cols, `${part.name} column cuts`);
    const baseYCuts = cutsFor(fit.rowCuts, raw.height, rows, `${part.name} row cuts`);
    const fittedCells: Raster[] = [];
    const cells = [];
    for (let row = 0; row < rows; row++) {
        const replacement = fit.replacementRows?.[row];
        if (replacement) checkFit(replacement, `${part.name} row ${row + 1}`);
        const source = replacement ? loadSource(replacement.rawPath, replacement.sha256) : original;
        if (replacement) archive.push(source);
        const rowFit = replacement ?? fit;
        const sourceRow = replacement ? 0 : row;
        const sourceRows = replacement ? 1 : rows;
        const nominalWidth = Math.floor(source.raw.width / cols);
        const nominalHeight = Math.floor(source.raw.height / sourceRows);
        const xCuts = replacement ? cutsFor(replacement.colCuts, source.raw.width, cols, `${part.name} replacement column cuts`) : baseXCuts;
        const yCuts = replacement ? cutsFor(replacement.rowCuts, source.raw.height, 1, `${part.name} replacement row cuts`) : baseYCuts;
        for (let col = 0; col < cols; col++) {
            const index = row * cols + col;
            const label = `${part.name} cell ${index + 1}`;
            const x = xCuts[col]!;
            const y = yCuts[sourceRow]!;
            const w = xCuts[col + 1]! - x;
            const h = yCuts[sourceRow + 1]! - y;
            const sourceCell = crop(source.keyed, { x, y, w, h });
            const bounds = contentBox(sourceCell);
            if (!bounds) throw Error(`${label} is empty.`);
            if (bounds.x === 0 || bounds.y === 0 || bounds.x + bounds.w === w || bounds.y + bounds.h === h) {
                throw Error(`${label} touches its source boundary. Check the gutter or candidate.`);
            }
            const [dx, dy] = fit.cellOffsets?.[index] ?? [0, 0];
            const sourceAnchor: [number, number] = [col * nominalWidth + rowFit.sourcePelvisX - x, sourceRow * nominalHeight + rowFit.sourceBaselineY - y];
            const targetAnchor: [number, number] = [targetPelvisX + dx, targetBaselineY + dy];
            const scale = rowFit.scale;
            const left = (bounds.x - sourceAnchor[0]) * scale + targetAnchor[0];
            const top = (bounds.y - sourceAnchor[1]) * scale + targetAnchor[1];
            const right = left + bounds.w * scale;
            const bottom = top + bounds.h * scale;
            if (left < MARGIN || top < MARGIN || right > CELL - MARGIN || bottom > CELL - MARGIN) {
                throw Error(`${label} cannot fit with ${MARGIN} px margins at the requested scale and anchors.`);
            }
            const fittedCell = fitCell(sourceCell, scale, sourceAnchor, targetAnchor);
            const fittedBounds = contentBox(chromaKey(fittedCell));
            if (!fittedBounds) throw Error(`${label} lost its subject while fitting.`);
            fittedCells.push(fittedCell);
            cells.push({ index, source: source.name, scale, sourceBounds: bounds, fittedBounds, sourceAnchor, targetAnchor });
        }
    }
    const normalized = encodePng(composeGrid(fittedCells, cols));
    const info = {
        name: part.name,
        input: [raw.width, raw.height],
        output: [cols * CELL, rows * CELL],
        originalSha256: original.hash,
        normalizedSha256: digest(normalized),
        scale: fit.scale,
        colCuts: baseXCuts,
        rowCuts: baseYCuts,
        replacementRows: fit.replacementRows,
        cells,
    };
    return { name: original.name, archive, normalized, info };
});

const originals = path.join(import.meta.dirname, '07-generator-originals');
const staging = path.join(import.meta.dirname, '07-normalized-raws');
fs.mkdirSync(originals, { recursive: true });
fs.mkdirSync(staging, { recursive: true });
for (const entry of fitted.flatMap(part => part.archive)) writeChecked(path.join(originals, entry.name), entry.original);
for (const entry of fitted) writeChecked(path.join(staging, entry.name), entry.normalized);
writeChecked(path.join(staging, 'geometry.json'), JSON.stringify({ targetPelvisX, targetBaselineY, parts: fitted.map(entry => entry.info) }, null, 2) + '\n');
console.log(`Staged ${fitted.length} normalized PNGs in ${staging}.`);
