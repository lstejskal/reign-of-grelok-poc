import type Phaser from 'phaser';
import { ART_SCALE } from '@grelok/engine';

// The game thinks in a tiny fixed "logical" resolution (classic SCUMM games used 320x200): every position, hotspot
// and piece of interface is in these units. The pictures have ART_SCALE times more detail (a background is 640x288),
// so the canvas is ART_SCALE times bigger and every scene's camera zooms by ART_SCALE: the interface looks exactly as
// at 320x200, and the art keeps all its pixels because it is drawn at 1/ART_SCALE (see artScale).
// The browser window is then a magnifying glass over the canvas - see scale.ts.
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 200;
export const CANVAS_WIDTH = GAME_WIDTH * ART_SCALE;
export const CANVAS_HEIGHT = GAME_HEIGHT * ART_SCALE;

/** Draw a picture from the game's assets at its true detail: one picture pixel per canvas pixel. */
export const artScale = 1 / ART_SCALE;

/** Every scene calls this first: its camera looks at the 320x200 world, magnified to fill the canvas. */
export function useLogicalCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(ART_SCALE).setOrigin(0, 0).setScroll(0, 0);
}

/** A pointer's position in game (320x200) units. Phaser's pointer.x/y are canvas pixels. */
export function logicalPointer(pointer: Phaser.Input.Pointer): [number, number] {
  return [Math.floor(pointer.x / ART_SCALE), Math.floor(pointer.y / ART_SCALE)];
}
