import { DEFAULT_WALK_STRIDE, playerAnimations } from '@grelok/engine';
import type { Facing, PlayerConfig } from '@grelok/engine';

/**
 * Which picture of the player to show, from what he is doing. Pure: the same state always gives the same frame.
 *
 * - Walking is driven by DISTANCE, not time: one whole cycle (two steps) per `walkStride` scene pixels, shrunk with
 *   the perspective. So his feet move as fast as the ground passes under them and never skate, at any speed or size.
 * - Talking and reaching are driven by time. Priority: reach > talk > walk > idle.
 * - Facing west mirrors the east animation unless the sheet has its own `_w` one (art made once, never out of step).
 */

/** How long each talk frame shows (ms): a jaw flapping roughly with the syllables. */
export const TALK_FRAME_MS = 140;
/** Reach: every frame but the last shows this long, then the hand stays out for REACH_HOLD_MS. */
export const REACH_FRAME_MS = 120;
export const REACH_HOLD_MS = 260;

export interface PlayerPoseState {
  facing: Facing;
  walking: boolean;
  /** Scene pixels walked so far (any running total). */
  walked: number;
  /** The perspective scale he is drawn at (1 = full size). */
  scale: number;
  /** Milliseconds since he started speaking, or undefined when he is silent. */
  talkingMs?: number;
  /** Milliseconds since he started reaching, or undefined when he is not. */
  reachMs?: number;
}

export interface PlayerPose {
  /** Frame index into the sheet. */
  frame: number;
  flipX: boolean;
  /** Lift in picture pixels (only for the original 3-column sheet, whose walk has no bob of its own). */
  lift: number;
  /** The animation shown, e.g. "walk_e" (for tests and debugging). */
  anim: string;
}

type Kind = 'idle' | 'walk' | 'talk' | 'reach';

/** Find `<kind>_<facing>`; west may mirror east. Idle and walk also fall back n -> s -> e (they always exist). */
function resolve(animations: Record<string, number[]>, kind: Kind, facing: Facing): { name: string; frames: number[]; flipX: boolean } | undefined {
  const tries: [Facing, boolean][] = facing === 'w' ? [['w', false], ['e', true]] : [[facing, false]];
  if (kind === 'idle' || kind === 'walk') tries.push(['s', false], ['e', facing === 'w']);
  for (const [f, flipX] of tries) {
    const frames = animations[`${kind}_${f}`];
    if (frames && frames.length > 0) return { name: `${kind}_${f}`, frames, flipX };
  }
  return undefined;
}

/** How a reach plays out for this facing: when the hand is out (do the action then) and when it is over. */
export function reachTiming(config: PlayerConfig, facing: Facing): { handOutMs: number; totalMs: number } {
  const reach = resolve(playerAnimations(config).animations, 'reach', facing);
  if (!reach) return { handOutMs: 0, totalMs: 0 };
  const handOutMs = REACH_FRAME_MS * (reach.frames.length - 1);
  return { handOutMs, totalMs: handOutMs + REACH_HOLD_MS };
}

export function playerFrame(config: PlayerConfig, s: PlayerPoseState): PlayerPose {
  const { animations, legacy } = playerAnimations(config);
  const idle = resolve(animations, 'idle', s.facing)!;
  const pose = (a: { name: string; frames: number[]; flipX: boolean }, i: number, lift = 0): PlayerPose => ({
    frame: a.frames[Math.min(i, a.frames.length - 1)]!,
    flipX: a.flipX,
    lift,
    anim: a.name,
  });

  const reach = s.reachMs !== undefined ? resolve(animations, 'reach', s.facing) : undefined;
  if (reach) return pose(reach, Math.floor(s.reachMs! / REACH_FRAME_MS));

  const talk = s.talkingMs !== undefined && !s.walking ? resolve(animations, 'talk', s.facing) : undefined;
  if (talk) return pose(talk, Math.floor(s.talkingMs! / TALK_FRAME_MS) % talk.frames.length);

  if (s.walking) {
    const walk = resolve(animations, 'walk', s.facing)!;
    const stride = (config.walkStride ?? DEFAULT_WALK_STRIDE) * Math.max(0.1, s.scale);
    const i = Math.floor(s.walked / (stride / walk.frames.length)) % walk.frames.length;
    // the original sheet passes through its standing frame between strides: lift him a little there (the bob)
    const lift = legacy && walk.frames[i] === idle.frames[0] ? 1 : 0;
    return pose(walk, i, lift);
  }
  return pose(idle, 0);
}

/**
 * With pre-made sizes (game.yml `sizes:`), the figure height to show for a perspective scale: the available one
 * (the full `frameHeight` or one of `sizes`) nearest to scale x frameHeight. It is then drawn 1:1, never scaled.
 */
export function pickSize(scale: number, frameHeight: number, sizes: readonly number[]): number {
  const wanted = scale * frameHeight;
  return [frameHeight, ...sizes].reduce((best, h) => (Math.abs(h - wanted) < Math.abs(best - wanted) ? h : best));
}

/**
 * Round the perspective scale to a few steps. Nearest-neighbour scaling by a slightly different factor drops
 * different pixel rows, so a scale that changes every frame makes the sprite "boil"; steps of 5% change it rarely.
 */
export function quantizeScale(scale: number, step = 0.05): number {
  return Math.round(scale / step) * step;
}
