import Phaser from 'phaser';
import { ART_SCALE, SCENE_HEIGHT, SCENE_WIDTH, Thing, iconPath, musicPath } from '@grelok/engine';
import { parseStep } from '@grelok/engine';
import type { Command, CutsceneStep, EngineEvent, ExitData, Facing, Point, SceneData, Verb } from '@grelok/engine';
import { GAME_WIDTH, GAME_HEIGHT, artScale, logicalPointer, useLogicalCamera } from '../config';
import { PIXEL_FONT } from '../gfx/pixelFont';
import { textureKey } from '../data/assets';
import { debugState } from '../debug';
import { hitTest } from '../scene/hitTest';
import { HotspotOverlay } from '../scene/hotspotOverlay';
import { PlayerActor } from '../scene/PlayerActor';
import { readMask } from '../scene/readMask';
import { lookOf, withActiveHotspots } from '../scene/spriteState';
import { gridFromMask, makeGrid } from '../walk/pathfinding';
import { walkTargetFor, walkTargetForCommand } from '../walk/plan';
import { arrivalAt } from '../walk/spawn';
import { WalkArea } from '../walk/WalkArea';
import { SentenceBuilder } from '../ui/SentenceBuilder';
import { TextPager } from '../ui/textPages';
import { DIALOG_MAX, DIALOG_PANEL, choiceAt, choiceRect, dialogChoices } from '../ui/dialog';
import type { DialogChoice } from '../ui/dialog';
import { SpeechQueue, interpretSay } from '../ui/speech';
import { Sequencer } from '../cutscene/Sequencer';
import { MenuPanel } from '../ui/MenuPanel';
import { volumeLabel } from '../audio/mix';
import { SLOTS as SAVE_SLOTS, browserStore, makeSave, slotLabel } from '../save/saveGame';
import type { SavedPlayer, Slot } from '../save/saveGame';
import type { CutsceneActor } from '../cutscene/Sequencer';
import { verbKeys, verbsOf } from '../ui/verbs';
import { cycleTextSpeed, loadTextSpeed } from '../ui/settings';
import type { TextSpeed } from '../ui/settings';
import type { VerbSpec } from '../ui/verbs';
import { MENU_BUTTON, SENTENCE_Y, TEXT_BOX, TEXT_BOX_CHARS, TEXT_BOX_LINES, TEXT_BOX_TEXT, inRect, verbAt, verbRect } from '../ui/layout';
import { SCROLL_LEFT, SCROLL_RIGHT, SLOTS, clampScroll, itemAt, maxScroll, slotRect, visibleItems } from '../ui/inventory';
import type { GameSession } from '../session';

/** Two clicks on the same exit this close together (milliseconds) are a double-click: go through at once. */
const DOUBLE_CLICK_MS = 400;

/** Each half (out, in) of the fade between scenes, in milliseconds. */
const FADE_MS = 200;
/**
 * Speech is drawn in the speaker's colour on top of the scene, which may be just as colourful (orange words on an orange
 * sunset). Eight dark copies, one pixel off in every direction, outline every letter, like subtitles.
 */
const SPEECH_OUTLINE: readonly (readonly [number, number])[] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const SPEECH_OUTLINE_COLOR = 0x140c14;
/** Verbs Grognak does with his hands: he reaches out before the engine hears them. */
const REACH_VERBS: ReadonlySet<string> = new Set(['pick_up', 'use', 'give', 'push']);

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
  /** The same kind of black rectangle, for the `fade` step of cutscenes (kept apart so the two never fight over one alpha). */
  private cutsceneFade!: Phaser.GameObjects.Rectangle;
  /** The location whose picture is on screen. It lags behind the engine's location during a fade. */
  private shownLocation = '';
  private transitioning = false;
  private hoveredExit: ExitData | undefined;
  /** Plays cutscenes; while it runs the player's input is locked. */
  private sequencer = this.makeSequencer();
  /** The in-game menu (Esc or the disk icon): Save, Load, Quit to title. */
  private menu!: MenuPanel;
  /** Where to put Grognak when a saved game is loaded (otherwise he starts at game.yml's startPosition). */
  private restore: SavedPlayer | undefined;
  /** Things cutscene steps are waiting for ("the text has been read", "the speech is over"), checked every frame. */
  private waiters: { done: () => boolean; resolve: () => void }[] = [];
  /** What the inventory panel shows. It follows the engine, except during a cutscene, until its `sync` step. */
  private inventoryView: string[] = [];
  /** Sounds and music the cutscenes asked for (they are also really played, by session.audio). */
  private readonly audioLog: string[] = [];
  private ended = false;
  /** The end screen has fully appeared: a click now returns to the title. */
  private endReady = false;
  /** How many things we carried after the last event, to tell "picked something up" from "gave something away". */
  private carried = 0;
  private endObjects: Phaser.GameObjects.GameObject[] = [];
  private endLines: string[] = [];
  private lastExitClick: { exit: ExitData; at: number } | undefined;
  /** One picture per sprite of the scene on screen (hidden when its state says "draw nothing"). */
  private spriteImages = new Map<string, Phaser.GameObjects.Image>();
  /** The walkable floor of each scene, built from its walkmask the first time it is needed. */
  private readonly areas = new Map<string, WalkArea>();

  private verbs: readonly VerbSpec[] = [];
  /** How fast spoken lines go by (menu: Text speed), remembered in the browser. */
  private textSpeed: TextSpeed = loadTextSpeed(browserStore());
  /** The name of what the mouse points at, next to the pointer: [shadow, text]. */
  private cursorLabel: Phaser.GameObjects.BitmapText[] = [];
  /** The game's own pointer (from game.yml ui.cursor, or the browser's), and whether it now shows busy instead. */
  private baseCursor = '';
  private cursorBusy = false;
  private builder = new SentenceBuilder();
  private readonly pager = new TextPager(TEXT_BOX_CHARS, TEXT_BOX_LINES);
  /** What people are saying, one page at a time, above their heads. */
  private readonly speech = new SpeechQueue();
  private speechText!: Phaser.GameObjects.BitmapText;
  /** Dark copies of the speech text around it: an outline, so coloured words stay readable on any background. */
  private speechOutline: Phaser.GameObjects.BitmapText[] = [];
  /** The open talk menu: who we are talking to and what can be asked. */
  private dialog: { npc: string; speaker: string; choices: DialogChoice[] } | undefined;
  private dialogPanel!: Phaser.GameObjects.Rectangle;
  private choiceLabels: Phaser.GameObjects.BitmapText[] = [];
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
    return visibleItems(this.inventoryView, this.inventoryScroll).filter((i): i is string => !!i);
  }

  /** True while the screen fades between two scenes (clicks are ignored then). */
  get isTransitioning(): boolean {
    return this.transitioning;
  }

  /** How black the fade rectangle is, 0..1 (for tests). */
  get fadeAlpha(): number {
    return this.fade.alpha;
  }

  /** The state of the cutscene machinery (for tests and debugging). */
  get cutsceneState() {
    return { running: this.sequencer.running, log: [...this.sequencer.log], audio: [...this.audioLog], ended: this.ended, endLines: this.endLines };
  }

  /** The sprites currently drawn in the scene: id, picture, feet position and depth (for tests). */
  get spritesShown(): { id: string; image: string; x: number; y: number; depth: number }[] {
    return [...this.spriteImages].filter(([, i]) => i.visible).map(([id, i]) => ({
      id,
      image: i.texture.key.replace(/^asset:/, ''),
      x: i.x,
      y: i.y,
      depth: i.depth,
    }));
  }

  /** The speech on screen: who speaks, what, and in which colour (undefined = nobody). */
  get speechNow(): { speaker: string; text: string; color: string } | undefined {
    const line = this.speech.current;
    if (!line || this.pager.current !== '') return undefined;
    return { speaker: line.speaker, text: line.text, color: this.session.bundle.speakers.speakers[line.speaker]?.color ?? '#ffffff' };
  }

  /** The open talk menu, as the labels the player reads (undefined = no menu). */
  get dialogState(): { npc: string; choices: string[] } | undefined {
    return this.dialog && { npc: this.dialog.npc, choices: this.dialog.choices.map((c) => c.label) };
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

  init(data: { session: GameSession; restore?: SavedPlayer }): void {
    this.session = data.session;
    this.restore = data.restore;
    // Phaser keeps ONE scene object and runs init/create again on every start (loading a game starts this scene
    // again), so everything that lives in fields has to start from scratch here.
    this.verbLabels = new Map();
    this.slotImages = [];
    this.choiceLabels = [];
    this.spriteImages = new Map();
    this.sequencer = this.makeSequencer();
    this.waiters = [];
    this.inventoryView = [];
    this.audioLog.length = 0;
    this.carried = this.session.engine.state.inventory.length;
    this.ended = false;
    this.endReady = false;
    this.endObjects = [];
    this.endLines = [];
    this.lastExitClick = undefined;
    this.dialog = undefined;
    this.pointer = undefined;
    this.hovered = undefined;
    this.hoveredExit = undefined;
    this.inventoryScroll = 0;
    this.transitioning = false;
    this.shownLocation = '';
    this.pager.clear();
    this.speech.clear();
    this.verbs = verbsOf(this.session.bundle.config);
    this.builder = new SentenceBuilder(this.verbs);
  }

  private makeSequencer(): Sequencer {
    return new Sequencer((error) => {
      debugState.error = `Cutscene failed: ${error instanceof Error ? error.message : String(error)}`;
    });
  }

  /** The menu being shown, if any (for tests). */
  get menuState() {
    return this.menu?.visible ? this.menu.state : undefined;
  }

  create(): void {
    useLogicalCamera(this);
    // bottom strip: the UI area
    this.add.rectangle(0, SCENE_HEIGHT, GAME_WIDTH, GAME_HEIGHT - SCENE_HEIGHT, 0x14141c).setOrigin(0);
    this.add.rectangle(0, SCENE_HEIGHT, GAME_WIDTH, 1, 0x7a1f2b).setOrigin(0);
    // the game's frame picture over the strip, if it has one: above the dark backing, below every control drawn next
    const frame = this.session.bundle.config.ui?.frame;
    if (frame !== undefined) this.add.image(0, SCENE_HEIGHT, textureKey(frame)).setOrigin(0).setScale(artScale);
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
    // the disk icon (opens the menu), and the menu itself above everything else
    const { x: dx, y: dy } = MENU_BUTTON;
    this.add.rectangle(dx + 1, dy + 1, 10, 9, 0x8a8aa8).setOrigin(0); // the disk
    this.add.rectangle(dx + 3, dy + 1, 6, 3, 0xd8d8e8).setOrigin(0); // its metal shutter
    this.add.rectangle(dx + 3, dy + 6, 6, 4, 0x30304a).setOrigin(0); // its label
    this.menu = new MenuPanel(this, 950, { framed: true, areaHeight: SCENE_HEIGHT });
    // the talk menu covers the verbs and inventory while it is open
    this.dialogPanel = this.add
      .rectangle(DIALOG_PANEL.x, DIALOG_PANEL.y, DIALOG_PANEL.w, DIALOG_PANEL.h, 0x14141c)
      .setOrigin(0)
      .setDepth(300)
      .setVisible(false);
    for (let i = 0; i < DIALOG_MAX; i++) {
      const r = choiceRect(i);
      this.choiceLabels.push(this.add.bitmapText(r.x, r.y + 1, PIXEL_FONT, '').setDepth(301).setVisible(false));
    }
    // speech: coloured text with a black copy one pixel lower-right, so it reads on any background
    this.speechOutline = SPEECH_OUTLINE.map(() => this.add.bitmapText(0, 0, PIXEL_FONT, '').setTint(SPEECH_OUTLINE_COLOR).setDepth(450).setOrigin(0.5, 1).setCenterAlign());
    this.speechText = this.add.bitmapText(0, 0, PIXEL_FONT, '').setDepth(451).setOrigin(0.5, 1).setCenterAlign();
    // the name at the pointer: a dark shadow copy and the text (below speech and the text box)
    this.cursorLabel = [0x140c14, 0xf0f0f0].map((tint) => this.add.bitmapText(0, 0, PIXEL_FONT, '').setTint(tint).setDepth(440).setOrigin(0.5, 1).setVisible(false));
    this.baseCursor = this.input.manager.defaultCursor;
    this.cursorBusy = false;
    this.verbs.forEach((spec, i) => {
      const r = verbRect(i);
      this.verbLabels.set(spec.verb, this.add.bitmapText(r.x, r.y + 1, PIXEL_FONT, spec.label));
    });
    this.locationLabel = this.add.bitmapText(4, GAME_HEIGHT - 8, PIXEL_FONT, '').setTint(0x909090);
    this.add
      .bitmapText(GAME_WIDTH - 4, GAME_HEIGHT - 8, PIXEL_FONT, 'F1 OUTLINES  / CONSOLE  M MUTE')
      .setOrigin(1, 0)
      .setTint(COLOR.hint);

    this.background = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setScale(artScale);
    this.overlay = new HotspotOverlay(this);
    this.showLocation(this.session.engine.state.location);
    this.fade = this.add.rectangle(0, 0, SCENE_WIDTH, SCENE_HEIGHT, 0x000000).setOrigin(0).setDepth(400).setAlpha(0);
    this.cutsceneFade = this.add.rectangle(0, 0, SCENE_WIDTH, SCENE_HEIGHT, 0x000000).setOrigin(0).setDepth(405).setAlpha(0);

    const { config } = this.session.bundle;
    const area = this.areaFor(this.session.engine.state.location);
    const start = area.snap(config.startPosition ?? [SCENE_WIDTH / 2, 112]);
    this.player = new PlayerActor(this, config.player, start, area, () => debugState.speedFactor ?? 1);
    if (this.restore) this.player.enter(area, area.snap([this.restore.x, this.restore.y]), this.restore.facing); // a loaded game
    this.inventoryView = this.session.engine.state.inventory;
    this.refreshUi();

    this.setUpInput();

    const stop = this.session.onEvents((events) => {
      this.playEventSounds(events);
      if (events.some((e) => e.type === 'location_changed')) {
        this.speech.clear();
        this.endDialog();
        this.transition();
      }
      // A message that announces a cutscene is not shown: the cutscene tells it (as one of its steps), and the picture
      // keeps its old look until the cutscene says `sync`. Otherwise the world is drawn as the engine now has it.
      // (Trying the same thing again says the same message key but changes nothing, so it needs a change as well.)
      const changed = events.some((e) => e.type === 'thing_changed' || e.type === 'inventory_changed' || e.type === 'location_changed' || e.type === 'game_over');
      const trigger = changed ? events.find((e) => e.type === 'say' && e.key !== undefined && e.key in this.session.bundle.cutscenes) : undefined;
      if (trigger === undefined) {
        this.refreshSprites(); // things appear, vanish and change under the engine's hands
        this.inventoryView = this.session.engine.state.inventory;
      }
      if (trigger) {
        this.pager.clear(); // whatever was on screen is old news now; the cutscene has the floor
        this.speech.clear();
      }
      this.show(events.flatMap((e) => (e.type === 'say' && e !== trigger ? [interpretSay(this.session.bundle.speakers, e.text, e.key)] : [])));
      if (trigger?.type === 'say' && trigger.key !== undefined) this.playCutscene(trigger.key);
      // Things can appear or vanish (the gemstone under the rubble), also under a motionless mouse.
      this.refreshHotspots();
      this.refreshUi();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  }

  /** The small sounds of everyday life: a door when we change scene, a jingle when we pick something up. */
  private playEventSounds(events: EngineEvent[]): void {
    const { audio, engine } = this.session;
    if (events.some((e) => e.type === 'location_changed')) audio.playSfx('door');
    const carried = engine.state.inventory.length;
    if (carried > this.carried) audio.playSfx('pickup');
    this.carried = carried;
  }

  /** Runs every frame. `delta` is the milliseconds since the last frame; movement is always speed x time. */
  update(_time: number, delta: number): void {
    this.refreshCursor();
    this.player.talking = this.speechNow?.speaker === this.session.bundle.speakers.default; // the player's own words
    this.player.update(delta);
    this.speech.update((delta / 1000) * (debugState.speedFactor ?? 1) * this.textSpeed.factor, this.pager.current !== '');
    this.drawSpeech();
    this.waiters = this.waiters.filter((w) => !(w.done() && (w.resolve(), true)));
    // the game is won (or lost) and everything has been read: show the end screen (a cutscene may have shown it already)
    const { pager, speech } = this;
    if (this.session.engine.state.over && !this.ended && !this.sequencer.running && !this.transitioning && pager.current === '' && !speech.busy) {
      this.showEnd([]);
    }
    if (this.overlay.visible) this.overlay.drawPath(this.player.follower.position, this.player.follower.remaining);
  }

  private createInventoryPanel(): void {
    for (let slot = 0; slot < SLOTS; slot++) {
      const r = slotRect(slot);
      this.add.rectangle(r.x, r.y, r.w - 1, r.h, 0x1e1e2a).setOrigin(0);
      this.slotImages.push(this.add.image(r.x + 1, r.y, '__DEFAULT').setOrigin(0).setScale(artScale).setVisible(false));
    }
    const arrow = (rect: typeof SCROLL_LEFT, glyph: string) =>
      this.add.bitmapText(rect.x + 2, rect.y + rect.h / 2 - 3, PIXEL_FONT, glyph).setTint(COLOR.verb);
    this.scrollButtons = { left: arrow(SCROLL_LEFT, '<'), right: arrow(SCROLL_RIGHT, '>') };
  }

  // --- input: we only turn mouse and keys into builder calls ------------------------------------

  private setUpInput(): void {
    // Phaser has already converted browser pixels to canvas pixels (it divides by the zoom); logicalPointer goes on to game units.
    this.input.mouse?.disableContextMenu(); // right-click is a game button, not a browser menu
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.pointer = logicalPointer(pointer);
      this.menu.pointerMove(...this.pointer);
      this.refreshHotspots(false);
      this.refreshUi();
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.pointer = undefined;
      this.refreshHotspots(false);
      this.refreshUi();
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.pointer = logicalPointer(pointer);
      if (this.menu.visible || this.pointer[1] >= SCENE_HEIGHT) this.session.audio.playSfx('click');
      if (this.menu.visible) this.menu.click(...this.pointer); // a menu is modal: nothing else hears the click
      else if (this.locked) this.onLockedClick(this.pointer);
      else if (!this.transitioning) this.onClick(this.pointer, pointer.rightButtonDown());
      this.refreshHotspots();
      this.refreshUi();
    });

    // F1 normally opens the browser's help page; addCapture stops that.
    this.input.keyboard?.addCapture('F1');
    this.input.keyboard?.on('keydown-F1', () => this.overlay.toggle());
    this.input.keyboard?.on('keydown-M', () => {
      if (document.activeElement instanceof HTMLInputElement) return; // typing in the debug console
      this.session.audio.toggleMute();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (document.activeElement instanceof HTMLInputElement) return; // Esc belongs to the debug console then
      if (this.menu.visible) this.menu.hide();
      else if (this.sequencer.running) this.sequencer.skip(); // Esc skips a cutscene (its result still shows)
      else if (this.locked) return;
      else if (!this.builder.idle || this.dialog) {
        this.builder.cancel(); // Esc first cancels what is half done...
        this.endDialog();
      } else this.openMenu(); // ...and with nothing to cancel it opens the menu
      this.refreshUi();
    });

    // letters: F = fullscreen, and a shortcut for every verb (the first free letter of its label, see verbKeys)
    const keys = verbKeys(this.verbs);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toUpperCase();
      if (key === 'F') return this.toggleFullscreen();
      const verb = keys.get(key);
      if (verb === undefined || this.locked || this.menu.visible || this.dialog) return;
      this.builder.selectVerb(verb);
      this.refreshUi();
    });
  }

  /** True while a cutscene plays or the game is over: the player cannot act. */
  private get locked(): boolean {
    return this.sequencer.running || this.ended;
  }

  /** During a cutscene the only thing a click does is move text along: read on, or skip the speech. */
  private onLockedClick([x, y]: Point): void {
    // on the end screen, once it has fully appeared, a click goes back to the title (where New game starts again)
    if (this.ended) {
      if (this.endReady) this.returnToTitle();
      return;
    }
    if (this.pager.current !== '' && y < this.answerBand.height) this.pager.next();
    else if (this.speechNow && y < SCENE_HEIGHT) this.speech.skip();
  }

  private onClick([x, y]: Point, right: boolean): void {
    // a click on the answer band reads on (and does nothing else)
    if (this.pager.current !== '' && y < this.answerBand.height) {
      this.pager.next();
      return;
    }

    // a click on the talk menu picks a question (and the menu hides the verbs and inventory under it)
    if (this.dialog && y >= DIALOG_PANEL.y) {
      const picked = right ? undefined : choiceAt(this.dialog.choices.length, x, y);
      if (picked !== undefined) this.choose(this.dialog.choices[picked]!);
      return;
    }

    // a click in the scene while somebody speaks skips to the next line (and does nothing else)
    if (this.speechNow && y < SCENE_HEIGHT) {
      this.speech.skip();
      return;
    }
    if (this.dialog) this.endDialog(); // any other click means the conversation is over

    if (!right && inRect(MENU_BUTTON, x, y)) {
      this.openMenu();
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
      // a double-click does not wait for the walk: he is at the exit at once (the engine may still refuse)
      const now = performance.now();
      if (this.lastExitClick?.exit === exit && now - this.lastExitClick.at < DOUBLE_CLICK_MS) this.player.skipWalk();
      this.lastExitClick = { exit, at: now };
      return;
    }

    // the floor: left-click walks there (dropping any half-built sentence), right-click cancels the sentence
    if (y < SCENE_HEIGHT && !right) {
      this.builder.cancel();
      this.player.walkTo([x, y]);
      return;
    }

    // not on the scene: right-click cancels, left-click may hit a verb
    const verb = verbAt(this.verbs, x, y);
    if (right) this.builder.cancel();
    else if (verb) this.builder.selectVerb(verb);
  }

  private walkToThing(id: string): void {
    const target = walkTargetFor(this.activeScene(), id);
    if (target) this.player.walkTo(target.point, { facing: target.facing, toward: target.toward });
  }

  /** Carry out a command: first walk to what it is about (if it needs that), then let the engine do it. */
  private act(command: Command): void {
    this.pager.clear();
    this.speech.clear();
    const target = walkTargetForCommand(this.activeScene(), command);
    if (target === undefined) this.perform(command);
    else {
      this.player.walkTo(target.point, {
        facing: target.facing,
        toward: target.toward,
        then: () => this.perform(command),
      });
    }
  }

  /**
   * Hand a command to the engine; a successful "Talk to" a speaker opens the talk menu. Verbs done with the hands
   * first play the reach animation and reach the engine when the hand is out.
   */
  private perform(command: Command): void {
    if (REACH_VERBS.has(command.verb)) {
      this.player.reach(() => this.session.perform(command));
      return;
    }
    this.session.perform(command);
    const npc = command.verb === 'talk_to' ? command.objects[0] : undefined;
    if (npc !== undefined) this.startDialog(npc);
  }

  // --- the menu, saving and loading --------------------------------------------------------------

  private openMenu(): void {
    const hasSave = this.session.saves.newest() !== undefined;
    this.menu.show('Menu', [
      { label: 'Save', onChoose: () => this.showSlots('save') },
      { label: 'Load', enabled: hasSave, onChoose: () => this.showSlots('load') },
      { label: `Volume: ${volumeLabel(this.session.audio.settings)}`, onChoose: () => { this.session.audio.cycleVolume(); this.openMenu(); } },
      { label: `Text speed: ${this.textSpeed.label}`, onChoose: () => { this.textSpeed = cycleTextSpeed(browserStore(), this.textSpeed); this.openMenu(); } },
      { label: `Fullscreen: ${this.scale.isFullscreen ? 'ON' : 'OFF'}`, onChoose: () => { this.menu.hide(); this.toggleFullscreen(); } },
      { label: 'Quit to title', onChoose: () => this.quitToTitle() },
      { label: 'Back', onChoose: () => this.menu.hide() },
    ]);
  }

  /** A list of save slots to save into (the three of the player) or load from (those, plus the automatic one). */
  private showSlots(mode: 'save' | 'load'): void {
    const { saves, bundle } = this.session;
    const slots = mode === 'save' ? SAVE_SLOTS.filter((s) => s !== 'auto') : SAVE_SLOTS;
    const items = slots.map((slot) => {
      const save = saves.read(slot);
      return {
        label: slotLabel(slot, save, (alias) => bundle.logic.locations[alias]?.name ?? alias),
        enabled: mode === 'save' || save !== undefined,
        onChoose: () => (mode === 'save' ? this.saveTo(slot) : this.loadFrom(slot)),
      };
    });
    items.push({ label: 'Back', enabled: true, onChoose: () => this.openMenu() });
    this.menu.show(mode === 'save' ? 'Save game' : 'Load game', items);
  }

  /** Everything a save needs from the scene: where Grognak stands, and which way he looks. */
  private currentSave() {
    const p = this.player.state;
    return makeSave(this.session.bundle.id, this.session.engine, { x: Math.round(p.x), y: Math.round(p.y), facing: p.facing });
  }

  private saveTo(slot: Slot): void {
    const ok = this.session.saves.write(slot, this.currentSave());
    this.menu.hide();
    this.pager.set(ok ? 'Game saved.' : 'Could not save: the browser blocks storage.');
  }

  /** Written without asking whenever the player enters a scene, and when he quits to the title. */
  private autosave(): void {
    if (this.session.engine.state.over || this.ended || this.sequencer.running) return;
    this.session.saves.write('auto', this.currentSave());
  }

  private loadFrom(slot: Slot): void {
    const save = this.session.saves.read(slot);
    try {
      if (!save) throw new Error('empty slot');
      this.session.loadEngine(save.engine);
    } catch {
      this.menu.hide();
      this.pager.set('Could not load that save.');
      return;
    }
    this.scene.start('RoomScene', { session: this.session, restore: save.player }); // a fresh start, from the loaded engine
  }

  private quitToTitle(): void {
    this.autosave();
    this.returnToTitle();
  }

  /** The whole screen or back to the window (F, or the menu). The canvas keeps its whole-number zoom (see scale.ts). */
  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  }

  private returnToTitle(): void {
    this.input.setDefaultCursor(this.baseCursor); // never leave a busy pointer behind
    this.session.audio.setMusic(undefined);
    this.scene.start('TitleScene', { session: this.session });
  }

  // --- cutscenes ----------------------------------------------------------------------------------

  /** Play the cutscene announced by message `key`. */
  private playCutscene(key: string): void {
    const steps: CutsceneStep[] = [];
    for (const raw of this.session.bundle.cutscenes[key] ?? []) {
      const parsed = parseStep(raw);
      if ('step' in parsed) steps.push(parsed.step);
      else debugState.error = `Cutscene "${key}": ${parsed.error}`;
    }
    this.builder.cancel();
    this.endDialog();
    const messages = this.session.bundle.logic.messages;
    void this.sequencer.play(steps, this.actor, (k) => messages[k] ?? '').then(() => {
      // whatever the cutscene did or did not `sync`, afterwards the picture agrees with the engine again
      this.refreshSprites();
      this.inventoryView = this.session.engine.state.inventory;
      this.refreshHotspots();
      this.refreshUi();
    });
  }

  /** Resolves once `done()` is true (checked every frame in update). */
  private until(done: () => boolean): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ done, resolve }));
  }

  /** Resolves after `seconds` of game time (a faster speedFactor, as in tests, makes it shorter). */
  private delay(seconds: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall((seconds * 1000) / (debugState.speedFactor ?? 1), resolve));
  }

  /** What each cutscene step does on screen. The Sequencer decides the order; this decides the looks. */
  private readonly actor: CutsceneActor = {
    walk: (to) => {
      const [x, y] = this.player.follower.position;
      if (Math.hypot(to[0] - x, to[1] - y) < 1) return Promise.resolve();
      return new Promise((resolve) => this.player.walkTo(to, { then: resolve }));
    },
    face: (facing) => this.player.face(facing),
    narrate: (text) => {
      this.speech.clear();
      this.pager.set(text);
      this.refreshUi();
      return this.until(() => this.pager.current === '');
    },
    say: (speaker, text) => {
      this.speech.say(speaker, text);
      return this.until(() => !this.speech.busy);
    },
    wait: (seconds) => this.delay(seconds),
    fade: (to) =>
      new Promise((resolve) =>
        this.tweens.add({ targets: this.cutsceneFade, alpha: to === 'out' ? 1 : 0, duration: (FADE_MS * 2) / (debugState.speedFactor ?? 1), onComplete: () => resolve() }),
      ),
    shake: (seconds) => {
      this.cameras.main.shake((seconds * 1000) / (debugState.speedFactor ?? 1), 0.008);
      return this.delay(seconds);
    },
    sfx: (name) => {
      this.audioLog.push(`sfx ${name}`);
      this.session.audio.playSfx(name);
    },
    music: (name) => {
      this.audioLog.push(`music ${name}`);
      this.session.audio.setMusic(name === 'stop' ? undefined : musicPath(name));
    },
    sync: () => {
      this.refreshSprites();
      this.inventoryView = this.session.engine.state.inventory;
      this.refreshHotspots();
      this.refreshUi();
    },
    end: (lines) => this.showEnd(lines),
    hurry: () => {
      this.player.skipWalk(); // a walk ends at its destination
      for (const tween of this.tweens.getTweensOf(this.cutsceneFade)) tween.complete(); // a fade ends where it was going
      this.cameras.main.resetFX(); // a shake stops
      this.speech.clear(); // a spoken line goes away
    },
  };

  /** The end screen: black, THE END, and some credits. After it nothing can be done. */
  private showEnd(lines: string[]): void {
    if (this.ended) return;
    this.ended = true;
    this.endLines = lines;
    this.pager.clear();
    this.speech.clear();
    this.endDialog();
    const back = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000).setOrigin(0).setDepth(900).setAlpha(0);
    const title = this.add.bitmapText(GAME_WIDTH / 2, 40, PIXEL_FONT, 'THE END').setOrigin(0.5, 0).setScale(3).setTint(0xffe040).setDepth(901).setAlpha(0);
    const credits = lines.map((line, i) =>
      this.add.bitmapText(GAME_WIDTH / 2, 90 + i * 10, PIXEL_FONT, line).setOrigin(0.5, 0).setTint(0xc8c8d8).setDepth(901).setAlpha(0),
    );
    const hint = this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT - 12, PIXEL_FONT, 'CLICK TO CONTINUE').setOrigin(0.5, 0).setTint(0x707080).setDepth(901).setAlpha(0);
    this.endObjects = [back, title, ...credits, hint];
    this.endReady = false;
    this.tweens.add({
      targets: this.endObjects,
      alpha: 1,
      duration: 1200 / (debugState.speedFactor ?? 1),
      onComplete: () => (this.endReady = true), // clicks during the fade-in (still reading) do nothing
    });
  }

  // --- speech and talking -------------------------------------------------------------------------

  /** Show what the engine said: narration in the text box; quoted words above the speaker, once the box is read. */
  private show(said: { narration: string; speech: { speaker: string; text: string }[] }[]): void {
    if (said.length === 0) return;
    this.speech.clear();
    const narration = said.map((s) => s.narration).filter((n) => n !== '').join('\n');
    if (narration === '') this.pager.clear();
    else this.pager.set(narration);
    for (const { speech } of said) for (const line of speech) this.speech.say(line.speaker, line.text);
  }

  /** Where a speaker's words go: just above their hotspot in this scene, or above Grognak's head. */
  private speechAnchor(speakerId: string): Point {
    const { bundle } = this.session;
    const thing = bundle.speakers.speakers[speakerId]?.thing;
    const hotspot = thing === undefined ? undefined : this.activeScene()?.hotspots.find((h) => h.id === thing);
    if (hotspot) {
      const xs = hotspot.polygon.map((p) => p[0]);
      const top = Math.min(...hotspot.polygon.map((p) => p[1]));
      return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), top - 2];
    }
    const p = this.player.state;
    return [Math.round(p.x), Math.round(p.y - (bundle.config.player.frameHeight / ART_SCALE) * p.scale) - 2];
  }

  private drawSpeech(): void {
    const line = this.speechNow;
    this.speechText.setVisible(line !== undefined);
    for (const copy of this.speechOutline) copy.setVisible(line !== undefined);
    if (!line) return;
    this.speechText.setText(line.text).setTint(Number.parseInt(line.color.slice(1), 16));
    for (const copy of this.speechOutline) copy.setText(line.text);
    const [ax, ay] = this.speechAnchor(line.speaker);
    // keep the whole bubble inside the picture
    const half = this.speechText.width / 2;
    const x = Math.round(Math.min(Math.max(ax, half + 3), SCENE_WIDTH - half - 3));
    const y = Math.round(Math.max(ay, this.speechText.height + 3));
    this.speechText.setPosition(x, y);
    this.speechOutline.forEach((copy, i) => copy.setPosition(x + SPEECH_OUTLINE[i]![0], y + SPEECH_OUTLINE[i]![1]));
  }

  private startDialog(npc: string): void {
    const { bundle, engine } = this.session;
    const speaker = Object.entries(bundle.speakers.speakers).find(([, s]) => s.thing === npc);
    if (!speaker || !this.isVisible(npc)) return;
    const choices = dialogChoices(speaker[1].topics ?? [], engine.state.inventory, Thing.aliasToName, npc);
    this.dialog = { npc, speaker: speaker[0], choices };
  }

  private endDialog(): void {
    this.dialog = undefined;
  }

  /** The player picked a question (or Goodbye). */
  private choose(choice: DialogChoice): void {
    const dialog = this.dialog!;
    this.pager.clear();
    this.speech.clear();
    if (choice.topic === undefined) this.endDialog();
    else this.session.perform({ verb: 'ask', objects: [dialog.npc, choice.topic] });
  }

  // --- showing what the world looks like ----------------------------------------------------------

  private showLocation(location: string): void {
    const { bundle } = this.session;
    const asset = bundle.scenes[location]?.background;
    if (asset === undefined) {
      throw new Error(`Scene "${location}" has no background`);
    }

    this.shownLocation = location;
    this.session.audio.setMusic(bundle.scenes[location]?.music); // each scene has its own tune; the old one fades out
    this.background.setTexture(textureKey(asset));
    this.locationLabel.setText(bundle.logic.locations[location]?.name ?? location);
    this.createSprites(location);
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
            this.autosave();
            // the engine may have moved on again while we were fading in (commands typed quickly): follow it
            if (this.session.engine.state.location !== this.shownLocation) this.transition();
            this.refreshHotspots(false);
            this.refreshUi();
          },
        });
      },
    });
  }

  /** Make one (still hidden) picture for each sprite of a scene; refreshSprites decides what each shows. */
  private createSprites(location: string): void {
    for (const image of this.spriteImages.values()) image.destroy();
    this.spriteImages.clear();
    for (const sprite of this.session.bundle.scenes[location]?.sprites ?? []) {
      this.spriteImages.set(sprite.id, this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setScale(artScale).setVisible(false));
    }
    this.refreshSprites();
  }

  /**
   * Bring the sprites in line with the world. Nothing is remembered between calls: for each sprite we ask
   * lookOf(sprite, world) and draw whatever it says - so a sprite can never disagree with the engine.
   */
  private refreshSprites(): void {
    const scene = this.session.bundle.scenes[this.shownLocation];
    const world = {
      booleans: this.session.engine.state.constraints.boolean,
      visibleThings: this.session.engine.visibleThings(this.shownLocation),
    };
    for (const sprite of scene?.sprites ?? []) {
      const image = this.spriteImages.get(sprite.id);
      const look = lookOf(sprite, world);
      if (!image) continue;
      if (!look) {
        image.setVisible(false);
        continue;
      }
      // sorted by y, like the player: whoever is lower on the screen is in front
      image.setTexture(textureKey(look.image)).setPosition(look.at[0], look.at[1]).setDepth(look.depth).setVisible(true);
    }
  }

  private isVisible = (id: string): boolean => this.session.engine.visibleThings(this.shownLocation).includes(id);

  /** The thing under a point: a scene hotspot above the strip, an inventory item in it. */
  private thingAt(x: number, y: number): string | undefined {
    if (y < SCENE_HEIGHT) return this.hotspotAt(x, y);
    return itemAt(this.session.engine.state.inventory, this.inventoryScroll, x, y);
  }

  /** The scene with only the hotspots whose `when` holds now (see withActiveHotspots). */
  private activeScene(location = this.shownLocation): SceneData | undefined {
    const scene = this.session.bundle.scenes[location];
    return scene && withActiveHotspots(scene, this.session.engine.state.constraints.boolean);
  }

  /** The hotspot under a point (game pixels), if the engine currently shows its thing. */
  private hotspotAt(x: number, y: number): string | undefined {
    const scene = this.activeScene();
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
      this.overlay.draw(this.activeScene(location), this.isVisible, this.areaFor(location));
    }
    this.hovered = this.pointer && this.thingAt(...this.pointer);
    this.hoveredExit = this.pointer && this.hovered === undefined ? this.exitAt(...this.pointer) : undefined;
    this.builder.hover(this.hovered, this.pointer !== undefined && this.pointer[1] >= SCENE_HEIGHT);
  }

  /** Bring every piece of the UI strip in line with the builder and the pager. */
  /**
   * The name of what the mouse points at, just above the pointer in the scene (the classic games showed it there
   * too; the sentence line below says what clicking will do). Hidden while the player cannot act.
   */
  private drawCursorLabel(): void {
    const [px, py] = this.pointer ?? [0, 0];
    let name = '';
    if (this.pointer && py < SCENE_HEIGHT && !this.locked && !this.menu.visible && !this.dialog && !this.transitioning) {
      if (this.hovered !== undefined) name = Thing.aliasToName(this.hovered);
      else if (this.hoveredExit) {
        const { locations } = this.session.bundle.logic;
        const to = locations[this.shownLocation]?.directions[this.hoveredExit.direction];
        name = to === undefined ? '' : (locations[to]?.name ?? to);
      }
    }
    for (const label of this.cursorLabel) label.setText(name.toUpperCase()).setVisible(name !== '');
    if (name === '') return;
    const half = this.cursorLabel[1]!.width / 2;
    const x = Math.round(Math.min(Math.max(px, half + 2), SCENE_WIDTH - half - 2));
    const y = py < 16 ? py + 22 : py - 4; // above the pointer, or below it at the very top
    this.cursorLabel[0]!.setPosition(x + 1, y + 1);
    this.cursorLabel[1]!.setPosition(x, y);
  }

  /** While a cutscene plays the pointer shows it is busy (it still reads on with a click). */
  private refreshCursor(): void {
    const busy = this.sequencer.running;
    if (busy === this.cursorBusy) return;
    this.cursorBusy = busy;
    this.input.setDefaultCursor(busy ? 'progress' : this.baseCursor);
  }

  private refreshUi(): void {
    this.drawCursorLabel();
    this.sentenceLine.setText(this.exitAwareSentence());
    // centre on whole pixels (half pixels would blur a pixel font)
    this.sentenceLine.setX(Math.round(GAME_WIDTH / 2 - this.sentenceLine.width / 2));

    const overVerb = this.pointer && verbAt(this.verbs, ...this.pointer);
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

    // the talk menu replaces the verbs
    const talking = this.dialog !== undefined;
    this.dialogPanel.setVisible(talking);
    this.choiceLabels.forEach((label, i) => {
      const choice = this.dialog?.choices[i];
      const hovering = choice !== undefined && this.pointer !== undefined && choiceAt(this.dialog!.choices.length, ...this.pointer) === i;
      label.setVisible(choice !== undefined).setText(choice?.label ?? '').setTint(hovering ? COLOR.verbHover : COLOR.verb);
    });
    for (const label of this.verbLabels.values()) label.setVisible(!talking);

    this.refreshInventory();
  }

  /** The sentence line: the builder's sentence, or "Go to <place>" when idly pointing at an exit. */
  private exitAwareSentence(): string {
    if (this.dialog) {
      const at = this.pointer ? choiceAt(this.dialog.choices.length, ...this.pointer) : undefined;
      const choice = at === undefined ? undefined : this.dialog.choices[at];
      if (choice === undefined) return `Talk to ${Thing.aliasToName(this.dialog.npc)}`;
      return choice.topic === undefined ? 'Say goodbye' : `Ask ${Thing.aliasToName(this.dialog.npc)} about ${Thing.aliasToName(choice.topic)}`;
    }
    const sentence = this.builder.text;
    if (sentence !== '' || !this.hoveredExit || this.transitioning) return sentence;
    const { locations } = this.session.bundle.logic;
    const destination = locations[this.shownLocation]?.directions[this.hoveredExit.direction];
    return destination === undefined ? '' : `Go to ${locations[destination]?.name ?? destination}`;
  }

  private refreshInventory(): void {
    const items = this.inventoryView;
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
