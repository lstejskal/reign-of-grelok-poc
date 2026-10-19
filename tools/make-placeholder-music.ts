// Generates placeholder sound for a game, so the audio system can be built and tested before any real music exists:
//   npm run placeholder-music [-- <game-id>] [--force]
//
//   assets/music/<location>.mp3   a short looping tune per location: square-wave lead, saw bass, noise drums
//   assets/music/<name>.mp3       one more tune for each `music: <name>` a cutscene asks for
//   assets/sfx/<name>.wav         the standard sounds (click, pickup, door) and each `sfx: <name>` a cutscene asks for
//
// The tunes are encoded to mp3 with ffmpeg (it must be installed); the effects stay wav.
// Everything is synthesised from maths (no libraries, no samples), and it is deterministic: the same game always
// gets the same files. Existing files are never overwritten (real music will replace these under the same names)
// unless --force. The tunes loop seamlessly: every note has died away by the end of the last bar.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { STANDARD_SFX, musicPath, parseStep, sfxPath } from '../packages/engine/src';
import { GAMES_DIR, loadGameBundle } from '../packages/engine/node/loadGameBundle';

const RATE = 22050; // samples per second: plenty for chiptune, and keeps the files small

// --- tiny synth ------------------------------------------------------------------------------------------

/** A seeded random number generator (mulberry32), so "random" noise is the same every run. */
function makeRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const hash = (text: string): number => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

type Wave = (phase: number) => number; // phase in 0..1
const square = (duty: number): Wave => (p) => (p < duty ? 1 : -1);
const saw: Wave = (p) => 2 * p - 1;
const sine: Wave = (p) => Math.sin(2 * Math.PI * p);

/** Adds `value` into `out` at sample `at` (ignoring anything that falls outside). */
function add(out: Float32Array, at: number, value: number): void {
    if (at >= 0 && at < out.length) out[at]! += value;
}

/** A note: a wave at `hz` for `seconds`, with a tiny attack and a decay to silence by the end. */
function note(out: Float32Array, start: number, hz: number, seconds: number, wave: Wave, volume: number): void {
    const length = Math.floor(seconds * RATE);
    const first = Math.floor(start * RATE);
    for (let i = 0; i < length; i++) {
        const t = i / length;
        const attack = Math.min(1, i / (0.003 * RATE));
        const envelope = attack * (1 - t) ** 1.5;
        add(out, first + i, wave((hz * i / RATE) % 1) * envelope * volume);
    }
}

/** A noise burst (drums, explosions), optionally smoothed to a duller, lower sound (`smooth` close to 1 = dull). */
function noise(out: Float32Array, start: number, seconds: number, volume: number, random: () => number, smooth = 0, curve = 2): void {
    const length = Math.floor(seconds * RATE);
    const first = Math.floor(start * RATE);
    let previous = 0;
    for (let i = 0; i < length; i++) {
        previous = previous * smooth + (random() * 2 - 1) * (1 - smooth);
        add(out, first + i, previous * (1 - i / length) ** curve * volume);
    }
}

/** A tone whose pitch glides from `from` to `to` Hz. */
function sweep(out: Float32Array, start: number, seconds: number, from: number, to: number, wave: Wave, volume: number, curve = 1.5): void {
    const length = Math.floor(seconds * RATE);
    const first = Math.floor(start * RATE);
    let phase = 0;
    for (let i = 0; i < length; i++) {
        const t = i / length;
        phase = (phase + (from + (to - from) * t) / RATE) % 1;
        add(out, first + i, wave(phase) * Math.min(1, i / (0.002 * RATE)) * (1 - t) ** curve * volume);
    }
}

/** Scales the loudest sample to `peak`, then converts to a 16-bit mono WAV file. */
function toWav(samples: Float32Array, peak = 0.8): Buffer {
    const loudest = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0) || 1;
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => data.writeInt16LE(Math.round((s / loudest) * peak * 32767), i * 2));
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16); // size of the fmt chunk
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(RATE, 24);
    header.writeUInt32LE(RATE * 2, 28); // bytes per second
    header.writeUInt16LE(2, 32); // bytes per sample frame
    header.writeUInt16LE(16, 34); // bits per sample
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
}

// --- music -----------------------------------------------------------------------------------------------

interface Style {
    /** MIDI note of the tonic (60 = middle C). */
    root: number;
    /** Semitones above the tonic, for the seven notes of the mode. */
    mode: number[];
    bpm: number;
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];

// One mood per location. Places not listed get a style picked from their name.
const STYLES: Record<string, Style> = {
    plain: { root: 50, mode: DORIAN, bpm: 112 }, //                 an open road: a marching Dorian
    mountain: { root: 52, mode: PHRYGIAN, bpm: 100 }, //            menacing
    town: { root: 55, mode: MIXOLYDIAN, bpm: 120 }, //              busy and bright
    swamp: { root: 45, mode: MINOR, bpm: 84 }, //                   slow and gloomy
    chapel: { root: 53, mode: LYDIAN, bpm: 90 }, //                 calm
    chapel_interior: { root: 50, mode: HARMONIC_MINOR, bpm: 76 }, // eerie
    lane: { root: 55, mode: MIXOLYDIAN, bpm: 116 },
    orchard: { root: 48, mode: LYDIAN, bpm: 104 },
};

function styleFor(name: string): Style {
    const known = STYLES[name];
    if (known) return known;
    const h = hash(name);
    const modes = [DORIAN, PHRYGIAN, MINOR, MIXOLYDIAN, LYDIAN, HARMONIC_MINOR];
    return { root: 45 + (h % 12), mode: modes[h % modes.length]!, bpm: 80 + (h % 40) };
}

/** Four bars of 4/4 in sixteenth-note steps: bass on the eighths, drums, and a lead line built from a short motif. */
function makeTune(name: string): Float32Array {
    const style = styleFor(name);
    const random = makeRandom(hash(name));
    const step = 60 / style.bpm / 4; // seconds per sixteenth
    const steps = 64;
    const out = new Float32Array(Math.round(steps * step * RATE));
    const degree = (d: number): number => style.root + style.mode[((d % 7) + 7) % 7]! + 12 * Math.floor(d / 7);

    // bass (saw): root, root, fifth, root... one octave down, on every eighth note
    const bassDegrees = [0, 0, 4, 0, 0, 0, 4, 3];
    for (let i = 0; i < steps; i += 2) {
        const bar = Math.floor(i / 16);
        const d = bassDegrees[(i / 2) % 8]! + (bar === 3 ? 3 : 0); // the last bar leans on the fourth
        note(out, i * step, midiToHz(degree(d) - 12), step * 1.8, saw, 0.3);
    }

    // drums (noise): kick on 1 and 3, snare on 2 and 4, hats on the eighths
    for (let i = 0; i < steps; i++) {
        const inBar = i % 16;
        if (inBar === 0 || inBar === 8 || (inBar === 10 && i % 32 === 26)) sweep(out, i * step, 0.14, 150, 45, sine, 0.9);
        if (inBar === 4 || inBar === 12) noise(out, i * step, 0.12, 0.55, random, 0.2);
        if (i % 2 === 0) noise(out, i * step, 0.04, 0.16, random, 0);
    }

    // lead (square): a two-bar motif of eighth notes and rests, repeated, with a varied ending
    const motif: (number | undefined)[] = [];
    for (let i = 0; i < 8; i++) motif.push(random() < 0.22 ? undefined : Math.floor(random() * 5) + (i === 0 ? 0 : 2));
    motif[0] = 4; // start on the fifth so it sounds like a call
    for (let i = 0; i < steps; i += 2) {
        const position = (i / 2) % 16;
        let d = motif[position % 8];
        if (position >= 8 && i < 48) d = d === undefined ? undefined : d + 2 * (position % 2); // second half of each phrase: answer a step higher
        if (i >= 56) d = [4, 2, 0, undefined][(i - 56) / 2]; // the last bar walks home to the tonic
        if (d === undefined) continue;
        note(out, i * step, midiToHz(degree(d + 7)), step * 1.9, square(0.25), 0.22);
    }
    return out;
}

// --- sound effects -----------------------------------------------------------------------------------------

type Effect = (random: () => number) => Float32Array;
const buffer = (seconds: number): Float32Array => new Float32Array(Math.round(seconds * RATE));

const EFFECTS: Record<string, Effect> = {
    // a short, quiet blip for UI clicks
    click: () => {
        const o = buffer(0.06);
        sweep(o, 0, 0.05, 900, 600, square(0.5), 0.5, 1);
        return o;
    },
    // a rising three-note jingle
    pickup: () => {
        const o = buffer(0.3);
        [660, 880, 1320].forEach((hz, i) => note(o, i * 0.07, hz, 0.1, square(0.25), 0.5));
        return o;
    },
    // a heavy thud with a creak
    door: (r) => {
        const o = buffer(0.5);
        sweep(o, 0, 0.18, 180, 50, sine, 1);
        noise(o, 0, 0.3, 0.5, r, 0.85);
        sweep(o, 0.2, 0.25, 140, 260, saw, 0.12);
        return o;
    },
    sword_hit: (r) => {
        const o = buffer(0.35);
        noise(o, 0, 0.12, 0.7, r, 0.1);
        sweep(o, 0, 0.3, 900, 120, saw, 0.5, 2);
        return o;
    },
    zombie_fall: (r) => {
        const o = buffer(0.8);
        sweep(o, 0, 0.5, 220, 55, saw, 0.6, 1);
        noise(o, 0.45, 0.3, 0.8, r, 0.9);
        return o;
    },
    // bright, inharmonic metal ring
    clang: () => {
        const o = buffer(0.6);
        [523, 1245, 2010, 3150].forEach((hz, i) => note(o, 0, hz, 0.6 - i * 0.1, sine, 0.5 / (i + 1)));
        return o;
    },
    explosion: (r) => {
        const o = buffer(1.4);
        noise(o, 0, 1.4, 1, r, 0.9, 1.2);
        sweep(o, 0, 0.5, 120, 30, sine, 1.2);
        return o;
    },
    // a wobbling "baaa"
    goat_bleat: () => {
        const o = buffer(0.7);
        const length = o.length;
        let phase = 0;
        for (let i = 0; i < length; i++) {
            const t = i / length;
            const wobble = 1 + 0.06 * Math.sin(2 * Math.PI * 26 * (i / RATE)); // fast vibrato: the bleat
            phase = (phase + (330 - 90 * t) * wobble / RATE) % 1;
            add(o, i, saw(phase) * Math.min(1, i / 300) * (1 - t) ** 0.7 * 0.6);
        }
        return o;
    },
};

/** Any sound without a recipe above gets a plain blip, so a new `sfx:` name in a cutscene still makes a noise. */
const fallbackEffect: Effect = () => {
    const o = buffer(0.2);
    sweep(o, 0, 0.18, 500, 300, square(0.5), 0.6);
    return o;
};

// --- writing the files ----------------------------------------------------------------------------------------

/** Turns a WAV file's bytes into MP3 bytes with ffmpeg (reads stdin, writes stdout). */
function toMp3(wav: Buffer): Buffer {
    const run = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-q:a', '4', '-f', 'mp3', 'pipe:1'], { input: wav, maxBuffer: 1 << 28 });
    if (run.error || run.status !== 0) throw new Error(`Encoding the music to mp3 needs ffmpeg (brew install ffmpeg): ${run.error?.message ?? run.stderr.toString()}`);
    return run.stdout;
}

function writeAsset(gameId: string, relative: string, make: () => Buffer, force: boolean): string {
    const file = path.join(GAMES_DIR, gameId, 'assets', relative);
    if (fs.existsSync(file) && !force) return `kept    ${relative}`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, make()); // made only now, so kept files cost no encoding
    return `wrote   ${relative}`;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const gameId = args.find((a) => !a.startsWith('--')) ?? 'grelok';
const bundle = loadGameBundle(gameId);

const tunes = new Set(Object.keys(bundle.logic.locations));
const effects = new Set<string>(STANDARD_SFX);
for (const steps of Object.values(bundle.cutscenes)) {
    for (const raw of steps) {
        const parsed = parseStep(raw);
        if (!('step' in parsed)) continue;
        if (parsed.step.type === 'sfx') effects.add(parsed.step.name);
        if (parsed.step.type === 'music' && parsed.step.name !== 'stop') tunes.add(parsed.step.name);
    }
}

for (const name of tunes) console.log(writeAsset(gameId, musicPath(name), () => toMp3(toWav(makeTune(name))), force));
for (const name of effects) console.log(writeAsset(gameId, sfxPath(name), () => toWav((EFFECTS[name] ?? fallbackEffect)(makeRandom(hash(name)))), force));
console.log('\nGive each scene its tune with  music: music/<location>.mp3  in scenes/<location>.yml.');
