import { expect, test } from '@playwright/test';

// `window.__adv` is the debug hook installed by the game (see packages/client/src/debug.ts).
// Note: code inside page.evaluate() runs in the browser, so it cannot use helpers defined in this file.
declare global {
  interface Window {
    __adv: any;
  }
}

test('loads the grelok data and starts the engine at the start location', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && problems.push(msg.text()));
  page.on('pageerror', (err) => problems.push(err.message));

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__adv.engine?.state.location)).toBe('plain');

  expect(await page.evaluate(() => window.__adv.bundle.id)).toBe('grelok');
  expect(await page.evaluate(() => window.__adv.bundle.config.title)).toBe('Reign of Grelok');
  expect(await page.evaluate(() => Object.keys(window.__adv.bundle.scenes).sort())).toEqual(
    ['chapel', 'chapel_interior', 'mountain', 'plain', 'swamp', 'town'],
  );
  expect(await page.evaluate(() => window.__adv.engine.visibleThings())).toEqual(['standing_stone', 'pebble']);

  expect(problems).toEqual([]);
});

test('an unknown game shows an error on screen instead of crashing', async ({ page }) => {
  await page.goto('/?game=nope');
  await expect.poll(() => page.evaluate(() => window.__adv.error)).toContain('nope');
  expect(await page.evaluate(() => window.__adv.engine)).toBeUndefined();

  await page.screenshot({ path: 'tests/e2e/screenshots/data-error.png' });
});
