import { expect, test } from '@playwright/test';

// Step 16: a picture that went through the art pipeline (art/raw -> npm run import-art) shows up in the game.

declare global {
  interface Window {
    __adv: any;
  }
}

test('the imported standing stone is drawn in the plain, with Grognak (imported sheet) walking in front of it', async ({ page }) => {
  await page.goto('/?title=off');
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('RoomScene');

  const sprites: { id: string; image: string; y: number }[] = await page.evaluate(() => window.__adv.sprites);
  const stone = sprites.find((s) => s.id === 'standing_stone');
  expect(stone?.image).toBe('sprites/standing_stone.png');
  expect(await page.evaluate(() => window.__adv.game.textures.get('asset:sprites/standing_stone.png').getSourceImage().height)).toBe(140); // 40x70 on screen, art at 2 picture pixels per scene pixel
  // the player sheet is as wide as game.yml says: `columns` frames of frameWidth x frameHeight (3 for the original layout)
  const { columns, frameWidth } = await page.evaluate(() => ({ columns: window.__adv.bundle.config.player.columns ?? 3, frameWidth: window.__adv.bundle.config.player.frameWidth }));
  expect(await page.evaluate(() => window.__adv.game.textures.get('asset:sprites/grognak.png').getSourceImage().width)).toBe(frameWidth * columns);

  await page.screenshot({ path: 'tests/e2e/screenshots/art-imported.png' });
});
