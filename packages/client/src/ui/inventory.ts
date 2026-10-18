import { ICON_HEIGHT, SCENE_HEIGHT } from '@grelok/engine';
import { inRect } from './layout';
import type { Rect } from './layout';

// The inventory panel: a grid of icon slots, filled column by column (down, then right), and scrolled
// sideways one column at a time. Everything here is plain arithmetic, so it is easy to test.

export const INVENTORY = {
  x: 112,
  y: SCENE_HEIGHT + 14,
  cols: 7,
  rows: 2,
  slotW: 26,
  slotH: ICON_HEIGHT,
};
export const SLOTS = INVENTORY.cols * INVENTORY.rows;

/** The two scroll buttons to the right of the grid. */
export const SCROLL_LEFT: Rect = { x: 296, y: INVENTORY.y, w: 10, h: INVENTORY.rows * INVENTORY.slotH };
export const SCROLL_RIGHT: Rect = { x: 308, y: INVENTORY.y, w: 10, h: INVENTORY.rows * INVENTORY.slotH };

/** How far the grid can scroll (in columns) for `count` items. */
export function maxScroll(count: number): number {
  return Math.max(0, Math.ceil(count / INVENTORY.rows) - INVENTORY.cols);
}

export function clampScroll(scroll: number, count: number): number {
  return Math.min(Math.max(0, scroll), maxScroll(count));
}

/** Which item is in each visible slot (slot 0 = top-left, 1 = below it, 2 = next column...). */
export function visibleItems<T>(items: readonly T[], scroll: number): (T | undefined)[] {
  const first = clampScroll(scroll, items.length) * INVENTORY.rows;
  return Array.from({ length: SLOTS }, (_, slot) => items[first + slot]);
}

export function slotRect(slot: number): Rect {
  const col = Math.floor(slot / INVENTORY.rows);
  const row = slot % INVENTORY.rows;
  return {
    x: INVENTORY.x + col * INVENTORY.slotW,
    y: INVENTORY.y + row * INVENTORY.slotH,
    w: INVENTORY.slotW,
    h: INVENTORY.slotH,
  };
}

/** Which visible slot is under the point (game pixels)? */
export function slotAt(x: number, y: number): number | undefined {
  for (let slot = 0; slot < SLOTS; slot++) if (inRect(slotRect(slot), x, y)) return slot;
  return undefined;
}

/** The thing shown under the point, if any. */
export function itemAt<T>(items: readonly T[], scroll: number, x: number, y: number): T | undefined {
  const slot = slotAt(x, y);
  return slot === undefined ? undefined : visibleItems(items, scroll)[slot];
}
