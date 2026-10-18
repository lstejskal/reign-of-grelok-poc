import { expect, test } from '@playwright/test';

test('boots into the room scene with a 320x200 canvas and no errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && problems.push(msg.text()));
  page.on('pageerror', (err) => problems.push(err.message));

  await page.goto('/');
  const canvas = page.locator('#game canvas');
  await expect(canvas).toHaveCount(1);

  // Logical resolution is fixed; the on-screen size is an integer multiple of it.
  expect(await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([320, 200]);
  // BootScene loads the data and pictures, then hands over to RoomScene
  await expect.poll(() => page.evaluate(() => (window as any).__adv.scene)).toBe('RoomScene');
  const zoom: number = await page.evaluate(() => (window as any).__adv.zoom);
  const box = await canvas.boundingBox();
  expect(box!.width).toBe(320 * zoom);
  expect(box!.height).toBe(200 * zoom);

  await page.screenshot({ path: 'tests/e2e/screenshots/boot.png' });
  expect(problems).toEqual([]);
});
