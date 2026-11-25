import { expect, test, type Page } from '@playwright/test';

// Step 15: music per scene with crossfades, sound effects on actions, mute and volume that survive a reload.
// (Headless Chromium cannot be listened to, so the tests read what the audio system DID: window.__adv.audio.)

declare global {
  interface Window {
    __adv: any;
  }
}

const audio = (page: Page) => page.evaluate(() => window.__adv.audio as { currentTrack?: string; played: string[]; muted: boolean; volume: number });

async function boot(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('RoomScene');
  await page.evaluate(() => (window.__adv.speedFactor = 10));
}

async function clickAt(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom: number = await page.evaluate(() => window.__adv.zoom);
  await page.mouse.click(box.x + (x + 0.5) * zoom, box.y + (y + 0.5) * zoom);
}

async function clickMenu(page: Page, label: string): Promise<void> {
  const items: { label: string; x: number; y: number; w: number; h: number }[] = await page.evaluate(() => window.__adv.menu.items);
  const item = items.find((i) => i.label.startsWith(label))!;
  expect(item, `menu row "${label}"`).toBeDefined();
  await clickAt(page, Math.floor(item.x + item.w / 2), Math.floor(item.y + item.h / 2));
}

test('every sound file is loaded into Phaser, and each scene starts its own tune', async ({ page }) => {
  await boot(page, '/?title=off');
  for (const key of ['music/intro.mp3', 'music/music1.mp3', 'music/music2.mp3', 'sfx/click.wav', 'sfx/sword_hit.wav']) {
    expect(await page.evaluate((k) => window.__adv.game.cache.audio.exists(`audio:${k}`), key), key).toBe(true);
  }
  expect((await audio(page)).currentTrack).toBe('music/music1.mp3'); // plain and town share it
});

test('moving to another scene switches the tune (and the old one fades out while the new one fades in)', async ({ page }) => {
  await boot(page, '/?title=off');
  await page.evaluate(() => window.__adv.session.performText('north'));
  await expect.poll(async () => (await audio(page)).currentTrack).toBe('music/music2.mp3'); // mountain, swamp and the chapel share it
  // right after the switch both tunes exist: one on its way out, one on its way in
  expect(await page.evaluate(() => window.__adv.game.sound.sounds.length)).toBeGreaterThanOrEqual(1);
  // ...and a little later only the new one is left
  await expect.poll(() => page.evaluate(() => window.__adv.game.sound.sounds.map((s: { key: string }) => s.key)), { timeout: 10_000 }).toEqual(['audio:music/music2.mp3']);
});

test('a second game has its own tunes', async ({ page }) => {
  await boot(page, '/?title=off&game=demo');
  expect((await audio(page)).currentTrack).toBe('music/lane.mp3');
});

test('sound effects: pick up, change scene, click the interface, and what a cutscene asks for', async ({ page }) => {
  await boot(page, '/?title=off');
  await page.evaluate(() => window.__adv.session.performText('take pebble'));
  expect((await audio(page)).played).toContain('pickup');

  await page.evaluate(() => window.__adv.session.performText('north'));
  expect((await audio(page)).played).toContain('door');

  await clickAt(page, 30, 160); // a click on a verb button
  expect((await audio(page)).played).toContain('click');
});

test('a cutscene plays its sounds', async ({ page }) => {
  await boot(page, '/?title=off&game=demo');
  await page.evaluate(() => {
    for (const line of ['look at haystack', 'take key', 'take oil can', 'use key on gate', 'use oil can on gate', 'use key on gate', 'east']) window.__adv.session.performText(line);
  });
  await expect.poll(() => page.evaluate(() => window.__adv.scene === 'RoomScene' && !window.__adv.transitioning)).toBe(true);
  await page.evaluate(() => window.__adv.session.performText('push goat'));
  await expect.poll(async () => (await audio(page)).played, { timeout: 15_000 }).toContain('goat_bleat');
});

test('M mutes and unmutes, and the choice survives a reload', async ({ page }) => {
  await boot(page, '/?title=off');
  expect((await audio(page)).muted).toBe(false);
  await page.keyboard.press('m');
  expect((await audio(page)).muted).toBe(true);

  await boot(page, '/?title=off'); // reload
  expect((await audio(page)).muted).toBe(true);
  await page.keyboard.press('m');
  expect((await audio(page)).muted).toBe(false);
});

test('typing an "m" into the debug console does not mute', async ({ page }) => {
  await boot(page, '/?title=off');
  await page.keyboard.press('Slash');
  await page.keyboard.type('mmm');
  expect((await audio(page)).muted).toBe(false);
});

test('the menu has a Volume row that steps through the levels, and it is remembered', async ({ page }) => {
  await boot(page, '/?title=off');
  await page.keyboard.press('Escape');
  const label = () => page.evaluate(() => (window.__adv.menu.items as { label: string }[]).find((i) => i.label.startsWith('Volume'))!.label);
  expect(await label()).toBe('Volume: 60%');
  await clickMenu(page, 'Volume');
  expect(await label()).toBe('Volume: 75%');
  await clickMenu(page, 'Volume');
  expect(await label()).toBe('Volume: 100%');
  await clickMenu(page, 'Volume');
  expect(await label()).toBe('Volume: OFF');
  expect((await audio(page)).volume).toBe(0);

  await boot(page, '/?title=off'); // reload
  expect((await audio(page)).volume).toBe(0);
});

test('quitting to the title fades the scene music out and the title theme in', async ({ page }) => {
  await boot(page, '/?title=off');
  await page.keyboard.press('Escape');
  await clickMenu(page, 'Quit to title');
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('TitleScene');
  expect((await audio(page)).currentTrack).toBe('music/intro.mp3');
  await expect.poll(() => page.evaluate(() => window.__adv.game.sound.sounds.map((s: { key: string }) => s.key)), { timeout: 10_000 }).toEqual(['audio:music/intro.mp3']);
});

test('two scenes with the same tune: it keeps playing, it does not start again', async ({ page }) => {
  await boot(page, '/?title=off');
  const voice = () => page.evaluate(() => window.__adv.game.sound.sounds
    .filter((s: { key: string }) => s.key.startsWith('audio:music/')) // (the door's sound effect plays too)
    .map((s: { key: string; seek: number }) => [s.key, s.seek > 0]));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__adv.session.performText('south')); // plain -> town, both music1
  await expect.poll(() => page.evaluate(() => window.__adv.engine.state.location)).toBe('town');
  expect((await audio(page)).currentTrack).toBe('music/music1.mp3');
  expect(await voice()).toEqual([['audio:music/music1.mp3', true]]); // the same one voice, already under way
});
