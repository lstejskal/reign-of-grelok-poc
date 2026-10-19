import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../save/saveGame';
import { DEFAULT_SETTINGS, effectiveVolume, loadSettings, nextVolume, saveSettings, stepLevel, volumeLabel } from './mix';

describe('stepLevel (fades)', () => {
  it('moves towards the target at 1/fadeMs per millisecond and stops exactly on it', () => {
    expect(stepLevel(0, 1, 450, 900)).toBeCloseTo(0.5);
    expect(stepLevel(0.5, 1, 450, 900)).toBe(1);
    expect(stepLevel(0.5, 1, 5000, 900)).toBe(1); // never overshoots
    expect(stepLevel(0.2, 0, 450, 900)).toBe(0);
    expect(stepLevel(1, 0, 450, 900)).toBeCloseTo(0.5);
    expect(stepLevel(0.7, 0.7, 100)).toBe(0.7);
  });
});

describe('volume', () => {
  it('is silent while muted and clamped otherwise', () => {
    expect(effectiveVolume({ volume: 0.6, muted: false })).toBe(0.6);
    expect(effectiveVolume({ volume: 0.6, muted: true })).toBe(0);
    expect(effectiveVolume({ volume: 7, muted: false })).toBe(1);
  });

  it('cycles through the steps and wraps to silence', () => {
    expect(nextVolume(0)).toBe(0.25);
    expect(nextVolume(0.6)).toBe(0.75);
    expect(nextVolume(0.75)).toBe(1);
    expect(nextVolume(1)).toBe(0);
  });

  it('has a label for the menu', () => {
    expect(volumeLabel({ volume: 0.75, muted: false })).toBe('75%');
    expect(volumeLabel({ volume: 0.75, muted: true })).toBe('OFF');
    expect(volumeLabel({ volume: 0, muted: false })).toBe('OFF');
  });
});

describe('settings storage', () => {
  it('round-trips', () => {
    const store = new MemoryStore();
    saveSettings(store, { volume: 0.25, muted: true });
    expect(loadSettings(store)).toEqual({ volume: 0.25, muted: true });
  });

  it('falls back to the defaults for nothing, junk or nonsense', () => {
    const store = new MemoryStore();
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    store.setItem('adventure:audio', 'not json{');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    store.setItem('adventure:audio', JSON.stringify({ volume: 'loud', muted: 'yes' }));
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    store.setItem('adventure:audio', JSON.stringify({ volume: 40 }));
    expect(loadSettings(store).volume).toBe(1);
  });
});
