import type { LogicData } from './types';
import type { GameBundle, GameConfig, SceneData, SceneSpriteData, SpeakersConfig } from './sceneTypes';

const LOGIC_FILES = {
    locations: 'logic/locations.yml',
    things: 'logic/things.yml',
    constraints: 'logic/constraints.yml',
    messages: 'logic/messages.yml',
    commands: 'logic/commands.yml',
    customActions: 'logic/custom_actions.yml',
} as const;

/**
 * Builds a GameBundle from the raw text of a game's YAML files.
 *
 * `files` maps a path relative to the game folder ("game.yml", "logic/things.yml", "scenes/plain.yml")
 * to its text. Reading files is the caller's job (Node: fs, browser: Vite's import.meta.glob) and so is
 * the YAML parser - this keeps the engine free of environment-specific code, shared by both.
 */
export function assembleBundle(id: string, files: Record<string, string>, parseYaml: (text: string) => unknown): GameBundle {
    const read = (path: string): unknown => {
        const text = files[path];
        if (text === undefined) {
            throw new Error(`Game "${id}" is missing ${path}`);
        }
        return parseYaml(text);
    };

    const logic = Object.fromEntries(Object.entries(LOGIC_FILES).map(([key, path]) => [key, read(path)])) as unknown as LogicData;

    const scenes: Record<string, SceneData> = {};
    for (const path of Object.keys(files)) {
        const match = path.match(/^scenes\/([^/]+)\.yml$/);
        if (match?.[1] !== undefined) {
            const raw = (read(path) ?? {}) as Partial<SceneData>;
            scenes[match[1]] = { ...raw, hotspots: raw.hotspots ?? [], exits: raw.exits ?? [], sprites: (raw.sprites ?? []).map(normalizeSprite) };
        }
    }

    // speakers.yml is optional: without it everything is narration and the player speaks the quotes
    const noSpeakers: SpeakersConfig = { default: 'player', speakers: { player: { name: 'Player', color: '#ffffff' } } };
    const speakers = 'speakers.yml' in files ? (read('speakers.yml') as SpeakersConfig) : noSpeakers;

    return { id, config: read('game.yml') as GameConfig, logic, speakers, scenes };
}

/** A sprite with one look may be written `image: x.png` instead of a `states:` list. */
function normalizeSprite(raw: SceneSpriteData & { image?: string }): SceneSpriteData {
    const { image, ...sprite } = raw;
    return { ...sprite, states: sprite.states ?? (image === undefined ? [] : [{ image }]) };
}
