import type { Facing, Point } from '@grelok/engine';

/** Which way is someone looking who moves by (dx, dy)? The bigger movement wins; screen y grows downwards. */
export function facingOf(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
  return dy >= 0 ? 's' : 'n';
}

/**
 * Moves a point along a list of waypoints at a given speed. It knows nothing about pictures: the scene asks
 * it where the player is and which way he faces. The key idea is `update(seconds, speed)`: movement is
 * always speed x elapsed time, so the walk takes the same real time on a 60 Hz and on a 144 Hz screen.
 */
export class PathFollower {
  position: Point;
  facing: Facing;
  /** Total distance walked so far (the scene uses it to pick the walking frame). */
  walked = 0;
  private path: Point[] = [];

  constructor(position: Point, facing: Facing = 's') {
    this.position = position;
    this.facing = facing;
  }

  get walking(): boolean {
    return this.path.length > 0;
  }

  /** Start walking along `path` (its first point is where we already are). */
  setPath(path: readonly Point[]): void {
    this.path = path.slice(1).map((p) => [p[0], p[1]]);
  }

  /** The remaining waypoints (for debug drawing). */
  get remaining(): readonly Point[] {
    return this.path;
  }

  stop(): void {
    this.path = [];
  }

  teleport(position: Point): void {
    this.position = position;
    this.stop();
  }

  faceTowards(target: Point): void {
    const [dx, dy] = [target[0] - this.position[0], target[1] - this.position[1]];
    if (dx !== 0 || dy !== 0) this.facing = facingOf(dx, dy);
  }

  /** Advance by `seconds` at `speed` pixels per second. Returns true if the path was finished during this update. */
  update(seconds: number, speed: number): boolean {
    let budget = speed * seconds;
    let finished = false;
    while (budget > 0 && this.path.length > 0) {
      const target = this.path[0]!;
      const [dx, dy] = [target[0] - this.position[0], target[1] - this.position[1]];
      const left = Math.hypot(dx, dy);
      if (left > 0) this.facing = facingOf(dx, dy);
      if (left <= budget) {
        this.position = [target[0], target[1]];
        this.walked += left;
        budget -= left;
        this.path.shift();
        finished = this.path.length === 0;
      } else {
        this.position = [this.position[0] + (dx / left) * budget, this.position[1] + (dy / left) * budget];
        this.walked += budget;
        budget = 0;
      }
    }
    return finished;
  }
}
