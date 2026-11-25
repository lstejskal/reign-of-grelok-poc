/**
 * Which picture of the walk to show. The sheet has three columns per facing: 0 = standing (legs together),
 * 1 = one leg forward, 2 = the other leg forward.
 *
 * Swapping only between the two strides looks like sliding: seen from the side both have the same outline (legs
 * apart), just with the near and far leg swapped. A real walk passes through "legs together" between the strides, so
 * the cycle is stride, together, other stride, together. On the "together" frames the body is at its highest (the
 * leg under it is straight), so the sprite is lifted a little: the bob that makes a walk feel alive.
 */
export const WALK_CYCLE = [1, 0, 2, 0] as const;
/** The pose changes every this many scene pixels walked (a whole cycle = two steps = 4 poses). */
export const POSE_LENGTH = 6;

export interface WalkPose {
  /** Column of the sheet. */
  column: number;
  /** How far to lift the sprite, in picture pixels (0 or 1). */
  lift: number;
}

export function walkPose(walking: boolean, walked: number): WalkPose {
  if (!walking) return { column: 0, lift: 0 };
  const column = WALK_CYCLE[Math.floor(walked / POSE_LENGTH) % WALK_CYCLE.length]!;
  return { column, lift: column === 0 ? 1 : 0 };
}
