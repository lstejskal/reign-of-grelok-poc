import Phaser from 'phaser';
import { Engine } from '@grelok/engine';
import type { GameBundle } from '@grelok/engine';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { registerPixelFont, PIXEL_FONT } from '../gfx/pixelFont';
import { loadGame, requestedGameId } from '../data/loadGame';
import { assetUrl, textureKey } from '../data/assets';
import { installDebugConsole } from '../debugConsole';
import { debugState } from '../debug';
import { GameSession } from '../session';

/** First scene: loads the game data and its pictures, creates the engine, then hands over to RoomScene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    registerPixelFont(this);
    this.add.rectangle(0.5, 0.5, GAME_WIDTH - 1, GAME_HEIGHT - 1).setOrigin(0).setStrokeStyle(1, 0x7a1f2b);

    try {
      const bundle = loadGame(requestedGameId());
      const engine = new Engine(bundle.logic, { startLocation: bundle.config.start });
      const session = new GameSession(bundle, engine);
      Object.assign(debugState, { bundle, engine, session });
      installDebugConsole(session);

      this.text(GAME_WIDTH / 2, 90, 'LOADING...', 0xc8c8c8);
      this.loadPictures(bundle, () => this.scene.start('RoomScene', { session }));
    } catch (error) {
      // A broken or missing game should be visible on screen, not just in the console.
      debugState.error = error instanceof Error ? error.message : String(error);
      this.text(GAME_WIDTH / 2, 90, 'CANNOT LOAD GAME', 0xe05050, 2);
      this.text(GAME_WIDTH / 2, 120, debugState.error, 0xc8c8c8, 1, GAME_WIDTH - 20);
    }
  }

  // Queue every scene background with Phaser's loader and call `done` when they have all arrived.
  private loadPictures(bundle: GameBundle, done: () => void): void {
    for (const scene of Object.values(bundle.scenes)) {
      if (scene.background === undefined) continue;
      const url = assetUrl(bundle.id, scene.background);
      if (url === undefined) throw new Error(`Missing picture: ${scene.background}`);
      this.load.image(textureKey(scene.background), url);
    }

    if (this.load.list.size === 0) {  // (totalToLoad is only set once loading starts)
      done();
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, done);
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      debugState.error = `Could not load ${file.url}`;
    });
    this.load.start();
  }

  private text(x: number, y: number, value: string, tint: number, scale = 1, maxWidth?: number) {
    const t = this.add.bitmapText(x, y, PIXEL_FONT, value, 8).setOrigin(0.5, 0).setTint(tint).setScale(scale).setCenterAlign();
    if (maxWidth !== undefined) t.setMaxWidth(maxWidth / scale);
    return t;
  }
}
