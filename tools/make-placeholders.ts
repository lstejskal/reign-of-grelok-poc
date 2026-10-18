// Generates placeholder pictures for every scene of a game, so the engine can be built and tested before
// any real art exists:  npm run placeholders [-- <game-id>] [--force]
//
//   assets/backgrounds/<location>.png   320x144, a colour per location + a 16px grid
//   assets/walkmasks/<location>.png     320x144, grayscale: white = the player may walk here, black = blocked
//   assets/icons/<thing>.png            24x16, one per pickable thing: a coloured tile with a little symmetric pattern
//
// Existing files are never overwritten (real art will replace these under the same names) unless --force.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { ICON_HEIGHT, ICON_WIDTH, SCENE_HEIGHT as H, SCENE_WIDTH as W, iconPath } from '../packages/engine/src';
import { GAMES_DIR, loadGameBundle } from '../packages/engine/node/loadGameBundle';

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
            if (x === 0 || y === 0 || x === W - 1 || y === H - 1) color = [235, 235, 235];
            setPixel(png, x, y, color);
        }
    }
    return PNG.sync.write(png);
}

function makeWalkmask(): Buffer {
    const png = new PNG({ width: W, height: H });
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const walkable = y >= WALK_TOP && x >= WALK_MARGIN && x < W - WALK_MARGIN;
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
    console.log(writeAsset(gameId, `backgrounds/${location}.png`, makeBackground(location), force));
    console.log(writeAsset(gameId, `walkmasks/${location}.png`, makeWalkmask(), force));
}
for (const thing of Object.values(loadGameBundle(gameId).logic.things)) {
    if (thing.pickable) console.log(writeAsset(gameId, iconPath(thing.alias), makeIcon(thing.alias), force));
}
