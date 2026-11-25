// Generates placeholder pictures for every scene of a game, so the engine can be built and tested before
// any real art exists:  npm run placeholders [-- <game-id>] [--force]
//
//   assets/backgrounds/<location>.png   640x288 (art is ART_SCALE x the scene), a colour per location + a 16px grid
//   assets/walkmasks/<location>.png     320x144, grayscale: white = the player may walk here, black = blocked
//   assets/sprites/<player>.png         the player's sheet (see GameConfig.player): a stocky horned-helmet figure, 4 facings x 3 frames
//   assets/sprites/<name>.png           every picture a scene sprite uses: a coloured figure the size of its thing's hotspot
//   assets/icons/<thing>.png            48x32, one per pickable thing: a coloured tile with a little symmetric pattern
//
// Pictures are drawn at scene size and then doubled (ART_SCALE), so placeholders stay blocky on purpose.
// Existing files are never overwritten (real art will replace these under the same names) unless --force.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { ART_SCALE, ICON_HEIGHT, ICON_WIDTH, PLAYER_FACING_ROWS, PLAYER_SHEET_COLUMNS, SCENE_HEIGHT as H, SCENE_WIDTH as W, iconPath } from '../packages/engine/src';
import type { Facing } from '../packages/engine/src';
import { GAMES_DIR, loadGameBundle } from '../packages/engine/node/loadGameBundle';
import { decodePng, encodePng } from './art/config';
import { resize } from './art/pipeline';

/** Art has ART_SCALE picture pixels per scene pixel: blow a scene-sized placeholder up to that (nearest neighbour). */
function artUp(png: Buffer): Buffer {
    const img = decodePng(png);
    return encodePng(resize(img, img.width * ART_SCALE, img.height * ART_SCALE, 'nearest'));
}

const HORIZON_Y = 40; // sky above, ground below
const WALK_TOP = 30; // the walkable floor starts here
const WALK_MARGIN = 4;

type Rgb = [number, number, number];

// [sky, ground] per grelok location. Other games get a colour derived from the location name.
const PALETTES: Record<string, [Rgb, Rgb]> = {
    plain: [[106, 159, 216], [76, 138, 60]],
    mountain: [[138, 43, 43], [58, 50, 50]],
    town: [[200, 164, 106], [122, 106, 88]],
    swamp: [[74, 106, 74], [46, 74, 46]],
    chapel: [[106, 106, 138], [58, 74, 58]],
    chapel_interior: [[42, 32, 48], [74, 58, 48]],
};

// Blocked rectangles [x0, y0, x1, y1) (not walkable), so there is something to walk around.
const OBSTACLES: Record<string, [number, number, number, number][]> = {
    plain: [[136, 88, 184, 100]], // the base of the standing stone
    swamp: [[128, 70, 200, 84]], // the base of the wizard's tower
};
const inObstacle = (location: string, x: number, y: number) =>
    (OBSTACLES[location] ?? []).some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);

function paletteFor(location: string): [Rgb, Rgb] {
    const known = PALETTES[location];
    if (known) return known;
    const hue = [...location].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
    return [hsl(hue, 0.45, 0.55), hsl(hue, 0.4, 0.3)];
}

function hsl(h: number, s: number, l: number): Rgb {
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
}

function setPixel(png: PNG, x: number, y: number, [r, g, b]: Rgb): void {
    const i = (y * W + x) * 4;
    png.data[i] = Math.max(0, Math.min(255, Math.round(r)));
    png.data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    png.data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    png.data[i + 3] = 255;
}

function makeBackground(location: string): Buffer {
    const [sky, ground] = paletteFor(location);
    const png = new PNG({ width: W, height: H });

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const base = y < HORIZON_Y ? sky : ground;
            // sky gets lighter towards the horizon, ground darker towards the viewer
            const shade = y < HORIZON_Y ? 0.8 + 0.3 * (y / HORIZON_Y) : 1 - 0.35 * ((y - HORIZON_Y) / (H - HORIZON_Y));
            let k = shade;
            if (x % 16 === 0 || y % 16 === 0) k *= 0.88; // grid, to see scale and position
            if (x % 64 === 0 || y % 64 === 0) k *= 0.8;
            let color: Rgb = [base[0] * k, base[1] * k, base[2] * k];
            if (y === HORIZON_Y) color = [20, 20, 20];
            if (inObstacle(location, x, y)) color = [70, 52, 40]; // an obstacle, drawn so you can see it
            if (x === 0 || y === 0 || x === W - 1 || y === H - 1) color = [235, 235, 235];
            setPixel(png, x, y, color);
        }
    }
    return PNG.sync.write(png);
}

function makeWalkmask(location: string): Buffer {
    const png = new PNG({ width: W, height: H });
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const walkable = y >= WALK_TOP && x >= WALK_MARGIN && x < W - WALK_MARGIN && !inObstacle(location, x, y);
            const v = walkable ? 255 : 0;
            setPixel(png, x, y, [v, v, v]);
        }
    }
    // grayscale, 8 bit per pixel: much smaller than RGBA and exactly what the mask is
    return PNG.sync.write(png, { colorType: 0, inputColorType: 6, inputHasAlpha: true });
}

// A small hash, so every thing always gets the same colour and pattern.
function hashOf(text: string): number {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    return h;
}

function makeIcon(alias: string): Buffer {
    const png = new PNG({ width: ICON_WIDTH, height: ICON_HEIGHT });
    const h = hashOf(alias);
    const base = hsl(h % 360, 0.55, 0.45);
    const light = hsl(h % 360, 0.55, 0.7);
    const dark = hsl(h % 360, 0.55, 0.2);
    const set = (x: number, y: number, c: Rgb) => {
        const i = (y * ICON_WIDTH + x) * 4;
        png.data[i] = c[0];
        png.data[i + 1] = c[1];
        png.data[i + 2] = c[2];
        png.data[i + 3] = 255;
    };
    for (let y = 0; y < ICON_HEIGHT; y++) {
        for (let x = 0; x < ICON_WIDTH; x++) {
            const edge = x === 0 || y === 0 || x === ICON_WIDTH - 1 || y === ICON_HEIGHT - 1;
            set(x, y, edge ? dark : base);
        }
    }
    // a left-right symmetric 5x3 pattern of 3x3 blocks, decided by the hash (an "identicon")
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            if (((h >>> (8 + row * 3 + col)) & 1) === 0) continue;
            for (const c of [col, 4 - col]) {
                for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) set(4 + c * 3 + dx, 2 + row * 4 + dy, light);
            }
        }
    }
    return PNG.sync.write(png);
}

// --- the player's sprite sheet ------------------------------------------------------------------

const SKIN: Rgb = [224, 160, 112];
const BEARD: Rgb = [208, 112, 32];
const FUR: Rgb = [138, 90, 43];
const BELT: Rgb = [58, 42, 26];
const PANTS: Rgb = [90, 64, 40];
const BOOTS: Rgb = [40, 30, 24];
const HELMET: Rgb = [160, 160, 176];
const HORN: Rgb = [240, 232, 208];
const AXE: Rgb = [200, 200, 212];
const OUTLINE: Rgb = [20, 16, 16];

/** One 32x48 frame of the figure, facing 's' | 'n' | 'e' | 'w', frame 0 = idle, 1 and 2 = the two walking poses. */
function drawGrognak(facing: Facing, frame: number, fw: number, fh: number): (Rgb | undefined)[][] {
    const px: (Rgb | undefined)[][] = Array.from({ length: fh }, () => Array<Rgb | undefined>(fw).fill(undefined));
    const rect = (x: number, y: number, w: number, h: number, c: Rgb) => {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px[yy]![xx] = c;
    };
    const side = facing === 'e' || facing === 'w';
    const stride = frame === 0 ? 0 : frame === 1 ? 3 : -3; // how far the legs swing

    // legs and boots (the feet end on the bottom row, which is where the sprite "stands")
    if (side) {
        rect(10 + stride, 36, 6, 8, PANTS);
        rect(16 - stride, 36, 6, 8, PANTS);
        rect(9 + stride, 44, 8, 4, BOOTS);
        rect(15 - stride, 44, 8, 4, BOOTS);
    } else {
        rect(8, 36, 7, 8 - (stride > 0 ? 2 : 0), PANTS);
        rect(17, 36, 7, 8 - (stride < 0 ? 2 : 0), PANTS);
        rect(7, 44 - (stride > 0 ? 2 : 0), 9, 4 + (stride > 0 ? 2 : 0), BOOTS);
        rect(16, 44 - (stride < 0 ? 2 : 0), 9, 4 + (stride < 0 ? 2 : 0), BOOTS);
    }
    // torso (fur tunic) and belt; broad, like a dwarf's
    const bodyX = side ? 8 : 5;
    const bodyW = side ? 16 : 22;
    rect(bodyX, 20, bodyW, 16, FUR);
    rect(bodyX, 32, bodyW, 3, BELT);
    // arms
    if (!side) {
        rect(1, 21, 4, 12, SKIN);
        rect(27, 21, 4, 12, SKIN);
        if (facing === 's') rect(28, 14, 4, 8, AXE); // the axe head, held up on his right
    } else {
        rect(14, 22, 5, 11, SKIN);
        rect(facing === 'e' ? 20 : 7, 14, 5, 6, AXE);
    }
    // head: helmet with horns, face, beard
    const headX = 10;
    rect(headX, 8, 12, 12, SKIN);
    rect(headX - 1, 3, 14, 6, HELMET);
    rect(headX - 3, 1, 3, 5, HORN);
    rect(headX + 12, 1, 3, 5, HORN);
    if (facing === 's') {
        rect(13, 12, 2, 2, OUTLINE);
        rect(18, 12, 2, 2, OUTLINE);
        rect(headX, 15, 12, 7, BEARD);
    } else if (facing === 'n') {
        rect(headX, 8, 12, 12, HELMET); // the back of the helmet
    } else {
        const dir = facing === 'e' ? 1 : -1;
        const eyeX = facing === 'e' ? 19 : 12;
        rect(eyeX, 12, 2, 2, OUTLINE);
        rect(headX + (dir > 0 ? 6 : 0), 15, 6, 7, BEARD);
        rect(facing === 'e' ? 22 : 8, 13, 2, 3, SKIN); // nose
    }

    // a dark outline around the whole figure, which reads well on any background
    const copy = px.map((row) => row.slice());
    for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
            if (copy[y]![x] !== undefined) continue;
            const next = [copy[y - 1]?.[x], copy[y + 1]?.[x], copy[y]?.[x - 1], copy[y]?.[x + 1]];
            if (next.some((c) => c !== undefined)) px[y]![x] = OUTLINE;
        }
    }
    return px;
}

function makePlayerSheet(frameWidth: number, frameHeight: number): Buffer {
    const png = new PNG({ width: frameWidth * PLAYER_SHEET_COLUMNS, height: frameHeight * PLAYER_FACING_ROWS.length });
    PLAYER_FACING_ROWS.forEach((facing, row) => {
        for (let col = 0; col < PLAYER_SHEET_COLUMNS; col++) {
            drawGrognak(facing, col, frameWidth, frameHeight).forEach((line, y) =>
                line.forEach((color, x) => {
                    const i = ((row * frameHeight + y) * png.width + col * frameWidth + x) * 4;
                    png.data[i] = color?.[0] ?? 0;
                    png.data[i + 1] = color?.[1] ?? 0;
                    png.data[i + 2] = color?.[2] ?? 0;
                    png.data[i + 3] = color === undefined ? 0 : 255; // transparent outside the figure
                }),
            );
        }
    });
    return PNG.sync.write(png);
}

/** A scene sprite's placeholder: a coloured block with a dark outline, rounded at the top, as big as `w` x `h`. */
function makeSprite(name: string, w: number, h: number): Buffer {
    const png = new PNG({ width: w, height: h });
    const hue = hashOf(name) % 360;
    const base = hsl(hue, 0.5, 0.45);
    const light = hsl(hue, 0.5, 0.65);
    const dark = hsl(hue, 0.5, 0.15);
    const round = Math.min(4, Math.floor(Math.min(w, h) / 3));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const cx = Math.min(x, w - 1 - x);
            const cutCorner = y < round && cx < round - y; // the two top corners stay see-through
            const i = (y * w + x) * 4;
            if (cutCorner) continue;
            const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || (y < round && cx === round - y - 1);
            const colour = edge ? dark : x < w / 3 && y < h / 2 ? light : base;
            [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]] = [colour[0], colour[1], colour[2], 255];
        }
    }
    return PNG.sync.write(png);
}

function writeAsset(gameId: string, relative: string, data: Buffer, force: boolean): string {
    const file = path.join(GAMES_DIR, gameId, 'assets', relative);
    if (fs.existsSync(file) && !force) return `kept    ${relative}`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    return `wrote   ${relative}`;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const gameId = args.find((a) => !a.startsWith('--')) ?? 'grelok';

for (const location of Object.keys(loadGameBundle(gameId).logic.locations)) {
    console.log(writeAsset(gameId, `backgrounds/${location}.png`, artUp(makeBackground(location)), force));
    console.log(writeAsset(gameId, `walkmasks/${location}.png`, makeWalkmask(location), force));
}
for (const thing of Object.values(loadGameBundle(gameId).logic.things)) {
    if (thing.pickable) console.log(writeAsset(gameId, iconPath(thing.alias), artUp(makeIcon(thing.alias)), force));
}
{
    const { sprite, frameWidth, frameHeight } = loadGameBundle(gameId).config.player;
    console.log(writeAsset(gameId, sprite, artUp(makePlayerSheet(frameWidth / ART_SCALE, frameHeight / ART_SCALE)), force));
}
{
    // scene sprites: as big as the hotspot of their thing (or 24x32 when they have none)
    const bundle = loadGameBundle(gameId);
    for (const scene of Object.values(bundle.scenes)) {
        for (const sprite of scene.sprites ?? []) {
            const hotspot = scene.hotspots.find((h) => h.id === sprite.thing);
            const xs = hotspot?.polygon.map((p) => p[0]) ?? [0, 24];
            const ys = hotspot?.polygon.map((p) => p[1]) ?? [0, 32];
            const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
            for (const state of sprite.states) console.log(writeAsset(gameId, state.image, artUp(makeSprite(state.image, w, h)), force));
        }
    }
}
