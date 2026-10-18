// Vite turns every game picture into a URL the browser can fetch (and fingerprints it in production builds).
const urls = import.meta.glob('../../../../games/*/assets/**/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** URL of `assetPath` (relative to the game's assets/ folder), or undefined if there is no such file. */
export function assetUrl(gameId: string, assetPath: string): string | undefined {
  const suffix = `games/${gameId}/assets/${assetPath}`;
  const key = Object.keys(urls).find((k) => k.endsWith(suffix));
  return key === undefined ? undefined : urls[key];
}

/** Phaser texture key for a game asset. */
export const textureKey = (assetPath: string): string => `asset:${assetPath}`;
