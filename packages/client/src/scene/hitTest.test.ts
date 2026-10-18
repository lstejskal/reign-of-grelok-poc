import { describe, expect, it } from 'vitest';
import type { HotspotData, Point } from '@grelok/engine';
import { hitTest, pointInPolygon } from './hitTest';

const square: Point[] = [[10, 10], [30, 10], [30, 30], [10, 30]];
// An L shape: the top-right corner is cut out.
const ell: Point[] = [[0, 0], [10, 0], [10, 10], [20, 10], [20, 20], [0, 20]];

describe('pointInPolygon', () => {
  it('knows inside from outside', () => {
    expect(pointInPolygon([20, 20], square)).toBe(true);
    expect(pointInPolygon([5, 20], square)).toBe(false);
    expect(pointInPolygon([35, 20], square)).toBe(false);
    expect(pointInPolygon([20, 5], square)).toBe(false);
    expect(pointInPolygon([20, 35], square)).toBe(false);
  });

  it('handles concave polygons', () => {
    expect(pointInPolygon([5, 5], ell)).toBe(true);
    expect(pointInPolygon([15, 15], ell)).toBe(true);
    expect(pointInPolygon([15, 5], ell)).toBe(false); // in the notch
  });

  it('handles triangles and degenerate input', () => {
    const triangle: Point[] = [[0, 0], [20, 0], [0, 20]];
    expect(pointInPolygon([5, 5], triangle)).toBe(true);
    expect(pointInPolygon([15, 15], triangle)).toBe(false);
    expect(pointInPolygon([1, 1], [])).toBe(false);
  });
});

describe('hitTest', () => {
  const back: HotspotData = { id: 'back', polygon: [[0, 0], [40, 0], [40, 40], [0, 40]], walkTo: [0, 0] };
  const front: HotspotData = { id: 'front', polygon: square, walkTo: [0, 0] };

  it('returns the topmost (last) hotspot where polygons overlap', () => {
    expect(hitTest([back, front], [20, 20])?.id).toBe('front');
    expect(hitTest([front, back], [20, 20])?.id).toBe('back');
  });

  it('falls through to the one below, and to nothing', () => {
    expect(hitTest([back, front], [5, 5])?.id).toBe('back');
    expect(hitTest([back, front], [100, 100])).toBeUndefined();
  });

  it('skips hotspots the engine says are not visible', () => {
    expect(hitTest([back, front], [20, 20], (id) => id !== 'front')?.id).toBe('back');
    expect(hitTest([back, front], [20, 20], () => false)).toBeUndefined();
  });
});
