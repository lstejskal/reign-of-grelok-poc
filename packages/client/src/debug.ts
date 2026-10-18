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
    get error() {
      return debugState.error;
    },
  };
}
