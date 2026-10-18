import type { Point } from '@grelok/engine';

/**
 * Finding a way across the floor. The walkmask picture is turned into a coarse grid of cells (4x4 pixels each),
 * each either walkable or not, and A* searches that grid. Everything here is plain data and arithmetic,
 * with no Phaser, so the tests can use tiny hand-made grids.
 */
export interface Grid {
  cols: number;
  rows: number;
  /** Cell size in pixels. */
  cell: number;
  /** cols * rows flags, row by row. */
  walkable: boolean[];
}

/** A decoded RGBA picture (what `ImageData` and the PNG libraries give you). */
export interface MaskImage {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export function makeGrid(cols: number, rows: number, cell: number, isWalkable: (col: number, row: number) => boolean): Grid {
  const walkable: boolean[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) walkable.push(isWalkable(col, row));
  return { cols, rows, cell, walkable };
}

/**
 * Sample a walkmask (white = walkable) into a grid. A cell counts as walkable only if its centre and
 * four corners are all white, so the player's feet never end up inside an obstacle.
 */
export function gridFromMask(mask: MaskImage, cell = 4): Grid {
  const white = (x: number, y: number) => {
    const px = Math.min(mask.width - 1, x);
    const py = Math.min(mask.height - 1, y);
    return mask.data[(py * mask.width + px) * 4]! > 127; // the red channel is enough for a grayscale picture
  };
  const cols = Math.ceil(mask.width / cell);
  const rows = Math.ceil(mask.height / cell);
  return makeGrid(cols, rows, cell, (col, row) => {
    const x0 = col * cell;
    const y0 = row * cell;
    const [x1, y1] = [x0 + cell - 1, y0 + cell - 1];
    const [cx, cy] = [x0 + (cell >> 1), y0 + (cell >> 1)];
    return white(x0, y0) && white(x1, y0) && white(x0, y1) && white(x1, y1) && white(cx, cy);
  });
}

const cellOf = (grid: Grid, [x, y]: Point): [number, number] => [
  Math.min(grid.cols - 1, Math.max(0, Math.floor(x / grid.cell))),
  Math.min(grid.rows - 1, Math.max(0, Math.floor(y / grid.cell))),
];
const centreOf = (grid: Grid, col: number, row: number): Point => [(col + 0.5) * grid.cell, (row + 0.5) * grid.cell];
const isFree = (grid: Grid, col: number, row: number) =>
  col >= 0 && row >= 0 && col < grid.cols && row < grid.rows && grid.walkable[row * grid.cols + col]!;

export function isWalkable(grid: Grid, point: Point): boolean {
  const [col, row] = cellOf(grid, point);
  return isFree(grid, col, row);
}

/** The walkable point closest to `point` (the point itself if it is walkable), or undefined if nothing is walkable. */
export function nearestWalkable(grid: Grid, point: Point): Point | undefined {
  if (isWalkable(grid, point)) return point;
  let best: Point | undefined;
  let bestDistance = Infinity;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (!isFree(grid, col, row)) continue;
      const centre = centreOf(grid, col, row);
      const d = distance(centre, point);
      if (d < bestDistance) [best, bestDistance] = [centre, d];
    }
  }
  return best;
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// The eight neighbours of a cell, with the cost of stepping there (1 straight, sqrt(2) diagonal).
const STEPS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** Can we step from (col,row) by (dc,dr)? Diagonal steps may not squeeze between two blocked cells' corner. */
function canStep(grid: Grid, col: number, row: number, dc: number, dr: number): boolean {
  if (!isFree(grid, col + dc, row + dr)) return false;
  return dc === 0 || dr === 0 || (isFree(grid, col + dc, row) && isFree(grid, col, row + dr));
}

/**
 * The route from `from` to `to`, as a list of points to walk through (first = `from`).
 *
 * - If `to` cannot be reached (blocked, or walled off) the route ends at the reachable spot nearest to it.
 * - If `from` is itself blocked we start from the nearest walkable spot.
 * - The raw A* route zigzags along cell centres, so it is straightened ("string pulling"): we skip every
 *   point we can see directly from an earlier one.
 */
export function findPath(grid: Grid, from: Point, to: Point): Point[] {
  const start = nearestWalkable(grid, from);
  if (start === undefined) return [from];
  const [startCol, startRow] = cellOf(grid, start);
  const [goalCol, goalRow] = cellOf(grid, to);
  const index = (col: number, row: number) => row * grid.cols + col;

  // A*: always expand the open cell with the lowest (cost so far + straight-line estimate to the goal).
  const cost = new Map<number, number>([[index(startCol, startRow), 0]]);
  const cameFrom = new Map<number, number>();
  const open = new MinHeap();
  const estimate = (col: number, row: number) => Math.hypot(col - goalCol, row - goalRow);
  open.push(index(startCol, startRow), estimate(startCol, startRow));
  const closed = new Set<number>();
  let reached = false;
  let closest = index(startCol, startRow); // the explored cell nearest the goal, for unreachable goals

  while (open.size > 0) {
    const current = open.pop()!;
    if (closed.has(current)) continue;
    closed.add(current);
    const [col, row] = [current % grid.cols, Math.floor(current / grid.cols)];
    if (estimate(col, row) < estimate(closest % grid.cols, Math.floor(closest / grid.cols))) closest = current;
    if (col === goalCol && row === goalRow) {
      reached = true;
      break;
    }
    for (const [dc, dr, stepCost] of STEPS) {
      if (!canStep(grid, col, row, dc, dr)) continue;
      const next = index(col + dc, row + dr);
      const newCost = cost.get(current)! + stepCost;
      if (newCost < (cost.get(next) ?? Infinity)) {
        cost.set(next, newCost);
        cameFrom.set(next, current);
        open.push(next, newCost + estimate(col + dc, row + dr));
      }
    }
  }

  // walk back from the goal (or the closest cell) to the start
  const cells: number[] = [];
  for (let c: number | undefined = reached ? index(goalCol, goalRow) : closest; c !== undefined; c = cameFrom.get(c)) cells.unshift(c);
  const centres = cells.map((c) => centreOf(grid, c % grid.cols, Math.floor(c / grid.cols)));

  // begin exactly where we are, and (if we got there) end exactly where we were asked to
  const route = pull(grid, centres);
  const end = reached && isWalkable(grid, to) ? to : route[route.length - 1]!;
  return [from, ...route.slice(1, -1), end];
}

/** String pulling: from each point, jump to the farthest later point that can be seen in a straight line. */
function pull(grid: Grid, points: Point[]): Point[] {
  if (points.length <= 2) return points.slice();
  const result: Point[] = [points[0]!];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let far = anchor + 1;
    for (let i = points.length - 1; i > anchor + 1; i--) {
      if (lineOfSight(grid, points[anchor]!, points[i]!)) {
        far = i;
        break;
      }
    }
    result.push(points[far]!);
    anchor = far;
  }
  return result;
}

/**
 * Is the straight line between two points free of blocked cells? The player has some width, so we check three
 * parallel lines (the middle one and one a little to each side). That also stops the route from slipping through
 * the exact corner where two blocked cells touch diagonally.
 */
export function lineOfSight(grid: Grid, a: Point, b: Point): boolean {
  const length = distance(a, b);
  if (length === 0) return isWalkable(grid, a);
  const [nx, ny] = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length]; // unit vector sideways
  const steps = Math.max(1, Math.ceil((length / grid.cell) * 2));
  for (const side of [-0.3, 0, 0.3]) {
    const [ox, oy] = [nx * side * grid.cell, ny * side * grid.cell];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!isWalkable(grid, [a[0] + (b[0] - a[0]) * t + ox, a[1] + (b[1] - a[1]) * t + oy])) return false;
    }
  }
  return true;
}

/** A tiny binary min-heap of (item, priority) pairs: the "open list" of A*. */
class MinHeap {
  private items: { item: number; priority: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    const a = this.items;
    a.push({ item, priority });
    for (let i = a.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (a[parent]!.priority <= a[i]!.priority) break;
      [a[parent], a[i]] = [a[i]!, a[parent]!];
      i = parent;
    }
  }

  pop(): number | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      for (let i = 0; ; ) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let smallest = i;
        if (l < a.length && a[l]!.priority < a[smallest]!.priority) smallest = l;
        if (r < a.length && a[r]!.priority < a[smallest]!.priority) smallest = r;
        if (smallest === i) break;
        [a[smallest], a[i]] = [a[i]!, a[smallest]!];
        i = smallest;
      }
    }
    return top.item;
  }
}
