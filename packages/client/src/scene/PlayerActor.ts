import Phaser from 'phaser';
import { ART_SCALE, PLAYER_FACING_ROWS, PLAYER_SHEET_COLUMNS } from '@grelok/engine';
import type { Facing, PlayerConfig, Point } from '@grelok/engine';
import { textureKey } from '../data/assets';
import { PathFollower } from '../walk/PathFollower';
import type { WalkArea } from '../walk/WalkArea';
import { walkPose } from '../walk/walkCycle';

/** Walking speed in scene pixels per second at full size; far away (smaller) he walks proportionally slower. */
export const WALK_SPEED = 64;
/** A frame that took longer than this (tab in the background...) is treated as this long, so he never jumps. */
const MAX_FRAME_MS = 100;

/** How to finish a walk: which way to turn on arrival, and what to do then. */
export interface Arrival {
  facing?: Facing;
  /** Turn towards this point if `facing` is not given. */
  toward?: Point;
  then?: () => void;
}

/**
 * Grognak on screen: a sprite driven by a PathFollower. The sprite's origin is at his feet, so (x, y) is where he
 * stands. His depth is his y: whoever is lower on the screen is nearer to us and drawn in front.
 */
export class PlayerActor {
  readonly follower: PathFollower;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private arrival: Arrival | undefined;

  constructor(
    scene: Phaser.Scene,
    config: PlayerConfig,
    start: Point,
    private area: WalkArea,
    private readonly speedFactor: () => number,
  ) {
    this.follower = new PathFollower(start);
    this.sprite = scene.add.sprite(start[0], start[1], textureKey(config.sprite), 0).setOrigin(0.5, 1);
    this.sync();
  }

  get state() {
    const [x, y] = this.follower.position;
    return { x, y, facing: this.follower.facing, walking: this.follower.walking, scale: this.sprite.scaleX * ART_SCALE, depth: this.sprite.depth };
  }

  /** Move into another scene's floor and stand at `point`, looking `facing`. */
  enter(area: WalkArea, point: Point, facing?: Facing): void {
    this.area = area;
    this.arrival = undefined;
    this.follower.teleport(point);
    if (facing) this.follower.facing = facing;
    this.sync();
  }

  /** Walk to `point` along a path that goes around obstacles. A new walk replaces the old one. */
  walkTo(point: Point, arrival: Arrival = {}): void {
    this.arrival = arrival;
    this.follower.setPath(this.area.path(this.follower.position, point));
  }

  /** Turn on the spot. */
  face(facing: Facing): void {
    this.follower.facing = facing;
    this.sync();
  }

  /** Skip the rest of the walk: appear at its end and do what he would have done on arriving there. */
  skipWalk(): void {
    const end = this.follower.remaining.at(-1);
    if (end) this.follower.teleport(end);
    this.arrive();
  }

  /** Call every frame with the time since the last one. */
  update(deltaMs: number): void {
    const seconds = Math.min(deltaMs, MAX_FRAME_MS) / 1000;
    const speed = WALK_SPEED * this.area.scaleAt(this.follower.position[1]) * this.speedFactor();
    if (this.follower.update(seconds, speed)) this.arrive();
    this.sync();
  }

  private arrive(): void {
    const arrival = this.arrival;
    this.arrival = undefined;
    if (arrival?.facing) this.follower.facing = arrival.facing;
    else if (arrival?.toward) this.follower.faceTowards(arrival.toward);
    this.sync();
    arrival?.then?.();
  }

  /** Put the sprite where the follower says: position, size (perspective), frame (facing + walking pose), depth. */
  private sync(): void {
    const [x, y] = this.follower.position;
    const row = PLAYER_FACING_ROWS.indexOf(this.follower.facing);
    const pose = walkPose(this.follower.walking, this.follower.walked);
    // Snap to whole PICTURE pixels (half a scene pixel at ART_SCALE 2), like everything in a pixel-art game. The sheet
    // has ART_SCALE times the detail, so it is drawn at 1/ART_SCALE of its size (times the perspective).
    const snap = (v: number) => Math.round(v * ART_SCALE) / ART_SCALE;
    this.sprite
      .setPosition(snap(x), snap(y) - pose.lift / ART_SCALE)
      .setScale(this.area.scaleAt(y) / ART_SCALE)
      .setFrame(row * PLAYER_SHEET_COLUMNS + pose.column)
      .setDepth(y);
  }
}
