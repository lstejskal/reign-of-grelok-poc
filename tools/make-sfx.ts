// Synthesises Grelok's sound effects (step 18): npm run make-sfx [-- <name> ...]
//
// Writes games/grelok/assets/sfx/<name>.wav for every recipe below (or only the names given), always overwriting.
// Everything is made from maths, in the spirit of the Mega Drive's FM chip that the music imitates: FM operators
// for bells and metal, filtered noise for whooshes, dirt and fire, pitch-dropping sines for thuds, and a small
// room reverb so the sounds sit in the same space as the music. Deterministic: the same code gives the same files.
//
// The demo game keeps the simple placeholders from tools/make-placeholder-music.ts.
// Listen with any player; `--spectrum` also writes a spectrogram PNG per sound into test-results/sfx/ (needs ffmpeg).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { sfxPath } from '../packages/engine/src';
import { GAMES_DIR } from '../packages/engine/node/loadGameBundle';

const RATE = 44100;
const TAU = 2 * Math.PI;

// --- building blocks -------------------------------------------------------------------------------------------

/** A seeded random number generator (mulberry32), so noise is the same every run. */
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

type Signal = Float32Array;
const seconds = (s: number): number => Math.round(s * RATE);
const silence = (s: number): Signal => new Float32Array(seconds(s));

/** A value that changes over time: a constant, or a function of the time in seconds since the sound started. */
type Curve = number | ((t: number) => number);
const at = (c: Curve, t: number): number => (typeof c === 'number' ? c : c(t));

/** Exponential decay to about -60 dB after `time` seconds. */
const decay = (time: number): ((t: number) => number) => (t) => Math.exp((-6.9 * t) / time);
/** A short linear attack, then exponential decay. */
const hit = (attack: number, time: number): ((t: number) => number) => (t) =>
  t < attack ? t / attack : Math.exp((-6.9 * (t - attack)) / time);
/** Glides from `from` to `to` exponentially over `time` seconds, then stays. */
const glide = (from: number, to: number, time: number): ((t: number) => number) => (t) =>
  from * (to / from) ** Math.min(1, t / time);

/** Adds `source` into `out`, starting at `start` seconds, scaled by `gain`. */
function mix(out: Signal, source: Signal, start = 0, gain = 1): Signal {
  const first = seconds(start);
  for (let i = 0; i < source.length && first + i < out.length; i++) out[first + i]! += source[i]! * gain;
  return out;
}

/**
 * One FM voice, like a two-operator Mega Drive patch: a sine carrier at `hz`, its phase pushed by a sine modulator
 * at `hz * ratio` with depth `index` (0 = a pure sine, 2-8 = brighter, metallic when the ratio is not a whole number).
 */
function fm(length: number, hz: Curve, ratio: number, index: Curve, env: Curve, feedback = 0): Signal {
  const out = silence(length);
  let carrier = 0;
  let modulator = 0;
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const f = at(hz, t);
    const m = Math.sin(TAU * modulator + feedback * last);
    last = m;
    out[i] = Math.sin(TAU * carrier + at(index, t) * m) * at(env, t);
    carrier = (carrier + f / RATE) % 1;
    modulator = (modulator + (f * ratio) / RATE) % 1;
  }
  return out;
}

/** A plain oscillator (sine, or a soft band-limited-ish saw built from a few harmonics). */
function tone(length: number, hz: Curve, env: Curve, shape: 'sine' | 'saw' = 'sine'): Signal {
  const out = silence(length);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const f = at(hz, t);
    let v = Math.sin(TAU * phase);
    if (shape === 'saw') for (let k = 2; k <= 12 && k * f < RATE / 2; k++) v += Math.sin(TAU * phase * k) / k;
    out[i] = v * at(env, t);
    phase = (phase + f / RATE) % 1;
  }
  return out;
}

/** White noise shaped by an envelope. */
function noise(length: number, env: Curve, random: () => number): Signal {
  const out = silence(length);
  for (let i = 0; i < out.length; i++) out[i] = (random() * 2 - 1) * at(env, i / RATE);
  return out;
}

/**
 * A resonant state-variable filter whose cutoff can move over time. `q` around 0.7 is smooth, higher rings.
 * Returns a new signal: lowpass, bandpass or highpass.
 */
function filter(input: Signal, kind: 'low' | 'band' | 'high', cutoff: Curve, q = 0.7): Signal {
  const out = silence(input.length / RATE);
  let low = 0;
  let band = 0;
  const damping = 1 / q;
  for (let i = 0; i < input.length; i++) {
    const f = 2 * Math.sin((Math.PI * Math.min(at(cutoff, i / RATE), RATE / 6)) / RATE);
    // two passes per sample keep the filter stable at higher cutoffs
    let high = 0;
    for (let pass = 0; pass < 2; pass++) {
      low += (f / 2) * band;
      high = input[i]! - low - damping * band;
      band += (f / 2) * high;
    }
    out[i] = kind === 'low' ? low : kind === 'band' ? band : high;
  }
  return out;
}

/** Sparse crackle: random clicks, `density` per second, each a tiny decaying burst. */
function crackle(length: number, density: Curve, env: Curve, random: () => number): Signal {
  const out = silence(length);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    if (random() < at(density, t) / RATE) {
      const size = 20 + Math.floor(random() * 120);
      const gain = (0.4 + random() * 0.6) * at(env, t) * (random() < 0.5 ? -1 : 1);
      for (let k = 0; k < size && i + k < out.length; k++) out[i + k]! += gain * (1 - k / size) ** 2 * (random() * 2 - 1);
    }
  }
  return out;
}

/** Gentle saturation (tanh), for weight without hard clipping. */
function drive(input: Signal, amount: number): Signal {
  const norm = Math.tanh(amount);
  return input.map((v) => Math.tanh(v * amount) / norm);
}

/**
 * A small room (Schroeder/Freeverb style: four feedback combs into two allpasses). `size` 0..1 sets the tail,
 * `wet` how much of the room is heard. The result is longer than the input by `tail` seconds.
 */
function room(input: Signal, size: number, wet: number, tail: number): Signal {
  const out = silence(input.length / RATE + tail);
  const dry = new Float32Array(out.length);
  dry.set(input);
  const combs = [1116, 1188, 1277, 1356].map((d) => ({ buf: new Float32Array(d), i: 0, store: 0 }));
  const allpasses = [556, 441].map((d) => ({ buf: new Float32Array(d), i: 0 }));
  const feedback = 0.7 + 0.28 * size;
  const damp = 0.3;
  for (let n = 0; n < out.length; n++) {
    const x = dry[n]! * 0.25;
    let sum = 0;
    for (const c of combs) {
      const y = c.buf[c.i]!;
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * feedback;
      c.i = (c.i + 1) % c.buf.length;
      sum += y;
    }
    for (const a of allpasses) {
      const y = a.buf[a.i]!;
      a.buf[a.i] = sum + y * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      sum = y - sum;
    }
    out[n] = dry[n]! + sum * wet;
  }
  return out;
}

/** Fades the last `time` seconds to silence (so no sound ends with a click). */
function fadeOut(input: Signal, time: number): Signal {
  const n = Math.min(input.length, seconds(time));
  for (let i = 0; i < n; i++) input[input.length - 1 - i]! *= i / n;
  return input;
}

/** Removes DC offset and sub-bass rumble below ~20 Hz (a one-pole highpass), which speakers can't play anyway. */
function dcBlock(input: Signal): Signal {
  const out = new Float32Array(input.length);
  const r = 1 - (TAU * 20) / RATE;
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < input.length; i++) {
    y1 = input[i]! - x1 + r * y1;
    x1 = input[i]!;
    out[i] = y1;
  }
  return out;
}

/** Scales the loudest sample to `peak` (0..1) and writes a 16-bit mono WAV. */
function toWav(samples: Signal, peak: number): Buffer {
  const loudest = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0) || 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (s / loudest) * peak)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// --- the sounds --------------------------------------------------------------------------------------------------
// `peak` sets how loud each one is next to the music (which is levelled to -16 LUFS): UI sounds stay quiet.

interface Recipe {
  peak: number;
  make: (random: () => number) => Signal;
}

const RECIPES: Record<string, Recipe> = {
  // Clicking the verbs, inventory and menus: a soft wooden tick, short enough to repeat quickly.
  click: {
    peak: 0.3,
    make: (r) => {
      const out = silence(0.06);
      mix(out, fm(0.05, 1800, 1.5, glide(3, 0.2, 0.02), hit(0.001, 0.02)), 0, 0.6);
      mix(out, filter(noise(0.01, decay(0.006), r), 'high', 3000), 0, 0.4);
      return fadeOut(out, 0.01);
    },
  },

  // Something goes into the inventory: a two-note FM bell, rising a fifth, with a little sparkle and room.
  pickup: {
    peak: 0.5,
    make: (r) => {
      const out = silence(0.5);
      const bell = (hz: number): Signal => fm(0.45, hz, 3.5, glide(2.2, 0.4, 0.3), hit(0.002, 0.35));
      mix(out, bell(784), 0, 0.6); // G5
      mix(out, bell(1175), 0.08, 0.7); // D6
      mix(out, filter(noise(0.25, hit(0.01, 0.2), r), 'band', glide(6000, 9000, 0.25), 4), 0.08, 0.08);
      return fadeOut(room(out, 0.4, 0.25, 0.4), 0.1);
    },
  },

  // Leaving one place for another (doors and paths alike): a soft whoosh of air and a low, muffled step.
  door: {
    peak: 0.55,
    make: (r) => {
      const out = silence(0.55);
      const air = noise(0.45, (t) => Math.sin((Math.PI * t) / 0.45) ** 2, r);
      mix(out, filter(air, 'band', glide(400, 1600, 0.45), 1.2), 0, 0.5);
      mix(out, tone(0.25, glide(110, 50, 0.12), hit(0.004, 0.15)), 0.3, 0.9);
      mix(out, filter(noise(0.1, decay(0.06), r), 'low', 500), 0.3, 0.6);
      return fadeOut(room(out, 0.3, 0.2, 0.3), 0.1);
    },
  },

  // Grognak's rusty sword hits the zombie: a swing whoosh, a meaty thud and a short dull ring of old iron.
  sword_hit: {
    peak: 0.85,
    make: (r) => {
      const out = silence(0.7);
      const swing = noise(0.14, (t) => (t / 0.14) ** 2, r);
      mix(out, filter(swing, 'band', glide(500, 3500, 0.14), 2), 0, 0.5);
      const impact = 0.13;
      mix(out, tone(0.3, glide(160, 45, 0.15), hit(0.002, 0.22)), impact, 1);
      mix(out, filter(noise(0.18, decay(0.1), r), 'low', glide(2500, 300, 0.1)), impact, 0.9);
      mix(out, fm(0.4, 420, 2.76, glide(4, 1, 0.2), hit(0.001, 0.25)), impact, 0.25); // rusty, so short and dull
      return fadeOut(room(drive(out, 1.6), 0.35, 0.2, 0.35), 0.1);
    },
  },

  // The zombie groans and topples into the open grave: a falling, throaty moan, then a body hitting earth.
  zombie_fall: {
    peak: 0.75,
    make: (r) => {
      const out = silence(1.4);
      // the moan: a buzzy saw through two vowel-like resonances ("uuoh"), pitch sinking, a slow wobble
      const pitch = (t: number): number => glide(150, 70, 0.7)(t) * (1 + 0.04 * Math.sin(TAU * 5.5 * t));
      const moanEnv = (t: number): number => Math.min(1, t / 0.08) * Math.max(0, 1 - t / 0.75) ** 1.2;
      const voice = tone(0.75, pitch, moanEnv, 'saw');
      const vowel = silence(0.75);
      mix(vowel, filter(voice, 'band', glide(500, 350, 0.7), 5), 0, 1);
      mix(vowel, filter(voice, 'band', glide(900, 700, 0.7), 6), 0, 0.5);
      mix(vowel, filter(noise(0.75, moanEnv, r), 'band', 800, 1), 0, 0.15); // breath
      mix(out, vowel, 0, 1);
      // the fall: a heavy low thud and loose dirt trickling after it
      const land = 0.7;
      mix(out, tone(0.4, glide(90, 35, 0.2), hit(0.003, 0.3)), land, 1.3);
      mix(out, filter(noise(0.25, decay(0.15), r), 'low', glide(1200, 200, 0.2)), land, 1);
      mix(out, filter(crackle(0.6, (t) => 400 * Math.exp(-5 * t), decay(0.5), r), 'low', 2500), land + 0.03, 0.35);
      return fadeOut(room(drive(out, 1.3), 0.4, 0.18, 0.3), 0.15);
    },
  },

  // The blacksmith's hammer on the anvil (played three times in the dark): a hard strike and a long bright ring.
  clang: {
    peak: 0.75,
    make: (r) => {
      const out = silence(0.9);
      // inharmonic partials of a steel block, each its own FM operator so the ring shimmers
      const partials: [number, number, number][] = [
        [880, 1, 0.7],
        [2417, 0.55, 0.45],
        [3911, 0.35, 0.3],
        [5530, 0.2, 0.18],
      ];
      for (const [hz, gain, time] of partials) mix(out, fm(0.8, hz, 1.41, glide(1.5, 0.1, 0.1), hit(0.0005, time)), 0, gain);
      mix(out, filter(noise(0.02, decay(0.01), r), 'high', 2000), 0, 0.35); // the strike itself
      mix(out, tone(0.08, glide(220, 120, 0.05), decay(0.05)), 0, 0.4); // body of the anvil
      return fadeOut(room(drive(out, 1.8), 0.55, 0.35, 0.5), 0.15); // drive: a fuller ring next to the strike
    },
  },

  // The shining sword strikes Grelok: magic swelling up, then a huge burst with fire, rumble and a long tail.
  explosion: {
    peak: 0.95,
    make: (r) => {
      const out = silence(2.6);
      // the swell: a rising FM shimmer
      const rise = 0.35;
      mix(out, fm(rise, glide(300, 1500, rise), 2.01, glide(1, 6, rise), (t) => (t / rise) ** 2), 0, 0.35);
      mix(out, filter(noise(rise, (t) => (t / rise) ** 3, r), 'band', glide(1000, 6000, rise), 3), 0, 0.3);
      // the blast
      const boom = rise;
      const body = filter(noise(2.2, hit(0.005, 1.5), r), 'low', glide(5000, 150, 1.2), 0.9);
      mix(out, body, boom, 1.4);
      mix(out, tone(1.4, glide(70, 28, 0.8), hit(0.003, 1.1)), boom, 1.5);
      mix(out, filter(crackle(2, (t) => 900 * Math.exp(-1.8 * t), decay(1.6), r), 'band', 2500, 0.8), boom + 0.05, 0.5);
      return fadeOut(room(drive(out, 2), 0.75, 0.3, 0.9), 0.4);
    },
  },
};

// --- writing -------------------------------------------------------------------------------------------------------

const hash = (text: string): number => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const args = process.argv.slice(2);
const spectrum = args.includes('--spectrum');
const wanted = args.filter((a) => !a.startsWith('--'));
const unknown = wanted.filter((n) => !(n in RECIPES));
if (unknown.length > 0) {
  console.error(`No recipe for: ${unknown.join(', ')}. Known: ${Object.keys(RECIPES).join(', ')}`);
  process.exit(1);
}

for (const [name, recipe] of Object.entries(RECIPES)) {
  if (wanted.length > 0 && !wanted.includes(name)) continue;
  const relative = sfxPath(name);
  const file = path.join(GAMES_DIR, 'grelok', 'assets', relative);
  const wav = toWav(dcBlock(recipe.make(makeRandom(hash(name)))), recipe.peak);
  fs.writeFileSync(file, wav);
  console.log(`wrote ${relative}  ${((wav.length - 44) / 2 / RATE).toFixed(2)} s, ${(wav.length / 1024).toFixed(0)} KB`);
  if (spectrum) {
    const dir = path.resolve(import.meta.dirname, '..', 'test-results', 'sfx');
    fs.mkdirSync(dir, { recursive: true });
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-lavfi', 'showspectrumpic=s=800x300:legend=1:scale=log', path.join(dir, `${name}.png`)]);
  }
}
