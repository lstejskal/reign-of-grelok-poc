import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { registerPixelFont, PIXEL_FONT } from '../gfx/pixelFont';

/** First scene: prepares shared resources, then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    registerPixelFont(this);

    const title = this.add.bitmapText(GAME_WIDTH / 2, 70, PIXEL_FONT, 'REIGN OF GRELOK').setOrigin(0.5).setTint(0xe8c040);
    // Fonts are drawn at 1 game pixel per font pixel; scale up by whole numbers only.
    title.setScale(2);

    this.add
      .bitmapText(GAME_WIDTH / 2, 110, PIXEL_FONT, 'A POINT AND CLICK ADVENTURE')
      .setOrigin(0.5)
      .setTint(0xc8c8c8);

    // A 1-pixel frame around the screen makes the 320x200 bounds (and crisp pixels) visible.
    this.add.rectangle(0.5, 0.5, GAME_WIDTH - 1, GAME_HEIGHT - 1).setOrigin(0).setStrokeStyle(1, 0x7a1f2b);
  }
}
