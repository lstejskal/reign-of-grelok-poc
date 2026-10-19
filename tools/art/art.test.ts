import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { expandPrompt, loadArtConfig, outputPath, projectPath, decodePng } from './config';
import { buildRequest, extractImage, generate, readSettings, sizeFor } from './imageApi';
import { hexOf } from './pipeline';

describe('prompts', () => {
    it('replaces {name} with fragments, also inside fragments, and leaves unknown names alone', () => {
        const fragments = { style: 'pixel art.', hero: 'A hero. {style}' };
        expect(expandPrompt('{style}   Draw {hero} {nope}', fragments)).toBe('pixel art. Draw A hero. pixel art. {nope}');
    });

    it('every prompt in assets.yml uses only fragments that exist', () => {
        const { assets, fragments } = loadArtConfig();
        for (const asset of assets) expect(expandPrompt(asset.prompt, fragments), asset.id).not.toMatch(/\{\w+\}/);
    });
});

describe('art/assets.yml', () => {
    const { assets, palette } = loadArtConfig();

    it('has a size (or frame and grid) for every asset', () => {
        for (const a of assets) {
            if (a.type === 'sheet') expect(a.frame && a.grid, a.id).toBeTruthy();
            else expect(a.size, a.id).toBeTruthy();
        }
    });

    it('palette has 32 distinct colours of Mega Drive levels', () => {
        const levels = [0, 52, 87, 116, 144, 172, 206, 255];
        expect(new Set(palette.map(hexOf)).size).toBe(32);
        for (const color of palette) for (const c of color) expect(levels).toContain(c);
    });

    // An asset with a picture in art/raw/ has been through the pipeline: its game file must use palette colours only.
    it('every imported picture uses only palette colours (and full or no transparency)', () => {
        const allowed = new Set(palette.map(hexOf));
        let checked = 0;
        for (const asset of assets) {
            if (!fs.existsSync(projectPath(asset.rawPath))) continue;
            checked++;
            const img = decodePng(fs.readFileSync(outputPath(asset)));
            for (let i = 0; i < img.data.length; i += 4) {
                if (img.data[i + 3] === 0) continue;
                expect(img.data[i + 3], `${asset.id} alpha`).toBe(255);
                expect(allowed.has(hexOf([img.data[i]!, img.data[i + 1]!, img.data[i + 2]!])), `${asset.id} has an off-palette pixel`).toBe(true);
            }
        }
        expect(checked).toBeGreaterThan(0); // the repository ships at least one imported asset
    });

    it('imported pictures have the size the game expects', () => {
        for (const a of assets) {
            if (!fs.existsSync(projectPath(a.rawPath))) continue;
            const png = PNG.sync.read(fs.readFileSync(outputPath(a)));
            const expected = a.type === 'sheet' ? [a.frame![0] * a.grid![0], a.frame![1] * a.grid![1]] : a.size!;
            expect([png.width, png.height], a.id).toEqual(expected);
        }
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
