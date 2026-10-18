import Phaser from 'phaser';
import { SCENE_HEIGHT, Thing } from '@grelok/engine';
import type { Point } from '@grelok/engine';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { PIXEL_FONT } from '../gfx/pixelFont';
import { textureKey } from '../data/assets';
import { hitTest } from '../scene/hitTest';
import { HotspotOverlay } from '../scene/hotspotOverlay';
import type { GameSession } from '../session';

/**
 * Shows the location the engine says the player is in: its background picture on top, a strip for the
 * UI (verbs, inventory, ...) below. It never decides anything - it only reacts to engine events.
 */
export class RoomScene extends Phaser.Scene {
  private session!: GameSession;
  private background!: Phaser.GameObjects.Image;
  private locationLabel!: Phaser.GameObjects.BitmapText;
  private sentenceLine!: Phaser.GameObjects.BitmapText;
  private overlay!: HotspotOverlay;
  /** Where the mouse is, in game pixels (undefined = outside the canvas). */
  private pointer: Point | undefined;
  private hovered: string | undefined;

  constructor() {
    super('RoomScene');
  }

  /** Key of the texture actually on screen ('__MISSING' would mean a bug). */
  get backgroundKey(): string {
    return this.background.texture.key;
  }

  /** Text of the sentence line (what the player is pointing at). */
  get sentenceText(): string {
    return this.sentenceLine.text;
  }

  /** Alias of the hotspot under the mouse, if any. */
  get hoveredId(): string | undefined {
    return this.hovered;
  }

  get overlayVisible(): boolean {
    return this.overlay.visible;
  }

  init(data: { session: GameSession }): void {
    this.session = data.session;
  }

  create(): void {
    // bottom strip: UI area (filled in from Step 6 on)
    this.add.rectangle(0, SCENE_HEIGHT, GAME_WIDTH, GAME_HEIGHT - SCENE_HEIGHT, 0x14141c).setOrigin(0);
    this.add.rectangle(0, SCENE_HEIGHT, GAME_WIDTH, 1, 0x7a1f2b).setOrigin(0);
    this.sentenceLine = this.add.bitmapText(0, SCENE_HEIGHT + 6, PIXEL_FONT, '').setTint(0xf0e0a0);
    this.locationLabel = this.add.bitmapText(4, GAME_HEIGHT - 10, PIXEL_FONT, '').setTint(0x909090);
    this.add
      .bitmapText(GAME_WIDTH - 4, GAME_HEIGHT - 10, PIXEL_FONT, 'F1 = OUTLINES  / = CONSOLE')
      .setOrigin(1, 0)
      .setTint(0x707070);

    this.background = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.overlay = new HotspotOverlay(this);
    this.showLocation(this.session.engine.state.location);

    // Input: we only remember where the mouse is; what it points at is worked out by updateHover().
    // Phaser has already converted browser pixels to game pixels (it divides by the zoom).
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.pointer = [Math.floor(pointer.x), Math.floor(pointer.y)];
      this.updateHover();
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.pointer = undefined;
      this.updateHover();
    });
    // F1 normally opens the browser's help page; addCapture stops that.
    this.input.keyboard?.addCapture('F1');
    this.input.keyboard?.on('keydown-F1', () => this.overlay.toggle());

    const stop = this.session.onEvents((events) => {
      for (const event of events) {
        if (event.type === 'location_changed') this.showLocation(event.to);
      }
      // Things can appear or vanish (the gemstone under the rubble), also under a motionless mouse.
      this.refreshHotspots();
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
    this.refreshHotspots();
  }

  private isVisible = (id: string): boolean => this.session.engine.visibleThings().includes(id);

  private refreshHotspots(): void {
    const scene = this.session.bundle.scenes[this.session.engine.state.location];
    this.overlay.draw(scene, this.isVisible);
    this.updateHover();
  }

  /** What is under the mouse? Show its name in the sentence line. */
  private updateHover(): void {
    const scene = this.session.bundle.scenes[this.session.engine.state.location];
    const pointer = this.pointer;
    let id: string | undefined;
    if (scene && pointer && pointer[1] < SCENE_HEIGHT) {
      // Test the pixel's centre, not its corner, so edges never sit exactly on a polygon edge.
      id = hitTest(scene.hotspots, [pointer[0] + 0.5, pointer[1] + 0.5], this.isVisible)?.id;
    }
    this.hovered = id;
    this.sentenceLine.setText(id === undefined ? '' : Thing.aliasToName(id));
    // centre on whole pixels (half pixels would blur a pixel font)
    this.sentenceLine.setX(Math.round(GAME_WIDTH / 2 - this.sentenceLine.width / 2));
  }
}
