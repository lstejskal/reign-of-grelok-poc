import { describe, expect, it } from 'vitest';
import type { PlayerConfig } from '@grelok/engine';
import { REACH_FRAME_MS, REACH_HOLD_MS, TALK_FRAME_MS, playerFrame, quantizeScale, reachTiming } from './playerAnimation';

const legacy: PlayerConfig = { sprite: 's.png', frameWidth: 64, frameHeight: 96 };
const full: PlayerConfig = {
  ...legacy,
  columns: 6,
  walkStride: 60,
  animations: {
    walk_e: [0, 1, 2, 3, 4, 5],
    walk_s: [6, 7, 8, 9],
    walk_n: [12, 13, 14, 15],
    idle_s: [18], idle_n: [19], idle_e: [20],
    talk_s: [24, 25], talk_e: [26, 27],
    reach_e: [30, 31], reach_s: [32], reach_n: [33],
  },
};
const still = { walking: false, walked: 0, scale: 1 };

describe('playerFrame', () => {
  it('the original 3x4 sheet: stride, together (lifted), other stride, together; west has its own row', () => {
    const frames = [0, 6, 12, 18].map((walked) => playerFrame(legacy, { facing: 'e', walking: true, walked, scale: 1 }));
    expect(frames.map((f) => f.frame)).toEqual([7, 6, 8, 6]);
    expect(frames.map((f) => f.lift)).toEqual([0, 1, 0, 1]);
    expect(playerFrame(legacy, { facing: 'w', ...still })).toEqual({ frame: 9, flipX: false, lift: 0, anim: 'idle_w' });
  });

  it('walks one whole cycle per walkStride pixels, shorter in the distance', () => {
    const at = (walked: number, scale = 1) => playerFrame(full, { facing: 'e', walking: true, walked, scale }).frame;
    expect([0, 10, 20, 30, 40, 50, 60].map((w) => at(w))).toEqual([0, 1, 2, 3, 4, 5, 0]);
    expect(at(10, 0.5)).toBe(2); // at half size a step is half as long
  });

  it('mirrors east for west', () => {
    expect(playerFrame(full, { facing: 'w', walking: true, walked: 10, scale: 1 })).toEqual({ frame: 1, flipX: true, lift: 0, anim: 'walk_e' });
  });

  it('talks while standing, alternating frames; talking facing north falls back to idle', () => {
    const talk = (ms: number) => playerFrame(full, { facing: 's', ...still, talkingMs: ms }).frame;
    expect([0, TALK_FRAME_MS, 2 * TALK_FRAME_MS].map(talk)).toEqual([24, 25, 24]);
    expect(playerFrame(full, { facing: 'n', ...still, talkingMs: 0 }).anim).toBe('idle_n');
    expect(playerFrame(full, { facing: 'w', ...still, talkingMs: 0 })).toMatchObject({ frame: 26, flipX: true });
  });

  it('reaching wins over talking, and holds its last frame', () => {
    const reach = (ms: number) => playerFrame(full, { facing: 'e', ...still, talkingMs: 0, reachMs: ms }).frame;
    expect([0, REACH_FRAME_MS, 5000].map(reach)).toEqual([30, 31, 31]);
  });

  it('without talk or reach animations (the original sheet) he just stands', () => {
    expect(playerFrame(legacy, { facing: 's', ...still, talkingMs: 500, reachMs: 50 }).anim).toBe('idle_s');
  });
});

describe('reachTiming', () => {
  it('acts when the hand is out; no reach animation = act at once', () => {
    expect(reachTiming(full, 'e')).toEqual({ handOutMs: REACH_FRAME_MS, totalMs: REACH_FRAME_MS + REACH_HOLD_MS });
    expect(reachTiming(full, 's')).toEqual({ handOutMs: 0, totalMs: REACH_HOLD_MS });
    expect(reachTiming(legacy, 'e')).toEqual({ handOutMs: 0, totalMs: 0 });
  });
});

describe('quantizeScale', () => {
  it('rounds to steps of 5%', () => {
    const expected = [0.6, 0.6, 0.65, 0.85, 1];
    [0.6, 0.61, 0.63, 0.874, 1].forEach((s, i) => expect(quantizeScale(s)).toBeCloseTo(expected[i]!));
  });
});
