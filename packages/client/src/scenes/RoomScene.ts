import Phaser from 'phaser';
import { SCENE_HEIGHT } from '@grelok/engine';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { PIXEL_FONT } from '../gfx/pixelFont';
import { textureKey } from '../data/assets';
import type { GameSession } from '../session';

/**
 * Shows the location the engine says the player is in: its background picture on top, a strip for the
 * UI (verbs, inventory, ...) below. It never decides anything - it only reacts to engine events.
 */
export class RoomScene extends Phaser.Scene {
  private session!: GameSession;
  private background!: Phaser.GameObjects.Image;
  private locationLabel!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('RoomScene');
  }

  /** Key of the texture actually on screen ('__MISSING' would mean a bug). */
  get backgroundKey(): string {
    return this.background.texture.key;
  }

  init(data: { session: GameSession }): void {
    this.session = data.session;
  }

  create(): void {
    // bottom strip: UI area (filled in from Step 6 on)
    this.add.rectangle(0, SCENE_HEIGHT, GAME_WIDTH, GAME_HEIGHT - SCENE_HEIGHT, 0x14141c).setOrigin(0);
    this.add.rectangle(0, SCENE_HEIGHT, GAME_WIDTH, 1, 0x7a1f2b).setOrigin(0);
    this.locationLabel = this.add.bitmapText(4, SCENE_HEIGHT + 6, PIXEL_FONT, '').setTint(0xc8c8c8);
    this.add
      .bitmapText(GAME_WIDTH - 4, GAME_HEIGHT - 12, PIXEL_FONT, '/ = CONSOLE')
      .setOrigin(1, 0)
      .setTint(0x707070);

    this.background = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.showLocation(this.session.engine.state.location);

    const stop = this.session.onEvents((events) => {
      for (const event of events) {
        if (event.type === 'location_changed') this.showLocation(event.to);
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  }

  private showLocation(location: string): void {
    const { bundle } = this.session;
    const asset = bundle.scenes[location]?.background;
    if (asset === undefined) {
      throw new Error(`Scene "${location}" has no background`);
    }

    this.background.setTexture(textureKey(asset));
    this.locationLabel.setText(bundle.logic.locations[location]?.name ?? location);
  }
}
