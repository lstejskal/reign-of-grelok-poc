import type { Point, SceneScale } from '@grelok/engine';
import { findPath, isWalkable, nearestWalkable } from './pathfinding';
import type { Grid } from './pathfinding';

/**
 * Where the player may walk in one scene, and how big he looks there. Built once per scene from its walkmask
 * (a scene without a walkmask is walkable everywhere).
 */
export class WalkArea {
  /** First and last walkable pixel row: the range over which the perspective scale changes. */
  readonly yTop: number;
  readonly yBottom: number;

  constructor(
    readonly grid: Grid,
    private readonly scale: SceneScale = { top: 1, bottom: 1 },
  ) {
    const rows = Array.from({ length: grid.rows }, (_, row) => row).filter((row) =>
      Array.from({ length: grid.cols }, (_, col) => grid.walkable[row * grid.cols + col]).some(Boolean),
    );
    this.yTop = (rows[0] ?? 0) * grid.cell;
    this.yBottom = ((rows[rows.length - 1] ?? grid.rows - 1) + 1) * grid.cell;
  }

  /** Size of the player with his feet at row `y`: `top` at the farthest walkable row, `bottom` at the nearest. */
  scaleAt(y: number): number {
    const span = this.yBottom - this.yTop;
    const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (y - this.yTop) / span));
    return this.scale.top + (this.scale.bottom - this.scale.top) * t;
  }

  isWalkable(point: Point): boolean {
    return isWalkable(this.grid, point);
  }

  /** A walkable point at or near `point`; falls back to the middle of the picture on a scene with no floor at all. */
  snap(point: Point): Point {
    return nearestWalkable(this.grid, point) ?? point;
  }

  path(from: Point, to: Point): Point[] {
    return findPath(this.grid, from, to);
  }
}
