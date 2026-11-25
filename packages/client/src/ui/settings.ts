import type { KeyValueStore } from '../save/saveGame';

/**
 * How long spoken lines stay on screen: the speech clock runs this many times as fast (a slow reader picks SLOW).
 * Kept in the browser's storage like the volume, so the choice survives a reload.
 */
export const TEXT_SPEEDS = [
  { label: 'SLOW', factor: 0.6 },
  { label: 'NORMAL', factor: 1 },
  { label: 'FAST', factor: 1.8 },
] as const;
export type TextSpeed = (typeof TEXT_SPEEDS)[number];

const TEXT_SPEED_KEY = 'adventure:text-speed';

export function loadTextSpeed(store: KeyValueStore): TextSpeed {
  try {
    const label = store.getItem(TEXT_SPEED_KEY);
    return TEXT_SPEEDS.find((s) => s.label === label) ?? TEXT_SPEEDS[1];
  } catch {
    return TEXT_SPEEDS[1];
  }
}

/** The next speed in the list (after FAST comes SLOW again), saved. */
export function cycleTextSpeed(store: KeyValueStore, current: TextSpeed): TextSpeed {
  const next = TEXT_SPEEDS[(TEXT_SPEEDS.findIndex((s) => s.label === current.label) + 1) % TEXT_SPEEDS.length]!;
  try {
    store.setItem(TEXT_SPEED_KEY, next.label);
  } catch {
    // a full or blocked store only means the choice is forgotten next time
  }
  return next;
}
