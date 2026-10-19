// What the two art tools share: reading art/assets.yml, expanding prompts, and moving pictures between PNG files and Rasters.
import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { PNG } from 'pngjs';
import { GAMES_DIR } from '../../packages/engine/node/loadGameBundle';
import { blank, parsePalette } from './pipeline';
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
    /** Shape to ask the image service for ("1024x1536"); a default fits the type, see sizeFor(). */
    genSize?: string;
    /** Sheets: named animations as lists of frame numbers (row by row). */
    animations?: Record<string, number[]>;
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
    const assets = Object.entries(raw.assets).map(([id, a]) => ({
        ...a,
        id,
        game: a.game ?? raw.game ?? 'grelok',
        rawPath: a.raw ?? `art/raw/${id}.png`,
        genSize: a.gen_size,
    })) as AssetSpec[];
    return { palette, outline: hexToRgb(raw.outline), assets, fragments };
}

/** Replaces every {name} in a prompt with the fragment of that name (fragments may use other fragments). Unknown names stay as they are. */
export function expandPrompt(prompt: string, fragments: Record<string, string>, depth = 0): string {
    const text = prompt.replace(/\{(\w+)\}/g, (whole, name: string) => (fragments[name] !== undefined && depth < 5 ? expandPrompt(fragments[name]!.trim(), fragments, depth + 1) : whole));
    return text.replace(/\s+/g, ' ').trim();
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
