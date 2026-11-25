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


// --- choosing a palette for ONE picture ------------------------------------------------------------------------
// Real Mega Drive pictures did not share one palette: each had a few colours picked to suit it (a zombie wants greens,
// a sunset wants oranges). We do the same, but every colour must still be one the console could show (9-bit RGB:
// each of red, green, blue is one of 8 levels), so everything keeps the same chunky look.

/** How many colours a picture's own palette gets by default (the outline counts as one). */
export const DEFAULT_SPRITE_COLORS = 16;
export const DEFAULT_BACKGROUND_COLORS = 32;

export const MEGA_DRIVE_LEVELS = [0, 52, 87, 116, 144, 172, 206, 255] as const;

/** The nearest colour the Mega Drive could show. */
export function snapToMegaDrive(color: Rgb): Rgb {
    return color.map((c) => MEGA_DRIVE_LEVELS.reduce((best, level) => (Math.abs(level - c) < Math.abs(best - c) ? level : best))) as Rgb;
}

/**
 * Picks the `count` colours that best describe the visible pixels of these pictures (all together, so the frames of a
 * sheet get one shared palette). `reserved` colours (like the outline) are always included and use up part of `count`.
 *
 * How: 1. count the colours (grouped coarsely, 32 levels per channel).  2. median cut: keep splitting the group with
 * the most variety in half, until there are enough groups.  3. a few rounds of k-means: move each colour to the average
 * of the pixels nearest to it.  4. snap to Mega Drive colours.
 * Counts are square-rooted first, so a small but distinctive area (red wounds, yellow teeth, a glowing gem) is not
 * swallowed by the big areas around it.
 */
export function buildPalette(images: Raster[], count: number, reserved: readonly Rgb[] = []): Rgb[] {
    const want = Math.max(1, count - reserved.length);
    const bins = 32768; // 5 bits per channel
    const [n, sr, sg, sb] = [new Float64Array(bins), new Float64Array(bins), new Float64Array(bins), new Float64Array(bins)];
    for (const img of images) {
        for (let i = 0; i < img.data.length; i += 4) {
            if (img.data[i + 3]! < ALPHA_ON) continue;
            const [r, g, b] = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
            const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
            n[key]!++;
            sr[key]! += r;
            sg[key]! += g;
            sb[key]! += b;
        }
    }
    interface Point { c: Rgb; w: number }
    const points: Point[] = [];
    for (let k = 0; k < bins; k++) if (n[k]! > 0) points.push({ c: [sr[k]! / n[k]!, sg[k]! / n[k]!, sb[k]! / n[k]!], w: Math.sqrt(n[k]!) });
    if (points.length === 0) return [...reserved];

    const mean = (group: Point[]): Rgb => {
        const total = group.reduce((a, p) => a + p.w, 0);
        return [0, 1, 2].map((ch) => group.reduce((a, p) => a + p.c[ch]! * p.w, 0) / total) as Rgb;
    };
    const spread = (group: Point[]): number => {
        const m = mean(group);
        return group.reduce((a, p) => a + p.w * (3 * (p.c[0] - m[0]) ** 2 + 4 * (p.c[1] - m[1]) ** 2 + 2 * (p.c[2] - m[2]) ** 2), 0);
    };

    const cluster = (k: number): Rgb[] => {
        // median cut
        const groups: Point[][] = [points];
        while (groups.length < k) {
            let [pick, most] = [-1, 0];
            groups.forEach((g, i) => {
                const s = g.length > 1 ? spread(g) : 0;
                if (s > most) [pick, most] = [i, s];
            });
            if (pick < 0) break;
            const group = groups[pick]!;
            const ranges = [0, 1, 2].map((ch) => Math.max(...group.map((p) => p.c[ch]!)) - Math.min(...group.map((p) => p.c[ch]!)));
            const weights = [3, 4, 2];
            const axis = [0, 1, 2].reduce((best, ch) => (ranges[ch]! * weights[ch]! > ranges[best]! * weights[best]! ? ch : best), 0);
            group.sort((a, b) => a.c[axis]! - b.c[axis]!);
            const half = group.reduce((a, p) => a + p.w, 0) / 2;
            let [run, cut] = [0, 0];
            while (cut < group.length - 1 && run + group[cut]!.w < half) run += group[cut++]!.w;
            cut = Math.min(group.length - 1, Math.max(1, cut));
            groups.splice(pick, 1, group.slice(0, cut), group.slice(cut));
        }
        // k-means
        let centers = groups.map(mean);
        for (let round = 0; round < 6; round++) {
            const members: Point[][] = centers.map(() => []);
            for (const p of points) members[nearestIndex(p.c, centers)]!.push(p);
            centers = centers.map((c, i) => (members[i]!.length > 0 ? mean(members[i]!) : c));
        }
        // snap, and drop duplicates (two centres can land on the same Mega Drive colour) and the reserved colours
        const seen = new Set(reserved.map(hexOf));
        const unique: Rgb[] = [];
        for (const c of centers.map(snapToMegaDrive)) {
            if (seen.has(hexOf(c))) continue;
            seen.add(hexOf(c));
            unique.push(c);
        }
        return unique;
    };

    // Duplicates leave slots empty, so ask for a few more centres until the palette is full (or can not grow).
    let chosen = cluster(want);
    for (let k = want + 1; chosen.length < want && k <= want * 2; k++) {
        const more = cluster(k);
        if (more.length > want) break;
        if (more.length > chosen.length) chosen = more;
    }
    chosen.sort((a, b) => a[0] + 2 * a[1] + a[2] - (b[0] + 2 * b[1] + b[2]));
    return [...reserved, ...chosen];
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

export type ResizeMethod = 'dominant' | 'nearest' | 'box';

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


/**
 * Shrinks to exactly width x height AND snaps to the palette in one go: every new pixel takes the palette colour that
 * most of its source pixels have (the "dominant" colour), and is see-through when fewer than half of them are visible.
 * Unlike 'box' it never invents in-between colours, so a thin dark line stays dark and a red wound stays red instead of
 * both dissolving into a muddy average. Dark pixels count a little extra so outlines and eyes survive the shrinking.
 */
export function resizeDominant(img: Raster, width: number, height: number, palette: readonly Rgb[]): Raster {
    const out = blank(width, height);
    const cache = new Int16Array(32768).fill(-1);
    const indexOf = (i: number): number => {
        if (img.data[i + 3]! < ALPHA_ON) return -1;
        const [r, g, b] = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        if (cache[key]! < 0) cache[key] = nearestIndex([r, g, b], palette);
        return cache[key]!;
    };
    const darkness = palette.map((c) => 1 + 0.6 * Math.max(0, 1 - (c[0] + 2 * c[1] + c[2]) / (4 * 110)));
    const [sx, sy] = [img.width / width, img.height / height];
    const votes = new Float64Array(palette.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [x0, y0] = [Math.floor(x * sx), Math.floor(y * sy)];
            const [x1, y1] = [Math.min(img.width, Math.max(x0 + 1, Math.ceil((x + 1) * sx))), Math.min(img.height, Math.max(y0 + 1, Math.ceil((y + 1) * sy)))];
            votes.fill(0);
            let [visible, total] = [0, 0];
            for (let yy = y0; yy < y1; yy++) {
                for (let xx = x0; xx < x1; xx++) {
                    total++;
                    const k = indexOf(at(img, xx, yy));
                    if (k < 0) continue;
                    visible++;
                    votes[k]! += darkness[k]!;
                }
            }
            if (visible * 2 < total) continue;
            let best = 0;
            for (let k = 1; k < palette.length; k++) if (votes[k]! > votes[best]!) best = k;
            const c = palette[best]!;
            out.data.set([c[0], c[1], c[2], 255], at(out, x, y));
        }
    }
    return out;
}

/** Scales a picture so it covers width x height, then trims the overhang: `focus` 0 keeps the top/left, 1 the bottom/right, 0.5 the middle. Never stretches. */
export function coverCrop(img: Raster, width: number, height: number, focus = 0.5): Raster {
    const wanted = width / height;
    const have = img.width / img.height;
    if (Math.abs(wanted - have) < 1e-6) return img;
    if (have < wanted) {
        const h = Math.round(img.width / wanted);
        return crop(img, { x: 0, y: Math.round((img.height - h) * focus), w: img.width, h });
    }
    const w = Math.round(img.height * wanted);
    return crop(img, { x: Math.round((img.width - w) * focus), y: 0, w, h: img.height });
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
    outlineColor: Rgb;
    /** Snap to this fixed palette. Leave out to choose the best `colors` colours for the picture itself (the default). */
    palette?: readonly Rgb[];
    /** Colours in the picture's own palette, the outline included (default DEFAULT_SPRITE_COLORS). */
    colors?: number;
    method?: ResizeMethod;
    anchor?: 'bottom' | 'center';
    key?: Rgb;
    /**
     * Draw the figure this much smaller (0..1, default 1) on the same frame-sized canvas, feet still at the bottom.
     * Used to make a character's sheet in several sizes for perspective, each shrunk from the raw picture itself.
     */
    fit?: number;
}

/**
 * The palette processFrames would choose for these pictures. Computed once and handed to every size of a sheet, so
 * all sizes use exactly the same colours.
 */
export function framesPalette(raws: Raster[], o: Pick<FrameOptions, 'colors' | 'outlineColor' | 'key'>): Rgb[] | undefined {
    const keyed = raws.map((r) => chromaKey(r, o.key));
    const boxes = keyed.map(contentBox).filter((b): b is Box => b !== undefined);
    if (boxes.length === 0) return undefined;
    const union = unionBox(boxes);
    return buildPalette(keyed.map((frame) => crop(frame, union)), o.colors ?? DEFAULT_SPRITE_COLORS, [o.outlineColor]);
}

/**
 * Turns generated pictures into game frames. For a sprite there is one picture; for a sheet there is one per cell.
 * All frames get the SAME treatment, so a character does not change size, colour or jump around between frames:
 *   1. cut out the key colour           2. find the box around ALL frames together and crop every frame to it
 *   3. choose the palette (from all frames together, unless a fixed one was given)
 *   4. shrink by one common factor so that box (plus the outline) fits the frame, snapping to the palette
 *   5. remove stray pixels              6. add the outline
 *   7. put it on a frame-sized canvas, feet at the bottom
 * Returns undefined when a frame set is entirely empty (nothing was left after the cut-out).
 */
export function processFrames(raws: Raster[], o: FrameOptions): Raster[] | undefined {
    const keyed = raws.map((r) => chromaKey(r, o.key));
    const boxes = keyed.map(contentBox).filter((b): b is Box => b !== undefined);
    if (boxes.length === 0) return undefined;
    const union = unionBox(boxes);
    const cropped = keyed.map((frame) => crop(frame, union));
    const palette = o.palette ?? buildPalette(cropped, o.colors ?? DEFAULT_SPRITE_COLORS, [o.outlineColor]);

    const scale = Math.min((o.frameW - 2) / union.w, (o.frameH - 2) / union.h) * (o.fit ?? 1);
    const [w, h] = [Math.max(1, Math.round(union.w * scale)), Math.max(1, Math.round(union.h * scale))];

    return cropped.map((frame) => {
        let img: Raster;
        if ((o.method ?? 'dominant') === 'dominant') img = resizeDominant(frame, w, h, palette);
        else img = quantize(resize(frame, w, h, o.method), palette);
        img = outline(pad(despeckle(img)), o.outlineColor);
        return place(img, o.frameW, o.frameH, o.anchor ?? 'bottom');
    });
}

/**
 * The cells of a multi-part sheet, in slot order, made comparable before they are treated together.
 *
 * Every part is a separate picture from an image generator, which picks its own canvas and its own figure size: the
 * side walk may come back as 341x768 cells with a tall figure, the talk as 627x627 cells with a smaller one. processFrames
 * crops all frames to ONE shared box in cell coordinates, so without this step a figure low in a tall cell and one in a
 * short cell span a box twice as tall as either: every frame shrinks and the short cells' figures float.
 *   1. cut out the key colour (so figures can be measured)
 *   2. scale each part so its TALLEST figure is as tall as the tallest figure of all parts (Grognak is one size)
 *   3. put every cell on one common canvas: centred, and each part's lowest foot on the same line. Within a part the
 *      cells keep their positions relative to each other, so a walk's bob or a reach's lean survive.
 * A sheet from a single picture is returned as it is (its cells already share one coordinate space).
 */
export function partCells(parts: { raw: Raster; grid: [number, number] }[], slots: { part: number; cell: number }[], key?: Rgb): Raster[] {
    const cells = parts.map((p) => sliceGrid(p.raw, p.grid[0], p.grid[1]));
    const picked = slots.map((s) => cells[s.part]![s.cell]!);
    if (parts.length < 2) return picked;

    const keyed = picked.map((c) => chromaKey(c, key));
    const boxes = keyed.map(contentBox);
    const byPart = (p: number) => slots.map((s, i) => (s.part === p ? boxes[i] : undefined)).filter((b): b is Box => b !== undefined);
    const tallest = parts.map((_, p) => Math.max(0, ...byPart(p).map((b) => b.h)));
    const lowest = parts.map((_, p) => Math.max(0, ...byPart(p).map((b) => b.y + b.h)));
    const reference = Math.max(...tallest);
    const factor = tallest.map((h) => (h > 0 ? reference / h : 1));

    const scaled = keyed.map((c, i) => {
        const f = factor[slots[i]!.part]!;
        return f === 1 ? c : resize(c, Math.max(1, Math.round(c.width * f)), Math.max(1, Math.round(c.height * f)), 'nearest');
    });
    const footLine = Math.max(...slots.map((s) => Math.round(lowest[s.part]! * factor[s.part]!)));
    const top = scaled.map((c, i) => footLine - Math.round(lowest[slots[i]!.part]! * factor[slots[i]!.part]!));
    const width = Math.max(...scaled.map((c) => c.width));
    const height = Math.max(...scaled.map((c, i) => top[i]! + c.height));
    return scaled.map((c, i) => {
        const out = blank(width, height);
        const [ox, oy] = [Math.floor((width - c.width) / 2), top[i]!];
        for (let y = 0; y < c.height; y++) out.data.set(c.data.subarray(at(c, 0, y), at(c, c.width, y)), at(out, ox, oy + y));
        return out;
    });
}

/**
 * A sheet assembled from several generated pictures ("parts", one per animation). Every cell of every part goes
 * through ONE processFrames call, so all frames share the same scale, palette and outline - Grognak must not change
 * size or colour between his walk and his talk. `slots` (see sheetLayout) says which cell lands on which frame of a
 * `columns` x `rows` sheet; frames no slot fills stay transparent.
 */
export function processPartsSheet(
    parts: { raw: Raster; grid: [number, number] }[],
    slots: { part: number; cell: number; frame: number }[],
    columns: number,
    rows: number,
    o: FrameOptions,
): Raster | undefined {
    const frames = processFrames(partCells(parts, slots, o.key), o);
    if (!frames) return undefined;
    const sheet: Raster[] = Array.from({ length: columns * rows }, () => blank(o.frameW, o.frameH));
    slots.forEach((s, i) => (sheet[s.frame] = frames[i]!));
    return composeGrid(sheet, columns);
}

export interface BackgroundOptions {
    /** Snap to this fixed palette. Leave out to choose the best `colors` colours for the picture itself (the default). */
    palette?: readonly Rgb[];
    /** Colours in the picture's own palette (default DEFAULT_BACKGROUND_COLORS). */
    colors?: number;
    method?: ResizeMethod;
    /** Ordered dithering (a fine checkerboard between two colours). Off by default: on a whole scene it shows as a screen-door pattern. */
    dither?: boolean;
    /** Where to trim when the picture is not the game's shape: 0 = keep the top, 1 = the bottom, 0.5 = the middle. */
    focus?: number;
}

/** A full-screen picture: trimmed to the game's shape (not stretched), shrunk to size and snapped to a palette. No cut-out, no outline. */
export function processBackground(raw: Raster, width: number, height: number, o: BackgroundOptions = {}): Raster {
    const cover = coverCrop(raw, width, height, o.focus);
    for (let i = 3; i < cover.data.length; i += 4) cover.data[i] = 255; // backgrounds are fully opaque
    const palette = o.palette ?? buildPalette([cover], o.colors ?? DEFAULT_BACKGROUND_COLORS);
    const method = o.method ?? 'dominant';
    if (method === 'dominant' && !o.dither) return resizeDominant(cover, width, height, palette);
    const small = resize(cover, width, height, method === 'dominant' ? 'box' : method);
    return quantize(small, palette, o.dither ?? false);
}
