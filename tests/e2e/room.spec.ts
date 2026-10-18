import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Verb } from '@grelok/engine';
import { verbRect } from '../../packages/client/src/ui/layout';
import { VERBS } from '../../packages/client/src/ui/verbs';
import { slotRect } from '../../packages/client/src/ui/inventory';

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

// --- Step 6: verbs and the sentence builder -----------------------------------------------------

/** Click game pixel (x, y) with the given mouse button. */
async function clickAt(page: Page, x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom: number = await page.evaluate(() => window.__adv.zoom);
  await page.mouse.click(box.x + (x + 0.5) * zoom, box.y + (y + 0.5) * zoom, { button });
}

/** Click the middle of a verb button. */
async function clickVerb(page: Page, verb: Verb): Promise<void> {
  const i = VERBS.findIndex((v) => v.verb === verb);
  const r = verbRect(i);
  await clickAt(page, r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
}

const sentence = (page: Page) => page.evaluate(() => window.__adv.sentence);

test('Look at + thing: the engine answers in the text box', async ({ page }) => {
  await clickVerb(page, 'look_at');
  expect(await sentence(page)).toBe('Look at');
  await moveMouseTo(page, 160, 60);
  await expect.poll(() => sentence(page)).toBe('Look at standing stone');

  await clickAt(page, 160, 60);
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toContain('menhir');
  expect(await page.evaluate(() => window.__adv.verb)).toBeUndefined(); // sentence is finished
  await page.screenshot({ path: 'tests/e2e/screenshots/room-look-at.png' });
});

test('right-click looks at a thing without choosing a verb', async ({ page }) => {
  await clickAt(page, 66, 116, 'right'); // pebble
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toContain('pebble');
});

test('"Pick up" really changes the world; the thing is then gone from the room', async ({ page }) => {
  await clickVerb(page, 'pick_up');
  await clickAt(page, 66, 116);
  await expect.poll(() => page.evaluate(() => window.__adv.engine.state.inventory)).toContain('pebble');
  await moveMouseTo(page, 66, 116);
  await expect.poll(() => page.evaluate(() => window.__adv.hovered)).toBeUndefined();
});

test('"Use" builds a two-object sentence; Escape cancels it', async ({ page }) => {
  await clickVerb(page, 'use');
  await clickAt(page, 66, 116); // pebble
  await moveMouseTo(page, 160, 60);
  await expect.poll(() => sentence(page)).toBe('Use pebble with standing stone');

  await page.keyboard.press('Escape');
  await expect.poll(() => sentence(page)).toBe('standing stone');
  expect(await page.evaluate(() => window.__adv.verb)).toBeUndefined();

  // and finishing the sentence sends the command to the engine
  await clickVerb(page, 'use');
  await clickAt(page, 66, 116);
  await clickAt(page, 160, 60);
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).not.toBe('');
});

test('a long answer is shown a page at a time', async ({ page }) => {
  await page.evaluate(() => window.__adv.session.performText('north'));
  await page.evaluate(() => window.__adv.session.performText('look')); // the long room description
  const first = await page.evaluate(() => window.__adv.answer);
  expect(first.split('\n').length).toBeLessThanOrEqual(4);
  expect(first.split('\n').every((l: string) => l.length <= 52)).toBe(true);

  await clickAt(page, 200, 10); // on the answer band
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).not.toBe(first);
});

// --- Step 7: inventory --------------------------------------------------------------------------

/** Click the answer band until the text is gone (clicks on the band read on, they do not reach the scene). */
async function dismissAnswer(page: Page): Promise<void> {
  for (let i = 0; i < 20 && (await page.evaluate(() => window.__adv.answer)) !== ''; i++) await clickAt(page, 200, 10);
  expect(await page.evaluate(() => window.__adv.answer)).toBe('');
}

/** Click the middle of the inventory slot that shows `alias`. */
async function clickInventoryItem(page: Page, alias: string, button: 'left' | 'right' = 'left'): Promise<void> {
  const slot: number = await page.evaluate((a) => window.__adv.inventory.indexOf(a), alias);
  expect(slot).toBeGreaterThanOrEqual(0);
  const r = slotRect(slot);
  await clickAt(page, r.x + 12, r.y + 8, button);
}

test('the inventory shows what the engine says you carry, with an icon texture for each item', async ({ page }) => {
  expect(await page.evaluate(() => window.__adv.inventory)).toEqual(['rusty_sword']);
  for (const alias of ['rusty_sword', 'pebble', 'gemstone', 'jug']) {
    expect(await page.evaluate((a) => window.__adv.game.textures.exists(`asset:icons/${a}.png`), alias)).toBe(true);
  }

  await clickVerb(page, 'pick_up');
  await clickAt(page, 66, 116); // the pebble
  await expect.poll(() => page.evaluate(() => window.__adv.inventory)).toEqual(['rusty_sword', 'pebble']);
  await page.screenshot({ path: 'tests/e2e/screenshots/room-inventory.png' });
});

test('inventory items can be pointed at, looked at, and used in sentences', async ({ page }) => {
  await page.evaluate(() => window.__adv.session.performText('take pebble'));
  const slot = await page.evaluate(() => window.__adv.inventory.indexOf('pebble'));
  const r = slotRect(slot);
  await moveMouseTo(page, r.x + 12, r.y + 8);
  await expect.poll(() => sentence(page)).toBe('pebble');

  await clickAt(page, r.x + 12, r.y + 8, 'right'); // right-click = look at
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toContain('pebble');

  await page.keyboard.press('Escape'); // (nothing pending, harmless)
  await clickVerb(page, 'use');
  await clickInventoryItem(page, 'pebble');
  await moveMouseTo(page, 160, 60);
  await expect.poll(() => sentence(page)).toBe('Use pebble with standing stone');
});

test('Give gemstone to wizard takes the gemstone out of the inventory', async ({ page }) => {
  const say = (line: string) => page.evaluate((l) => window.__adv.session.performText(l), line);
  await say('north');
  await say('look at rubble'); // reveals the gemstone
  await clickVerb(page, 'pick_up');
  await clickAt(page, 75, 112);
  await expect.poll(() => page.evaluate(() => window.__adv.inventory)).toContain('gemstone');

  await say('south');
  await say('west'); // the swamp, where the wizard lives
  await dismissAnswer(page); // the room description covers the top of the scene, where the wizard stands
  await clickVerb(page, 'give');
  await clickInventoryItem(page, 'gemstone');
  await moveMouseTo(page, 160, 20);
  await expect.poll(() => sentence(page)).toBe('Give gemstone to wizard');
  await clickAt(page, 160, 20);

  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toContain('Eye of Grub');
  expect(await page.evaluate(() => window.__adv.inventory)).not.toContain('gemstone');
});
