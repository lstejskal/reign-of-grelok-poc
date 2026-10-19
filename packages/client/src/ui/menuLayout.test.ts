import { describe, expect, it } from 'vitest';
import { MENU_ROW_HEIGHT, MENU_TITLE_HEIGHT, centeredLayout, rowAt, rowRect } from './menuLayout';

describe('menu layout', () => {
  const layout = centeredLayout(4, true, 120, 160, 144);

  it('centres title and rows vertically', () => {
    const total = MENU_TITLE_HEIGHT + 4 * MENU_ROW_HEIGHT; // 64
    expect(layout.firstRowY).toBe((144 - total) / 2 + MENU_TITLE_HEIGHT);
  });

  it('lays rows out one under another, centred on the middle', () => {
    expect(rowRect(layout, 0).x).toBe(100);
    expect(rowRect(layout, 1).y - rowRect(layout, 0).y).toBe(MENU_ROW_HEIGHT);
  });

  it('finds the row under a point', () => {
    const r = rowRect(layout, 2);
    expect(rowAt(layout, 4, 160, r.y + 1)).toBe(2);
    expect(rowAt(layout, 4, 10, r.y + 1)).toBeUndefined(); // left of the menu
    expect(rowAt(layout, 2, 160, r.y + 1)).toBeUndefined(); // only two rows exist
  });
});
