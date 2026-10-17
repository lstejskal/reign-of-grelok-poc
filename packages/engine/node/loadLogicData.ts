// Node-only helper: reads a game's logic/*.yml files into the plain LogicData the engine wants.
// (The engine itself never touches files or YAML - that is the client's job.)
import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import type { LogicData } from '../src/types';

const FILES = {
    locations: 'locations.yml',
    things: 'things.yml',
    constraints: 'constraints.yml',
    messages: 'messages.yml',
    commands: 'commands.yml',
    customActions: 'custom_actions.yml',
} as const;

export function loadLogicData(dir: string): LogicData {
    const read = (file: string) => parseYaml(fs.readFileSync(path.join(dir, file), 'utf8'));
    return Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, read(file)])) as unknown as LogicData;
}

/** games/grelok/logic, found relative to this file so it works from any working directory. */
export const GRELOK_LOGIC_DIR = path.resolve(import.meta.dirname, '../../../games/grelok/logic');
