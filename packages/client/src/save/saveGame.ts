import type { Engine, Facing } from '@grelok/engine';

// Saving a game = writing a small JSON "envelope" into the browser's localStorage. The engine already knows how to
// turn its own state into a string (engine.serialize()); the envelope adds what only the client knows: where
// Grognak stands, which game this is, and when it was saved. Everything here is plain data, no Phaser.

export const SAVE_VERSION = 1;

/** The places a game can be saved: three the player chooses, and one the game fills in by itself. */
export const SLOTS = ['1', '2', '3', 'auto'] as const;
export type Slot = (typeof SLOTS)[number];

export interface SavedPlayer {
  x: number;
  y: number;
  facing: Facing;
}

export interface SaveFile {
  version: typeof SAVE_VERSION;
  /** Which game this belongs to (a save of another game must not be loaded). */
  gameId: string;
  /** When, in milliseconds since 1970 (Date.now()). */
  savedAt: number;
  /** The location alias, to show in the slot list without loading the whole engine state. */
  location: string;
  player: SavedPlayer;
  /** engine.serialize(). */
  engine: string;
}

export function makeSave(gameId: string, engine: Engine, player: SavedPlayer, now: number = Date.now()): SaveFile {
  return { version: SAVE_VERSION, gameId, savedAt: now, location: engine.state.location, player, engine: engine.serialize() };
}

const FACINGS: readonly string[] = ['n', 's', 'e', 'w'];

/**
 * Read an envelope back from text. Returns undefined for anything that is not a valid save of THIS game
 * (garbage, an older format, another game's save): the caller just treats the slot as empty.
 */
export function parseSave(text: string | null, gameId: string): SaveFile | undefined {
  if (text === null) return undefined;
  try {
    const save = JSON.parse(text) as Partial<SaveFile> | null;
    const player = save?.player;
    const valid =
      save?.version === SAVE_VERSION &&
      save.gameId === gameId &&
      typeof save.savedAt === 'number' &&
      typeof save.location === 'string' &&
      typeof save.engine === 'string' &&
      typeof player?.x === 'number' &&
      typeof player.y === 'number' &&
      FACINGS.includes(player.facing);
    return valid ? (save as SaveFile) : undefined;
  } catch {
    return undefined;
  }
}

/** "19.10. 11:07" - local time, day first. */
export function formatSaveTime(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}.${d.getMonth() + 1}. ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** What a slot shows in a list: "1: Plain  19.10. 11:07", or "1: Empty". */
export function slotLabel(slot: Slot, save: SaveFile | undefined, locationName: (alias: string) => string): string {
  const name = slot === 'auto' ? 'Auto' : slot;
  return save === undefined ? `${name}: Empty` : `${name}: ${locationName(save.location)}  ${formatSaveTime(save.savedAt)}`;
}

// --- where saves live ------------------------------------------------------------------------------

/** The little bit of localStorage we use, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A store that lives only as long as the page (also the fallback when the browser blocks localStorage). */
export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** localStorage, or a MemoryStore if it is missing or throws (private windows, blocked site data). */
export function browserStore(): KeyValueStore {
  try {
    const store = window.localStorage;
    const probe = 'adventure:probe';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return new MemoryStore();
  }
}

/** The save slots of one game. Every call is safe: a failing store means "empty" or `false`, never an exception. */
export class SaveStore {
  constructor(
    private readonly store: KeyValueStore,
    private readonly gameId: string,
  ) {}

  private key(slot: Slot): string {
    return `adventure:${this.gameId}:save:${slot}`;
  }

  read(slot: Slot): SaveFile | undefined {
    try {
      return parseSave(this.store.getItem(this.key(slot)), this.gameId);
    } catch {
      return undefined;
    }
  }

  /** Returns whether it worked (storage can be full or blocked). */
  write(slot: Slot, save: SaveFile): boolean {
    try {
      this.store.setItem(this.key(slot), JSON.stringify(save));
      return true;
    } catch {
      return false;
    }
  }

  /** All slots in order; undefined = empty. */
  all(): (SaveFile | undefined)[] {
    return SLOTS.map((slot) => this.read(slot));
  }

  /** The most recently saved game of any slot ("Continue"). */
  newest(): { slot: Slot; save: SaveFile } | undefined {
    let best: { slot: Slot; save: SaveFile } | undefined;
    for (const slot of SLOTS) {
      const save = this.read(slot);
      if (save && (!best || save.savedAt > best.save.savedAt)) best = { slot, save };
    }
    return best;
  }
}
