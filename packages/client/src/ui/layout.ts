import { SCENE_HEIGHT } from '@grelok/engine';
import type { Verb } from '@grelok/engine';
import { VERBS } from './verbs';

// Where things sit in the 320x200 picture. Pure numbers, so tests (and the scene) share one source of truth.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SENTENCE_Y = SCENE_HEIGHT + 4;

const VERB_ROWS = 3;
export const VERB_GRID = { x: 4, y: SCENE_HEIGHT + 14, cellW: 52, cellH: 9 };

/**
 * Where the engine's answers appear: a dark band across the top of the scene (the bottom strip is full), 4 lines
 * of up to 52 characters. It is only drawn while there is something to read.
 */
export const TEXT_BOX: Rect = { x: 0, y: 0, w: 320, h: 38 };
export const TEXT_BOX_TEXT = { x: 4, y: 3 };
export const TEXT_BOX_LINES = 4;
export const TEXT_BOX_CHARS = 52;

export function verbRect(index: number): Rect {
  const col = Math.floor(index / VERB_ROWS);
  const row = index % VERB_ROWS;
  const { x, y, cellW, cellH } = VERB_GRID;
  return { x: x + col * cellW, y: y + row * cellH, w: cellW, h: cellH };
}

export function inRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/** Which verb button is under the point (game pixels)? */
export function verbAt(x: number, y: number): Verb | undefined {
  return VERBS.find((_, i) => inRect(verbRect(i), x, y))?.verb;
}
