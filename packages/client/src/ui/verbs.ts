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

/** Keys the game uses for other things, so no verb gets them: M = mute, F = fullscreen. */
export const RESERVED_KEYS: readonly string[] = ['M', 'F'];

/**
 * Keyboard shortcuts for the verbs: each verb gets the first letter of its label that is still free (Give = G,
 * Pick up = P, Use = U, Look at = L, Talk to = T, Push = S because P and U are taken). Derived from the labels, so a
 * game with other verbs gets shortcuts too. Returns letter -> verb.
 */
export function verbKeys(verbs: readonly VerbSpec[]): Map<string, Verb> {
  const keys = new Map<string, Verb>();
  for (const spec of verbs) {
    const letter = [...spec.label.toUpperCase()].find((c) => c >= 'A' && c <= 'Z' && !keys.has(c) && !RESERVED_KEYS.includes(c));
    if (letter) keys.set(letter, spec.verb);
  }
  return keys;
}

/** What a plain click on a thing you carry does when no verb is chosen (a thing in the scene is walked to instead). */
export const DEFAULT_VERB: Verb = 'look_at';
