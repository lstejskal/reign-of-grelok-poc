import { describe, expect, it } from 'vitest';
import type { GameBundle, Point, SceneData } from '@grelok/engine';
import { findPath, gridFromMask, isWalkable, lineOfSight, makeGrid, nearestWalkable } from './pathfinding';
import { PathFollower, facingOf } from './PathFollower';
import { WalkArea } from './WalkArea';
import { walkTargetFor, walkTargetForCommand } from './plan';
import { arrivalAt } from './spawn';
import { walkPose } from './walkCycle';

/** A grid from ASCII art, one cell = 1 pixel: '.' walkable, '#' blocked. */
const gridOf = (...rows: string[]) => makeGrid(rows[0]!.length, rows.length, 1, (c, r) => rows[r]![c] === '.');
const centre = (col: number, row: number): Point => [col + 0.5, row + 0.5];

/** Every step of the route stays on walkable ground. */
const routeIsClear = (grid: ReturnType<typeof gridOf>, path: Point[]) =>
  path.every((p, i) => i === 0 || lineOfSight(grid, path[i - 1]!, p));

describe('findPath', () => {
  it('walks straight when nothing is in the way', () => {
    const grid = gridOf('.........', '.........', '.........');
    const path = findPath(grid, centre(0, 1), centre(8, 1));
    expect(path).toEqual([centre(0, 1), centre(8, 1)]);
  });

  it('goes around a wall through the gap', () => {
    const grid = gridOf(
      '.....#.....',
      '.....#.....',
      '.....#.....',
      '.....#.....',
      '...........', // the gap
    );
    const path = findPath(grid, centre(1, 0), centre(9, 0));
    expect(path[0]).toEqual(centre(1, 0));
    expect(path[path.length - 1]).toEqual(centre(9, 0));
    expect(path.length).toBeGreaterThan(2);
    expect(routeIsClear(grid, path)).toBe(true);
    expect(path.some(([, y]) => y >= 4)).toBe(true); // it really went down to the gap
  });

  it('does not squeeze between two diagonally touching blocked cells', () => {
    const grid = gridOf('..#.', '.#..', '....'); // a diagonal wall from (2,0) to (1,1)
    const path = findPath(grid, centre(0, 0), centre(3, 0));
    expect(routeIsClear(grid, path)).toBe(true);
    expect(path.some(([, y]) => y > 2)).toBe(true); // had to go round the bottom
  });

  it('ends at the nearest reachable point when the target is walled off', () => {
    const grid = gridOf(
      '......#...',
      '......#...',
      '......#...',
    );
    const target = centre(8, 1);
    const path = findPath(grid, centre(0, 1), target);
    const end = path[path.length - 1]!;
    expect(isWalkable(grid, end)).toBe(true);
    expect(end[0]).toBeLessThan(6); // stopped on our side of the wall
    expect(end[0]).toBeGreaterThan(4.5); // ... right next to it
  });

  it('ends at the nearest point when the target itself is blocked', () => {
    const grid = gridOf('.....', '..#..', '.....');
    const path = findPath(grid, centre(0, 1), centre(2, 1));
    const end = path[path.length - 1]!;
    expect(isWalkable(grid, end)).toBe(true);
    expect(Math.hypot(end[0] - 2.5, end[1] - 1.5)).toBeLessThan(1.6);
  });

  it('starts from the nearest walkable spot when the start is blocked', () => {
    const grid = gridOf('#....', '#....');
    const path = findPath(grid, centre(0, 0), centre(4, 0));
    expect(path[0]).toEqual(centre(0, 0)); // we begin where we stand ...
    expect(routeIsClear(grid, path.slice(1))).toBe(true); // ... and step onto the floor
    expect(path[path.length - 1]).toEqual(centre(4, 0));
  });

  it('handles start and target in the same cell', () => {
    const grid = gridOf('...');
    expect(findPath(grid, [1.1, 0.5], [1.9, 0.5])).toEqual([[1.1, 0.5], [1.9, 0.5]]);
  });
});

describe('grid helpers', () => {
  it('turns a walkmask picture into cells, blocking a cell that touches black', () => {
    // 8x4 picture, white except a black pixel at x=5,y=1; cells of 4x4
    const data: number[] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) data.push(...(x === 5 && y === 1 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const grid = gridFromMask({ width: 8, height: 4, data }, 4);
    expect([grid.cols, grid.rows]).toEqual([2, 1]);
    // the black pixel is not at a sample point (corners/centre of the cell) -> still walkable
    expect(grid.walkable).toEqual([true, true]);

    data[(0 * 8 + 4) * 4] = 0; // black at the top-left corner of the second cell
    expect(gridFromMask({ width: 8, height: 4, data }, 4).walkable).toEqual([true, false]);
  });

  it('finds the nearest walkable point', () => {
    const grid = gridOf('#..', '#..');
    expect(nearestWalkable(grid, [0.5, 0.5])).toEqual(centre(1, 0));
    expect(nearestWalkable(grid, [2.5, 1.5])).toEqual([2.5, 1.5]);
    expect(nearestWalkable(gridOf('##'), [0, 0])).toBeUndefined();
  });
});

describe('PathFollower', () => {
  it('moves speed x time along the path and reports when it arrives', () => {
    const walker = new PathFollower([0, 0]);
    walker.setPath([[0, 0], [10, 0], [10, 10]]);
    expect(walker.update(0.1, 50)).toBe(false); // 5 px
    expect(walker.position).toEqual([5, 0]);
    expect(walker.update(0.1, 100)).toBe(false); // 10 px: reaches the corner (5) and turns (5 more)
    expect(walker.position[0]).toBeCloseTo(10);
    expect(walker.position[1]).toBeCloseTo(5);
    expect(walker.update(1, 100)).toBe(true);
    expect(walker.position).toEqual([10, 10]);
    expect(walker.walking).toBe(false);
    expect(walker.walked).toBeCloseTo(20);
  });

  it('takes the same time whatever the frame rate', () => {
    const slow = new PathFollower([0, 0]);
    const fast = new PathFollower([0, 0]);
    slow.setPath([[0, 0], [100, 0]]);
    fast.setPath([[0, 0], [100, 0]]);
    for (let i = 0; i < 30; i++) slow.update(1 / 30, 60); // 30 fps for 1 s
    for (let i = 0; i < 120; i++) fast.update(1 / 120, 60); // 120 fps for 1 s
    expect(slow.position[0]).toBeCloseTo(60);
    expect(fast.position[0]).toBeCloseTo(60);
  });

  it('faces the way it walks, and can turn on the spot', () => {
    expect(facingOf(5, 1)).toBe('e');
    expect(facingOf(-5, 1)).toBe('w');
    expect(facingOf(1, 5)).toBe('s');
    expect(facingOf(1, -5)).toBe('n');

    const walker = new PathFollower([0, 0]);
    walker.setPath([[0, 0], [0, -10]]);
    walker.update(0.01, 100);
    expect(walker.facing).toBe('n');
    walker.faceTowards([-50, 0]);
    expect(walker.facing).toBe('w');
  });

  it('stops and teleports', () => {
    const walker = new PathFollower([0, 0]);
    walker.setPath([[0, 0], [10, 0]]);
    walker.teleport([50, 50]);
    expect(walker.walking).toBe(false);
    expect(walker.position).toEqual([50, 50]);
  });
});

describe('WalkArea perspective', () => {
  it('scales between the farthest and the nearest walkable row', () => {
    // floor from row 2 to row 7 of a 10-row picture, 4 px cells -> y 8..32
    const grid = makeGrid(5, 10, 4, (_, row) => row >= 2 && row <= 7);
    const area = new WalkArea(grid, { top: 0.5, bottom: 1 });
    expect([area.yTop, area.yBottom]).toEqual([8, 32]);
    expect(area.scaleAt(8)).toBeCloseTo(0.5);
    expect(area.scaleAt(32)).toBeCloseTo(1);
    expect(area.scaleAt(20)).toBeCloseTo(0.75);
    expect(area.scaleAt(0)).toBeCloseTo(0.5); // clamped
    expect(area.scaleAt(99)).toBeCloseTo(1);
  });

  it('does not scale when the scene gives no scale', () => {
    const area = new WalkArea(gridOf('....'));
    expect(area.scaleAt(0)).toBe(1);
  });
});

describe('planning a walk', () => {
  const scene = {
    hotspots: [
      { id: 'pebble', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]], walkTo: [5, 20], facing: 'n' },
      { id: 'wizard', polygon: [[100, 0], [120, 0], [120, 20], [100, 20]], walkTo: [110, 30] },
    ],
    exits: [],
  } as SceneData;

  it('finds where to stand for a thing, and the middle of it to face', () => {
    expect(walkTargetFor(scene, 'pebble')).toEqual({ point: [5, 20], facing: 'n', toward: [5, 5] });
    expect(walkTargetFor(scene, 'gemstone')).toBeUndefined();
  });

  it('walks to the thing in the scene, whichever way round the sentence is', () => {
    expect(walkTargetForCommand(scene, { verb: 'pick_up', objects: ['pebble'] })?.point).toEqual([5, 20]);
    expect(walkTargetForCommand(scene, { verb: 'give', objects: ['gemstone', 'wizard'] })?.point).toEqual([110, 30]);
  });

  it('does not walk to look at things, or when everything is carried', () => {
    expect(walkTargetForCommand(scene, { verb: 'look_at', objects: ['pebble'] })).toBeUndefined();
    expect(walkTargetForCommand(scene, { verb: 'use', objects: ['rusty_sword', 'gemstone'] })).toBeUndefined();
  });
});

describe('arrivalAt', () => {
  const bundle = {
    logic: { locations: { plain: { directions: { n: 'mountain' } }, mountain: { directions: { s: 'plain' } } } },
    scenes: { mountain: { hotspots: [], exits: [{ direction: 's', spawn: [160, 118], walkTo: [0, 0], polygon: [] }] }, plain: { hotspots: [], exits: [] } },
  } as unknown as GameBundle;

  it('arrives through the exit opposite to the way he left', () => {
    // went north: arrives at the mountain's south exit, looking north into the scene
    expect(arrivalAt(bundle, 'plain', 'mountain')).toEqual({ point: [160, 118], facing: 'n' });
  });

  it('gives nothing when the rooms are not neighbours or the exit has no data', () => {
    expect(arrivalAt(bundle, 'mountain', 'plain')).toBeUndefined();
    expect(arrivalAt(bundle, 'plain', 'swamp')).toBeUndefined();
  });
});

describe('walkPose', () => {
  it('stands still on column 0, without a lift', () => {
    expect(walkPose(false, 37)).toEqual({ column: 0, lift: 0 });
  });

  it('walks stride, legs together (lifted), other stride, legs together', () => {
    const poses = [0, 6, 12, 18, 24].map((walked) => walkPose(true, walked));
    expect(poses.map((p) => p.column)).toEqual([1, 0, 2, 0, 1]);
    expect(poses.map((p) => p.lift)).toEqual([0, 1, 0, 1, 0]);
  });
});
