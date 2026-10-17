// Plays the game in the terminal using the engine: `npm run cli`.
// This is the only place that prints, reads input or touches files.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { Engine, chopToLines } from '../src';
import type { EngineEvent } from '../src';
import { loadLogicData, GRELOK_LOGIC_DIR } from './loadLogicData';

const SAVE_DIR = path.resolve(import.meta.dirname, '../../../saved-games');

const data = loadLogicData(GRELOK_LOGIC_DIR);
let engine = new Engine(data);
let extendedPrompt = false;

function show(events: EngineEvent[]): boolean {
    for (const e of events) {
        if (e.type === 'say') console.log(chopToLines(e.text));
    }
    return events.some((e) => e.type === 'game_over');
}

function prompt(): string {
    if (!extendedPrompt) return '\n> ';
    const loc = engine.describeLocation()[0].toLowerCase();
    return `\n[${loc}] > `;
}

function saveFile(name: string): string {
    return path.join(SAVE_DIR, `${name || 'quicksave'}.json`);
}

// Commands the engine does not know about: they belong to this terminal shell.
function shellCommand(line: string): boolean | 'quit' {
    const [word, arg = ''] = line.trim().split(/\s+/);
    if (word === 'quit' || word === 'exit') return 'quit';
    if (line.trim().startsWith('extended prompt')) {
        extendedPrompt = line.trim().endsWith('on');
        console.log(`extended prompt ${extendedPrompt ? 'activated' : 'deactivated'}`);
        return true;
    }
    if (word === 'save') {
        fs.mkdirSync(SAVE_DIR, { recursive: true });
        fs.writeFileSync(saveFile(arg), engine.serialize());
        console.log(`Game saved as ${arg || 'quicksave'}.`);
        return true;
    }
    if (word === 'load' || word === 'restore') {
        if (!fs.existsSync(saveFile(arg))) {
            console.log("This saved game doesn't exist.");
        } else {
            engine = Engine.deserialize(data, fs.readFileSync(saveFile(arg), 'utf8'));
            console.log(`Loaded save game: ${arg || 'quicksave'}`);
            console.log(engine.describeLocation().map((l) => chopToLines(l)).join('\n'));
        }
        return true;
    }
    return false;
}

console.log('REIGN OF GRELOK (engine CLI)');
console.log(engine.describeLocation().map((l) => chopToLines(l)).join('\n'));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt(prompt());
rl.prompt();

for await (const line of rl) {
    const shell = shellCommand(line);
    if (shell === 'quit') {
        console.log('Farewell!');
        break;
    }
    if (shell === false && show(engine.performText(line))) break;
    rl.setPrompt(prompt());
    rl.prompt();
}
rl.close();
