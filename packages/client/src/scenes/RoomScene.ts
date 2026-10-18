import Phaser from 'phaser';
import { SCENE_HEIGHT, SCENE_WIDTH, iconPath } from '@grelok/engine';
import type { Command, ExitData, Facing, Point, Verb } from '@grelok/engine';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { PIXEL_FONT } from '../gfx/pixelFont';
import { textureKey } from '../data/assets';
import { debugState } from '../debug';
import { hitTest } from '../scene/hitTest';
import { HotspotOverlay } from '../scene/hotspotOverlay';
import { PlayerActor } from '../scene/PlayerActor';
import { readMask } from '../scene/readMask';
import { gridFromMask, makeGrid } from '../walk/pathfinding';
import { walkTargetFor, walkTargetForCommand } from '../walk/plan';
import { arrivalAt } from '../walk/spawn';
import { WalkArea } from '../walk/WalkArea';
import { SentenceBuilder } from '../ui/SentenceBuilder';
import { TextPager } from '../ui/textPages';
import { VERBS } from '../ui/verbs';
import { SENTENCE_Y, TEXT_BOX, TEXT_BOX_CHARS, TEXT_BOX_LINES, TEXT_BOX_TEXT, inRect, verbAt, verbRect } from '../ui/layout';
import { SCROLL_LEFT, SCROLL_RIGHT, SLOTS, clampScroll, itemAt, maxScroll, slotRect, visibleItems } from '../ui/inventory';
import type { GameSession } from '../session';

/** Each half (out, in) of the fade between scenes, in milliseconds. */
const FADE_MS = 200;

const COLOR = {
  sentence: 0xf0e0a0,
  verb: 0xb0b0c8,
  verbHover: 0xffffff,
  verbSelected: 0xffe040,
  answer: 0xe8e8e8,
  hint: 0x707070,
};

/**
 * Shows the location the engine says the player is in: its background picture on top, and below it the
 * UI strip (sentence line, verb grid, answer box). It never decides anything - mouse clicks are turned into
 * Commands by the SentenceBuilder, the engine answers with events, and this scene only draws them.
 */
export class RoomScene extends Phaser.Scene {
  private session!: GameSession;
  private background!: Phaser.GameObjects.Image;
  private locationLabel!: Phaser.GameObjects.BitmapText;
  private sentenceLine!: Phaser.GameObjects.BitmapText;
  private verbLabels = new Map<Verb, Phaser.GameObjects.BitmapText>();
  private answerBox!: Phaser.GameObjects.BitmapText;
  private answerBand!: Phaser.GameObjects.Rectangle;
  private moreMarker!: Phaser.GameObjects.BitmapText;
  private slotImages: Phaser.GameObjects.Image[] = [];
  private scrollButtons!: { left: Phaser.GameObjects.BitmapText; right: Phaser.GameObjects.BitmapText };
  private overlay!: HotspotOverlay;
  private player!: PlayerActor;
  /** A black rectangle over the scene (not the UI strip) that fades in and out between scenes. */
  private fade!: Phaser.GameObjects.Rectangle;
  /** The location whose picture is on screen. It lags behind the engine's location during a fade. */
  private shownLocation = '';
  private transitioning = false;
  private hoveredExit: ExitData | undefined;
  /** The walkable floor of each scene, built from its walkmask the first time it is needed. */
  private readonly areas = new Map<string, WalkArea>();

  private readonly builder = new SentenceBuilder();
  private readonly pager = new TextPager(TEXT_BOX_CHARS, TEXT_BOX_LINES);
  /** Where the mouse is, in game pixels (undefined = outside the canvas). */
  private pointer: Point | undefined;
  private hovered: string | undefined;
  /** How many inventory columns are scrolled out of view on the left. */
  private inventoryScroll = 0;

  constructor() {
    super('RoomScene');
  }

  /** Key of the texture actually on screen ('__MISSING' would mean a bug). */
  get backgroundKey(): string {
    return this.background.texture.key;
  }

  /** Text of the sentence line (verb, things, and what the mouse points at). */
  get sentenceText(): string {
    return this.sentenceLine.text;
  }

  /** The answer currently shown in the text box. */
  get answerText(): string {
    return this.answerBox.text;
  }

  /** Aliases of the things shown in the inventory slots right now. */
  get inventoryShown(): string[] {
    return visibleItems(this.session.engine.state.inventory, this.inventoryScroll).filter((i): i is string => !!i);
  }

  /** True while the screen fades between two scenes (clicks are ignored then). */
  get isTransitioning(): boolean {
    return this.transitioning;
  }

  /** How black the fade rectangle is, 0..1 (for tests). */
  get fadeAlpha(): number {
    return this.fade.alpha;
  }

  /** Position, facing, size ... of Grognak (for tests and debugging). */
  get playerState() {
    return this.player.state;
  }

  get selectedVerb(): Verb | undefined {
    return this.builder.selectedVerb;
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
    // bottom strip: the UI area
    this.add.rectangle(0, SCENE_HEIGHT, GAME_WIDTH, GAME_HEIGHT - SCENE_HEIGHT, 0x14141c).setOrigin(0);
    this.add.rectangle(0, SCENE_HEIGHT, GAME_WIDTH, 1, 0x7a1f2b).setOrigin(0);
    this.sentenceLine = this.add.bitmapText(0, SENTENCE_Y, PIXEL_FONT, '').setTint(COLOR.sentence);
    this.createInventoryPanel();
    // the answer band lies over the top of the scene, above everything except the debug outlines
    this.answerBand = this.add.rectangle(0, 0, TEXT_BOX.w, TEXT_BOX.h, 0x000000, 0.8).setOrigin(0).setDepth(500).setVisible(false);
    this.answerBox = this.add.bitmapText(TEXT_BOX_TEXT.x, TEXT_BOX_TEXT.y, PIXEL_FONT, '').setTint(COLOR.answer).setDepth(501);
    this.moreMarker = this.add
      .bitmapText(GAME_WIDTH - 4, TEXT_BOX.h - 9, PIXEL_FONT, 'MORE >')
      .setOrigin(1, 0)
      .setTint(COLOR.verbSelected)
      .setDepth(501)
      .setVisible(false);
    VERBS.forEach((spec, i) => {
      const r = verbRect(i);
      this.verbLabels.set(spec.verb, this.add.bitmapText(r.x, r.y + 1, PIXEL_FONT, spec.label));
    });
    this.locationLabel = this.add.bitmapText(4, GAME_HEIGHT - 8, PIXEL_FONT, '').setTint(0x909090);
    this.add
      .bitmapText(GAME_WIDTH - 4, GAME_HEIGHT - 8, PIXEL_FONT, 'F1 = OUTLINES  / = CONSOLE')
      .setOrigin(1, 0)
      .setTint(COLOR.hint);

    this.background = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.overlay = new HotspotOverlay(this);
    this.showLocation(this.session.engine.state.location);
    this.fade = this.add.rectangle(0, 0, SCENE_WIDTH, SCENE_HEIGHT, 0x000000).setOrigin(0).setDepth(400).setAlpha(0);

    const { config } = this.session.bundle;
    const area = this.areaFor(this.session.engine.state.location);
    const start = area.snap(config.startPosition ?? [SCENE_WIDTH / 2, 112]);
    this.player = new PlayerActor(this, config.player, start, area, () => debugState.speedFactor ?? 1);
    this.refreshUi();

    this.setUpInput();

    const stop = this.session.onEvents((events) => {
      if (events.some((e) => e.type === 'location_changed')) this.transition();
      const said = events.flatMap((e) => (e.type === 'say' ? [e.text] : []));
      if (said.length > 0) this.pager.set(said.join('\n'));
      // Things can appear or vanish (the gemstone under the rubble), also under a motionless mouse.
      this.refreshHotspots();
      this.refreshUi();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  }

  /** Runs every frame. `delta` is the milliseconds since the last frame; movement is always speed x time. */
  update(_time: number, delta: number): void {
    this.player.update(delta);
    if (this.overlay.visible) this.overlay.drawPath(this.player.follower.position, this.player.follower.remaining);
  }

  private createInventoryPanel(): void {
    for (let slot = 0; slot < SLOTS; slot++) {
      const r = slotRect(slot);
      this.add.rectangle(r.x, r.y, r.w - 1, r.h, 0x1e1e2a).setOrigin(0);
      this.slotImages.push(this.add.image(r.x + 1, r.y, '__DEFAULT').setOrigin(0).setVisible(false));
    }
    const arrow = (rect: typeof SCROLL_LEFT, glyph: string) =>
      this.add.bitmapText(rect.x + 2, rect.y + rect.h / 2 - 3, PIXEL_FONT, glyph).setTint(COLOR.verb);
    this.scrollButtons = { left: arrow(SCROLL_LEFT, '<'), right: arrow(SCROLL_RIGHT, '>') };
  }

  // --- input: we only turn mouse and keys into builder calls ------------------------------------

  private setUpInput(): void {
    // Phaser has already converted browser pixels to game pixels (it divides by the zoom).
    this.input.mouse?.disableContextMenu(); // right-click is a game button, not a browser menu
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.pointer = [Math.floor(pointer.x), Math.floor(pointer.y)];
      this.refreshHotspots(false);
      this.refreshUi();
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.pointer = undefined;
      this.refreshHotspots(false);
      this.refreshUi();
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.pointer = [Math.floor(pointer.x), Math.floor(pointer.y)];
      if (!this.transitioning) this.onClick(this.pointer, pointer.rightButtonDown());
      this.refreshHotspots();
      this.refreshUi();
    });

    // F1 normally opens the browser's help page; addCapture stops that.
    this.input.keyboard?.addCapture('F1');
    this.input.keyboard?.on('keydown-F1', () => this.overlay.toggle());
    this.input.keyboard?.on('keydown-ESC', () => {
      this.builder.cancel();
      this.refreshUi();
    });
  }

  private onClick([x, y]: Point, right: boolean): void {
    // a click on the answer band reads on (and does nothing else)
    if (this.pager.current !== '' && y < this.answerBand.height) {
      this.pager.next();
      return;
    }

    if (!right && inRect(SCROLL_LEFT, x, y)) this.inventoryScroll--;
    else if (!right && inRect(SCROLL_RIGHT, x, y)) this.inventoryScroll++;

    // things in the scene and things in the inventory are clicked the same way
    const id = this.thingAt(x, y);
    if (id !== undefined) {
      const carried = y >= SCENE_HEIGHT;
      if (right) this.act(this.builder.lookAt(id));
      else if (this.builder.idle && !carried) this.walkToThing(id); // no verb chosen: just walk there
      else {
        const command = this.builder.pickObject(id, carried);
        if (command) this.act(command);
      }
      return;
    }

    // an exit: walk to it, then ask the engine to go that way (it may say no)
    const exit = y < SCENE_HEIGHT && !right ? this.exitAt(x, y) : undefined;
    if (exit) {
      this.builder.cancel();
      this.pager.clear();
      this.player.walkTo(exit.walkTo, {
        facing: exit.direction as Facing,
        then: () => this.session.perform({ verb: 'go', objects: [exit.direction] }),
      });
      return;
    }

    // the floor: left-click walks there (dropping any half-built sentence), right-click cancels the sentence
    if (y < SCENE_HEIGHT && !right) {
      this.builder.cancel();
      this.player.walkTo([x, y]);
      return;
    }

    // not on the scene: right-click cancels, left-click may hit a verb
    const verb = verbAt(x, y);
    if (right) this.builder.cancel();
    else if (verb) this.builder.selectVerb(verb);
  }

  private walkToThing(id: string): void {
    const target = walkTargetFor(this.session.bundle.scenes[this.shownLocation], id);
    if (target) this.player.walkTo(target.point, { facing: target.facing, toward: target.toward });
  }

  /** Carry out a command: first walk to what it is about (if it needs that), then let the engine do it. */
  private act(command: Command): void {
    this.pager.clear();
    const target = walkTargetForCommand(this.session.bundle.scenes[this.shownLocation], command);
    if (target === undefined) this.session.perform(command);
    else {
      this.player.walkTo(target.point, {
        facing: target.facing,
        toward: target.toward,
        then: () => this.session.perform(command),
      });
    }
  }

  // --- showing what the world looks like ----------------------------------------------------------

  private showLocation(location: string): void {
    const { bundle } = this.session;
    const asset = bundle.scenes[location]?.background;
    if (asset === undefined) {
      throw new Error(`Scene "${location}" has no background`);
    }

    this.shownLocation = location;
    this.background.setTexture(textureKey(asset));
    this.locationLabel.setText(bundle.logic.locations[location]?.name ?? location);
    this.refreshHotspots();
  }

  /** The floor of a scene; built from its walkmask picture the first time (no mask = everything is floor). */
  private areaFor(location: string): WalkArea {
    let area = this.areas.get(location);
    if (area === undefined) {
      const scene = this.session.bundle.scenes[location];
      const grid =
        scene?.walkmask !== undefined
          ? gridFromMask(readMask(this.textures, textureKey(scene.walkmask)))
          : makeGrid(SCENE_WIDTH / 4, SCENE_HEIGHT / 4, 4, () => true);
      area = new WalkArea(grid, scene?.scale);
      this.areas.set(location, area);
    }
    return area;
  }

  /** The player arrives in a new scene: at the matching exit's spawn point if there is one, looking into the scene. */
  private enterLocation(from: string, to: string): void {
    const area = this.areaFor(to);
    const arrival = arrivalAt(this.session.bundle, from, to);
    this.player.enter(area, area.snap(arrival?.point ?? [SCENE_WIDTH / 2, 112]), arrival?.facing);
  }

  /**
   * Change scene with a fade: the picture goes black, the new scene is set up while nothing can be seen, then it
   * fades back in. The engine has already moved (it does not wait for pictures); only what we SHOW is delayed.
   * Several changes in a row just share one fade, which ends in the engine's latest location.
   */
  private transition(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const half = FADE_MS / (debugState.speedFactor ?? 1);
    this.tweens.add({
      targets: this.fade,
      alpha: 1,
      duration: half,
      onComplete: () => {
        const from = this.shownLocation;
        const to = this.session.engine.state.location;
        this.showLocation(to);
        if (to !== from) this.enterLocation(from, to);
        this.refreshUi();
        this.tweens.add({
          targets: this.fade,
          alpha: 0,
          duration: half,
          onComplete: () => {
            this.transitioning = false;
            this.refreshHotspots(false);
            this.refreshUi();
          },
        });
      },
    });
  }

  private isVisible = (id: string): boolean => this.session.engine.visibleThings(this.shownLocation).includes(id);

  /** The thing under a point: a scene hotspot above the strip, an inventory item in it. */
  private thingAt(x: number, y: number): string | undefined {
    if (y < SCENE_HEIGHT) return this.hotspotAt(x, y);
    return itemAt(this.session.engine.state.inventory, this.inventoryScroll, x, y);
  }

  /** The hotspot under a point (game pixels), if the engine currently shows its thing. */
  private hotspotAt(x: number, y: number): string | undefined {
    const scene = this.session.bundle.scenes[this.shownLocation];
    if (!scene || y >= SCENE_HEIGHT) return undefined;
    // Test the pixel's centre, not its corner, so edges never sit exactly on a polygon edge.
    return hitTest(scene.hotspots, [x + 0.5, y + 0.5], (h) => this.isVisible(h.id))?.id;
  }

  /** The exit under a point (game pixels) in the scene being shown. */
  private exitAt(x: number, y: number): ExitData | undefined {
    const scene = this.session.bundle.scenes[this.shownLocation];
    if (!scene || y >= SCENE_HEIGHT) return undefined;
    return hitTest(scene.exits, [x + 0.5, y + 0.5]);
  }

  /** Work out what the mouse points at; `redraw` also redraws the F1 outlines (only needed when the world changed). */
  private refreshHotspots(redraw = true): void {
    if (redraw) {
      const location = this.shownLocation;
      this.overlay.draw(this.session.bundle.scenes[location], this.isVisible, this.areaFor(location));
    }
    this.hovered = this.pointer && this.thingAt(...this.pointer);
    this.hoveredExit = this.pointer && this.hovered === undefined ? this.exitAt(...this.pointer) : undefined;
    this.builder.hover(this.hovered, this.pointer !== undefined && this.pointer[1] >= SCENE_HEIGHT);
  }

  /** Bring every piece of the UI strip in line with the builder and the pager. */
  private refreshUi(): void {
    this.sentenceLine.setText(this.exitAwareSentence());
    // centre on whole pixels (half pixels would blur a pixel font)
    this.sentenceLine.setX(Math.round(GAME_WIDTH / 2 - this.sentenceLine.width / 2));

    const overVerb = this.pointer && verbAt(...this.pointer);
    for (const [verb, label] of this.verbLabels) {
      label.setTint(
        verb === this.builder.selectedVerb ? COLOR.verbSelected : verb === overVerb ? COLOR.verbHover : COLOR.verb,
      );
    }

    this.answerBox.setText(this.pager.current);
    // the band is as tall as the text, plus a row for "MORE >" when there is another page
    const lines = this.pager.current === '' ? 0 : this.pager.current.split('\n').length;
    this.answerBand.setVisible(lines > 0).setSize(TEXT_BOX.w, 6 + 8 * (lines + (this.pager.hasMore ? 1 : 0)));
    this.moreMarker.setY(TEXT_BOX_TEXT.y + 8 * lines).setVisible(this.pager.hasMore);

    this.refreshInventory();
  }

  /** The sentence line: the builder's sentence, or "Go to <place>" when idly pointing at an exit. */
  private exitAwareSentence(): string {
    const sentence = this.builder.text;
    if (sentence !== '' || !this.hoveredExit || this.transitioning) return sentence;
    const { locations } = this.session.bundle.logic;
    const destination = locations[this.shownLocation]?.directions[this.hoveredExit.direction];
    return destination === undefined ? '' : `Go to ${locations[destination]?.name ?? destination}`;
  }

  private refreshInventory(): void {
    const items = this.session.engine.state.inventory;
    this.inventoryScroll = clampScroll(this.inventoryScroll, items.length);
    visibleItems(items, this.inventoryScroll).forEach((alias, slot) => {
      const image = this.slotImages[slot]!;
      if (alias === undefined) image.setVisible(false);
      else image.setTexture(textureKey(iconPath(alias))).setVisible(true);
    });
    const last = maxScroll(items.length);
    this.scrollButtons.left.setTint(this.inventoryScroll > 0 ? COLOR.verbSelected : 0x40404c);
    this.scrollButtons.right.setTint(this.inventoryScroll < last ? COLOR.verbSelected : 0x40404c);
  }
}
