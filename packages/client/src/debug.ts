import type Phaser from 'phaser';

/** Dev hook so Playwright (and you, in DevTools) can inspect the game: `window.__adv`. */
export function installDebugHook(game: Phaser.Game): void {
  (window as unknown as { __adv: unknown }).__adv = {
    game,
    get scene(): string {
      return game.scene.getScenes(true)[0]?.scene.key ?? '';
    },
    get zoom(): number {
      return game.scale.zoom;
    },
  };
}
