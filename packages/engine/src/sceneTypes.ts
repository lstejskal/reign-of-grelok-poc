// Schema of a game's *presentation* data (scenes/*.yml, game.yml). Types only - the logic data
// (things, locations, puzzles) is described in types.ts. Coordinates are in scene pixels: x 0..319, y 0..143.
import type { LogicData } from './types';

export const SCENE_WIDTH = 320;
export const SCENE_HEIGHT = 144;

/** Inventory icons are 24x16 pictures, one per pickable thing, at `assets/icons/<thing alias>.png`. */
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

export interface SceneData {
    /** Asset paths are relative to the game's `assets/` folder. Added in Step 4. */
    background?: string;
    walkmask?: string;
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
}
export const PLAYER_SHEET_COLUMNS = 3;
export const PLAYER_FACING_ROWS: readonly Facing[] = ['s', 'n', 'e', 'w'];

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
    /** The verb buttons, in column-major order (up to MAX_VERBS). Default: DEFAULT_VERBS. */
    verbs?: VerbSpec[];
    /** Location alias where the player starts. */
    start: string;
    /** Where the player stands at the start, in scene pixels (default: the middle of the floor). */
    startPosition?: Point;
    player: PlayerConfig;
}

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
