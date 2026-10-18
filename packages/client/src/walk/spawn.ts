import type { Facing, GameBundle, Point } from '@grelok/engine';

const OPPOSITE: Record<string, string> = { n: 's', s: 'n', e: 'w', w: 'e' };

export interface Arrival {
  point: Point;
  /** He walks into the scene, so he looks away from the exit he came through. */
  facing: Facing;
}

/**
 * Where does the player appear when he arrives in `to` coming from `from`, and which way does he look? If he left
 * `from` going north, he comes in through the south exit of `to`; that exit's `spawn` point says where he stands and he
 * faces north (into the scene). Undefined when there is no such exit (the caller picks a default).
 */
export function arrivalAt(bundle: GameBundle, from: string, to: string): Arrival | undefined {
  const directions = bundle.logic.locations[from]?.directions ?? {};
  const direction = Object.keys(directions).find((d) => directions[d] === to);
  if (direction === undefined) return undefined;
  const entry = bundle.scenes[to]?.exits.find((e) => e.direction === OPPOSITE[direction[0]!]);
  return entry === undefined ? undefined : { point: entry.spawn, facing: direction[0] as Facing };
}
