import type { Verb } from '@grelok/engine';

/** One verb button: what the player reads, and how many things the sentence needs. */
export interface VerbSpec {
  verb: Verb;
  label: string;
  /** 1 = "Look at X"; 2 = "Use X with Y". */
  objects: 1 | 2;
  /** Word between the two objects (only for objects = 2). */
  preposition?: string;
}

/**
 * The verb grid, in column-major order (the first three are the left column). It is a constant for now;
 * a game that wants other verbs would move this list into its game.yml.
 */
export const VERBS: readonly VerbSpec[] = [
  { verb: 'give', label: 'Give', objects: 2, preposition: 'to' },
  { verb: 'pick_up', label: 'Pick up', objects: 1 },
  { verb: 'use', label: 'Use', objects: 2, preposition: 'with' },
  { verb: 'look_at', label: 'Look at', objects: 1 },
  { verb: 'talk_to', label: 'Talk to', objects: 1 },
  { verb: 'push', label: 'Push', objects: 1 },
];

/**
 * What a plain click on a thing does when no verb is selected. In Step 8 this becomes "walk there",
 * the classic SCUMM default; until then, looking is the harmless choice.
 */
export const DEFAULT_VERB: Verb = 'look_at';
