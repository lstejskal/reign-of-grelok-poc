import { SCENE_HEIGHT, SCENE_WIDTH } from './sceneTypes';
import type { Facing, Point } from './sceneTypes';

// A cutscene is a short list of steps in games/<id>/cutscenes.yml. This file only describes the steps and checks
// them (pure data, no timing, no drawing); a client decides how to play each one.

export type CutsceneStep =
    /** Grognak walks to a point and waits until he is there. */
    | { type: 'walk'; to: Point }
    /** Grognak turns to look this way. */
    | { type: 'face'; facing: Facing }
    /** Text in the text box; waits until the player has read it. Either literal `text` or a `message` key. */
    | { type: 'narrate'; text?: string; message?: string }
    /** Words above a speaker (a key of speakers.yml); waits until they have been said. */
    | { type: 'say'; speaker: string; text: string }
    | { type: 'wait'; seconds: number }
    /** The scene fades to black ('out') or back ('in'). */
    | { type: 'fade'; to: 'out' | 'in' }
    | { type: 'shake'; seconds: number }
    | { type: 'sfx'; name: string }
    /** Start a music track, or 'stop'. */
    | { type: 'music'; name: string }
    /** Show the world as it is NOW. Until then the picture keeps what it showed before the command. */
    | { type: 'sync' }
    /** The end screen, with optional lines of credits. Nothing happens after it. */
    | { type: 'end'; lines: string[] };

export type StepType = CutsceneStep['type'];

const FACINGS: readonly string[] = ['n', 's', 'e', 'w'];

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v !== '';

/**
 * Turn one entry of a cutscene list as YAML gives it into a step, or say what is wrong with it.
 * A step is a one-key map (`wait: 0.5`); steps without a value may be written as a bare word (`sync`).
 */
export function parseStep(raw: unknown): { step: CutsceneStep } | { error: string } {
    const bad = (message: string) => ({ error: message });
    let name: string;
    let value: unknown;
    if (typeof raw === 'string') {
        [name, value] = [raw, undefined];
    } else if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.keys(raw).length === 1) {
        [name, value] = Object.entries(raw)[0]!;
    } else {
        return bad(`a step is a single "name: value" (or a bare name), not ${JSON.stringify(raw)}`);
    }

    switch (name) {
        case 'walk': {
            const ok = Array.isArray(value) && value.length === 2 && isNumber(value[0]) && isNumber(value[1]) &&
                value[0] >= 0 && value[0] < SCENE_WIDTH && value[1] >= 0 && value[1] < SCENE_HEIGHT;
            return ok ? { step: { type: 'walk', to: value as Point } } : bad(`walk needs [x, y] inside ${SCENE_WIDTH}x${SCENE_HEIGHT}`);
        }
        case 'face':
            return typeof value === 'string' && FACINGS.includes(value)
                ? { step: { type: 'face', facing: value as Facing } }
                : bad('face needs one of n, s, e, w');
        case 'narrate': {
            if (isString(value)) return { step: { type: 'narrate', text: value } };
            const message = (value as { message?: unknown } | null)?.message;
            return isString(message) ? { step: { type: 'narrate', message } } : bad('narrate needs a text, or {message: <key>}');
        }
        case 'say': {
            const { speaker, text } = (value ?? {}) as { speaker?: unknown; text?: unknown };
            return isString(speaker) && isString(text) ? { step: { type: 'say', speaker, text } } : bad('say needs {speaker: <id>, text: <words>}');
        }
        case 'wait':
        case 'shake':
            return isNumber(value) && value >= 0 ? { step: { type: name, seconds: value } } : bad(`${name} needs a number of seconds`);
        case 'fade':
            return value === 'out' || value === 'in' ? { step: { type: 'fade', to: value } } : bad('fade needs "out" or "in"');
        case 'sfx':
        case 'music':
            return isString(value) ? { step: { type: name, name: value } } : bad(`${name} needs a name`);
        case 'sync':
            return { step: { type: 'sync' } };
        case 'end': {
            if (value === undefined || value === null) return { step: { type: 'end', lines: [] } };
            const lines = (value as { lines?: unknown }).lines;
            return Array.isArray(lines) && lines.every((l) => typeof l === 'string') ? { step: { type: 'end', lines } } : bad('end takes nothing, or {lines: [text, ...]}');
        }
        default:
            return bad(`unknown step "${name}"`);
    }
}
