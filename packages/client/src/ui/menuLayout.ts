import { inRect } from './layout';
import type { Rect } from './layout';

// Where the rows of a menu are. Plain arithmetic, shared by the menu and the tests.

export const MENU_ROW_HEIGHT = 12;
export const MENU_TITLE_HEIGHT = 16;

export interface MenuLayout {
  /** Horizontal centre of the menu. */
  centerX: number;
  /** Top of the first row of choices. */
  firstRowY: number;
  width: number;
}

export function rowRect(layout: MenuLayout, index: number): Rect {
  return { x: layout.centerX - layout.width / 2, y: layout.firstRowY + index * MENU_ROW_HEIGHT, w: layout.width, h: MENU_ROW_HEIGHT };
}

/** Index of the row under a point, or undefined. */
export function rowAt(layout: MenuLayout, count: number, x: number, y: number): number | undefined {
  for (let i = 0; i < count; i++) if (inRect(rowRect(layout, i), x, y)) return i;
  return undefined;
}

/** A menu centred on the screen: the title above the rows, all of it vertically centred in `height`. */
export function centeredLayout(count: number, hasTitle: boolean, width: number, centerX: number, height: number): MenuLayout {
  const total = (hasTitle ? MENU_TITLE_HEIGHT : 0) + count * MENU_ROW_HEIGHT;
  const top = Math.floor((height - total) / 2);
  return { centerX, width, firstRowY: top + (hasTitle ? MENU_TITLE_HEIGHT : 0) };
}
