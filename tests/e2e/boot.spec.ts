import { expect, test } from '@playwright/test';

test('boots into the title screen with a 640x400 canvas (320x200 game, art at 2x) and no errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && problems.push(msg.text()));
  page.on('pageerror', (err) => problems.push(err.message));

  await page.goto('/');
  const canvas = page.locator('#game canvas');
  await expect(canvas).toHaveCount(1);

  // The game is 320x200; the canvas has 2 pixels per game pixel (art detail); the on-screen size is an integer multiple of that.
  expect(await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([640, 400]);
  // BootScene loads the data and pictures, then hands over to the title screen
  await expect.poll(() => page.evaluate(() => (window as any).__adv.scene)).toBe('TitleScene');
  const zoom: number = await page.evaluate(() => (window as any).__adv.zoom);
  const box = await canvas.boundingBox();
  expect(box!.width).toBe(320 * zoom);
  expect(box!.height).toBe(200 * zoom);

  await page.screenshot({ path: 'tests/e2e/screenshots/boot.png' });
  expect(problems).toEqual([]);
});

test('?title=off skips the title screen', async ({ page }) => {
  await page.goto('/?title=off');
  await expect.poll(() => page.evaluate(() => (window as any).__adv.scene)).toBe('RoomScene');
});
