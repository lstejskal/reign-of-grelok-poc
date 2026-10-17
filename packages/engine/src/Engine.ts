import { Game } from './models/Game';
import { Message } from './models/Message';
import { Thing } from './models/Thing';
import { clone, toSentence } from './utils';
import { parseCommand, isAmbiguous, buildCommandAlias } from './parser/CommandParser';
import { CustomActionRunner } from './parser/CustomActionRunner';
import { HELP_LINES } from './helpText';
import type { Command, CommandsData, ConstraintsData, EngineEvent, GameState, LogicData } from './types';

export interface EngineOptions {
    /** Where the player starts. Defaults to the first location in the data. */
    startLocation?: string;
    /** Source of randomness (only used to pick a gibberish reply). Inject a fake one in tests. */
    random?: () => number;
}

// Bumped if the serialized format ever changes.
const SAVE_VERSION = 1;

interface SaveFile {
    version: number;
    currentLocation: string;
    over: boolean;
    locations: LogicData['locations'];
    things: LogicData['things'];
    constraints: ConstraintsData;
    messages: LogicData['messages'];
}

// Verbs that only make sense in a shell that can save files / quit; the engine itself does not handle them.
const SHELL_COMMANDS = new Set(['save_game', 'load_game', 'quit_game']);

/**
 * The whole game simulation: world state + rules. It is pure - no DOM, no Phaser, no Node -
 * and it never prints. You give it a command, it returns a list of EngineEvents describing
 * what happened (what was said, what moved, whether the game ended).
 *
 *   mouse click / typed line  ->  engine.perform(...)  ->  EngineEvent[]  ->  client draws them
 *
 * Derived from the text game's `Player` class; the puzzle logic itself lives in the data
 * (custom_actions.yml), interpreted by CustomActionRunner.
 */
export class Engine {
    private readonly game: Game;
    private readonly messages: Message;
    private readonly constraints: ConstraintsData;
    private readonly commands: CommandsData;
    private readonly runner: CustomActionRunner;
    private readonly random: () => number;
    private readonly handlers: Record<string, (params: string[]) => void>;

    private currentLocation: string;
    private over = false;

    // Scratch space for the command currently being executed (see run()).
    private events: EngineEvent[] = [];
    private actionAlias: string | undefined;
    private won = false;

    constructor(data: LogicData, options: EngineOptions = {}) {
        this.game = new Game(data);
        // Messages and constraints are mutated during play; copy so the loaded data stays pristine.
        this.messages = new Message(clone(data.messages));
        this.constraints = clone(data.constraints);
        this.commands = data.commands;
        this.random = options.random ?? Math.random;

        const first = Object.keys(data.locations)[0];
        const start = options.startLocation ?? first;
        if (start === undefined || !(start in data.locations)) {
            throw new Error(`Unknown start location: ${start}`);
        }
        this.currentLocation = start;

        this.runner = new CustomActionRunner(this.game, this.messages, this.constraints, (text, key) =>
            this.say(text, key),
        );

        this.handlers = {
            look_at: (p) => this.lookAt(p[0]),
            pick_up: (p) => this.pickUp(p[0]),
            drop: (p) => this.drop(p[0]),
            go: (p) => this.go(p[0] ?? ''),
            talk_to: (p) => this.talkTo(p[0]),
            ask: (p) => this.ask(p[0]),
            give: (p) => this.give(p[0], p[1]),
            use: (p) => this.use(p[0], p[1]),
            display_inventory: () => this.displayInventory(),
        };
    }

    // --- public API --------------------------------------------------------

    /** Perform a structured command (what a point-and-click UI sends). */
    perform(cmd: Command): EngineEvent[] {
        return this.run(() => this.execute(cmd.verb, cmd.objects, buildCommandAlias(cmd.verb, cmd.objects)));
    }

    /**
     * Perform a typed line like "use rusty sword on zombie" (the text-game interface; also handy for
     * tests and a debug console). Unlike perform(), it describes the new room after you move.
     */
    performText(line: string): EngineEvent[] {
        const trimmed = line.trim();
        if (trimmed === 'h' || trimmed === 'help') {
            return this.run(() => HELP_LINES.forEach((l) => this.say(l)));
        }

        return this.run(() => {
            if (trimmed === '') {
                return;
            }

            const parsed = parseCommand(trimmed, this.activeObjects(), this.commands);
            if (isAmbiguous(parsed)) {
                this.say(parsed.ambiguity);
                return;
            }

            const from = this.currentLocation;
            this.execute(parsed.command, parsed.params, parsed.commandAlias);
            if (this.currentLocation !== from) {
                this.describeLocation().forEach((l) => this.say(l));
            }
        });
    }

    /** What the player sees on entering / looking around: name, description, exits, things. */
    describeLocation(): string[] {
        const location = this.game.locations[this.currentLocation];
        return [
            location.name,
            location.description,
            location.formattedDirections(),
            this.thingsInLocation(this.currentLocation),
        ];
    }

    get state(): Readonly<GameState> {
        const things: GameState['things'] = {};
        for (const [id, t] of Object.entries(this.game.things)) {
            things[id] = { location: t.location, visible: t.visible, description: t.description };
        }
        return {
            location: this.currentLocation,
            inventory: this.inventory(),
            things,
            constraints: clone(this.constraints),
            over: this.over,
        };
    }

    /** Aliases of the visible things at a location (default: where the player is). */
    visibleThings(locationAlias: string = this.currentLocation): string[] {
        return Object.values(this.game.things)
            .filter((t) => t.inLocation(locationAlias) && t.visible)
            .map((t) => t.alias);
    }

    /** Save the changing part of the world as a string. Static game data is not included. */
    serialize(): string {
        const { locations, things } = this.game.toData();
        const save: SaveFile = {
            version: SAVE_VERSION,
            currentLocation: this.currentLocation,
            over: this.over,
            locations,
            things,
            constraints: clone(this.constraints),
            messages: this.messages.toData(),
        };
        return JSON.stringify(save);
    }

    /** Rebuild an engine from the (static) game data plus a string produced by serialize(). */
    static deserialize(data: LogicData, saved: string, options: EngineOptions = {}): Engine {
        const save = JSON.parse(saved) as SaveFile;
        if (save.version !== SAVE_VERSION) {
            throw new Error(`Unsupported save version: ${save.version}`);
        }

        const engine = new Engine(
            {
                ...data,
                locations: save.locations,
                things: save.things,
                constraints: save.constraints,
                messages: save.messages,
            },
            { ...options, startLocation: save.currentLocation },
        );
        engine.over = save.over;
        return engine;
    }

    // --- running a command -------------------------------------------------

    // Runs `body`, which says things / changes state, then works out the events by comparing the
    // world before and after. Diffing keeps the game rules free of event bookkeeping.
    private run(body: () => void): EngineEvent[] {
        if (this.over) {
            return [];
        }

        const before = this.snapshot();
        this.events = [];
        this.actionAlias = undefined;
        this.won = false;

        body();

        const out: EngineEvent[] = [];
        if (this.actionAlias !== undefined) {
            out.push({ type: 'action_performed', alias: this.actionAlias });
        }
        out.push(...this.events);
        out.push(...this.diff(before));

        if (this.won) {
            this.over = true;
            out.push({ type: 'game_over', won: true });
        }
        return out;
    }

    // The old Player#processLine pipeline: scripted action -> plain message -> built-in handler -> gibberish.
    private execute(command: string, params: string[], alias: string): void {
        const result = this.runner.perform(command, params, alias, this.currentLocation);
        if (result.handled) {
            this.actionAlias = alias;
            this.won = result.gameOver;
            return;
        }

        const message = this.messages.findByAlias(alias);
        if (message !== undefined) {
            this.say(message, alias);
            return;
        }

        const handler = this.handlers[command];
        if (handler !== undefined) {
            handler(params);
        } else if (SHELL_COMMANDS.has(command)) {
            this.say("That isn't available here.");
        } else {
            this.sayGibberish();
        }
    }

    private snapshot() {
        return {
            location: this.currentLocation,
            inventory: this.inventory(),
            things: this.fingerprints(),
        };
    }

    // One comparable string per thing and per location, covering everything that can change at runtime.
    private fingerprints(): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [id, t] of Object.entries(this.game.things)) {
            result[id] = JSON.stringify([t.location, t.visible, t.description]);
        }
        for (const [id, l] of Object.entries(this.game.locations)) {
            result[id] = JSON.stringify(l.description);
        }
        return result;
    }

    private diff(before: ReturnType<Engine['snapshot']>): EngineEvent[] {
        const events: EngineEvent[] = [];

        if (this.currentLocation !== before.location) {
            events.push({ type: 'location_changed', from: before.location, to: this.currentLocation });
        }

        const after = this.fingerprints();
        for (const id of Object.keys(after)) {
            if (after[id] !== before.things[id]) {
                events.push({ type: 'thing_changed', id });
            }
        }

        const inventory = this.inventory();
        if (inventory.join() !== before.inventory.join()) {
            events.push({ type: 'inventory_changed', inventory });
        }
        return events;
    }

    // --- output ---------------------------------------------------------------

    private say(text: string, key?: string): void {
        this.events.push(key === undefined ? { type: 'say', text } : { type: 'say', text, key });
    }

    private sayGibberish(): void {
        const index = Math.floor(this.random() * 3) + 1;
        const message = this.messages.findByAlias(`gibberish${index}`);
        if (message !== undefined) {
            this.say(message, `gibberish${index}`);
        }
    }

    // --- world queries -----------------------------------------------------------

    private inventory(): string[] {
        return Object.values(this.game.things)
            .filter((t) => t.location === 'i')
            .map((t) => t.alias);
    }

    // Names (with spaces) of visible things at a location
    private thingNamesAt(locationAlias: string): string[] {
        return Object.values(this.game.things)
            .filter((t) => t.inLocation(locationAlias) && t.visible)
            .map((t) => t.name);
    }

    private thingsInLocation(locationAlias: string): string {
        const prepend = locationAlias === 'i' ? 'You carry ' : 'There is ';
        return toSentence(this.thingNamesAt(locationAlias), { prepend });
    }

    // What the player can refer to right now: carried things + visible things here (as names).
    private activeObjects(): string[] {
        return [
            ...this.inventory().map((alias) => Thing.aliasToName(alias)),
            ...this.thingNamesAt(this.currentLocation),
        ];
    }

    private isActiveObject(thingAlias: string): boolean {
        return this.activeObjects().includes(Thing.aliasToName(thingAlias));
    }

    // --- built-in command handlers (fallbacks: real puzzle logic lives in the data) ----------

    private canLookAt(thingAlias: string): boolean {
        const thing = this.game.things[thingAlias];
        return (
            thing !== undefined &&
            (thing.location === this.currentLocation || thing.location === 'i') &&
            thing.visible
        );
    }

    private lookAt(thingAlias: string = ''): void {
        if (thingAlias === '') {
            this.describeLocation().forEach((l) => this.say(l));
            return;
        }

        this.say(
            this.canLookAt(thingAlias)
                ? `It's ${this.game.things[thingAlias].description}.`
                : `You can't see any ${Thing.aliasToName(thingAlias)} here.`,
        );
    }

    private canPickUp(thingAlias: string): boolean {
        const thing = this.game.things[thingAlias];
        return thing !== undefined && thing.visible && thing.pickable && thing.location === this.currentLocation;
    }

    private pickUp(thingAlias: string = ''): void {
        const thingName = Thing.aliasToName(thingAlias);

        if (this.canPickUp(thingAlias)) {
            this.game.things[thingAlias].location = 'i';
            this.say(`You picked up ${thingName}.`);
        } else if (this.inventory().includes(thingAlias)) {
            this.say(`You already carry ${thingName}.`);
        } else if (thingName !== '') {
            this.say(`You can't pick up ${thingName}.`);
        } else {
            this.say('Pick up what?');
        }
    }

    private drop(thingAlias: string = ''): void {
        const thingName = Thing.aliasToName(thingAlias);

        if (this.inventory().includes(thingAlias)) {
            this.game.things[thingAlias].location = this.currentLocation;
            this.say(`You dropped ${thingName}.`);
        } else if (thingName !== '') {
            this.say(`You don't carry ${thingName}.`);
        } else {
            this.say('Drop what?');
        }
    }

    private go(direction: string): void {
        const dir = direction.charAt(0);
        const location = this.game.locations[this.currentLocation];
        const blocked = this.constraints.locations[`${this.currentLocation}-${dir}`];

        if (dir in location.directions && !blocked) {
            this.currentLocation = location.directions[dir];
        } else {
            this.say(blocked || "You can't go that way.", blocked ? `${this.currentLocation}-${dir}` : undefined);
        }
    }

    private talkTo(whom: string = ''): void {
        if (this.isActiveObject(whom)) {
            this.say("You can't chat with that.");
        } else {
            this.say(`Talk to whom? I don't see any ${Thing.aliasToName(whom)} around here.`);
        }
    }

    private ask(whom: string = ''): void {
        if (this.isActiveObject(whom)) {
            const key = `ask_${whom}_about_anything`;
            const message = this.messages.findByAlias(key);
            this.say(message ?? "You can't chat with that.", message === undefined ? undefined : key);
        } else {
            this.say(`Ask whom? I don't see any ${Thing.aliasToName(whom)} around here.`);
        }
    }

    private give(what: string = '', whom: string = ''): void {
        if (what === '') {
            this.sayGibberish();
        } else if (!this.inventory().includes(what)) {
            this.say(`You don't have ${Thing.aliasToName(what)}.`);
        } else if (whom === '') {
            this.say('Give to whom?');
        } else if (!this.isActiveObject(whom)) {
            this.say(`Give to whom? I don't see any ${Thing.aliasToName(whom)} around here.`);
        } else {
            const key = `give_anything_to_${whom}`;
            const message = this.messages.findByAlias(key);
            this.say(message ?? "That doesn't make sense.", message === undefined ? undefined : key);
        }
    }

    // also stands in for "attack", which the parser rewrites into "use"
    private use(what: string = '', target: string = ''): void {
        if (what === '') {
            this.sayGibberish();
        } else if (!this.inventory().includes(what)) {
            this.say(`You don't have ${Thing.aliasToName(what)}.`);
        } else if (target !== '' && !this.isActiveObject(target)) {
            this.say(`I don't see any ${Thing.aliasToName(target)} around here.`);
        } else {
            this.say("That doesn't make sense.");
        }
    }

    private displayInventory(): void {
        this.say(this.inventory().length === 0 ? "You don't have anything." : this.thingsInLocation('i'));
    }
}
