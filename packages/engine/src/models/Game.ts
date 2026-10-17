
import { Location } from './Location';
import { Thing } from './Thing';
import type { LogicData, CustomActionsData } from '../types';

/**
 * Holds the mutable game world state (locations, things, custom actions)
 */
export class Game {
    locations: Record<string, Location>;
    things: Record<string, Thing>;
    customActions: CustomActionsData;

    constructor(gameData: LogicData) {
        this.locations = Game.loadLocations(gameData.locations);
        this.things = Game.loadThings(gameData.things);
        this.customActions = gameData.customActions;
    }

    private static loadLocations(rawLocations: LogicData['locations']): Record<string, Location> {
        const locations: Record<string, Location> = {};

        for (const [key, data] of Object.entries(rawLocations)) {
            locations[key] = new Location(data);
        }

        return locations;
    }

    private static loadThings(rawThings: LogicData['things']): Record<string, Thing> {
        const things: Record<string, Thing> = {};

        for (const [key, data] of Object.entries(rawThings)) {
            things[key] = new Thing(data);
        }

        return things;
    }

    // For saving: the inverse of the constructor.
    // `customActions` is static game content, passed through unchanged
    toData(): Pick<LogicData, 'locations' | 'things' | 'customActions'> {
        return {
            locations: mapValues(this.locations, (location) => location.toLocationData()),
            things: mapValues(this.things, (thing) => thing.toData()),
            customActions: this.customActions,
        };
    }
}

function mapValues<T, R>(record: Record<string, T>, fn: (value: T) => R): Record<string, R> {
    const result: Record<string, R> = {};
    for (const [key, value] of Object.entries(record)) {
        result[key] = fn(value);
    }
    return result;
}
