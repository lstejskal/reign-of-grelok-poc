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
      return debugState.engine;
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
    /** The scene sprites currently drawn: { id, image, x, y, depth }. */
    get sprites() {
      return (game.scene.getScene('RoomScene') as RoomScene | null)?.spritesShown;
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
