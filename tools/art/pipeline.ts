// The image-cleaning steps of the art pipeline. Every function takes a Raster and returns a new one (or numbers), so
// each step can be tested on its own and the order they run in is visible in one place (processFrames below).
//
// A Raster is just width x height x 4 bytes: red, green, blue, alpha for every pixel, row after row.

export type Rgb = [number, number, number];

export interface Raster {
    width: number;
    height: number;
    /** RGBA, 4 bytes per pixel. */
    data: Uint8Array;
}

export const ALPHA_ON = 128; // pixels at least this opaque count as "there"; the rest as "not there" (pixel art has no half-transparency)

export function blank(width: number, height: number): Raster {
    return { width, height, data: new Uint8Array(width * height * 4) };
}

const at = (r: Raster, x: number, y: number): number => (y * r.width + x) * 4;
const solid = (r: Raster, x: number, y: number): boolean => x >= 0 && y >= 0 && x < r.width && y < r.height && r.data[at(r, x, y) + 3]! >= ALPHA_ON;

// --- palette -------------------------------------------------------------------------------------------------

/** "#rrggbb ; comment" per line (a leading # is optional, ; starts a comment). */
export function parsePalette(text: string): Rgb[] {
    const colors: Rgb[] = [];
    for (const line of text.split('\n')) {
        const match = line.split(';')[0]!.trim().match(/^#?([0-9a-fA-F]{6})$/);
        if (match) {
            const n = parseInt(match[1]!, 16);
            colors.push([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
        }
    }
    return colors;
}

export const hexOf = ([r, g, b]: Rgb): string => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');

/**
 * Index of the palette colour closest to `color`. "Closest" uses weighted squared distance: the eye notices green most
 * and blue least, so green differences count double and blue ones count less. Ties go to the earlier entry.
 */
export function nearestIndex(color: Rgb, palette: readonly Rgb[]): number {
    let best = 0;
    let bestDistance = Infinity;
    palette.forEach((p, i) => {
        const d = 3 * (color[0] - p[0]) ** 2 + 4 * (color[1] - p[1]) ** 2 + 2 * (color[2] - p[2]) ** 2;
        if (d < bestDistance) {
            bestDistance = d;
            best = i;
        }
    });
    return best;
}

// A 4x4 "Bayer" matrix: thresholds in a pattern that spreads evenly. Used for ordered dithering.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Snaps every visible pixel to the palette (and makes visible ones fully opaque, the rest fully transparent).
 * With `dither` the colour is nudged up or down by a repeating pattern first, so smooth areas become fine checkerboards
 * of two palette colours instead of hard bands. It is the classic trick for faking more colours than you have.
 */
export function quantize(img: Raster, palette: readonly Rgb[], dither = false): Raster {
    const out = blank(img.width, img.height);
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const i = at(img, x, y);
            if (img.data[i + 3]! < ALPHA_ON) continue;
            const nudge = dither ? (BAYER[(y % 4) * 4 + (x % 4)]! - 7.5) * 4 : 0;
            const color: Rgb = [0, 1, 2].map((c) => Math.min(255, Math.max(0, img.data[i + c]! + nudge))) as Rgb;
            const chosen = palette[nearestIndex(color, palette)]!;
            out.data.set([chosen[0], chosen[1], chosen[2], 255], i);
        }
    }
    return out;
}

// --- cutting out ---------------------------------------------------------------------------------------------

const isMagentaish = (r: number, g: number, b: number): boolean => r > 140 && b > 140 && g < Math.min(r, b) * 0.65;

/**
 * Makes the flat key colour (default magenta) transparent. Image generators never give a perfectly flat colour (and edges
 * are blended with the figure), so besides "close to the key" we also remove anything that is clearly magenta-tinted.
 * Then one pass of "defringe": visible pixels touching transparency that still lean magenta are removed too.
 */
export function chromaKey(img: Raster, key: Rgb = [255, 0, 255], tolerance = 90): Raster {
    const out = blank(img.width, img.height);
    out.data.set(img.data);
    for (let i = 0; i < out.data.length; i += 4) {
        const [r, g, b] = [out.data[i]!, out.data[i + 1]!, out.data[i + 2]!];
        const distance = Math.hypot(r - key[0], g - key[1], b - key[2]);
        if (distance <= tolerance || isMagentaish(r, g, b)) out.data[i + 3] = 0;
    }
    const fringe: number[] = [];
    for (let y = 0; y < out.height; y++) {
        for (let x = 0; x < out.width; x++) {
            if (!solid(out, x, y)) continue;
            const i = at(out, x, y);
            const touchesHole = !solid(out, x - 1, y) || !solid(out, x + 1, y) || !solid(out, x, y - 1) || !solid(out, x, y + 1);
            if (touchesHole && out.data[i]! - out.data[i + 1]! > 50 && out.data[i + 2]! - out.data[i + 1]! > 50) fringe.push(i);
        }
    }
    for (const i of fringe) out.data[i + 3] = 0;
    return out;
}

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** The smallest box holding every visible pixel, or undefined if the picture is empty. */
export function contentBox(img: Raster): Box | undefined {
    let [x0, y0, x1, y1] = [img.width, img.height, -1, -1];
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (solid(img, x, y)) {
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x);
                y1 = Math.max(y1, y);
            }
        }
    }
    return x1 < 0 ? undefined : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The smallest box containing all the given boxes. */
export function unionBox(boxes: Box[]): Box {
    const x0 = Math.min(...boxes.map((b) => b.x));
    const y0 = Math.min(...boxes.map((b) => b.y));
    return { x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0 };
}

export function crop(img: Raster, box: Box): Raster {
    const out = blank(box.w, box.h);
    for (let y = 0; y < box.h; y++) {
        for (let x = 0; x < box.w; x++) {
            const [sx, sy] = [box.x + x, box.y + y];
            if (sx >= 0 && sy >= 0 && sx < img.width && sy < img.height) out.data.set(img.data.subarray(at(img, sx, sy), at(img, sx, sy) + 4), at(out, x, y));
        }
    }
    return out;
}

// --- shrinking -----------------------------------------------------------------------------------------------

export type ResizeMethod = 'nearest' | 'box';

/**
 * Scales to exactly width x height.
 *  - 'nearest': every new pixel copies ONE source pixel (the one at its centre). Hard and crisp, never invents a colour;
 *    right when the source is already pixel art. On a blurry source it looks noisy.
 *  - 'box': every new pixel averages ALL the source pixels it covers. Smoother and more faithful on detailed pictures,
 *    but it blends colours (the palette step then snaps them back).
 */
export function resize(img: Raster, width: number, height: number, method: ResizeMethod = 'nearest'): Raster {
    const out = blank(width, height);
    const [sx, sy] = [img.width / width, img.height / height];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const o = at(out, x, y);
            if (method === 'nearest') {
                const [px, py] = [Math.min(img.width - 1, Math.floor((x + 0.5) * sx)), Math.min(img.height - 1, Math.floor((y + 0.5) * sy))];
                out.data.set(img.data.subarray(at(img, px, py), at(img, px, py) + 4), o);
                continue;
            }
            const [x0, x1] = [Math.floor(x * sx), Math.max(Math.floor(x * sx) + 1, Math.ceil((x + 1) * sx))];
            const [y0, y1] = [Math.floor(y * sy), Math.max(Math.floor(y * sy) + 1, Math.ceil((y + 1) * sy))];
            let [r, g, b, a, n] = [0, 0, 0, 0, 0];
            for (let yy = y0; yy < Math.min(y1, img.height); yy++) {
                for (let xx = x0; xx < Math.min(x1, img.width); xx++) {
                    const i = at(img, xx, yy);
                    const alpha = img.data[i + 3]!;
                    // colours are weighted by opacity, so see-through pixels do not drag their (meaningless) colour in
                    r += img.data[i]! * alpha;
                    g += img.data[i + 1]! * alpha;
                    b += img.data[i + 2]! * alpha;
                    a += alpha;
                    n++;
                }
            }
            if (a > 0) out.data.set([Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / n)], o);
        }
    }
    return out;
}

// --- tidying -------------------------------------------------------------------------------------------------

/** Removes visible pixels that have no visible neighbour at all (the specks scattered around a generated picture). */
export function despeckle(img: Raster): Raster {
    const out = blank(img.width, img.height);
    out.data.set(img.data);
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (!solid(img, x, y)) continue;
            let neighbours = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && solid(img, x + dx, y + dy)) neighbours++;
            if (neighbours === 0) out.data[at(out, x, y) + 3] = 0;
        }
    }
    return out;
}

/** Adds one empty pixel on every side. */
export function pad(img: Raster, by = 1): Raster {
    const out = blank(img.width + 2 * by, img.height + 2 * by);
    for (let y = 0; y < img.height; y++) out.data.set(img.data.subarray(at(img, 0, y), at(img, img.width, y)), at(out, by, y + by));
    return out;
}

/** Paints a 1-pixel border in `color` on every empty pixel that touches a visible one (up, down, left or right). */
export function outline(img: Raster, color: Rgb): Raster {
    const out = blank(img.width, img.height);
    out.data.set(img.data);
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (solid(img, x, y)) continue;
            if (solid(img, x - 1, y) || solid(img, x + 1, y) || solid(img, x, y - 1) || solid(img, x, y + 1)) {
                out.data.set([color[0], color[1], color[2], 255], at(out, x, y));
            }
        }
    }
    return out;
}

/** Puts `img` on a transparent canvas, bottom-centre (feet on the floor) or in the middle. */
export function place(img: Raster, width: number, height: number, anchor: 'bottom' | 'center'): Raster {
    const out = blank(width, height);
    const x0 = Math.floor((width - img.width) / 2);
    const y0 = anchor === 'bottom' ? height - img.height : Math.floor((height - img.height) / 2);
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const [dx, dy] = [x0 + x, y0 + y];
            if (dx >= 0 && dy >= 0 && dx < width && dy < height) out.data.set(img.data.subarray(at(img, x, y), at(img, x, y) + 4), at(out, dx, dy));
        }
    }
    return out;
}

// --- sheets --------------------------------------------------------------------------------------------------

/** Cuts a picture into columns x rows equal cells, row by row. */
export function sliceGrid(img: Raster, columns: number, rows: number): Raster[] {
    const [w, h] = [Math.floor(img.width / columns), Math.floor(img.height / rows)];
    const cells: Raster[] = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) cells.push(crop(img, { x: col * w, y: row * h, w, h }));
    return cells;
}

/** The opposite of sliceGrid: frames (all the same size) pasted into one sheet, row by row. */
export function composeGrid(frames: Raster[], columns: number): Raster {
    const [fw, fh] = [frames[0]!.width, frames[0]!.height];
    const rows = Math.ceil(frames.length / columns);
    const out = blank(fw * columns, fh * rows);
    frames.forEach((frame, i) => {
        const [ox, oy] = [(i % columns) * fw, Math.floor(i / columns) * fh];
        for (let y = 0; y < fh; y++) out.data.set(frame.data.subarray(at(frame, 0, y), at(frame, fw, y)), at(out, ox, oy + y));
    });
    return out;
}

export interface Atlas {
    frames: Record<string, { frame: Box; sourceSize: { w: number; h: number } }>;
    /** Named animations: lists of frame names (our own addition; Phaser ignores unknown keys). */
    animations?: Record<string, string[]>;
    meta: { image: string; size: { w: number; h: number }; scale: number };
}

/** A Phaser "JSON hash" atlas describing a grid sheet: where each frame sits, and optional named animations. */
export function makeAtlas(image: string, sheet: { width: number; height: number }, frameW: number, frameH: number, columns: number, rows: number, animations?: Record<string, number[]>): Atlas {
    const name = (i: number): string => `frame_${String(i).padStart(2, '0')}`;
    const frames: Atlas['frames'] = {};
    for (let i = 0; i < columns * rows; i++) {
        frames[name(i)] = { frame: { x: (i % columns) * frameW, y: Math.floor(i / columns) * frameH, w: frameW, h: frameH }, sourceSize: { w: frameW, h: frameH } };
    }
    const atlas: Atlas = { frames, meta: { image, size: { w: sheet.width, h: sheet.height }, scale: 1 } };
    if (animations) atlas.animations = Object.fromEntries(Object.entries(animations).map(([tag, list]) => [tag, list.map(name)]));
    return atlas;
}

// --- the whole recipe ----------------------------------------------------------------------------------------

export interface FrameOptions {
    frameW: number;
    frameH: number;
    palette: readonly Rgb[];
    outlineColor: Rgb;
    method?: ResizeMethod;
    anchor?: 'bottom' | 'center';
    key?: Rgb;
}

/**
 * Turns generated pictures into game frames. For a sprite there is one picture; for a sheet there is one per cell.
 * All frames get the SAME treatment, so a character does not change size or jump around between frames:
 *   1. cut out the key colour           2. find the box around ALL frames together and crop every frame to it
 *   3. shrink by one common factor so that box (plus the outline) fits the frame
 *   4. remove stray pixels              5. snap to the palette
 *   6. add the outline                  7. put it on a frame-sized canvas, feet at the bottom
 * Returns undefined when a frame set is entirely empty (nothing was left after the cut-out).
 */
export function processFrames(raws: Raster[], o: FrameOptions): Raster[] | undefined {
    const keyed = raws.map((r) => chromaKey(r, o.key));
    const boxes = keyed.map(contentBox).filter((b): b is Box => b !== undefined);
    if (boxes.length === 0) return undefined;
    const union = unionBox(boxes);

    const scale = Math.min((o.frameW - 2) / union.w, (o.frameH - 2) / union.h);
    const [w, h] = [Math.max(1, Math.round(union.w * scale)), Math.max(1, Math.round(union.h * scale))];

    return keyed.map((frame) => {
        let img = resize(crop(frame, union), w, h, o.method ?? 'nearest');
        img = quantize(despeckle(img), o.palette);
        img = outline(pad(img), o.outlineColor);
        return place(img, o.frameW, o.frameH, o.anchor ?? 'bottom');
    });
}

/** A full-screen picture: shrunk to size and snapped to the palette. No cut-out, no outline. */
export function processBackground(raw: Raster, width: number, height: number, palette: readonly Rgb[], method: ResizeMethod = 'box', dither = true): Raster {
    const small = resize(raw, width, height, method);
    for (let i = 3; i < small.data.length; i += 4) small.data[i] = 255; // backgrounds are fully opaque
    return quantize(small, palette, dither);
}
