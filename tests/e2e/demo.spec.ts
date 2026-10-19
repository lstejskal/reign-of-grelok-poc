import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Verb } from '@grelok/engine';
import { verbRect } from '../../packages/client/src/ui/layout';
import { load as parseYaml } from 'js-yaml';
import { slotRect } from '../../packages/client/src/ui/inventory';

// The demo lists its own four verbs in game.yml.
const VERBS = (parseYaml(fs.readFileSync('games/demo/game.yml', 'utf8')) as { verbs: { verb: string }[] }).verbs;

// Step 14: a second, different game on the same engine and client. Nothing in packages/ knows about it.

declare global {
  interface Window {
    __adv: any;
  }
}

const spriteIds = (page: Page) => page.evaluate(() => window.__adv.sprites.map((s: { id: string }) => s.id) as string[]);

async function clickAt(page: Page, x: number, y: number, clickCount = 1): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom: number = await page.evaluate(() => window.__adv.zoom);
  await page.mouse.click(box.x + (x + 0.5) * zoom, box.y + (y + 0.5) * zoom, { clickCount });
}

async function clickVerb(page: Page, verb: Verb): Promise<void> {
  const r = verbRect(VERBS.findIndex((v) => v.verb === verb));
  await clickAt(page, r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
}

async function clickInventoryItem(page: Page, alias: string): Promise<void> {
  const slot: number = await page.evaluate((a) => window.__adv.inventory.indexOf(a), alias);
  expect(slot).toBeGreaterThanOrEqual(0);
  const r = slotRect(slot);
  await clickAt(page, r.x + 12, r.y + 8);
}

const answer = (page: Page) => page.evaluate(() => window.__adv.answer as string);

/** Wait for the answer to contain `text`, then click it away so the next click reaches the scene. */
async function expectAnswer(page: Page, text: string): Promise<void> {
  await expect.poll(() => answer(page), { timeout: 15_000 }).toContain(text);
  for (let i = 0; i < 10 && (await answer(page)) !== ''; i++) await clickAt(page, 200, 5);
}

test('?game=demo boots a different game: its own title, start location and things', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (err) => problems.push(err.message));
  await page.goto('/?game=demo');
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('TitleScene');
  expect(await page.evaluate(() => window.__adv.bundle.config.title)).toBe('The Rusty Gate');
  await page.screenshot({ path: 'tests/e2e/screenshots/demo-title.png' });

  // its saves are its own: a grelok save does not show up here
  expect(((await page.evaluate(() => window.__adv.menu.items)) as { label: string; enabled: boolean }[]).find((i) => i.label === 'Continue')!.enabled).toBe(false);

  const newGame = (await page.evaluate(() => window.__adv.menu.items))[0];
  await clickAt(page, newGame.x + 20, newGame.y + 4);
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('RoomScene');
  expect(await page.evaluate(() => window.__adv.engine.state.location)).toBe('lane');
  expect(await page.evaluate(() => window.__adv.engine.visibleThings())).toEqual(['haystack', 'oil_can', 'gate']);
  expect(problems).toEqual([]);
});

test('the whole demo can be solved with the mouse, ending on its own end screen', async ({ page }) => {
  await page.goto('/?game=demo&title=off');
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('RoomScene');
  await page.evaluate(() => (window.__adv.speedFactor = 10));

  // the gate is locked at first
  await clickAt(page, 308, 80, 2); // double-click the exit: go at once
  await expectAnswer(page, 'The gate is locked.');

  await clickVerb(page, 'look_at');
  await clickAt(page, 30, 80); // the haystack
  await expectAnswer(page, 'find a key');
  expect(await spriteIds(page)).toContain('key');

  await clickVerb(page, 'pick_up');
  await clickAt(page, 50, 104); // the key, in the haystack
  await expect.poll(() => page.evaluate(() => window.__adv.inventory)).toContain('key');
  await clickVerb(page, 'pick_up');
  await clickAt(page, 156, 88); // the oil can
  await expect.poll(() => page.evaluate(() => window.__adv.inventory)).toContain('oil_can');

  // Use key with gate: too rusty
  await clickVerb(page, 'use');
  await clickInventoryItem(page, 'key');
  await clickAt(page, 262, 70);
  await expectAnswer(page, 'rusted solid');

  // oil it, then the key works
  await clickVerb(page, 'use');
  await clickInventoryItem(page, 'oil_can');
  await clickAt(page, 262, 70);
  await expectAnswer(page, 'oil the lock');
  await clickVerb(page, 'use');
  await clickInventoryItem(page, 'key');
  await clickAt(page, 262, 70);
  await expectAnswer(page, 'creaks open');
  expect(await spriteIds(page)).toContain('gate_open');
  await page.screenshot({ path: 'tests/e2e/screenshots/demo-lane-open.png' });

  await clickAt(page, 308, 80, 2);
  await expect.poll(() => page.evaluate(() => window.__adv.engine.state.location), { timeout: 15_000 }).toBe('orchard');
  await expect.poll(() => page.evaluate(() => window.__adv.transitioning)).toBe(false);
  await expectAnswer(page, ''); // (nothing to read: moving by mouse does not describe the room)

  await clickVerb(page, 'push');
  await clickAt(page, 160, 90); // the goat
  await expect.poll(() => page.evaluate(() => window.__adv.cutscene.running), { timeout: 15_000 }).toBe(true);
  await expect
    .poll(
      async () => {
        if ((await answer(page)) !== '') await clickAt(page, 200, 5);
        return page.evaluate(() => window.__adv.cutscene.ended);
      },
      { timeout: 30_000, intervals: [100] },
    )
    .toBe(true);
  expect(await page.evaluate(() => window.__adv.cutscene.endLines)).toContain('The Rusty Gate');
  expect(await page.evaluate(() => window.__adv.cutscene.audio)).toEqual(['sfx goat_bleat']);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/e2e/screenshots/demo-the-end.png' });
});

test('the demo walkthrough also plays from the debug console', async ({ page }) => {
  await page.goto('/?game=demo&title=off');
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('RoomScene');
  const lines = fs.readFileSync('games/demo/walkthrough.txt', 'utf8').split('\n').filter((l) => l.trim() !== '');
  await page.keyboard.press('Slash');
  for (const line of lines) {
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('#debug-console-log')).toContainText('THE END');
  expect(await page.evaluate(() => window.__adv.engine.state.over)).toBe(true);
});
