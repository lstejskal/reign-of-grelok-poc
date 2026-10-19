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

// Sounds: assets/music/*.mp3 and assets/sfx/*.wav (any of wav / mp3 / ogg is picked up).
const sounds = import.meta.glob('../../../../games/*/assets/{music,sfx}/*.{mp3,wav,ogg}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Every sound file of a game: its path inside assets/ ("sfx/clang.wav") and the URL to fetch it from. */
export function soundAssets(gameId: string): { path: string; url: string }[] {
  const prefix = `games/${gameId}/assets/`;
  return Object.entries(sounds).flatMap(([key, url]) => {
    const at = key.indexOf(prefix);
    return at < 0 ? [] : [{ path: key.slice(at + prefix.length), url }];
  });
}
