import { load as parseYaml } from 'js-yaml';
import { assembleBundle } from '@grelok/engine';
import type { GameBundle } from '@grelok/engine';

// Vite reads every games/*/**/*.yml at build time and gives us their text, keyed by path.
// ("eager" = bundled into the page; fine for small text files.)
const allFiles = import.meta.glob('../../../../games/*/**/*.yml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Which game to play: `?game=demo` in the URL, otherwise grelok. */
export function requestedGameId(search: string = window.location.search): string {
  return new URLSearchParams(search).get('game') ?? 'grelok';
}

export function loadGame(id: string): GameBundle {
  const marker = `games/${id}/`;
  const files: Record<string, string> = {};
  for (const [path, text] of Object.entries(allFiles)) {
    const at = path.indexOf(marker);
    if (at !== -1) files[path.slice(at + marker.length)] = text;
  }

  if (Object.keys(files).length === 0) {
    throw new Error(`No such game: "${id}"`);
  }
  return assembleBundle(id, files, parseYaml);
}
