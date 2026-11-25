// Turns music files (audio/raw/) into game-ready loops (games/<game>/assets/music/), with ffmpeg:
//   npm run import-audio                 every track in audio/tracks.yml whose original exists
//   npm run import-audio -- intro        just these
//
// For each track:
//   1. trim silence at the start and the end, make it as loud as the others (EBU R128 loudness), 44.1 kHz stereo
//   2. fold the last `crossfade` seconds over the first ones: the start of the file is the end of the song fading out
//      while its beginning fades in. Played in a loop, the end of the file then runs straight into its start: no jump.
//   3. encode a smaller mp3 (`bitrate`)
// ffmpeg is found on the PATH, in FFMPEG_DIR, or (Windows) where winget installs it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
interface Track { raw: string; out: string; crossfade?: number }
interface Config { game: string; bitrate: string; loudness: number; tracks: Record<string, Track> }

const config = parseYaml(fs.readFileSync(path.join(ROOT, 'audio/tracks.yml'), 'utf8')) as Config;

/** The folder with ffmpeg and ffprobe, or '' when they are on the PATH. */
function ffmpegDir(): string {
    if (process.env.FFMPEG_DIR) return process.env.FFMPEG_DIR;
    try {
        execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
        return '';
    } catch {
        const winget = path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages');
        const pkg = fs.existsSync(winget) ? fs.readdirSync(winget).find((d) => d.startsWith('Gyan.FFmpeg')) : undefined;
        const build = pkg && fs.readdirSync(path.join(winget, pkg)).find((d) => d.startsWith('ffmpeg-'));
        if (build) return path.join(winget, pkg, build, 'bin');
        throw new Error('ffmpeg not found: install it (winget install Gyan.FFmpeg) or set FFMPEG_DIR');
    }
}
const dir = ffmpegDir();
const tool = (name: string) => (dir ? path.join(dir, name) : name);
const run = (name: string, args: string[]) => execFileSync(tool(name), args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function duration(file: string): number {
    return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).trim());
}

function importTrack(id: string, track: Track): string {
    const raw = path.join(ROOT, track.raw);
    if (!fs.existsSync(raw)) throw new Error(`${id}: missing ${track.raw}`);
    const out = path.join(ROOT, 'games', config.game, 'assets', track.out);
    const clean = path.join(os.tmpdir(), `grelok-${id}-clean.wav`);

    // 1. silence off both ends (reverse, trim the start, reverse back), even loudness, one sample rate
    const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1';
    run('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', `${trim},areverse,${trim},areverse,loudnorm=I=${config.loudness}:TP=-1.5:LRA=11,aresample=44100`, '-ac', '2', clean]);
    const length = duration(clean);

    // 2. the loop seam: [end fading out + start fading in] + the middle. Its length is the song minus the crossfade.
    const x = Math.min(track.crossfade ?? 0, length / 4);
    const loop = x > 0
        ? `[0:a]asplit=3[a][b][c];` +
          `[a]atrim=0:${x},asetpts=PTS-STARTPTS,afade=t=in:d=${x}:curve=qsin[head];` +
          `[b]atrim=start=${length - x},asetpts=PTS-STARTPTS,afade=t=out:d=${x}:curve=qsin[tail];` +
          `[head][tail]amix=inputs=2:normalize=0[seam];` +
          `[c]atrim=${x}:${length - x},asetpts=PTS-STARTPTS[middle];` +
          `[seam][middle]concat=n=2:v=0:a=1[out]`
        : '[0:a]anull[out]';

    // 3. a smaller mp3
    fs.mkdirSync(path.dirname(out), { recursive: true });
    run('ffmpeg', ['-y', '-v', 'error', '-i', clean, '-filter_complex', loop, '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', config.bitrate, out]);
    fs.rmSync(clean);

    const mb = (file: string) => (fs.statSync(file).size / 1e6).toFixed(1);
    return `${id}: ${duration(raw).toFixed(0)} s, ${mb(raw)} MB -> ${duration(out).toFixed(0)} s loop, ${mb(out)} MB  games/${config.game}/assets/${track.out}`;
}

const ids = process.argv.slice(2);
for (const id of ids) if (!(id in config.tracks)) throw new Error(`No track "${id}" in audio/tracks.yml`);
const chosen = Object.entries(config.tracks).filter(([id, t]) => (ids.length > 0 ? ids.includes(id) : fs.existsSync(path.join(ROOT, t.raw))));
if (chosen.length === 0) console.log('Nothing to import: put the originals in audio/raw/ (see audio/tracks.yml).');
for (const [id, track] of chosen) console.log(importTrack(id, track));
