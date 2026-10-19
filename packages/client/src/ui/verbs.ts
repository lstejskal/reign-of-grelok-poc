import { DEFAULT_VERBS } from '@grelok/engine';
import type { GameConfig, Verb, VerbSpec } from '@grelok/engine';

export type { VerbSpec };

/**
 * The verb buttons for a game: its `verbs:` list from game.yml, or the engine's default six.
 * (Column-major order: the first three are the left column.)
 */
export function verbsOf(config: Pick<GameConfig, 'verbs'>): readonly VerbSpec[] {
  return config.verbs ?? DEFAULT_VERBS;
}

/** What a plain click on a thing you carry does when no verb is chosen (a thing in the scene is walked to instead). */
export const DEFAULT_VERB: Verb = 'look_at';
