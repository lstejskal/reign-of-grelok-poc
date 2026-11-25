import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, artScale, logicalPointer, useLogicalCamera } from '../config';
import { PIXEL_FONT } from '../gfx/pixelFont';
import { textureKey } from '../data/assets';
import { MenuPanel } from '../ui/MenuPanel';
import type { MenuItem } from '../ui/MenuPanel';
import { SLOTS, slotLabel } from '../save/saveGame';
import type { Slot } from '../save/saveGame';
import type { GameSession } from '../session';

/**
 * The first screen: the game's title over a dimmed picture, and a menu - New game, Continue (the newest save),
 * Load (pick a slot). It decides nothing about the game itself: it only chooses which engine to start RoomScene with.
 */
export class TitleScene extends Phaser.Scene {
  private session!: GameSession;
  private menu!: MenuPanel;

  constructor() {
    super('TitleScene');
  }

  /** The menu being shown (for tests). */
  get menuState() {
    return this.menu?.state;
  }

  init(data: { session: GameSession }): void {
    this.session = data.session;
  }

  create(): void {
    useLogicalCamera(this);
    const { bundle } = this.session;
    const backdrop = bundle.scenes[bundle.config.start]?.background;
    if (backdrop !== undefined) this.add.image(0, 0, textureKey(backdrop)).setOrigin(0).setScale(artScale);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0);

    // the title is drawn at 3x: bitmap fonts scale like any picture, and nearest-neighbour keeps the pixels sharp
    this.add.bitmapText(GAME_WIDTH / 2 + 1, 25, PIXEL_FONT, bundle.config.title).setOrigin(0.5, 0).setScale(3).setTint(0x000000);
    this.add.bitmapText(GAME_WIDTH / 2, 24, PIXEL_FONT, bundle.config.title).setOrigin(0.5, 0).setScale(3).setTint(0xd8325a);
    this.add.bitmapText(GAME_WIDTH / 2, 56, PIXEL_FONT, 'A POINT-AND-CLICK ADVENTURE').setOrigin(0.5, 0).setTint(0xc8c8d8);

    this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT - 10, PIXEL_FONT, 'CLICK TO CHOOSE').setOrigin(0.5, 0).setTint(0x707080);

    this.menu = new MenuPanel(this, 10, { framed: false, areaHeight: GAME_HEIGHT + 40 });
    this.showMain();

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.menu.pointerMove(...logicalPointer(p)));
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.menu.click(...logicalPointer(p)));
  }

  private showMain(): void {
    const newest = this.session.saves.newest();
    const items: MenuItem[] = [
      { label: 'New game', onChoose: () => this.startNew() },
      { label: 'Continue', enabled: newest !== undefined, onChoose: () => newest && this.startFrom(newest.slot) },
      { label: 'Load', enabled: newest !== undefined, onChoose: () => this.showSlots() },
    ];
    this.menu.show('', items);
  }

  private showSlots(): void {
    const { saves, bundle } = this.session;
    const items: MenuItem[] = SLOTS.map((slot) => {
      const save = saves.read(slot);
      return {
        label: slotLabel(slot, save, (alias) => bundle.logic.locations[alias]?.name ?? alias),
        enabled: save !== undefined,
        onChoose: () => this.startFrom(slot),
      };
    });
    items.push({ label: 'Back', onChoose: () => this.showMain() });
    this.menu.show('Load game', items);
  }

  private startNew(): void {
    this.session.newGame();
    this.scene.start('RoomScene', { session: this.session });
  }

  private startFrom(slot: Slot): void {
    const save = this.session.saves.read(slot);
    if (!save) return this.showSlots();
    try {
      this.session.loadEngine(save.engine);
    } catch {
      return this.showSlots(); // a damaged save: stay here instead of crashing
    }
    this.scene.start('RoomScene', { session: this.session, restore: save.player });
  }
}
