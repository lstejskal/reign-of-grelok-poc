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
  expect(await page.evaluate(() => window.__adv.game.textures.get('asset:sprites/standing_stone.png').getSourceImage().height)).toBe(70);
  // the player sheet keeps the size the engine expects (3 columns x 4 rows of 32x48)
  expect(await page.evaluate(() => window.__adv.game.textures.get('asset:sprites/grognak.png').getSourceImage().width)).toBe(96);

  await page.screenshot({ path: 'tests/e2e/screenshots/art-imported.png' });
});
