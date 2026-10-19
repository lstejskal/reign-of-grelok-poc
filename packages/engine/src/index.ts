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
export { parseStep } from './cutscene';
export type { CutsceneStep } from './cutscene';
export { SCENE_WIDTH, SCENE_HEIGHT, ICON_WIDTH, ICON_HEIGHT, iconPath, sfxPath, musicPath, STANDARD_SFX } from './sceneTypes';
export { PLAYER_FACING_ROWS, PLAYER_SHEET_COLUMNS, DEFAULT_VERBS, MAX_VERBS, MAX_VERB_LABEL } from './sceneTypes';
export { DEFAULT_GIBBERISH } from './Engine';
export type { VerbSpec } from './sceneTypes';
export type { ExitData, Facing, GameBundle, GameConfig, HotspotData, PlayerConfig, Point, SceneData, SceneScale, SceneSpriteData, SpeakerData, SpeakersConfig, SpriteState } from './sceneTypes';
