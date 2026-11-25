// What the two art tools share: reading art/assets.yml, expanding prompts, and moving pictures between PNG files and Rasters.
import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { PNG } from 'pngjs';
import { GAMES_DIR } from '../../packages/engine/node/loadGameBundle';
import { blank, parsePalette, DEFAULT_BACKGROUND_COLORS, DEFAULT_SPRITE_COLORS } from './pipeline';
import type { Raster, ResizeMethod, Rgb } from './pipeline';

export const ART_DIR = path.resolve(import.meta.dirname, '../../art');

export interface AssetSpec {
    id: string;
    game: string;
    type: 'sprite' | 'sheet' | 'icon' | 'background';
    /** Relative to games/<game>/assets/. */
    out: string;
    /** Relative to the project folder. */
    rawPath: string;
    prompt: string;
    size?: [number, number];
    frame?: [number, number];
    grid?: [number, number];
    method?: ResizeMethod;
    dither?: boolean;
    /** Colours in this picture's own palette (outline included). Defaults: 16 for sprites and icons, 32 for backgrounds. */
    colors?: number;
    /** `shared` = snap to art/palette.hex instead of choosing colours to suit the picture. */
    palette?: 'own' | 'shared';
    /** Backgrounds: which part to keep when the picture is not the game's shape, 0 = top .. 1 = bottom (default 0.5). */
    focus?: number;
    /** Shape to ask the image service for ("1024x1536"); a default fits the type, see sizeFor(). */
    genSize?: string;
    /** Sheets: named animations as lists of frame numbers (row by row). */
    animations?: Record<string, number[]>;
    /**
     * Sheets made of several generated pictures (one per animation, which an image generator keeps consistent far
     * better than one big grid). Each part starts a new row of the sheet; `columns` frames per row.
     */
    parts?: SheetPart[];
    columns?: number;
}

/** One generated picture of a multi-part sheet: a grid of cells, read row by row, handed out to named animations. */
export interface SheetPart {
    /** Short name; the raw picture is art/raw/<asset id>_<name>.png unless `raw` says otherwise. */
    name: string;
    rawPath: string;
    grid: [number, number];
    /** Animation name -> how many of the part's cells it takes, in order (e.g. { talk_s: 2, talk_e: 2 }). */
    frames: Record<string, number>;
    prompt: string;
    genSize?: string;
}

/** Every raw picture an asset is made from. */
export const rawPathsOf = (asset: AssetSpec): string[] => (asset.parts ? asset.parts.map((p) => p.rawPath) : [asset.rawPath]);

/** Where each part's cells go in a multi-part sheet, and the animations that come out of it (frame numbers row by row). */
export function sheetLayout(asset: AssetSpec): {
    columns: number;
    rows: number;
    slots: { part: number; cell: number; frame: number }[];
    animations: Record<string, number[]>;
} {
    const columns = asset.columns ?? 6;
    const slots: { part: number; cell: number; frame: number }[] = [];
    const animations: Record<string, number[]> = {};
    (asset.parts ?? []).forEach((part, row) => {
        let cell = 0;
        for (const [name, count] of Object.entries(part.frames)) {
            animations[name] = [];
            for (let k = 0; k < count; k++, cell++) {
                slots.push({ part: row, cell, frame: row * columns + cell });
                animations[name]!.push(row * columns + cell);
            }
        }
        if (cell > columns) throw new Error(`${asset.id}: part "${part.name}" has ${cell} frames, more than the ${columns} columns of a row`);
        if (cell > part.grid[0] * part.grid[1]) throw new Error(`${asset.id}: part "${part.name}" needs ${cell} cells but its grid has ${part.grid[0] * part.grid[1]}`);
    });
    return { columns, rows: asset.parts?.length ?? 0, slots, animations };
}

export interface ArtConfig {
    palette: Rgb[];
    outline: Rgb;
    assets: AssetSpec[];
    fragments: Record<string, string>;
}

const hexToRgb = (hex: string): Rgb => parsePalette(hex)[0]!;

export function loadArtConfig(): ArtConfig {
    const raw = parseYaml(fs.readFileSync(path.join(ART_DIR, 'assets.yml'), 'utf8')) as {
        palette: string; outline: string; game?: string; assets: Record<string, Omit<AssetSpec, 'id' | 'game' | 'rawPath' | 'genSize'> & { game?: string; raw?: string; gen_size?: string }>;
    };
    const palette = parsePalette(fs.readFileSync(path.resolve(ART_DIR, '..', raw.palette), 'utf8'));
    const fragments = parseYaml(fs.readFileSync(path.join(ART_DIR, 'prompts/fragments.yml'), 'utf8')) as Record<string, string>;
    type RawPart = { name: string; raw?: string; grid: [number, number]; frames?: Record<string, number>; prompt: string; gen_size?: string };
    const assets = Object.entries(raw.assets).map(([id, a]) => ({
        ...a,
        id,
        game: a.game ?? raw.game ?? 'grelok',
        rawPath: a.raw ?? `art/raw/${id}.png`,
        genSize: a.gen_size,
        parts: (a.parts as unknown as RawPart[] | undefined)?.map((p): SheetPart => ({
            name: p.name,
            rawPath: p.raw ?? `art/raw/${id}_${p.name}.png`,
            grid: p.grid,
            frames: p.frames ?? { [p.name]: p.grid[0] * p.grid[1] },
            prompt: p.prompt,
            genSize: p.gen_size,
        })),
    })) as AssetSpec[];
    return { palette, outline: hexToRgb(raw.outline), assets, fragments };
}

/** Replaces every {name} in a prompt with the fragment of that name (fragments may use other fragments). Unknown names stay as they are. */
export function expandPrompt(prompt: string, fragments: Record<string, string>, depth = 0): string {
    const text = prompt.replace(/\{(\w+)\}/g, (whole, name: string) => (fragments[name] !== undefined && depth < 5 ? expandPrompt(fragments[name]!.trim(), fragments, depth + 1) : whole));
    return text.replace(/\s+/g, ' ').trim();
}

/** How many colours this asset's picture may use (the shared palette's size when it uses that). */
export function colorsFor(asset: AssetSpec, sharedPalette: readonly Rgb[]): number {
    if (asset.palette === 'shared') return sharedPalette.length;
    return asset.colors ?? (asset.type === 'background' ? DEFAULT_BACKGROUND_COLORS : DEFAULT_SPRITE_COLORS);
}

export const projectPath = (relative: string): string => path.resolve(ART_DIR, '..', relative);
export const outputPath = (asset: AssetSpec): string => path.join(GAMES_DIR, asset.game, 'assets', asset.out);

export function decodePng(buffer: Buffer): Raster {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

export function encodePng(img: Raster): Buffer {
    const png = new PNG({ width: img.width, height: img.height });
    png.data = Buffer.from(img.data);
    return PNG.sync.write(png);
}

export const emptyRaster = blank;
