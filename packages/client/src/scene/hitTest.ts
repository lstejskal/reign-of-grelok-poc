import type { Point } from '@grelok/engine';

/**
 * Is point `p` inside `polygon`? (Ray casting.)
 *
 * Imagine a ray going from `p` to the right, forever. Count how many polygon edges it crosses:
 * an odd number means `p` is inside, an even number means outside. This works for any polygon,
 * also concave ones (an L shape, say). A point exactly on an edge may go either way, so callers
 * test pixel *centres* (x + 0.5) - see RoomScene.
 */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  const [px, py] = p;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    // Does edge j->i straddle the horizontal line through p, with its crossing point right of p?
    const straddles = yi > py !== yj > py;
    if (straddles && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The item (hotspot, exit...) under point `p`, or undefined. Items later in the list are drawn on top, so they win
 * when polygons overlap. `accept` lets the caller skip items: a hidden thing cannot be hovered or clicked, so the
 * thing underneath (if any) is found instead.
 */
export function hitTest<T extends { polygon: Point[] }>(
  items: readonly T[],
  p: Point,
  accept: (item: T) => boolean = () => true,
): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!;
    if (accept(item) && pointInPolygon(p, item.polygon)) return item;
  }
  return undefined;
}
