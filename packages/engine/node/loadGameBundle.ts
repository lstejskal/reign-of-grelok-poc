// Node-only: reads every .yml file of a game folder (games/<id>/) and assembles the GameBundle.
import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { assembleBundle } from '../src';
import { readPngSize } from './pngSize';
import type { GameBundle } from '../src';

export const GAMES_DIR = path.resolve(import.meta.dirname, '../../../games');

export function loadGameBundle(id: string, gamesDir: string = GAMES_DIR): GameBundle {
    const root = path.join(gamesDir, id);
    if (!fs.existsSync(root)) {
        throw new Error(`No such game: "${id}" (looked in ${root})`);
    }

    const files: Record<string, string> = {};
    for (const relative of fs.readdirSync(root, { recursive: true, encoding: 'utf8' })) {
        if (relative.endsWith('.yml')) {
            files[relative.split(path.sep).join('/')] = fs.readFileSync(path.join(root, relative), 'utf8');
        }
    }
    return assembleBundle(id, files, parseYaml);
}

/** Does a file exist under games/<id>/assets/ ? */
export function assetExistsFor(id: string, gamesDir: string = GAMES_DIR): (assetPath: string) => boolean {
    return (assetPath) => fs.existsSync(path.join(gamesDir, id, 'assets', assetPath));
}

/** Size of a PNG under games/<id>/assets/ (undefined if it is missing or not a PNG). */
export function imageSizeFor(id: string, gamesDir: string = GAMES_DIR): (assetPath: string) => { width: number; height: number } | undefined {
    return (assetPath) => {
        try {
            return readPngSize(path.join(gamesDir, id, 'assets', assetPath));
        } catch {
            return undefined;
        }
    };
}
