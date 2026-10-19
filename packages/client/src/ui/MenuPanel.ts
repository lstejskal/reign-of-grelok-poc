import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { PIXEL_FONT } from '../gfx/pixelFont';
import { MENU_ROW_HEIGHT, MENU_TITLE_HEIGHT, centeredLayout, rowAt, rowRect } from './menuLayout';
import type { MenuLayout } from './menuLayout';

export interface MenuItem {
  label: string;
  /** Greyed out and unclickable when false (default true). */
  enabled?: boolean;
  onChoose: () => void;
}

const COLOR = { title: 0xffe040, item: 0xb0b0c8, hover: 0xffffff, disabled: 0x50505c };

/**
 * A list of buttons in the middle of the screen: a title and rows of text. It is modal: while it is shown it
 * swallows every click, so the game underneath stays still. The title screen and the in-game menu both use it.
 *
 * `framed` draws a dark box behind it (in-game); without it the menu floats over whatever the scene shows (title).
 */
export class MenuPanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private items: MenuItem[] = [];
  private layout: MenuLayout = { centerX: 0, firstRowY: 0, width: 0 };
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private shownTitle = '';
  private hovered: number | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly options: { framed: boolean; areaHeight: number },
  ) {}

  get visible(): boolean {
    return this.objects.length > 0;
  }

  /** What is on screen, with each row's rectangle in game pixels (for tests and debugging). */
  get state() {
    return {
      title: this.shownTitle,
      items: this.items.map((item, i) => ({ label: item.label, enabled: item.enabled !== false, ...rowRect(this.layout, i) })),
    };
  }

  /** Show a menu (replacing any that is shown). */
  show(title: string, items: MenuItem[]): void {
    this.hide();
    this.items = items;
    this.shownTitle = title;
    const width = 170;
    this.layout = centeredLayout(items.length, title !== '', width, GAME_WIDTH / 2, this.options.areaHeight);
    const top = this.layout.firstRowY - (title !== '' ? MENU_TITLE_HEIGHT : 0);

    if (this.options.framed) {
      const h = (title !== '' ? MENU_TITLE_HEIGHT : 0) + items.length * MENU_ROW_HEIGHT + 8;
      this.objects.push(
        this.scene.add.rectangle(GAME_WIDTH / 2, top - 4 + h / 2, width + 16, h, 0x14141c, 0.96).setStrokeStyle(1, 0x7a1f2b).setDepth(this.depth),
      );
    }
    if (title !== '') {
      this.objects.push(
        this.scene.add.bitmapText(GAME_WIDTH / 2, top + 2, PIXEL_FONT, title).setOrigin(0.5, 0).setTint(COLOR.title).setDepth(this.depth + 1),
      );
    }
    this.labels = items.map((item, i) => {
      const r = rowRect(this.layout, i);
      const label = this.scene.add.bitmapText(GAME_WIDTH / 2, r.y + 2, PIXEL_FONT, item.label).setOrigin(0.5, 0).setDepth(this.depth + 1);
      this.objects.push(label);
      return label;
    });
    this.hovered = undefined;
    this.paint();
  }

  hide(): void {
    for (const object of this.objects) object.destroy();
    this.objects.length = 0;
    this.labels = [];
    this.items = [];
  }

  pointerMove(x: number, y: number): void {
    if (!this.visible) return;
    this.hovered = rowAt(this.layout, this.items.length, x, y);
    this.paint();
  }

  /** A click while the menu is shown. Always swallowed; chooses the row under the pointer if it is enabled. */
  click(x: number, y: number): void {
    const row = rowAt(this.layout, this.items.length, x, y);
    const item = row === undefined ? undefined : this.items[row];
    if (item && item.enabled !== false) item.onChoose();
  }

  private paint(): void {
    this.labels.forEach((label, i) => {
      const enabled = this.items[i]!.enabled !== false;
      label.setTint(!enabled ? COLOR.disabled : i === this.hovered ? COLOR.hover : COLOR.item);
    });
  }
}
