import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { colorsFor, expandPrompt, loadArtConfig, outputPath, projectPath, decodePng, rawPathsOf, sheetLayout, sizeHeights } from './config';
import type { AssetSpec } from './config';
import { loadGameBundle } from '../../packages/engine/node/loadGameBundle';

/** Imported = every raw picture the asset is made from exists. */
const imported = (a: AssetSpec) => rawPathsOf(a).every((p) => fs.existsSync(projectPath(p)));
import { buildRequest, extractImage, generate, readSettings, sizeFor } from './imageApi';
import { MEGA_DRIVE_LEVELS, hexOf } from './pipeline';
import type { Rgb } from './pipeline';

describe('prompts', () => {
    it('replaces {name} with fragments, also inside fragments, and leaves unknown names alone', () => {
        const fragments = { style: 'pixel art.', hero: 'A hero. {style}' };
        expect(expandPrompt('{style}   Draw {hero} {nope}', fragments)).toBe('pixel art. Draw A hero. pixel art. {nope}');
    });

    it('every prompt in assets.yml uses only fragments that exist', () => {
        const { assets, fragments } = loadArtConfig();
        for (const asset of assets) {
            const prompts = [asset.prompt ?? '', ...(asset.parts ?? []).map((p) => p.prompt)];
            for (const prompt of prompts) expect(expandPrompt(prompt, fragments), asset.id).not.toMatch(/\{\w+\}/);
        }
    });
});

describe('art/assets.yml', () => {
    const { assets, palette } = loadArtConfig();

    it('has a size (or frame and grid) for every asset', () => {
        for (const a of assets) {
            if (a.type === 'sheet') expect(a.frame && (a.grid || a.parts), a.id).toBeTruthy();
            else expect(a.size, a.id).toBeTruthy();
        }
    });

    it('the shared palette (art/palette.hex) has 32 distinct colours of Mega Drive levels', () => {
        const levels = [0, 52, 87, 116, 144, 172, 206, 255];
        expect(new Set(palette.map(hexOf)).size).toBe(32);
        for (const color of palette) for (const c of color) expect(levels).toContain(c);
    });

    // An asset with a picture in art/raw/ has been through the pipeline: its game file must stay within its colour budget,
    // use only colours the Mega Drive could show, and have no half-transparent pixels. (`palette: shared` assets must
    // use the colours of art/palette.hex.)
    it('every imported picture has few colours, all Mega Drive colours, and full or no transparency', () => {
        const levels: readonly number[] = MEGA_DRIVE_LEVELS;
        const shared = new Set(palette.map(hexOf));
        let checked = 0;
        for (const asset of assets) {
            if (!imported(asset)) continue;
            checked++;
            const img = decodePng(fs.readFileSync(outputPath(asset)));
            // collect problems with plain checks: an expect() per pixel is far too slow for 640x288 pictures
            const used = new Set<string>();
            const problems = new Set<string>();
            for (let i = 0; i < img.data.length; i += 4) {
                if (img.data[i + 3] === 0) continue;
                if (img.data[i + 3] !== 255) problems.add('half-transparent pixels');
                const color: Rgb = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
                if (!color.every((c) => levels.includes(c))) problems.add(`the off-grid colour ${hexOf(color)}`);
                if (asset.palette === 'shared' && !shared.has(hexOf(color))) problems.add(`the off-palette colour ${hexOf(color)}`);
                used.add(hexOf(color));
            }
            expect([...problems], `${asset.id} has`).toEqual([]);
            expect(used.size, `${asset.id} uses ${used.size} colours`).toBeLessThanOrEqual(colorsFor(asset, palette));
        }
        expect(checked).toBeGreaterThan(0); // the repository ships at least one imported asset
    });

    it('imported pictures have the size the game expects', () => {
        for (const a of assets) {
            if (!imported(a)) continue;
            const png = PNG.sync.read(fs.readFileSync(outputPath(a)));
            const layout = a.parts ? sheetLayout(a) : undefined;
            const expected = layout
                ? [a.frame![0] * layout.columns, a.frame![1] * layout.rows]
                : a.type === 'sheet' ? [a.frame![0] * a.grid![0], a.frame![1] * a.grid![1]] : a.size!;
            expect([png.width, png.height], a.id).toEqual(expected);
        }
    });

    // A multi-part sheet's frame numbers come from its parts; the game reads them from game.yml, so the two must agree.
    it('an imported sheet with sizes has every smaller copy: same dimensions, only the full sheet\'s colours', () => {
        const colours = (img: { data: Uint8Array }) => {
            const set = new Set<string>();
            for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) set.add(`${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`);
            return set;
        };
        for (const a of assets) {
            if (!a.sizes || !imported(a)) continue;
            const full = decodePng(fs.readFileSync(outputPath(a)));
            const allowed = colours(full);
            for (const h of sizeHeights(a)) {
                const file = outputPath(a).replace(/\.png$/, `_${h}.png`);
                const small = decodePng(fs.readFileSync(file));
                expect([small.width, small.height], file).toEqual([full.width, full.height]);
                expect([...colours(small)].filter((c) => !allowed.has(c)), `${file} has colours the full sheet doesn't`).toEqual([]);
            }
        }
    });

    it('a game whose player sheet is an imported multi-part sheet has the matching animations in game.yml', () => {
        for (const a of assets) {
            if (!a.parts || !imported(a)) continue;
            const player = loadGameBundle(a.game).config.player;
            if (player.sprite !== a.out) continue;
            const layout = sheetLayout(a);
            expect(player.columns, `${a.game}/game.yml player columns`).toBe(layout.columns);
            expect(player.animations, `${a.game}/game.yml player animations (npm run import-art prints them)`).toEqual(layout.animations);
        }
    });

    it('lays out a multi-part sheet: one row per part, cells handed out to animations in order', () => {
        const asset = {
            id: 'hero', frame: [8, 8], columns: 4,
            parts: [
                { name: 'walk', grid: [2, 2], frames: { walk_e: 4 } },
                { name: 'talk', grid: [2, 2], frames: { talk_s: 2, talk_e: 2 } },
                { name: 'idle', grid: [3, 1], frames: { idle_s: 1, idle_n: 1, idle_e: 1 } },
            ],
        } as unknown as AssetSpec;
        const layout = sheetLayout(asset);
        expect(layout.rows).toBe(3);
        expect(layout.animations).toEqual({ walk_e: [0, 1, 2, 3], talk_s: [4, 5], talk_e: [6, 7], idle_s: [8], idle_n: [9], idle_e: [10] });
        expect(layout.slots[5]).toEqual({ part: 1, cell: 1, frame: 5 });
    });
});

describe('image service', () => {
    it('is off without a key and has sensible defaults with one', () => {
        expect(readSettings({})).toBeUndefined();
        expect(readSettings({ IMAGE_API_KEY: 'k' })).toMatchObject({ key: 'k', size: undefined, url: 'https://api.openai.com/v1/images/generations' });
    });

    it('picks a picture shape that suits the asset, unless told otherwise', () => {
        expect(sizeFor({ type: 'background' })).toBe('1536x1024');
        expect(sizeFor({ type: 'sheet', grid: [3, 4] })).toBe('1024x1536');
        expect(sizeFor({ type: 'sheet', grid: [4, 3] })).toBe('1536x1024');
        expect(sizeFor({ type: 'sheet', grid: [2, 2] })).toBe('1024x1024');
        expect(sizeFor({ type: 'sprite' })).toBe('1024x1024');
        expect(sizeFor({ type: 'background' }, '512x512')).toBe('512x512'); // IMAGE_SIZE overrides the defaults
        expect(sizeFor({ type: 'background', genSize: '1792x1024' }, '512x512')).toBe('1792x1024'); // the asset's own wins
    });

    it('every gen_size in assets.yml looks like WxH', () => {
        for (const a of loadArtConfig().assets) if (a.genSize) expect(a.genSize, a.id).toMatch(/^\d+x\d+$/);
    });

    it('builds an OpenAI-style request', () => {
        const { url, init } = buildRequest({ key: 'k', url: 'https://x/y', model: 'm', size: '512x512' }, 'a hero');
        expect(url).toBe('https://x/y');
        expect(init.headers.authorization).toBe('Bearer k');
        expect(JSON.parse(init.body)).toEqual({ prompt: 'a hero', size: '512x512', n: 1, model: 'm' });
    });

    it('finds the picture in a response, as base64 or as a URL', () => {
        expect(extractImage({ data: [{ b64_json: 'QUJD' }] })).toEqual({ base64: 'QUJD' });
        expect(extractImage({ data: [{ url: 'https://i/1.png' }] })).toEqual({ url: 'https://i/1.png' });
        expect(extractImage({ nope: 1 })).toBeUndefined();
    });

    it('generate returns the picture bytes (with a fake service) and explains failures', async () => {
        const ok = (async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('PNGDATA').toString('base64') }] }))) as unknown as typeof fetch;
        expect((await generate({ key: 'k', url: 'u', size: 's' }, 'p', ok)).toString()).toBe('PNGDATA');
        const bad = (async () => new Response('no credit', { status: 402 })) as unknown as typeof fetch;
        await expect(generate({ key: 'k', url: 'u', size: 's' }, 'p', bad)).rejects.toThrow('402');
    });
});
