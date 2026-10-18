// Public API of the engine package. Pure game logic: no DOM, no Phaser, no Node.
export { Engine } from './Engine';
export type { EngineOptions } from './Engine';
export { Thing } from './models/Thing';
export { chopToLines, toSentence } from './utils';
export type {
    Command,
    CommandsData,
    ConstraintsData,
    CustomActionsData,
    EngineEvent,
    GameState,
    LocationData,
    LogicData,
    MessagesData,
    ThingData,
    ThingState,
    Verb,
} from './types';
export { assembleBundle } from './bundle';
export { validateGame } from './validateGame';
export { SCENE_WIDTH, SCENE_HEIGHT, ICON_WIDTH, ICON_HEIGHT, iconPath } from './sceneTypes';
export type { ExitData, Facing, GameBundle, GameConfig, HotspotData, Point, SceneData, SceneSpriteData } from './sceneTypes';
