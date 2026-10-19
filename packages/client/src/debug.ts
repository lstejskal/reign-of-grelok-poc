import type Phaser from 'phaser';
import type { Engine, GameBundle } from '@grelok/engine';
import type { GameSession } from './session';
import type { RoomScene } from './scenes/RoomScene';

/** What the game registers for the debug hook (see installDebugHook). */
export interface DebugState {
  bundle?: GameBundle;
  engine?: Engine;
  session?: GameSession;
  error?: string;
  /** Multiplies the walking speed (tests set it high so they do not wait). */
  speedFactor?: number;
}

export const debugState: DebugState = {};

/** Dev hook so Playwright (and you, in DevTools) can inspect the game: `window.__adv`. */
export function installDebugHook(game: Phaser.Game): void {
  (window as unknown as { __adv: unknown }).__adv = {
    game,
    get scene(): string {
      return game.scene.getScenes(true)[0]?.scene.key ?? '';
    },
    get zoom(): number {
      return game.scale.zoom;
    },
    get bundle() {
      return debugState.bundle;
    },
    get engine() {
      return debugState.session?.engine; // the session swaps engines when a game is loaded
    },
    get session() {
      return debugState.session;
    },
    /** Texture key of the background RoomScene is currently showing. */
    get backgroundKey(): string | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.backgroundKey;
    },
    /** What the sentence line says (the name of the hovered hotspot). */
    get sentence(): string | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.sentenceText;
    },
    /** The answer text currently shown in the text box. */
    get answer(): string | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.answerText;
    },
    /** Aliases of the things shown in the inventory panel. */
    get inventory(): string[] | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.inventoryShown;
    },
    /** The verb selected in the verb grid (undefined = none). */
    get verb(): string | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.selectedVerb;
    },
    get hovered(): string | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.hoveredId;
    },
    get overlayVisible(): boolean | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.overlayVisible;
    },
    /** Where Grognak is, which way he faces, whether he is walking, and how big he is drawn. */
    get player() {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.playerState;
    },
    /** Cutscene machinery: { running, log, audio, ended, endLines }. */
    get cutscene() {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.cutsceneState;
    },
    /** The scene sprites currently drawn: { id, image, x, y, depth }. */
    get sprites() {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.spritesShown;
    },
    /** The menu being shown (title screen or in-game): { title, items: [{label, enabled, x, y, w, h}] }, or undefined. */
    get menu() {
      for (const key of ['TitleScene', 'RoomScene']) {
        const scene = game.scene.getScene(key) as unknown as { menuState?: unknown } | null;
        if (game.scene.isActive(key) && scene?.menuState) return scene.menuState;
      }
      return undefined;
    },
    /** What the save slots hold: [{ slot, location, savedAt, player }] (empty slots are left out). */
    get saves() {
      const session = debugState.session;
      return session && ['1', '2', '3', 'auto'].flatMap((slot, i) => {
        const save = session.saves.all()[i];
        return save ? [{ slot, location: save.location, savedAt: save.savedAt, player: save.player }] : [];
      });
    },
    /** The speech on screen: { speaker, text, color }, or undefined. */
    get speech() {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.speechNow;
    },
    /** The open talk menu: { npc, choices }, or undefined. */
    get dialog() {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.dialogState;
    },
    /** True while the screen fades between scenes. */
    get transitioning(): boolean | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.isTransitioning;
    },
    /** How black the fade is (0 = clear, 1 = black). */
    get fade(): number | undefined {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.fadeAlpha;
    },
    /** Music and sound: { currentTrack, played, muted, volume }. */
    get audio() {
      return debugState.session?.audio.state;
    },
    get speedFactor(): number {
      return debugState.speedFactor ?? 1;
    },
    set speedFactor(value: number) {
      debugState.speedFactor = value;
    },
    get error() {
      return debugState.error;
    },
  };
}
