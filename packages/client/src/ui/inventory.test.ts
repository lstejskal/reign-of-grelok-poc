import { describe, expect, it } from 'vitest';
import { INVENTORY, SCROLL_LEFT, SLOTS, clampScroll, itemAt, maxScroll, slotAt, slotRect, visibleItems } from './inventory';
import { inRect } from './layout';

const items = (n: number) => Array.from({ length: n }, (_, i) => `item${i}`);
const capacity = INVENTORY.cols * INVENTORY.rows; // 14

describe('inventory paging', () => {
  it('needs no scrolling while everything fits', () => {
    expect(maxScroll(0)).toBe(0);
    expect(maxScroll(capacity)).toBe(0);
  });

  it('scrolls one column (two items) at a time', () => {
    expect(maxScroll(capacity + 1)).toBe(1);
    expect(maxScroll(capacity + 2)).toBe(1);
    expect(maxScroll(capacity + 3)).toBe(2);
  });

  it('clamps the scroll position, e.g. after items were given away', () => {
    expect(clampScroll(5, capacity + 3)).toBe(2);
    expect(clampScroll(-1, 100)).toBe(0);
    expect(clampScroll(3, 2)).toBe(0);
  });

  it('fills slots top to bottom, then left to right', () => {
    const shown = visibleItems(items(5), 0);
    expect(shown).toHaveLength(SLOTS);
    expect(shown.slice(0, 5)).toEqual(['item0', 'item1', 'item2', 'item3', 'item4']);
    expect(shown[5]).toBeUndefined();
  });

  it('shows later items after scrolling', () => {
    const shown = visibleItems(items(capacity + 4), 2);
    expect(shown[0]).toBe('item4');
    expect(shown[SLOTS - 1]).toBe(`item${capacity + 3}`);
  });
});

describe('inventory hit testing', () => {
  it('finds the slot under a point, and nothing outside the grid', () => {
    for (let slot = 0; slot < SLOTS; slot++) {
      const r = slotRect(slot);
      expect(slotAt(r.x + 2, r.y + 2)).toBe(slot);
    }
    expect(slotAt(10, 170)).toBeUndefined(); // verb grid
    expect(slotAt(200, 100)).toBeUndefined(); // the scene
  });

  it('finds the item in a slot, empty slots give nothing', () => {
    const r1 = slotRect(1);
    expect(itemAt(items(2), 0, r1.x + 1, r1.y + 1)).toBe('item1');
    const r3 = slotRect(3);
    expect(itemAt(items(2), 0, r3.x + 1, r3.y + 1)).toBeUndefined();
  });

  it('does not overlap the scroll buttons', () => {
    const last = slotRect(SLOTS - 1);
    expect(inRect(SCROLL_LEFT, last.x + last.w - 1, last.y)).toBe(false);
  });
});
