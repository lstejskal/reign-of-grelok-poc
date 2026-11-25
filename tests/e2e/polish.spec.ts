import { expect, test, type Page } from '@playwright/test';
import type { Verb } from '@grelok/engine';
import { verbRect } from '../../packages/client/src/ui/layout';
import { DEFAULT_VERBS as VERBS } from '../../packages/engine/src/sceneTypes';
import { slotRect } from '../../packages/client/src/ui/inventory';

// Step 19: polish. The whole game played with the mouse only, plus the smaller comforts (keys, skipping, settings).

declare global {
  interface Window {
    __adv: any;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?title=off');
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('RoomScene');
  await page.evaluate(() => (window.__adv.speedFactor = 10));
});

async function clickAt(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom: number = await page.evaluate(() => window.__adv.zoom);
  await page.mouse.click(box.x + (x + 0.5) * zoom, box.y + (y + 0.5) * zoom);
}

async function moveTo(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom: number = await page.evaluate(() => window.__adv.zoom);
  await page.mouse.move(box.x + (x + 0.5) * zoom, box.y + (y + 0.5) * zoom);
}

async function clickVerb(page: Page, verb: Verb): Promise<void> {
  const r = verbRect(VERBS.findIndex((v) => v.verb === verb));
  await clickAt(page, r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
}

async function clickItem(page: Page, alias: string): Promise<void> {
  const slot: number = await page.evaluate((a) => window.__adv.inventory.indexOf(a), alias);
  expect(slot, `${alias} in the inventory`).toBeGreaterThanOrEqual(0);
  const r = slotRect(slot);
  await clickAt(page, r.x + 12, r.y + 8);
}

/** Wait until the game is idle again, reading every text and speech away with clicks, as a player would. */
async function readOn(page: Page): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const s = await page.evaluate(() => ({
      answer: window.__adv.answer as string,
      speech: Boolean(window.__adv.speech),
      busy: Boolean(window.__adv.cutscene.running || window.__adv.transitioning || window.__adv.player.walking),
    }));
    if (s.answer !== '') await clickAt(page, 200, 5); // the text box at the top: read on
    else if (s.speech) await clickAt(page, 290, 140); // a spoken line: skip it
    else if (!s.busy) return;
    await page.waitForTimeout(50);
  }
  throw new Error('the game did not become idle');
}

const location = (page: Page) => page.evaluate(() => window.__adv.engine.state.location);
const inventory = (page: Page) => page.evaluate(() => window.__adv.engine.state.inventory);

test('the whole game can be played with the mouse alone, from the plain to THE END', async ({ page }) => {
  test.setTimeout(120_000);
  await readOn(page);
  // plain -> mountain: the mountains on the horizon
  await clickAt(page, 110, 50);
  await expect.poll(() => location(page)).toBe('mountain');
  await readOn(page);
  // look at the rubble, take the gemstone that shows up
  await clickVerb(page, 'look_at');
  await clickAt(page, 50, 115);
  await readOn(page);
  await clickVerb(page, 'pick_up');
  await clickAt(page, 75, 106);
  await expect.poll(() => inventory(page)).toContain('gemstone');
  await readOn(page);
  // back south, then west to the swamp
  await clickAt(page, 160, 138);
  await expect.poll(() => location(page)).toBe('plain');
  await readOn(page);
  await clickAt(page, 8, 110);
  await expect.poll(() => location(page)).toBe('swamp');
  await readOn(page);
  // give the gemstone to the wizard; pick up the shards he leaves on the shore
  await clickVerb(page, 'give');
  await clickItem(page, 'gemstone');
  await clickAt(page, 108, 58);
  await readOn(page);
  await clickVerb(page, 'pick_up');
  await clickAt(page, 135, 133);
  await expect.poll(() => inventory(page)).toContain('gemstone_shards');
  await readOn(page);
  // east to the plain, south to the town; the blacksmith forges the shining sword
  await clickAt(page, 310, 105);
  await expect.poll(() => location(page)).toBe('plain');
  await readOn(page);
  await clickAt(page, 160, 138);
  await expect.poll(() => location(page)).toBe('town');
  await readOn(page);
  await clickVerb(page, 'give');
  await clickItem(page, 'gemstone_shards');
  await clickAt(page, 80, 90);
  await expect.poll(() => inventory(page), { timeout: 20_000 }).toContain('shining_sword');
  await readOn(page);
  // up the street to the plain, north to the mountain, and the final blow
  await clickAt(page, 181, 90);
  await expect.poll(() => location(page)).toBe('plain');
  await readOn(page);
  await clickAt(page, 110, 50);
  await expect.poll(() => location(page)).toBe('mountain');
  await readOn(page);
  await clickVerb(page, 'use');
  await clickItem(page, 'shining_sword');
  await clickAt(page, 228, 60);
  await expect.poll(() => page.evaluate(() => window.__adv.engine.state.over), { timeout: 20_000 }).toBe(true);
  await readOn(page);
  await expect.poll(async () => (await page.evaluate(() => window.__adv.cutscene)).ended).toBe(true);
  await page.screenshot({ path: 'tests/e2e/screenshots/walkthrough-the-end.png' });
});

test('letters choose verbs: L = Look at, S = Push (P is Pick up)', async ({ page }) => {
  await readOn(page);
  await page.keyboard.press('l');
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('Look at');
  await page.keyboard.press('s');
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('Push');
});

test('Esc skips a cutscene: no waiting, but the result is shown and the world has changed', async ({ page }) => {
  await page.evaluate(() => window.__adv.session.performText('east'));
  await readOn(page);
  await page.evaluate(() => (window.__adv.speedFactor = 0.1)); // so slow that watching would take a minute
  await page.evaluate(() => window.__adv.session.performText('use rusty sword on zombie'));
  await expect.poll(() => page.evaluate(() => window.__adv.cutscene.running)).toBe(true);
  const cursor = () => page.evaluate(() => (window.__adv.game.canvas as HTMLCanvasElement).style.cursor);
  await expect.poll(cursor).toBe('progress'); // busy pointer (set on the next frame)
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__adv.answer), { timeout: 3_000 }).toContain('stumbles and falls');
  const zombie = (await page.evaluate(() => window.__adv.sprites)).find((s: { id: string }) => s.id === 'zombie');
  expect(zombie.image).toBe('sprites/zombie_down.png');
  await page.evaluate(() => (window.__adv.speedFactor = 10));
  await readOn(page);
  await expect.poll(cursor).toMatch(/^url\(/); // its own pointer again
});

test('the name of what the mouse points at is shown next to the pointer', async ({ page }) => {
  await readOn(page);
  await moveTo(page, 160, 60);
  const label = () => page.evaluate(() => {
    const text = (window.__adv.game.scene.getScene('RoomScene') as any).cursorLabel[1];
    return text.visible ? text.text : '';
  });
  await expect.poll(label).toBe('STANDING STONE');
  await moveTo(page, 110, 50);
  await expect.poll(label).toBe('MOUNTAIN');
  await moveTo(page, 60, 130); // empty ground
  await expect.poll(label).toBe('');
});

test('the menu offers a text speed, remembered after a reload', async ({ page }) => {
  await readOn(page);
  await page.keyboard.press('Escape'); // nothing to cancel: opens the menu
  const row = async (start: string) => {
    const items: { label: string; x: number; y: number; w: number; h: number }[] = (await page.evaluate(() => window.__adv.menu)).items;
    return items.find((i) => i.label.startsWith(start))!;
  };
  expect((await row('Text speed')).label).toBe('Text speed: NORMAL');
  const r = await row('Text speed');
  await clickAt(page, Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2));
  await expect.poll(async () => (await row('Text speed')).label).toBe('Text speed: FAST');
  expect((await row('Fullscreen')).label).toBe('Fullscreen: OFF');
  expect(await page.evaluate(() => localStorage.getItem('adventure:text-speed'))).toBe('FAST');
});
