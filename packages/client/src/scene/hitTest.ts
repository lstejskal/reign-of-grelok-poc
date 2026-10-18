import type { HotspotData, Point } from '@grelok/engine';

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
 * The hotspot under point `p`, or undefined. Hotspots later in the list are drawn on top, so they win
 * when polygons overlap. `isVisible` lets the engine hide things: a hidden thing cannot be hovered
 * or clicked, so the thing underneath (if any) is found instead.
 */
export function hitTest(
  hotspots: readonly HotspotData[],
  p: Point,
  isVisible: (id: string) => boolean = () => true,
): HotspotData | undefined {
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const hotspot = hotspots[i]!;
    if (isVisible(hotspot.id) && pointInPolygon(p, hotspot.polygon)) return hotspot;
  }
  return undefined;
}
