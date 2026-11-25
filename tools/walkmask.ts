// Turns a scene's `walkArea:` polygons into its walkmask picture (white = floor, black = blocked).
// Why polygons: a walkmask drawn by hand in a paint program drifts away from the background it belongs to and is hard
// to review. A few points in the scene file are easy to read, to diff and to adjust when the background changes.
import { PNG } from 'pngjs';
import type { WalkAreaData } from '../packages/engine/src';
import { pointInPolygon } from '../packages/client/src/scene/hitTest';

/** One byte per pixel, row by row: 255 = floor, 0 = blocked. Each pixel is judged by its centre (x + 0.5, y + 0.5). */
export function renderWalkArea(area: WalkAreaData, width: number, height: number): Uint8Array {
    const out = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const p: [number, number] = [x + 0.5, y + 0.5];
            const floor = area.floor.some((polygon) => pointInPolygon(p, polygon));
            const blocked = (area.blocked ?? []).some((polygon) => pointInPolygon(p, polygon));
            out[y * width + x] = floor && !blocked ? 255 : 0;
        }
    }
    return out;
}

/** An 8-bit grayscale PNG: the format the placeholder walkmasks already use. */
export function encodeWalkmask(pixels: Uint8Array, width: number, height: number): Buffer {
    const png = new PNG({ width, height });
    pixels.forEach((v, i) => {
        png.data.set([v, v, v, 255], i * 4);
    });
    return PNG.sync.write(png, { colorType: 0, inputColorType: 6, inputHasAlpha: true });
}
