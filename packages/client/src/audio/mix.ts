import type { KeyValueStore } from '../save/saveGame';

// The pure part of the audio system: numbers in, numbers out. No Phaser, no browser, so it is easy to test.

/** How long a track takes to fade in or out when the music changes. */
export const FADE_MS = 900;

/** The volume steps the menu cycles through (0 = off). */
export const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

export interface AudioSettings {
  /** Master volume, 0..1. */
  volume: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: AudioSettings = { volume: 0.6, muted: false };

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** What the speakers get: the master volume, or nothing while muted. */
export const effectiveVolume = (s: AudioSettings): number => (s.muted ? 0 : clamp01(s.volume));

/**
 * One step of a fade: move `level` towards `target` (both 0..1) as if `deltaMs` passed, where going from
 * 0 to 1 takes `fadeMs`. Never overshoots.
 */
export function stepLevel(level: number, target: number, deltaMs: number, fadeMs: number = FADE_MS): number {
  const step = deltaMs / fadeMs;
  return level < target ? Math.min(target, level + step) : Math.max(target, level - step);
}

/** The next entry of VOLUME_STEPS after `volume`, wrapping round to silence. */
export function nextVolume(volume: number): number {
  const next = VOLUME_STEPS.find((v) => v > volume + 0.001);
  return next ?? VOLUME_STEPS[0];
}

/** "75%" */
export const volumeLabel = (s: AudioSettings): string => (s.muted || s.volume <= 0 ? 'OFF' : `${Math.round(s.volume * 100)}%`);

const SETTINGS_KEY = 'adventure:audio';

/** Settings from storage; anything missing or damaged becomes the default (storage may be empty, blocked or edited by hand). */
export function loadSettings(store: KeyValueStore): AudioSettings {
  try {
    const raw = JSON.parse(store.getItem(SETTINGS_KEY) ?? 'null') as Partial<AudioSettings> | null;
    return {
      volume: typeof raw?.volume === 'number' && Number.isFinite(raw.volume) ? clamp01(raw.volume) : DEFAULT_SETTINGS.volume,
      muted: raw?.muted === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(store: KeyValueStore, settings: AudioSettings): void {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // a full or blocked store only means the choice is forgotten next time
  }
}

/**
 * What the rest of the client asks of the audio system. RoomScene only knows this interface, so tests (and
 * a browser with no sound) can use `silentAudio` instead of the real thing.
 */
export interface AudioPlayer {
  /** Play this music file (asset path) looping, fading out whatever played before; undefined = fade to silence. */
  setMusic(path: string | undefined): void;
  /** Play a sound effect once (a name from assets/sfx/). Unknown names are ignored. */
  playSfx(name: string): void;
  settings: AudioSettings;
  toggleMute(): void;
  cycleVolume(): void;
  /** For debugging and tests. */
  readonly state: { currentTrack: string | undefined; played: string[]; muted: boolean; volume: number };
}

export const silentAudio: AudioPlayer = {
  setMusic() {},
  playSfx() {},
  settings: { ...DEFAULT_SETTINGS },
  toggleMute() {},
  cycleVolume() {},
  state: { currentTrack: undefined, played: [], muted: false, volume: 0 },
};
