import type { Point, SceneData, SceneSpriteData } from '@grelok/engine';

/** What the world looks like right now, as far as sprites care. */
export interface WorldView {
  /** The game's boolean constraints (state.constraints.boolean). */
  booleans: Readonly<Record<string, boolean>>;
  /** Aliases of the things the engine says are visible in the scene being shown. */
  visibleThings: readonly string[];
}

/** What to draw for one sprite right now. */
export interface SpriteLook {
  image: string;
  /** Where its feet are. */
  at: Point;
  /** The y to sort by when drawing (its feet, unless the sprite says otherwise). */
  depth: number;
}

/**
 * Decide what a sprite looks like. This is the whole idea of "rendering derived from state": the view stores
 * nothing of its own; every time the world may have changed we ask this function again, and draw the answer.
 *
 * Returns undefined when nothing should be drawn: its thing is not visible here, or no state's `when` holds.
 */
export function lookOf(sprite: SceneSpriteData, world: WorldView): SpriteLook | undefined {
  if (sprite.thing !== undefined && !world.visibleThings.includes(sprite.thing)) return undefined;
  const state = sprite.states.find((s) => conditionsHold(s.when, world.booleans));
  if (!state) return undefined;
  const at: Point = [state.x ?? sprite.x, state.y ?? sprite.y];
  return { image: state.image, at, depth: state.depth ?? sprite.depth ?? at[1] };
}

/** Do all these conditions on boolean constraints hold? (No conditions = always.) */
export function conditionsHold(when: Readonly<Record<string, boolean>> | undefined, booleans: Readonly<Record<string, boolean>>): boolean {
  return Object.entries(when ?? {}).every(([name, wanted]) => booleans[name] === wanted);
}

/** The scene with only the hotspots whose `when` holds right now (a moved thing's old place stops being clickable). */
export function withActiveHotspots(scene: SceneData, booleans: Readonly<Record<string, boolean>>): SceneData {
  return { ...scene, hotspots: scene.hotspots.filter((h) => conditionsHold(h.when, booleans)) };
}
