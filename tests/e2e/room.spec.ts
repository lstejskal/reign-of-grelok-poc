import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __adv: any;
  }
}

const walkthrough = fs
  .readFileSync('games/grelok/walkthrough.txt', 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('RoomScene');
});

test('shows the background of the current location and changes it when the player moves', async ({ page }) => {
  // every scene background was loaded into Phaser's texture manager (not just queued)
  for (const key of ['plain', 'mountain', 'town', 'swamp', 'chapel', 'chapel_interior']) {
    expect(await page.evaluate((k) => window.__adv.game.textures.exists(`asset:backgrounds/${k}.png`), key)).toBe(true);
  }

  // backgroundKey is the texture the image on screen really uses
  expect(await page.evaluate(() => window.__adv.backgroundKey)).toBe('asset:backgrounds/plain.png');
  await page.screenshot({ path: 'tests/e2e/screenshots/room-plain.png' });

  await page.evaluate(() => window.__adv.session.performText('north'));
  expect(await page.evaluate(() => window.__adv.backgroundKey)).toBe('asset:backgrounds/mountain.png');
  await page.screenshot({ path: 'tests/e2e/screenshots/room-mountain.png' });
});

test('the whole game can be played from the debug console, from the first move to THE END', async ({ page }) => {
  const consoleLog = page.locator('#debug-console-log');
  await expect(page.locator('#debug-console')).toBeHidden();

  await page.keyboard.press('Slash'); // open
  await expect(page.locator('#debug-console')).toBeVisible();
  await expect(consoleLog).toContainText('There is standing stone and pebble');

  for (const line of walkthrough) {
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
  }

  await expect(consoleLog).toContainText('THE END');
  expect(await page.evaluate(() => window.__adv.engine.state.over)).toBe(true);
  expect(await page.evaluate(() => window.__adv.backgroundKey)).toBe('asset:backgrounds/mountain.png');
  await page.screenshot({ path: 'tests/e2e/screenshots/console-the-end.png' });

  await page.keyboard.press('Slash'); // close
  await expect(page.locator('#debug-console')).toBeHidden();
});

test('the console opens with "/" and also closes with Escape', async ({ page }) => {
  await page.keyboard.press('Slash');
  await expect(page.locator('#debug-console')).toBeVisible();
  await expect(page.locator('#debug-console-input')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#debug-console')).toBeHidden();
});

// --- Step 5: hover and hotspots ---------------------------------------------------------------

/** Move the real mouse to game pixel (x, y): canvas position on the page + game pixel * zoom. */
async function moveMouseTo(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom: number = await page.evaluate(() => window.__adv.zoom);
  await page.mouse.move(box.x + (x + 0.5) * zoom, box.y + (y + 0.5) * zoom);
}

test('pointing at a thing shows its name in the sentence line', async ({ page }) => {
  await moveMouseTo(page, 160, 60); // inside the standing stone
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('standing stone');

  await moveMouseTo(page, 66, 116); // the pebble
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('pebble');

  await moveMouseTo(page, 10, 10); // empty sky
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('');

  await moveMouseTo(page, 160, 170); // the UI strip is never a hotspot
  await expect.poll(() => page.evaluate(() => window.__adv.hovered)).toBeUndefined();
});

test('hidden things cannot be pointed at until the engine reveals them', async ({ page }) => {
  await page.evaluate(() => window.__adv.session.performText('north'));
  await moveMouseTo(page, 75, 112); // the gemstone sits on top of the rubble
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('rubble');

  await page.evaluate(() => window.__adv.session.performText('look at rubble')); // reveals the gemstone
  // the mouse did not move, but the sentence line follows the world
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('gemstone');
});

test('F1 toggles the outline overlay', async ({ page }) => {
  expect(await page.evaluate(() => window.__adv.overlayVisible)).toBe(false);
  await page.keyboard.press('F1');
  expect(await page.evaluate(() => window.__adv.overlayVisible)).toBe(true);
  await moveMouseTo(page, 160, 60);
  await page.screenshot({ path: 'tests/e2e/screenshots/room-outlines.png' });
  await page.keyboard.press('F1');
  expect(await page.evaluate(() => window.__adv.overlayVisible)).toBe(false);
});
