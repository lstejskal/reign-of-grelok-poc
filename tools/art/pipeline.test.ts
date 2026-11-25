import { describe, expect, it } from 'vitest';
import {
    blank, buildPalette, chromaKey, composeGrid, contentBox, coverCrop, crop, despeckle, hexOf, makeAtlas, MEGA_DRIVE_LEVELS, nearestIndex, outline, pad,
    parsePalette, place, processBackground, processFrames, processPartsSheet, quantize, resize, resizeDominant, sliceGrid, snapToMegaDrive,
} from './pipeline';
import type { Raster, Rgb } from './pipeline';

/** A picture from a list of rows of characters: '.' = transparent, '#' = black, 'M' = magenta, 'r' = red, 'w' = white. */
function draw(rows: string[]): Raster {
    const colors: Record<string, Rgb | undefined> = { '#': [0, 0, 0], M: [255, 0, 255], r: [200, 20, 20], w: [255, 255, 255], g: [20, 200, 20] };
    const img = blank(rows[0]!.length, rows.length);
    rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
            const c = colors[ch];
            if (c) img.data.set([c[0], c[1], c[2], 255], (y * img.width + x) * 4);
        }),
    );
    return img;
}
const pixel = (img: Raster, x: number, y: number): number[] => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
const visible = (img: Raster): number => img.data.filter((_, i) => i % 4 === 3 && img.data[i]! >= 128).length;

const PALETTE: Rgb[] = [[0, 0, 0], [255, 255, 255], [172, 52, 52], [52, 144, 52]];

describe('palette', () => {
    it('reads #rrggbb lines and ignores comments and blank lines', () => {
        expect(parsePalette('; a comment\n#ff0000 ; red\n\n00ff00\nnot a colour\n')).toEqual([[255, 0, 0], [0, 255, 0]]);
    });

    it('snaps a colour to the nearest palette colour', () => {
        expect(PALETTE[nearestIndex([10, 10, 10], PALETTE)]).toEqual([0, 0, 0]);
        expect(PALETTE[nearestIndex([240, 250, 245], PALETTE)]).toEqual([255, 255, 255]);
        expect(PALETTE[nearestIndex([190, 60, 60], PALETTE)]).toEqual([172, 52, 52]);
        expect(PALETTE[nearestIndex([30, 160, 40], PALETTE)]).toEqual([52, 144, 52]);
    });

    it('quantize uses only palette colours, keeps transparency, and makes visible pixels opaque', () => {
        const img = draw(['r.w', 'g.#']);
        img.data[3] = 200; // slightly see-through, still counts as there
        const q = quantize(img, PALETTE);
        expect(pixel(q, 0, 0)).toEqual([172, 52, 52, 255]);
        expect(pixel(q, 1, 0)[3]).toBe(0);
        expect(pixel(q, 2, 1)).toEqual([0, 0, 0, 255]);
        for (let i = 0; i < q.data.length; i += 4) {
            if (q.data[i + 3] === 0) continue;
            expect(PALETTE.some((p) => p[0] === q.data[i] && p[1] === q.data[i + 1] && p[2] === q.data[i + 2])).toBe(true);
        }
    });

    it('dithering turns a flat in-between colour into a mix of two palette colours', () => {
        const grey = blank(8, 8);
        for (let i = 0; i < grey.data.length; i += 4) grey.data.set([128, 128, 128, 255], i);
        const blackAndWhite: Rgb[] = [[0, 0, 0], [255, 255, 255]];
        const flat = quantize(grey, blackAndWhite, false);
        const mixed = quantize(grey, blackAndWhite, true);
        const distinct = (img: Raster) => new Set(Array.from({ length: 64 }, (_, i) => img.data[i * 4])).size;
        expect(distinct(flat)).toBe(1);
        expect(distinct(mixed)).toBeGreaterThan(1);
    });
});

describe('chroma key', () => {
    it('removes the key colour, including slightly-off magenta, and keeps the rest', () => {
        const img = draw(['MMMM', 'MrrM', 'MrrM', 'MMMM']);
        img.data.set([240, 30, 250, 255], 0); // not quite #FF00FF
        const k = chromaKey(img);
        expect(visible(k)).toBe(4);
        expect(pixel(k, 0, 0)[3]).toBe(0);
        expect(pixel(k, 1, 1)[3]).toBe(255);
    });

    it('removes a pinkish fringe next to the cut-out, but not the same colour in the middle of the figure', () => {
        const img = draw(['MMMMMM', 'MrrrrM', 'MrrrrM', 'MrrrrM', 'MMMMMM']);
        const pink = [200, 140, 200, 255]; // leans magenta but is not close to the key
        img.data.set(pink, (1 * 6 + 1) * 4); // on the edge of the figure
        img.data.set(pink, (2 * 6 + 2) * 4); // in the middle
        const k = chromaKey(img, [255, 0, 255], 20);
        expect(pixel(k, 1, 1)[3]).toBe(0);
        expect(pixel(k, 2, 2)[3]).toBe(255);
    });
});

describe('cropping and boxes', () => {
    it('finds the box around the visible pixels', () => {
        expect(contentBox(draw(['....', '.rr.', '.r..', '....']))).toEqual({ x: 1, y: 1, w: 2, h: 2 });
        expect(contentBox(blank(3, 3))).toBeUndefined();
    });

    it('crops, padding with transparency outside the picture', () => {
        const c = crop(draw(['rw', 'gr']), { x: 1, y: 0, w: 2, h: 2 });
        expect(pixel(c, 0, 0)).toEqual([255, 255, 255, 255]);
        expect(pixel(c, 1, 0)[3]).toBe(0);
    });
});

describe('resize', () => {
    it('nearest copies one source pixel per new pixel (4x4 -> 2x2 keeps the centre-ish pixels)', () => {
        const img = draw(['rrww', 'rrww', 'ggww', 'gg##']);
        const small = resize(img, 2, 2, 'nearest');
        expect([pixel(small, 0, 0), pixel(small, 1, 0), pixel(small, 0, 1), pixel(small, 1, 1)].map((p) => p.join())).toEqual([
            '200,20,20,255', '255,255,255,255', '20,200,20,255', '0,0,0,255',
        ]);
    });

    it('box averages the pixels it covers', () => {
        const img = draw(['#w', 'w#']);
        const one = resize(img, 1, 1, 'box');
        expect(pixel(one, 0, 0).slice(0, 3).map(Math.round)).toEqual([128, 128, 128]);
    });

    it('box ignores the colour of see-through pixels', () => {
        const img = draw(['r.', '..']);
        expect(pixel(resize(img, 1, 1, 'box'), 0, 0).slice(0, 3)).toEqual([200, 20, 20]);
    });
});

describe('tidying', () => {
    it('despeckle removes a lone pixel but keeps connected ones', () => {
        const d = despeckle(draw(['r....', '.....', '..rr.', '..rr.']));
        expect(pixel(d, 0, 0)[3]).toBe(0);
        expect(visible(d)).toBe(4);
    });

    it('outline draws a border only around the picture, in the given colour', () => {
        const o = outline(pad(draw(['r'])), [1, 2, 3]);
        expect(o.width).toBe(3);
        expect(pixel(o, 1, 1)).toEqual([200, 20, 20, 255]); // the original stays
        expect(pixel(o, 1, 0)).toEqual([1, 2, 3, 255]); // above, left, right, below
        expect(pixel(o, 0, 1)).toEqual([1, 2, 3, 255]);
        expect(pixel(o, 0, 0)[3]).toBe(0); // corners are not touching, so no border
    });

    it('place puts a picture bottom-centre on a bigger canvas', () => {
        const p = place(draw(['rr', 'rr']), 6, 5, 'bottom');
        expect(contentBox(p)).toEqual({ x: 2, y: 3, w: 2, h: 2 });
        expect(contentBox(place(draw(['rr', 'rr']), 6, 6, 'center'))).toEqual({ x: 2, y: 2, w: 2, h: 2 });
    });
});

describe('frame grids', () => {
    it('slices a grid into cells row by row', () => {
        const sheet = draw(['rw', 'g#']);
        const cells = sliceGrid(sheet, 2, 2);
        expect(cells).toHaveLength(4);
        expect(cells.map((c) => pixel(c, 0, 0).slice(0, 3).join())).toEqual(['200,20,20', '255,255,255', '20,200,20', '0,0,0']);
    });

    it('slicing then composing gives the original back', () => {
        const sheet = draw(['rrww', 'rrww', 'gg##', 'gg##', 'rwrw', 'rwrw']);
        const back = composeGrid(sliceGrid(sheet, 2, 3), 2);
        expect(back.width).toBe(4);
        expect(back.height).toBe(6);
        expect(Array.from(back.data)).toEqual(Array.from(sheet.data));
    });

    it('describes a sheet as a Phaser atlas with named animations', () => {
        const atlas = makeAtlas('hero.png', { width: 96, height: 96 }, 32, 48, 3, 2, { walk: [0, 1, 0, 2] });
        expect(Object.keys(atlas.frames)).toHaveLength(6);
        expect(atlas.frames.frame_04!.frame).toEqual({ x: 32, y: 48, w: 32, h: 48 });
        expect(atlas.animations!.walk).toEqual(['frame_00', 'frame_01', 'frame_00', 'frame_02']);
        expect(atlas.meta.size).toEqual({ w: 96, h: 96 });
    });
});

describe('processFrames (the whole recipe)', () => {
    const options = { frameW: 10, frameH: 14, palette: PALETTE, outlineColor: [0, 0, 0] as Rgb };

    // a 40x60 magenta picture with a red block of 20x40 in the middle
    function raw(blockX = 10): Raster {
        const img = blank(40, 60);
        for (let i = 0; i < img.data.length; i += 4) img.data.set([255, 0, 255, 255], i);
        for (let y = 10; y < 50; y++) for (let x = blockX; x < blockX + 20; x++) img.data.set([200, 20, 20, 255], (y * 40 + x) * 4);
        return img;
    }

    it('cuts out, shrinks to fit the frame, snaps to the palette, outlines, and stands the figure on the bottom edge', () => {
        const [frame] = processFrames([raw()], options)!;
        expect(frame!.width).toBe(10);
        expect(frame!.height).toBe(14);
        const box = contentBox(frame!)!;
        expect(box.y + box.h).toBe(14); // feet on the bottom row
        expect(box.w).toBeLessThanOrEqual(10);
        expect(pixel(frame!, box.x, box.y + 5)).toEqual([0, 0, 0, 255]); // the outline is the leftmost column
        const inner = pixel(frame!, box.x + 1, box.y + 5);
        expect(inner).toEqual([172, 52, 52, 255]); // red snapped to the palette
    });

    it('treats all frames of a sheet alike: same scale, same crop, so they stay aligned', () => {
        const [a, b] = processFrames([raw(10), raw(14)], options)!;
        const [boxA, boxB] = [contentBox(a!)!, contentBox(b!)!];
        expect(boxA.w).toBe(boxB.w);
        expect(boxA.h).toBe(boxB.h);
        expect(boxB.x).toBeGreaterThanOrEqual(boxA.x); // the block moved right in the second frame, and still does
    });

    it('returns undefined when nothing is left after the cut-out', () => {
        const empty = blank(8, 8);
        for (let i = 0; i < empty.data.length; i += 4) empty.data.set([255, 0, 255, 255], i);
        expect(processFrames([empty], options)).toBeUndefined();
    });

    it('builds a sheet from several pictures: every frame treated alike, unused frames transparent', () => {
        // part 0: two cells side by side (80x60); part 1: one cell. Sheet: 3 columns x 2 rows.
        const two = blank(80, 60);
        const [left, right] = [raw(10), raw(14)];
        for (let y = 0; y < 60; y++) {
            two.data.set(left.data.subarray(y * 160, y * 160 + 160), y * 320);
            two.data.set(right.data.subarray(y * 160, y * 160 + 160), y * 320 + 160);
        }
        const slots = [{ part: 0, cell: 0, frame: 0 }, { part: 0, cell: 1, frame: 1 }, { part: 1, cell: 0, frame: 3 }];
        const sheet = processPartsSheet([{ raw: two, grid: [2, 1] }, { raw: raw(10), grid: [1, 1] }], slots, 3, 2, options)!;
        expect([sheet.width, sheet.height]).toEqual([30, 28]);
        const frame = (i: number) => crop(sheet, { x: (i % 3) * 10, y: Math.floor(i / 3) * 14, w: 10, h: 14 });
        expect(contentBox(frame(0))!.h).toBe(contentBox(frame(3))!.h); // same scale across parts
        expect(contentBox(frame(2))).toBeUndefined(); // no slot: empty
        expect(contentBox(frame(5))).toBeUndefined();
    });
});

describe('processBackground', () => {
    it('shrinks to size, is fully opaque and uses only palette colours', () => {
        const big = blank(64, 40);
        for (let i = 0; i < big.data.length; i += 4) big.data.set([(i * 7) % 256, (i * 3) % 256, (i * 11) % 256, 255], i);
        const bg = processBackground(big, 16, 10, { palette: PALETTE });
        expect([bg.width, bg.height]).toEqual([16, 10]);
        for (let i = 0; i < bg.data.length; i += 4) {
            expect(bg.data[i + 3]).toBe(255);
            expect(PALETTE.some((p) => p[0] === bg.data[i] && p[1] === bg.data[i + 1] && p[2] === bg.data[i + 2])).toBe(true);
        }
    });
});

describe('a palette chosen for one picture', () => {
    const levels: readonly number[] = MEGA_DRIVE_LEVELS;
    /** Left half green, right half red, plus a few small blue pixels. */
    function greenRedBlue(): Raster {
        const img = blank(40, 20);
        for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) img.data.set(x < 20 ? [60, 170, 60, 255] : [190, 40, 40, 255], (y * 40 + x) * 4);
        for (let x = 0; x < 3; x++) img.data.set([30, 60, 220, 255], x * 4);
        return img;
    }

    it('snaps any colour to one the Mega Drive could show', () => {
        expect(snapToMegaDrive([0, 0, 0])).toEqual([0, 0, 0]);
        expect(snapToMegaDrive([250, 130, 60])).toEqual([255, 116, 52]);
        for (const c of snapToMegaDrive([13, 200, 99])) expect(levels).toContain(c);
    });

    it('has no more colours than asked for, all of them Mega Drive colours, with the reserved ones first', () => {
        const outlineColor: Rgb = [52, 0, 52];
        const palette = buildPalette([greenRedBlue()], 4, [outlineColor]);
        expect(palette[0]).toEqual(outlineColor);
        expect(palette.length).toBeLessThanOrEqual(4);
        expect(new Set(palette.map(hexOf)).size).toBe(palette.length);
        for (const color of palette) for (const c of color) expect(levels).toContain(c);
    });

    it('keeps a small but different area (three blue pixels among 800 green and red ones)', () => {
        const palette = buildPalette([greenRedBlue()], 4);
        expect(palette.some(([r, g, b]) => b > r && b > g)).toBe(true);
    });

    it('is empty-safe: a picture with nothing visible gives just the reserved colours', () => {
        expect(buildPalette([blank(4, 4)], 8, [[1, 2, 3]])).toEqual([[1, 2, 3]]);
    });
});

describe('resizeDominant', () => {
    const [black, white]: Rgb[] = [[0, 0, 0], [255, 255, 255]];

    /** A one-row picture from letters: 'w' white, 'b' black, '.' see-through. */
    function row(letters: string): Raster {
        const img = blank(letters.length, 1);
        [...letters].forEach((ch, x) => {
            if (ch === 'w') img.data.set([255, 255, 255, 255], x * 4);
            if (ch === 'b') img.data.set([0, 0, 0, 255], x * 4);
        });
        return img;
    }

    it('gives each new pixel the colour most of its source pixels have, never a blend', () => {
        const out = resizeDominant(row('wwwbbbbw'), 2, 1, [black, white]); // blocks of 4: www+b and bbb+w
        expect(pixel(out, 0, 0)).toEqual([255, 255, 255, 255]);
        expect(pixel(out, 1, 0)).toEqual([0, 0, 0, 255]);
    });

    it('is see-through where fewer than half of the source pixels are visible', () => {
        const out = resizeDominant(row('wwww.w..'), 2, 1, [black, white]); // 4 of 4 visible, then 1 of 4
        expect(pixel(out, 0, 0)[3]).toBe(255);
        expect(pixel(out, 1, 0)[3]).toBe(0);
    });

    it('lets a thin dark line survive when it is a bit less than half of the area (dark pixels count extra)', () => {
        const out = resizeDominant(row('wwwwwwbbww'), 2, 1, [black, white]); // blocks of 5: no black, then 2 black of 5
        expect(pixel(out, 0, 0)).toEqual([255, 255, 255, 255]);
        expect(pixel(out, 1, 0)).toEqual([0, 0, 0, 255]);
    });
});

describe('coverCrop', () => {
    it('trims instead of stretching: a 16:9 picture becomes 20:9 by losing rows, and focus picks which', () => {
        const img = blank(160, 90);
        for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) img.data.set([y, 0, 0, 255], (y * 160 + x) * 4);
        const middle = coverCrop(img, 20, 9);
        expect([middle.width, middle.height]).toEqual([160, 72]);
        expect(pixel(middle, 0, 0)[0]).toBe(9);
        expect(pixel(coverCrop(img, 20, 9, 0), 0, 0)[0]).toBe(0);
        expect(pixel(coverCrop(img, 20, 9, 1), 0, 0)[0]).toBe(18);
    });

    it('trims the sides of a picture that is too tall, and leaves a picture of the right shape alone', () => {
        expect(coverCrop(blank(100, 100), 20, 10).height).toBe(50);
        const same = blank(40, 20);
        expect(coverCrop(same, 20, 10)).toBe(same);
    });
});

describe('processFrames with a palette of its own', () => {
    it('gives every frame of a sheet the same palette, and keeps to the colour budget', () => {
        const frame = (color: Rgb): Raster => {
            const img = blank(30, 30);
            for (let i = 0; i < img.data.length; i += 4) img.data.set([255, 0, 255, 255], i);
            for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++) img.data.set([color[0], color[1], color[2], 255], (y * 30 + x) * 4);
            return img;
        };
        const frames = processFrames([frame([200, 40, 40]), frame([40, 200, 60])], { frameW: 12, frameH: 12, outlineColor: [52, 0, 52], colors: 3 })!;
        const used = new Set(frames.flatMap((f) => Array.from({ length: f.width * f.height }, (_, i) => (f.data[i * 4 + 3] ? hexOf([f.data[i * 4]!, f.data[i * 4 + 1]!, f.data[i * 4 + 2]!]) : ''))).filter(Boolean));
        expect(used.size).toBeLessThanOrEqual(3);
        expect(used.has('#340034')).toBe(true); // the outline
    });
});
