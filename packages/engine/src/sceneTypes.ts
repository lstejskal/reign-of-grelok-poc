// Schema of a game's *presentation* data (scenes/*.yml, game.yml). Types only - the logic data
// (things, locations, puzzles) is described in types.ts. Coordinates are in scene pixels: x 0..319, y 0..143.
import type { LogicData } from './types';

export const SCENE_WIDTH = 320;
export const SCENE_HEIGHT = 144;

/**
 * Pictures have ART_SCALE pixels per scene pixel. Positions, hotspots, walkmasks and the interface stay in scene
 * pixels (320x200), but backgrounds, sprites, icons and the player sheet are drawn with twice the detail: a background
 * is 640x288, an icon 48x32. The game shows them at 1/ART_SCALE through a camera that zooms by ART_SCALE, so the art
 * keeps all its pixels while the rest of the game keeps its coordinates. Walkmasks are NOT art: they stay 320x144.
 */
export const ART_SCALE = 2;

/** Inventory icons are 24x16 scene pixels (48x32 picture pixels), one per pickable thing, at `assets/icons/<thing alias>.png`. */
export const ICON_WIDTH = 24;
export const ICON_HEIGHT = 16;
export const iconPath = (thingAlias: string): string => `icons/${thingAlias}.png`;

// Sound files (music is mp3, effects are wav: they are tiny, and mp3 adds a hair of silence at the start of a file).
//  A cutscene says `sfx: clang` / `music: battle`; a scene says `music: music/plain.mp3` (a path, like its picture).
export const sfxPath = (name: string): string => `sfx/${name}.wav`;
export const musicPath = (name: string): string => `music/${name}.mp3`;
/** Sounds the client plays by itself. A game may ship these files (assets/sfx/<name>.wav); without them there is silence. */
export const STANDARD_SFX = ['click', 'pickup', 'door'] as const;

export type Point = [x: number, y: number];
export type Facing = 'n' | 's' | 'e' | 'w';

/** A clickable area bound to a thing (`id` is the thing's alias). Later entries are drawn on top of earlier ones. */
export interface HotspotData {
    id: string;
    polygon: Point[];
    /** Where the player walks to before interacting. */
    walkTo: Point;
    /** Direction the player faces on arrival. */
    facing?: Facing;
    /**
     * Only active while these boolean constraints hold (like a sprite state's `when`). A thing whose picture moves,
     * e.g. the zombie that falls into the grave, gets one hotspot per place, each with its own `when`; a door may stop
     * being clickable once it is open, so the exit behind it can be clicked instead.
     */
    when?: Record<string, boolean>;
}

/** A way out of the scene. `direction` is a key of the location's `directions` (n/s/e/w). */
export interface ExitData {
    direction: string;
    polygon: Point[];
    /** Where the player walks to in order to leave. */
    walkTo: Point;
    /** Where the player appears in THIS scene when arriving through this exit (i.e. coming from its neighbour). */
    spawn: Point;
}

/** One look of a sprite, and when it applies. */
export interface SpriteState {
    /** Conditions on the game's boolean constraints, e.g. { zombie_blocks_chapel_door: true }. All must hold. */
    when?: Record<string, boolean>;
    /** Relative to the game's `assets/` folder. */
    image: string;
    /** Move the sprite for this look (default: the sprite's own x, y). */
    x?: number;
    y?: number;
    /** Draw order for this look (default: the sprite's `depth`, else its feet's y). */
    depth?: number;
}

/**
 * A picture in a scene that follows the world's state instead of being part of the background. It is drawn with its
 * feet (bottom centre) at x, y, and sorted by y like the player. The FIRST state whose `when` holds is drawn; a state
 * without `when` always holds; if none holds, nothing is drawn.
 */
export interface SceneSpriteData {
    /** Unique within the scene. */
    id: string;
    /** Only drawn while this thing is visible in this scene's location (so a picked-up thing vanishes). */
    thing?: string;
    x: number;
    y: number;
    /**
     * Draw order: sort as if the feet were at this y (default: its y). For a thing lying ON another sprite, e.g. a
     * gemstone on a heap of rubble: its feet are higher up than the heap's, but it must be drawn in front of it.
     */
    depth?: number;
    states: SpriteState[];
}

/**
 * Perspective: the player is drawn at scale `top` on the farthest walkable row of the scene and at scale `bottom`
 * on the nearest one, and in between it changes smoothly. 1 = the sprite's own size.
 */
export interface SceneScale {
    top: number;
    bottom: number;
}

/**
 * The walkable floor drawn as polygons: the source of the walkmask picture. `npm run walkmask` paints it into the PNG
 * that `walkmask:` names; the game itself reads only the PNG. A pixel is floor when it is inside a `floor` polygon and
 * not inside a `blocked` one (e.g. the base of a big object standing on the floor).
 */
export interface WalkAreaData {
    floor: Point[][];
    blocked?: Point[][];
}

export interface SceneData {
    /** Asset paths are relative to the game's `assets/` folder. Added in Step 4. */
    background?: string;
    walkmask?: string;
    /** Optional: polygons the walkmask picture is generated from (Step 17). */
    walkArea?: WalkAreaData;
    scale?: SceneScale;
    music?: string;
    hotspots: HotspotData[];
    exits: ExitData[];
    sprites?: SceneSpriteData[];
}

/**
 * The player's picture: one sheet of equally sized frames. Columns are idle, walk 1, walk 2; rows are the facings
 * in the order of PLAYER_FACING_ROWS. The sprite's feet are at the bottom centre of a frame.
 */
export interface PlayerConfig {
    /** Relative to the game's `assets/` folder. */
    sprite: string;
    frameWidth: number;
    frameHeight: number;
    /** Frames per row of the sheet (default PLAYER_SHEET_COLUMNS). Only with `animations`. */
    columns?: number;
    /** Named frame lists (see PlayerAnimations). Without it the sheet has the original 3x4 layout. */
    animations?: PlayerAnimations;
    /** Scene pixels one whole walk cycle covers at full size, so the feet don't slide (default DEFAULT_WALK_STRIDE). */
    walkStride?: number;
    /**
     * Smaller copies of the sheet for perspective, by figure height in picture pixels (e.g. [94, 92, .. 58]), each
     * at playerSizeSheet(sprite, height) with the same layout. The game picks the nearest and draws it 1:1, because
     * scaling pixel art by an uneven factor breaks it. Without `sizes` the sheet is scaled at runtime.
     */
    sizes?: number[];
}

/** The file of one smaller size of the player's sheet: sprites/grognak.png, 94 -> sprites/grognak_94.png. */
export const playerSizeSheet = (sprite: string, height: number): string => sprite.replace(/\.png$/, `_${height}.png`);
export const PLAYER_SHEET_COLUMNS = 3;
export const PLAYER_FACING_ROWS: readonly Facing[] = ['s', 'n', 'e', 'w'];

/**
 * The player's animations: lists of frame indices into the sheet (counted row by row), named `<kind>_<facing>`:
 *   idle_s|n|e   standing still                 walk_s|n|e   one whole walk cycle (two steps)
 *   talk_s|e     while he speaks (optional)     reach_s|n|e  picking up / using / giving / pushing (optional)
 * Facing west uses the `_w` animation if there is one, otherwise the `_e` one mirrored. A missing talk or reach
 * animation falls back to idle; a missing `_n`/`_s` one to `_s`/`_e`.
 */
export type PlayerAnimations = Record<string, number[]>;
export const REQUIRED_PLAYER_ANIMATIONS = ['idle_s', 'idle_n', 'idle_e', 'walk_s', 'walk_n', 'walk_e'] as const;

/**
 * A game.yml without `animations:` has the original sheet: 3 columns (stand, stride, other stride) x 4 rows
 * (PLAYER_FACING_ROWS). Its walk passes through the standing frame between the strides: stride, together, stride,
 * together. (`legacy` tells the client to add a small bob on the "together" frames, which a real cycle draws itself.)
 */
export function playerAnimations(config: PlayerConfig): { animations: PlayerAnimations; columns: number; legacy: boolean } {
    if (config.animations) return { animations: config.animations, columns: config.columns ?? PLAYER_SHEET_COLUMNS, legacy: false };
    const animations: PlayerAnimations = {};
    PLAYER_FACING_ROWS.forEach((facing, row) => {
        const at = (column: number) => row * PLAYER_SHEET_COLUMNS + column;
        animations[`idle_${facing}`] = [at(0)];
        animations[`walk_${facing}`] = [at(1), at(0), at(2), at(0)];
    });
    return { animations, columns: PLAYER_SHEET_COLUMNS, legacy: true };
}

/** Scene pixels one whole walk cycle covers at full size, when game.yml does not say (two steps of 12). */
export const DEFAULT_WALK_STRIDE = 24;

/** One verb button: what the player reads, and how many things the sentence needs. */
export interface VerbSpec {
    verb: string;
    label: string;
    /** 1 = "Look at X"; 2 = "Use X with Y". */
    objects: 1 | 2;
    /** Word between the two objects (required when objects = 2). */
    preposition?: string;
}

/** The verb grid has room for this many buttons (2 columns of 3). */
export const MAX_VERBS = 6;
/** Longest label that fits a button. */
export const MAX_VERB_LABEL = 9;

/** Used when game.yml has no `verbs:`. Column-major: the first three are the left column. */
export const DEFAULT_VERBS: readonly VerbSpec[] = [
    { verb: 'give', label: 'Give', objects: 2, preposition: 'to' },
    { verb: 'pick_up', label: 'Pick up', objects: 1 },
    { verb: 'use', label: 'Use', objects: 2, preposition: 'with' },
    { verb: 'look_at', label: 'Look at', objects: 1 },
    { verb: 'talk_to', label: 'Talk to', objects: 1 },
    { verb: 'push', label: 'Push', objects: 1 },
];

/** games/<id>/game.yml */
export interface GameConfig {
    title: string;
    /** The line under the title on the title screen (default "A point-and-click adventure"). */
    subtitle?: string;
    /** The verb buttons, in column-major order (up to MAX_VERBS). Default: DEFAULT_VERBS. */
    verbs?: VerbSpec[];
    /** Location alias where the player starts. */
    start: string;
    /** Where the player stands at the start, in scene pixels (default: the middle of the floor). */
    startPosition?: Point;
    player: PlayerConfig;
    /** Optional art for the title screen (without it: the start scene's background and the title in the pixel font). */
    titleScreen?: TitleScreenConfig;
    /** Optional art for the interface (without it: a plain dark strip and the system cursor). */
    ui?: UiConfig;
}

export interface TitleScreenConfig {
    /** A full-screen picture, TITLE_WIDTH x TITLE_HEIGHT picture pixels (the whole 320x200 screen at ART_SCALE). */
    background?: string;
    /** The game's name as a picture (transparent around it), drawn centred at the top instead of the text title. */
    logo?: string;
}

export interface UiConfig {
    /** A frame over the interface strip, (320 x 56) * ART_SCALE picture pixels, transparent where the controls are. */
    frame?: string;
    /** The mouse pointer: a small picture shown at its own size, and the pixel in it that points (its "hotspot"). */
    cursor?: { image: string; hotspot: Point };
}

/** Sizes the title background and the interface frame must have (picture pixels). */
export const TITLE_WIDTH = 320 * ART_SCALE;
export const TITLE_HEIGHT = 200 * ART_SCALE;
export const UI_FRAME_WIDTH = 320 * ART_SCALE;
export const UI_FRAME_HEIGHT = (200 - SCENE_HEIGHT) * ART_SCALE;

/** One person who can speak: Grognak, the blacksmith... (games/<id>/speakers.yml). */
export interface SpeakerData {
    name: string;
    /** Text colour, "#rrggbb". */
    color: string;
    /** The thing this speaker is. Their words appear above its hotspot. Leave out for the player (above his head). */
    thing?: string;
    /** Message keys this speaker says. A trailing * matches anything: "ask_blacksmith_about_*". */
    messages?: string[];
    /** Things you can ask this speaker about (besides whatever you carry). */
    topics?: string[];
}

export interface SpeakersConfig {
    /** Who speaks any quoted text no speaker claims. */
    default: string;
    speakers: Record<string, SpeakerData>;
}

/** Everything the engine and a client need to know about one game. */
export interface GameBundle {
    id: string;
    config: GameConfig;
    logic: LogicData;
    /**
     * cutscenes.yml: lists of steps (see cutscene.ts), keyed by the key of the message that announces them. When the
     * engine says that message, the client plays the cutscene instead. Raw YAML, checked by validateGame.
     */
    cutscenes: Record<string, unknown[]>;
    /** speakers.yml; a game without one gets just the player as the default speaker. */
    speakers: SpeakersConfig;
    /** Keyed by location alias. */
    scenes: Record<string, SceneData>;
}
