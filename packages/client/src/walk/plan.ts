import type { Command, Facing, Point, SceneData } from '@grelok/engine';

/** Where to stand, and how to face, before acting on something. */
export interface WalkTarget {
  point: Point;
  /** Facing from the data, if it has one. Otherwise face `toward`. */
  facing?: Facing;
  /** The middle of the thing, to turn towards. */
  toward: Point;
}

const centre = (polygon: readonly Point[]): Point => [
  polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length,
  polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length,
];

/** The place to walk to for a thing in the scene (undefined if the thing is not in this scene, e.g. carried). */
export function walkTargetFor(scene: SceneData | undefined, alias: string): WalkTarget | undefined {
  const hotspot = scene?.hotspots.find((h) => h.id === alias);
  if (!hotspot) return undefined;
  return { point: hotspot.walkTo, facing: hotspot.facing, toward: centre(hotspot.polygon) };
}

/**
 * Does this command first need a walk? The player walks to the thing he acts on, so "Pick up pebble" walks to the
 * pebble and "Give gemstone to wizard" to the wizard (the gemstone is in his pocket). Looking is done from where he
 * stands, as in the classic games. A command whose things are all carried needs no walk either.
 */
export function walkTargetForCommand(scene: SceneData | undefined, command: Command): WalkTarget | undefined {
  if (command.verb === 'look_at') return undefined;
  for (const alias of [...command.objects].reverse()) {
    const target = walkTargetFor(scene, alias);
    if (target) return target;
  }
  return undefined;
}
