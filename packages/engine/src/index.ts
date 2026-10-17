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
