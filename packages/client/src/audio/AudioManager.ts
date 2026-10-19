import type Phaser from 'phaser';
import { sfxPath } from '@grelok/engine';
import type { KeyValueStore } from '../save/saveGame';
import { effectiveVolume, loadSettings, nextVolume, saveSettings, stepLevel } from './mix';
import type { AudioPlayer, AudioSettings } from './mix';

/** The bits of a Phaser sound we use (both the WebAudio and the HTML5 kind have them). */
interface Voice extends Phaser.Sound.BaseSound {
  volume: number;
}

interface Track {
  voice: Voice;
  /** How loud this track is right now relative to the master volume (0..1), moving towards `target`. */
  level: number;
  target: 0 | 1;
}

/**
 * Plays the game's music and sound effects with Phaser's sound manager.
 *
 * - Music: one looping track per scene. When the track changes the old one fades out while the new one fades in
 *   (a crossfade). The fades are driven by update(), called every frame with the elapsed milliseconds.
 * - Sound effects: fire and forget.
 * - Browsers refuse to play sound before the player has clicked or pressed a key. Phaser notices that, keeps the
 *   sounds waiting and starts them on the first click, so nothing special is needed here.
 * - Volume and mute are saved in localStorage and apply to everything.
 */
export class AudioManager implements AudioPlayer {
  settings: AudioSettings;
  private currentTrack: string | undefined;
  private readonly tracks = new Map<string, Track>();
  private readonly played: string[] = [];

  /**
   * @param loaded the asset paths (relative to assets/) of every sound file that was loaded into Phaser's cache
   */
  constructor(
    private readonly sound: Phaser.Sound.BaseSoundManager,
    private readonly store: KeyValueStore,
    private readonly loaded: ReadonlySet<string>,
  ) {
    this.settings = loadSettings(store);
  }

  get state() {
    return { currentTrack: this.currentTrack, played: [...this.played], muted: this.settings.muted, volume: this.settings.volume };
  }

  setMusic(path: string | undefined): void {
    if (path === this.currentTrack) return;
    this.currentTrack = path;

    for (const track of this.tracks.values()) track.target = 0; // everything fades out...
    if (path === undefined || !this.loaded.has(path)) return;

    const existing = this.tracks.get(path); // ...except the new one (which may be still fading out from a moment ago)
    if (existing) {
      existing.target = 1;
      return;
    }
    const voice = this.sound.add(trackKey(path), { loop: true, volume: 0 }) as Voice;
    voice.play();
    this.tracks.set(path, { voice, level: 0, target: 1 });
  }

  playSfx(name: string): void {
    const path = sfxPath(name);
    if (!this.loaded.has(path)) return;
    this.played.push(name);
    this.sound.play(trackKey(path), { volume: effectiveVolume(this.settings) });
  }

  /** Called every frame. Moves the fades along and keeps the volume in step with the settings. */
  update(deltaMs: number): void {
    const master = effectiveVolume(this.settings);
    for (const [path, track] of this.tracks) {
      track.level = stepLevel(track.level, track.target, deltaMs);
      track.voice.volume = track.level * master;
      if (track.level === 0 && track.target === 0) {
        track.voice.destroy(); // faded out: free it
        this.tracks.delete(path);
      }
    }
  }

  toggleMute(): void {
    this.change({ ...this.settings, muted: !this.settings.muted });
  }

  cycleVolume(): void {
    this.change({ volume: nextVolume(this.settings.volume), muted: false });
  }

  private change(settings: AudioSettings): void {
    this.settings = settings;
    saveSettings(this.store, settings);
  }
}

const trackKey = (assetPath: string): string => `audio:${assetPath}`;
export { trackKey as audioKey };
