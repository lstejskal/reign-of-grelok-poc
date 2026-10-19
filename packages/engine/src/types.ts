
export interface LocationData {
    alias: string;
    name: string;
    description: string;
    directions: Record<string, string>;
}

export interface ThingData {
    alias: string;
    description: string;
    location?: string;
    pickable: boolean;
    // Not every entry sets this in game-data/things.yml (defaulting the
    // missing case to visible is still TODO).
    visible?: boolean;
}

export interface ConstraintsData {
    locations: Record<string, string>;
    boolean: Record<string, boolean>;
}

export type CommandsData = Record<string, string[]>;

export type CustomActionsData = Record<string, string[]>;

export type MessagesData = Record<string, string>;

export interface LogicData {
    locations: Record<string, LocationData>;
    things: Record<string, ThingData>;
    commands: CommandsData;
    constraints: ConstraintsData;
    customActions: CustomActionsData;
    messages: MessagesData;
}

// ---------------------------------------------------------------------------
// The engine's public API: commands go in, events come out.
// ---------------------------------------------------------------------------

/**
 * The verbs a point-and-click UI can produce. The first nine are built into the engine; any other lower_snake_case
 * word ("open", "drink"...) is a data-only verb a game lists in its game.yml and answers in custom_actions.yml /
 * messages.yml. (`string & {}` keeps editor autocomplete for the built-in ones.)
 */
export type Verb = 'look_at' | 'pick_up' | 'drop' | 'use' | 'give' | 'talk_to' | 'ask' | 'go' | 'push' | (string & {});

/** A complete player intention, e.g. { verb: 'use', objects: ['rusty_sword', 'zombie'] }. Objects are thing aliases. */
export interface Command {
    verb: Verb;
    objects: string[];
}

/**
 * Everything that can happen as a result of a command. The engine never draws or prints;
 * a client (terminal, browser...) reads these events and decides how to show them.
 */
export type EngineEvent =
    // text for the player; `key` is the message id when it comes from messages.yml (lets a client pick a speaker)
    | { type: 'say'; text: string; key?: string }
    | { type: 'location_changed'; from: string; to: string }
    | { type: 'inventory_changed'; inventory: string[] }
    // a thing's (or location's) location, visibility or description changed
    | { type: 'thing_changed'; id: string }
    // a scripted action from custom_actions.yml ran; always the first event of its batch
    | { type: 'action_performed'; alias: string }
    // always the last event of its batch
    | { type: 'game_over'; won: boolean };

export interface ThingState {
    location: string | undefined; // location alias, 'i' = inventory, undefined = nowhere
    visible: boolean;
    description: string;
}

/** A read-only snapshot of the world, safe to hold on to (it is a copy). */
export interface GameState {
    location: string;
    inventory: string[];
    things: Record<string, ThingState>;
    constraints: ConstraintsData;
    over: boolean;
}
