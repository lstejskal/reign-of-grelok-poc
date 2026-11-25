import Phaser from 'phaser';
import { ART_SCALE, playerSizeSheet } from '@grelok/engine';
import type { Facing, PlayerConfig, Point } from '@grelok/engine';
import { textureKey } from '../data/assets';
import { PathFollower } from '../walk/PathFollower';
import type { WalkArea } from '../walk/WalkArea';
import { pickSize, playerFrame, quantizeScale, reachTiming } from './playerAnimation';

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
  /** Is he speaking? RoomScene sets this every frame from the speech on screen. */
  talking = false;
  private talkingMs = 0;
  /** A reach in progress: how long it has run, and the action to do once the hand is out (if not done yet). */
  private reaching: { ms: number; handOutMs: number; totalMs: number; then?: () => void } | undefined;
  private lastPose = { frame: 0, flipX: false, anim: '' };
  /** The perspective size he is shown at (1 = full size). */
  private shownScale = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly config: PlayerConfig,
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
    const { frame, flipX, anim } = this.lastPose;
    return { x, y, facing: this.follower.facing, walking: this.follower.walking, scale: this.shownScale, depth: this.sprite.depth, frame, flipX, anim };
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
    this.finishReach(); // a click during a reach: the action still happens, the hand just doesn't linger
    this.arrival = arrival;
    this.follower.setPath(this.area.path(this.follower.position, point));
  }

  /**
   * Reach out (pick up, use, give, push) and do `then` at the moment the hand is out. With no reach animation in
   * the sheet, `then` runs at once.
   */
  reach(then: () => void): void {
    this.finishReach();
    const { handOutMs, totalMs } = reachTiming(this.config, this.follower.facing);
    if (totalMs === 0) return then();
    this.reaching = { ms: 0, handOutMs, totalMs, then };
    if (handOutMs === 0) this.fireReach();
    this.sync();
  }

  private fireReach(): void {
    const then = this.reaching?.then;
    if (this.reaching) this.reaching.then = undefined;
    then?.();
  }

  private finishReach(): void {
    this.fireReach();
    this.reaching = undefined;
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
    const animMs = seconds * 1000 * this.speedFactor(); // the debug speed-up (tests) also speeds up animations
    this.talkingMs = this.talking ? this.talkingMs + animMs : 0;
    if (this.reaching) {
      this.reaching.ms += animMs;
      if (this.reaching.ms >= this.reaching.handOutMs) this.fireReach();
      if (this.reaching && this.reaching.ms >= this.reaching.totalMs) this.reaching = undefined;
    }
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

  /**
   * Put the sprite where the follower says: position, size (perspective), frame (see playerAnimation), depth.
   * Size: with pre-made sizes (game.yml `sizes:`) the nearest one is drawn 1:1 - pixel art scaled by an uneven factor
   * loses pixel rows and shimmers as it moves. Without them the sheet is scaled, in 5% steps.
   */
  private sync(): void {
    const [x, y] = this.follower.position;
    const { sprite, frameHeight, sizes } = this.config;
    let scale: number;
    let drawScale: number;
    let sheet = sprite;
    if (sizes && sizes.length > 0) {
      const h = pickSize(this.area.scaleAt(y), frameHeight, sizes);
      if (h !== frameHeight) sheet = playerSizeSheet(sprite, h);
      scale = h / frameHeight;
      drawScale = 1;
    } else {
      scale = quantizeScale(this.area.scaleAt(y));
      drawScale = scale;
    }
    if (this.sprite.texture.key !== textureKey(sheet)) this.sprite.setTexture(textureKey(sheet));
    this.shownScale = scale;
    const pose = playerFrame(this.config, {
      facing: this.follower.facing,
      walking: this.follower.walking,
      walked: this.follower.walked,
      scale,
      talkingMs: this.talking ? this.talkingMs : undefined,
      reachMs: this.reaching?.ms,
    });
    this.lastPose = pose;
    // Snap to whole PICTURE pixels (half a scene pixel at ART_SCALE 2), like everything in a pixel-art game. The sheet
    // has ART_SCALE times the detail, so it is drawn at 1/ART_SCALE of its size.
    const snap = (v: number) => Math.round(v * ART_SCALE) / ART_SCALE;
    this.sprite
      .setPosition(snap(x), snap(y) - pose.lift / ART_SCALE)
      .setScale(drawScale / ART_SCALE)
      .setFrame(pose.frame)
      .setFlipX(pose.flipX)
      .setDepth(y);
  }
}
