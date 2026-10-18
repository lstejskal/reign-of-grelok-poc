import Phaser from 'phaser';
import { SCENE_WIDTH } from '@grelok/engine';
import type { Point, SceneData } from '@grelok/engine';
import { PIXEL_FONT } from '../gfx/pixelFont';

const COLORS = {
  hotspot: 0x40ff60, // things you can point at right now
  hidden: 0x707070, // things the engine says are not visible (so not clickable)
  exit: 0x40a0ff,
  walkTo: 0xffe040, // where the player walks before interacting
  spawn: 0xff40ff, // where the player appears when arriving through an exit
};

/**
 * The F1 debug overlay: draws the outlines the data describes, so you can check by eye that a
 * polygon covers the right part of the picture. It only draws; RoomScene tells it what and when.
 */
export class HotspotOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.BitmapText[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(1000).setVisible(false);
  }

  get visible(): boolean {
    return this.graphics.visible;
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  setVisible(on: boolean): void {
    this.graphics.setVisible(on);
    for (const label of this.labels) label.setVisible(on);
  }

  /** Redraw for a scene; `isVisible` says which things the engine currently shows. */
  draw(data: SceneData | undefined, isVisible: (id: string) => boolean): void {
    const g = this.graphics;
    g.clear();
    for (const label of this.labels) label.destroy();
    this.labels.length = 0;
    if (!data) return;

    for (const hotspot of data.hotspots) {
      const color = isVisible(hotspot.id) ? COLORS.hotspot : COLORS.hidden;
      this.outline(hotspot.polygon, color);
      this.label(hotspot.polygon[0]!, hotspot.id, color);
      this.cross(hotspot.walkTo, COLORS.walkTo);
    }
    for (const exit of data.exits) {
      this.outline(exit.polygon, COLORS.exit);
      this.label(exit.polygon[0]!, `exit ${exit.direction}`, COLORS.exit);
      this.cross(exit.walkTo, COLORS.walkTo);
      this.cross(exit.spawn, COLORS.spawn);
    }
    for (const label of this.labels) label.setVisible(this.visible);
  }

  private outline(polygon: Point[], color: number): void {
    this.graphics.lineStyle(1, color, 1);
    this.graphics.strokePoints(
      polygon.map(([x, y]) => new Phaser.Math.Vector2(x, y)),
      true, // close the shape
    );
  }

  private cross([x, y]: Point, color: number): void {
    this.graphics.lineStyle(1, color, 1);
    this.graphics.lineBetween(x - 2, y, x + 2, y);
    this.graphics.lineBetween(x, y - 2, x, y + 2);
  }

  private label([x, y]: Point, text: string, color: number): void {
    // keep the text inside the picture, whatever the polygon's first corner is
    const label = this.scene.add
      .bitmapText(x + 1, Math.max(y + 1, 1), PIXEL_FONT, text)
      .setTint(color)
      .setDepth(1001);
    label.setX(Math.min(label.x, SCENE_WIDTH - label.width - 1));
    this.labels.push(label);
  }
}
