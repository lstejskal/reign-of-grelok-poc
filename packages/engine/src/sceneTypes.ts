// Schema of a game's *presentation* data (scenes/*.yml, game.yml). Types only - the logic data
// (things, locations, puzzles) is described in types.ts. Coordinates are in scene pixels: x 0..319, y 0..143.
import type { LogicData } from './types';

export const SCENE_WIDTH = 320;
export const SCENE_HEIGHT = 144;

/** Inventory icons are 24x16 pictures, one per pickable thing, at `assets/icons/<thing alias>.png`. */
export const ICON_WIDTH = 24;
export const ICON_HEIGHT = 16;
export const iconPath = (thingAlias: string): string => `icons/${thingAlias}.png`;

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

/** Extra picture bound to a thing's state. Minimal for now; Step 11 extends it. */
export interface SceneSpriteData {
    thing?: string;
    image: string;
    x: number;
    y: number;
}

export interface SceneData {
    /** Asset paths are relative to the game's `assets/` folder. Added in Step 4. */
    background?: string;
    walkmask?: string;
    music?: string;
    hotspots: HotspotData[];
    exits: ExitData[];
    sprites?: SceneSpriteData[];
}

/** games/<id>/game.yml */
export interface GameConfig {
    title: string;
    /** Location alias where the player starts. */
    start: string;
}

/** Everything the engine and a client need to know about one game. */
export interface GameBundle {
    id: string;
    config: GameConfig;
    logic: LogicData;
    /** Keyed by location alias. */
    scenes: Record<string, SceneData>;
}
