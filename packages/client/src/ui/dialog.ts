import { VERB_GRID, inRect } from './layout';
import type { Rect } from './layout';

// The talk menu: after "Talk to <person>" the verbs are replaced by things to ask about, and "Goodbye".

export interface DialogChoice {
  label: string;
  /** What to ask about; undefined = "Goodbye". */
  topic?: string;
}

export const DIALOG_ROWS = 4;
export const DIALOG_COLS = 2;
/** The most choices that fit, Goodbye included. */
export const DIALOG_MAX = DIALOG_ROWS * DIALOG_COLS;
const COL_WIDTH = 156;

/** Backdrop of the menu: it covers the verbs and the inventory, but not the sentence line above them. */
export const DIALOG_PANEL: Rect = { x: 0, y: VERB_GRID.y - 2, w: 320, h: 200 - (VERB_GRID.y - 2) };

/**
 * What can be asked: the person's own topics first, then whatever you carry (showing a thing is a way to ask about
 * it). Cut short if too many; Goodbye is always last.
 */
export function dialogChoices(
  topics: readonly string[],
  carried: readonly string[],
  nameOf: (alias: string) => string,
  npc?: string,
): DialogChoice[] {
  const unique = [...new Set([...topics, ...carried])].filter((t) => t !== npc);
  const choices = unique.slice(0, DIALOG_MAX - 1).map((topic) => ({ label: `Ask about ${nameOf(topic)}`, topic }));
  return [...choices, { label: 'Goodbye' }];
}

/** Column-major, like the verbs: the first four go down the left column. */
export function choiceRect(index: number): Rect {
  const col = Math.floor(index / DIALOG_ROWS);
  const row = index % DIALOG_ROWS;
  return { x: 4 + col * COL_WIDTH, y: VERB_GRID.y + row * VERB_GRID.cellH, w: COL_WIDTH, h: VERB_GRID.cellH };
}

/** Index of the choice under the point (game pixels), if there is one. */
export function choiceAt(count: number, x: number, y: number): number | undefined {
  for (let i = 0; i < count; i++) if (inRect(choiceRect(i), x, y)) return i;
  return undefined;
}
