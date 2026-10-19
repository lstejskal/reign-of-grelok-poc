// Draws two STAND-IN "generated" pictures into art/raw/, so the art pipeline can be shown working before you have used a
// real image generator:   npm run sample-raw
//
//   art/raw/standing_stone.png   a menhir
//   art/raw/grognak.png          a 3x4 character sheet
//
// They imitate what an AI image tool gives you: four times bigger than the game needs, smooth shapes with
// anti-aliased edges, soft shading, colours that are NOT on the palette, a slightly noisy magenta background.
// Replace them with real generated pictures whenever you like (same file names) and run  npm run import-art.
import fs from 'node:fs';
import { encodePng, projectPath } from './art/config';
import { blank } from './art/pipeline';
import type { Raster, Rgb } from './art/pipeline';

const SS = 3; // supersampling: each pixel is tested at 3x3 points and the results averaged, which makes soft edges

type Painter = (x: number, y: number) => Rgb | undefined; // colour at a point, or undefined = not covered

function paint(img: Raster, shape: Painter, bounds: [number, number, number, number]): void {
    const [x0, y0, x1, y1] = bounds;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(img.height, Math.ceil(y1)); y++) {
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(img.width, Math.ceil(x1)); x++) {
            let [r, g, b, hits] = [0, 0, 0, 0];
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const c = shape(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
                    if (c) { r += c[0]; g += c[1]; b += c[2]; hits++; }
                }
            }
            if (hits === 0) continue;
            const cover = hits / (SS * SS);
            const i = (y * img.width + x) * 4;
            img.data[i] = img.data[i]! * (1 - cover) + (r / hits) * cover;
            img.data[i + 1] = img.data[i + 1]! * (1 - cover) + (g / hits) * cover;
            img.data[i + 2] = img.data[i + 2]! * (1 - cover) + (b / hits) * cover;
        }
    }
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A rotation-free ellipse with soft shading: lighter towards the upper left. */
function ellipse(img: Raster, cx: number, cy: number, rx: number, ry: number, base: Rgb, light: Rgb = base, dark: Rgb = base): void {
    paint(img, (x, y) => {
        const [dx, dy] = [(x - cx) / rx, (y - cy) / ry];
        if (dx * dx + dy * dy > 1) return undefined;
        const shade = (dx + dy) / 2; // -1 (upper left) .. 1 (lower right)
        return shade < 0 ? mix(base, light, -shade) : mix(base, dark, shade);
    }, [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1]);
}

/** ellipse() with the three shades given as one list. */
function ellipseC(img: Raster, cx: number, cy: number, rx: number, ry: number, c: Rgb[]): void {
    ellipse(img, cx, cy, rx, ry, c[0]!, c[1]!, c[2]!);
}

/** A rectangle, shaded left (light) to right (dark). */
function rect(img: Raster, x: number, y: number, w: number, h: number, base: Rgb, light: Rgb = base, dark: Rgb = base): void {
    paint(img, (px, py) => {
        if (px < x || px > x + w || py < y || py > y + h) return undefined;
        const t = (px - x) / w;
        return t < 0.5 ? mix(light, base, t * 2) : mix(base, dark, (t - 0.5) * 2);
    }, [x - 1, y - 1, x + w + 1, y + h + 1]);
}

/** rect() with the three shades given as one list. */
function rectC(img: Raster, x: number, y: number, w: number, h: number, c: Rgb[]): void {
    rect(img, x, y, w, h, c[0]!, c[1]!, c[2]!);
}

function polygon(img: Raster, points: [number, number][], base: Rgb, light: Rgb = base, dark: Rgb = base): void {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    paint(img, (x, y) => {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i]!;
            const [xj, yj] = points[j]!;
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (!inside) return undefined;
        const t = (x - minX) / (maxX - minX || 1);
        return t < 0.5 ? mix(light, base, t * 2) : mix(base, dark, (t - 0.5) * 2);
    }, [minX - 1, minY - 1, maxX + 1, maxY + 1]);
}

/** Magenta, like image generators give: not perfectly flat. */
function magentaBackground(width: number, height: number): Raster {
    const img = blank(width, height);
    let seed = 12345;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < img.data.length; i += 4) img.data.set([245 + random() * 10, random() * 14, 245 + random() * 10, 255], i);
    return img;
}

// --- the standing stone: 160 x 280 (the game wants 40 x 70) -----------------------------------------------------------
function standingStone(): Raster {
    const img = magentaBackground(160, 280);
    const [grey, lightGrey, darkGrey]: Rgb[] = [[128, 124, 130], [176, 172, 178], [82, 78, 90]];
    polygon(img, [[26, 276], [40, 40], [58, 8], [96, 2], [118, 22], [128, 60], [140, 276]], grey, lightGrey, darkGrey);
    polygon(img, [[26, 276], [40, 40], [58, 8], [64, 70], [58, 276]], lightGrey, [196, 192, 198], grey); // lit left face
    // cracks and runes
    for (const [x, y, w, h] of [[84, 60, 6, 26], [78, 100, 26, 6], [90, 140, 6, 34], [70, 184, 30, 6], [96, 224, 6, 22]] as const) rect(img, x, y, w, h, [60, 56, 70]);
    ellipse(img, 92, 100, 7, 7, [90, 150, 200], [150, 210, 255], [50, 100, 160]); // a glowing rune dot
    // moss at the base
    for (const [x, y, rx, ry] of [[48, 268, 26, 12], [84, 272, 22, 10], [120, 266, 20, 12]] as const) ellipse(img, x, y, rx, ry, [84, 140, 60], [130, 190, 90], [50, 100, 40]);
    return img;
}

// --- Grognak: 3 columns x 4 rows of 128 x 192 cells (the game wants 32 x 48 frames) ------------------------------------
type Facing = 'front' | 'back' | 'right' | 'left';

function grognak(facing: Facing, step: number): Raster {
    const img = magentaBackground(128, 192);
    const cx = 64;
    const side = facing === 'right' || facing === 'left';
    const dir = facing === 'left' ? -1 : 1;
    const skin: Rgb[] = [[222, 170, 130], [250, 206, 170], [170, 116, 88]];
    const iron: Rgb[] = [[150, 152, 164], [210, 212, 224], [90, 92, 110]];
    const fur: Rgb[] = [[140, 96, 60], [190, 140, 90], [90, 60, 36]];
    const leather: Rgb[] = [[110, 70, 40], [150, 100, 60], [70, 44, 28]];
    const bob = step === 0 ? 0 : 3; // standing is a bit taller than mid-stride
    const stride = step === 1 ? 14 : step === 2 ? -14 : 0;

    // legs
    if (side) {
        rectC(img, cx - 14 + stride * dir, 124, 22, 62 + bob, leather);
        rectC(img, cx - 6 - stride * dir, 124, 22, 62 + bob, leather);
    } else {
        rectC(img, cx - 30, 124, 26, 62 + bob - (step === 1 ? 8 : 0), leather);
        rectC(img, cx + 4, 124, 26, 62 + bob - (step === 2 ? 8 : 0), leather);
    }
    // boots
    for (const bx of side ? [cx - 18 + stride * dir, cx - 8 - stride * dir] : [cx - 34, cx + 2]) rect(img, bx, 176, 34, 14, [70, 50, 40], [100, 76, 60], [40, 28, 24]);
    // fur loincloth
    polygon(img, [[cx - 38, 112], [cx + 38, 112], [cx + 44, 150], [cx + 20, 140], [cx, 154], [cx - 20, 140], [cx - 44, 150]], fur[0]!, fur[1]!, fur[2]!);
    // torso (broad)
    polygon(img, [[cx - 46, 56], [cx + 46, 56], [cx + 38, 118], [cx - 38, 118]], skin[0]!, skin[1]!, skin[2]!);
    if (!side) rect(img, cx - 36, 100, 72, 10, [120, 80, 50]); // belt
    // arms
    if (side) {
        ellipseC(img, cx + 10 * dir, 84, 18, 40, skin);
    } else {
        ellipseC(img, cx - 56, 86, 17, 38, skin);
        ellipseC(img, cx + 56, 86, 17, 38, skin);
    }
    // sword (on the right arm, point up)
    const sx = side ? cx + 34 * dir : cx + 54;
    rect(img, sx - 4, 6, 9, 96, [200, 204, 214], [240, 244, 252], [140, 144, 160]);
    rect(img, sx - 12, 98, 25, 8, [190, 150, 60]);
    ellipseC(img, sx, 112, 9, 9, skin);
    // head
    ellipseC(img, cx, 38 + bob / 2, 30, 30, skin);
    if (facing === 'back') {
        ellipse(img, cx, 30, 32, 28, [110, 70, 40], [150, 100, 60], [70, 44, 28]); // hair from behind
    } else {
        // beard, braided
        polygon(img, [[cx - 26, 44], [cx + 26, 44], [cx + 18, 96], [cx, 110], [cx - 18, 96]], [110, 72, 44], [150, 104, 66], [70, 46, 28]);
        // eyes
        const eyes = side ? [[cx + 12 * dir, 34]] : [[cx - 12, 34], [cx + 12, 34]];
        for (const [ex, ey] of eyes) ellipse(img, ex!, ey!, 4, 5, [30, 24, 28]);
    }
    // horned helmet
    polygon(img, [[cx - 32, 40], [cx - 28, 8], [cx + 28, 8], [cx + 32, 40], [cx + 26, 24], [cx - 26, 24]], iron[0]!, iron[1]!, iron[2]!);
    polygon(img, [[cx - 30, 28], [cx - 62, 8], [cx - 74, -2], [cx - 56, 24], [cx - 40, 38]], [236, 226, 196], [255, 250, 230], [190, 176, 140]);
    polygon(img, [[cx + 30, 28], [cx + 62, 8], [cx + 74, -2], [cx + 56, 24], [cx + 40, 38]], [236, 226, 196], [255, 250, 230], [190, 176, 140]);
    return img;
}

function sheet(): Raster {
    const [cols, rows, cw, ch] = [3, 4, 128, 192];
    const out = blank(cols * cw, rows * ch);
    const facings: Facing[] = ['front', 'back', 'right', 'left'];
    facings.forEach((facing, row) =>
        [0, 1, 2].forEach((step, col) => {
            const cell = grognak(facing, step);
            for (let y = 0; y < ch; y++) out.data.set(cell.data.subarray(y * cw * 4, (y + 1) * cw * 4), ((row * ch + y) * out.width + col * cw) * 4);
        }),
    );
    return out;
}

fs.mkdirSync(projectPath('art/raw'), { recursive: true });
fs.writeFileSync(projectPath('art/raw/standing_stone.png'), encodePng(standingStone()));
fs.writeFileSync(projectPath('art/raw/grognak.png'), encodePng(sheet()));
console.log('wrote art/raw/standing_stone.png and art/raw/grognak.png (stand-ins for generated pictures)');
