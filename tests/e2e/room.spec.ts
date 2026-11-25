import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Verb } from '@grelok/engine';
import { verbRect } from '../../packages/client/src/ui/layout';
import { DEFAULT_VERBS as VERBS } from '../../packages/engine/src/sceneTypes';
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
  await page.goto('/?title=off'); // straight into the game (the title screen has its own tests, below)
  await expect.poll(() => page.evaluate(() => window.__adv.scene)).toBe('RoomScene');
  await page.evaluate(() => (window.__adv.speedFactor = 10)); // walking at 10x, so tests do not wait for him
});

/**
 * Tell the engine a command, then wait until the fade between scenes and any cutscene are over. A cutscene waits for
 * the player to read its text, so while one runs we keep clicking the text box, like an impatient player.
 */
async function say(page: Page, line: string): Promise<void> {
  await page.evaluate((l) => window.__adv.session.performText(l), line);
  await expect
    .poll(
      async () => {
        const cutsceneRunning: boolean = await page.evaluate(() => window.__adv.cutscene.running);
        if (cutsceneRunning && (await page.evaluate(() => window.__adv.answer)) !== '') await clickAt(page, 200, 5);
        return !cutsceneRunning && !(await page.evaluate(() => window.__adv.transitioning));
      },
      { timeout: 20_000, intervals: [50] },
    )
    .toBe(true);
}

test('shows the background of the current location and changes it when the player moves', async ({ page }) => {
  // every scene background was loaded into Phaser's texture manager (not just queued)
  for (const key of ['plain', 'mountain', 'town', 'swamp', 'chapel', 'chapel_interior']) {
    expect(await page.evaluate((k) => window.__adv.game.textures.exists(`asset:backgrounds/${k}.png`), key)).toBe(true);
  }

  // backgroundKey is the texture the image on screen really uses
  expect(await page.evaluate(() => window.__adv.backgroundKey)).toBe('asset:backgrounds/plain.png');
  await page.screenshot({ path: 'tests/e2e/screenshots/room-plain.png' });

  await say(page, 'north');
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
  await expect.poll(() => page.evaluate(() => window.__adv.backgroundKey)).toBe('asset:backgrounds/mountain.png');
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
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('Walk to standing stone');

  await moveMouseTo(page, 66, 116); // the pebble
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('Walk to pebble');

  await moveMouseTo(page, 10, 10); // empty sky
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('');

  await moveMouseTo(page, 160, 170); // the UI strip is never a hotspot
  await expect.poll(() => page.evaluate(() => window.__adv.hovered)).toBeUndefined();
});

test('hidden things cannot be pointed at until the engine reveals them', async ({ page }) => {
  await say(page, 'north');
  await moveMouseTo(page, 75, 112); // the gemstone sits on top of the rubble
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('Walk to rubble');

  await say(page, 'look at rubble'); // reveals the gemstone
  // the mouse did not move, but the sentence line follows the world
  await expect.poll(() => page.evaluate(() => window.__adv.sentence)).toBe('Walk to gemstone');
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
  await expect.poll(() => sentence(page)).toBe('Walk to standing stone');
  expect(await page.evaluate(() => window.__adv.verb)).toBeUndefined();

  // and finishing the sentence sends the command to the engine
  await clickVerb(page, 'use');
  await clickAt(page, 66, 116);
  await clickAt(page, 160, 60);
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).not.toBe('');
});

test('a long answer is shown a page at a time', async ({ page }) => {
  await say(page, 'north');
  await say(page, 'look'); // the long room description
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
  await say(page, 'take pebble');
  const slot = await page.evaluate(() => window.__adv.inventory.indexOf('pebble'));
  const r = slotRect(slot);
  await moveMouseTo(page, r.x + 12, r.y + 8);
  await expect.poll(() => sentence(page)).toBe('Look at pebble');

  await clickAt(page, r.x + 12, r.y + 8, 'right'); // right-click = look at
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toContain('pebble');

  await clickVerb(page, 'use');
  await clickInventoryItem(page, 'pebble');
  await moveMouseTo(page, 160, 60);
  await expect.poll(() => sentence(page)).toBe('Use pebble with standing stone');
});

test('Give gemstone to wizard takes the gemstone out of the inventory', async ({ page }) => {
  await say(page, 'north');
  await say(page, 'look at rubble'); // reveals the gemstone
  await clickVerb(page, 'pick_up');
  await clickAt(page, 75, 112);
  await expect.poll(() => page.evaluate(() => window.__adv.inventory)).toContain('gemstone');

  await say(page, 'south');
  await say(page, 'west'); // the swamp, where the wizard lives
  await dismissAnswer(page); // the room description covers the top of the scene, where the wizard stands
  await clickVerb(page, 'give');
  await clickInventoryItem(page, 'gemstone');
  await moveMouseTo(page, 160, 20);
  await expect.poll(() => sentence(page)).toBe('Give gemstone to wizard');
  await clickAt(page, 160, 20);

  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toContain('Eye of Grub');
  expect(await page.evaluate(() => window.__adv.inventory)).not.toContain('gemstone');
});

// --- Step 8: Grognak walks -----------------------------------------------------------------------

const player = (page: Page) => page.evaluate(() => window.__adv.player);
const walkSpeed = (page: Page, factor: number) => page.evaluate((f) => (window.__adv.speedFactor = f), factor);
const waitUntilStopped = (page: Page) =>
  expect.poll(async () => (await player(page)).walking, { timeout: 15_000 }).toBe(false);

test('Grognak starts where game.yml says, drawn from the sprite sheet, with depth = his y', async ({ page }) => {
  const p = await player(page);
  expect([p.x, p.y, p.facing, p.walking]).toEqual([160, 112, 's', false]);
  expect(p.depth).toBe(p.y); // lower on the screen = nearer = drawn in front
  // the sheet was cut into 3 columns x 4 rows of frames
  expect(await page.evaluate(() => Object.keys(window.__adv.game.textures.get('asset:sprites/grognak.png').frames).filter((f) => f !== '__BASE').length)).toBe(12);
});

test('clicking the floor walks there and turns him the way he walked', async ({ page }) => {
  await clickAt(page, 60, 120);
  await waitUntilStopped(page);
  const p = await player(page);
  expect([p.x, p.y]).toEqual([60, 120]);
  expect(p.facing).toBe('w');
});

test('he is drawn smaller in the distance (perspective) and always in front of what is behind him', async ({ page }) => {
  await clickAt(page, 200, 130);
  await waitUntilStopped(page);
  const near = await player(page);
  await clickAt(page, 196, 92); // the far end of the clearing
  await waitUntilStopped(page);
  const far = await player(page);
  expect(far.scale).toBeLessThan(near.scale);
  expect(far.scale).toBeGreaterThan(0.55);
  expect(near.scale).toBeLessThanOrEqual(1);
  expect(far.depth).toBeLessThan(near.depth);
});

test('he walks around the base of the standing stone instead of through it', async ({ page }) => {
  await walkSpeed(page, 3); // slow enough to sample his path every frame
  await page.evaluate(() => {
    const trail: [number, number][] = [];
    (window as any).__trail = trail;
    const tick = () => {
      const p = window.__adv.player;
      trail.push([p.x, p.y]);
      requestAnimationFrame(tick);
    };
    tick();
  });
  await clickAt(page, 190, 86); // behind the stone's base (x 138-181, y 88-99 is blocked), beside the stone's hotspot
  await waitUntilStopped(page);

  const trail: [number, number][] = await page.evaluate(() => (window as any).__trail);
  expect(trail.some(([x, y]) => x >= 138 && x < 182 && y >= 88 && y < 100)).toBe(false);
  expect(trail.some(([x]) => x < 138 || x >= 182)).toBe(true); // he really went round the side
  const end = await player(page);
  expect([end.x, end.y]).toEqual([190, 86]);
});

test('he walks up to a thing before using it: the engine hears nothing until he arrives', async ({ page }) => {
  await walkSpeed(page, 1);
  await clickVerb(page, 'pick_up');
  await clickAt(page, 66, 116); // the pebble
  expect((await player(page)).walking).toBe(true);
  expect(await page.evaluate(() => window.__adv.engine.state.inventory)).not.toContain('pebble');

  await expect.poll(() => page.evaluate(() => window.__adv.engine.state.inventory), { timeout: 15_000 }).toContain('pebble');
  const p = await player(page);
  expect([p.x, p.y]).toEqual([66, 124]); // the hotspot's walkTo
  expect(p.facing).toBe('n'); // no facing in the data: he turns towards the pebble
});

test('with no verb chosen, clicking a thing just walks there (and faces it as the data says)', async ({ page }) => {
  await clickAt(page, 160, 60); // the standing stone
  await waitUntilStopped(page);
  const p = await player(page);
  expect([p.x, p.y, p.facing]).toEqual([160, 108, 'n']);
  expect(await page.evaluate(() => window.__adv.answer)).toBe('');
});

test('looking is done from where he stands', async ({ page }) => {
  await clickVerb(page, 'look_at');
  await clickAt(page, 160, 60);
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toContain('menhir');
  const p = await player(page);
  expect([p.x, p.y, p.walking]).toEqual([160, 112, false]);
});

test('a new click redirects him, and the old walk is forgotten', async ({ page }) => {
  await walkSpeed(page, 1);
  await clickVerb(page, 'pick_up');
  await clickAt(page, 66, 116); // starts walking to the pebble ...
  await clickAt(page, 250, 120); // ... but the player changed his mind
  await waitUntilStopped(page);
  const p = await player(page);
  expect([p.x, p.y]).toEqual([250, 120]);
  expect(await page.evaluate(() => window.__adv.engine.state.inventory)).not.toContain('pebble');
});

test('arriving in a new location places him at the matching exit', async ({ page }) => {
  await say(page, 'north');
  const p = await player(page);
  expect([p.x, p.y]).toEqual([160, 118]); // mountain's south exit spawn
  await page.screenshot({ path: 'tests/e2e/screenshots/room-player.png' });
});

test('F1 also shows the walk grid and the route', async ({ page }) => {
  await walkSpeed(page, 0.5);
  await page.keyboard.press('F1');
  await clickAt(page, 250, 110);
  await expect.poll(async () => (await player(page)).x, { timeout: 15_000 }).toBeGreaterThan(190);
  await page.screenshot({ path: 'tests/e2e/screenshots/room-walking.png' });
});

// --- Step 9: exits and scene transitions -------------------------------------------------------

const sentenceLine = (page: Page) => page.evaluate(() => window.__adv.sentence);

test('pointing at an exit says where it leads', async ({ page }) => {
  await moveMouseTo(page, 110, 50); // the mountains on the horizon
  await expect.poll(() => sentenceLine(page)).toBe('Go to Mountain');
  await moveMouseTo(page, 60, 120); // empty ground again
  await expect.poll(() => sentenceLine(page)).toBe('');
});

test('clicking an exit walks there and then through it; the way back works too', async ({ page }) => {
  await clickAt(page, 110, 50); // the mountains on the horizon
  await expect.poll(() => page.evaluate(() => window.__adv.backgroundKey), { timeout: 15_000 }).toBe('asset:backgrounds/mountain.png');
  await expect.poll(() => page.evaluate(() => window.__adv.transitioning)).toBe(false);
  let p = await player(page);
  expect([p.x, p.y, p.facing]).toEqual([160, 118, 'n']);
  await page.screenshot({ path: 'tests/e2e/screenshots/room-exit-mountain.png' });

  await clickAt(page, 160, 138); // the south exit
  await expect.poll(() => page.evaluate(() => window.__adv.backgroundKey), { timeout: 15_000 }).toBe('asset:backgrounds/plain.png');
  await expect.poll(() => page.evaluate(() => window.__adv.transitioning)).toBe(false);
  p = await player(page);
  expect([p.x, p.y, p.facing]).toEqual([188, 90, 's']);
});

test('the screen fades to black and back when the scene changes', async ({ page }) => {
  await walkSpeed(page, 1);
  await page.evaluate(() => {
    const w = window as any;
    w.__maxFade = 0;
    const tick = () => {
      w.__maxFade = Math.max(w.__maxFade, w.__adv.fade ?? 0);
      requestAnimationFrame(tick);
    };
    tick();
    w.__adv.session.performText('north');
  });
  await expect.poll(() => page.evaluate(() => window.__adv.transitioning)).toBe(false);
  expect(await page.evaluate(() => (window as any).__maxFade)).toBeGreaterThan(0.95);
  expect(await page.evaluate(() => window.__adv.fade)).toBe(0);
});

test('a blocked exit shows the engine\'s message and he stays', async ({ page }) => {
  await say(page, 'east'); // the chapel
  await clickAt(page, 310, 80);
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toBe('Chapel door is blocked by zombie.');
  expect(await page.evaluate(() => window.__adv.backgroundKey)).toBe('asset:backgrounds/chapel.png');
  const p = await player(page);
  expect([p.x, p.y, p.facing]).toEqual([292, 110, 'e']);

  await dismissAnswer(page);
  await say(page, 'use rusty sword on zombie'); // a cutscene: plays out while we keep reading
  await clickAt(page, 310, 80);
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toBe('Chapel door is locked.');
});

// --- Step 10: speech and dialogs ---------------------------------------------------------------

import { choiceRect } from '../../packages/client/src/ui/dialog';

const speech = (page: Page) => page.evaluate(() => window.__adv.speech);
const dialog = (page: Page) => page.evaluate(() => window.__adv.dialog);

/** In the town, "Talk to" the blacksmith; leaves the narration read and his first words on screen. */
async function talkToBlacksmith(page: Page): Promise<void> {
  await say(page, 'south');
  await clickVerb(page, 'talk_to');
  await clickAt(page, 80, 70);
  await expect.poll(() => page.evaluate(() => window.__adv.answer), { timeout: 15_000 }).toContain('Blacksmith smiles');
  await walkSpeed(page, 0.05); // speech stays up 20 times longer, so tests can look at it
  await dismissAnswer(page);
}

test('quoted words are spoken above the speaker in his colour; the rest stays narration', async ({ page }) => {
  await talkToBlacksmith(page);
  const line = await speech(page);
  expect(line.speaker).toBe('blacksmith');
  expect(line.color).toBe('#ff9a3c');
  expect(line.text).toContain('Greetings');
  await page.screenshot({ path: 'tests/e2e/screenshots/speech-blacksmith.png' });
});

test('speech goes away by itself, and a click in the scene skips it', async ({ page }) => {
  await talkToBlacksmith(page);
  expect(await speech(page)).toBeDefined();
  await clickAt(page, 250, 120); // skips; does not walk
  await expect.poll(() => speech(page), { message: 'first page skipped' }).not.toMatchObject({ text: expect.stringContaining('Greetings') });
  expect((await player(page)).walking).toBe(false);

  await walkSpeed(page, 10); // time passes quickly: whatever is left expires
  await expect.poll(() => speech(page)).toBeUndefined();
});

test('Talk to opens a menu of questions; asking gets an answer, Goodbye closes the menu', async ({ page }) => {
  await talkToBlacksmith(page);
  expect(await dialog(page)).toEqual({ npc: 'blacksmith', choices: ['Ask about grelok', 'Ask about rusty sword', 'Goodbye'] });
  await page.screenshot({ path: 'tests/e2e/screenshots/dialog-menu.png' });

  const r = choiceRect(0);
  await moveMouseTo(page, r.x + 5, r.y + 3);
  await expect.poll(() => sentence(page)).toBe('Ask blacksmith about grelok');
  await clickAt(page, r.x + 5, r.y + 3);
  await expect.poll(async () => (await speech(page))?.text).toContain('evil wizard');

  const bye = choiceRect(2);
  await clickAt(page, bye.x + 5, bye.y + 3);
  expect(await dialog(page)).toBeUndefined();
  expect(await speech(page)).toBeUndefined();
});

test('clicking the scene (once he has finished speaking) ends the conversation', async ({ page }) => {
  await talkToBlacksmith(page);
  for (let i = 0; i < 10 && (await speech(page)); i++) await clickAt(page, 250, 120); // clicks first skip the speech...
  expect(await dialog(page)).toBeDefined(); // ...and the menu stays while he is still talking
  await clickAt(page, 250, 120); // ...then a click walks, and the conversation is over
  expect(await dialog(page)).toBeUndefined();
  await expect.poll(async () => (await player(page)).walking).toBe(true);
});

// --- Step 11: sprites that follow the game state -----------------------------------------------

const sprites = (page: Page) => page.evaluate(() => window.__adv.sprites);
const spriteIds = async (page: Page) => (await sprites(page)).map((s: { id: string }) => s.id);

test('a sprite is drawn for a thing in the scene, at its feet position and sorted by y, and goes when it is picked up', async ({ page }) => {
  // (the standing stone is a sprite too, imported in Step 16; it is sorted by its feet like everything else)
  expect(await sprites(page)).toEqual([
    { id: 'standing_stone', image: 'sprites/standing_stone.png', x: 160, y: 100, depth: 100 },
    { id: 'pebble', image: 'sprites/pebble.png', x: 66, y: 120, depth: 120 },
  ]);
  await page.screenshot({ path: 'tests/e2e/screenshots/sprite-pebble.png' });

  await say(page, 'take pebble');
  expect(await spriteIds(page)).toEqual(['standing_stone']);
});

test('a hidden thing gets its sprite only when the engine reveals it', async ({ page }) => {
  await say(page, 'north');
  expect(await spriteIds(page)).toEqual([]); // the gemstone is hidden under the rubble
  await say(page, 'look at rubble');
  expect(await spriteIds(page)).toEqual(['gemstone']);
  await say(page, 'take gemstone');
  expect(await spriteIds(page)).toEqual([]);
});

test('the world changes visibly as the puzzle is solved: zombie falls, door opens', async ({ page }) => {
  await say(page, 'south');
  await say(page, 'talk to priest'); // gives the chapel key
  await say(page, 'north');
  await say(page, 'east');

  expect(await sprites(page)).toEqual([{ id: 'zombie', image: 'sprites/zombie_standing.png', x: 220, y: 110, depth: 110 }]);
  await page.screenshot({ path: 'tests/e2e/screenshots/sprite-zombie-standing.png' });

  await say(page, 'use rusty sword on zombie');
  expect(await spriteIds(page)).toEqual(['zombie']);
  expect((await sprites(page))[0].image).toBe('sprites/zombie_down.png');

  await say(page, 'use chapel key on chapel door');
  expect(await spriteIds(page)).toEqual(['zombie', 'door_open']);
  await page.screenshot({ path: 'tests/e2e/screenshots/sprite-door-open.png' });
});

test('leaving a scene swaps its sprites for the new scene\'s', async ({ page }) => {
  expect(await spriteIds(page)).toEqual(['standing_stone', 'pebble']);
  await say(page, 'east'); // the chapel
  expect(await spriteIds(page)).toEqual(['zombie']);
  await say(page, 'west');
  expect(await spriteIds(page)).toEqual(['standing_stone', 'pebble']);
});

test('double-clicking an exit goes through at once instead of walking there', async ({ page }) => {
  await walkSpeed(page, 0.05); // so slow that walking to the exit would take minutes
  const [x, y] = [110, 50]; // the mountains on the horizon
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom: number = await page.evaluate(() => window.__adv.zoom);
  await page.mouse.dblclick(box.x + (x + 0.5) * zoom, box.y + (y + 0.5) * zoom);
  // (the engine moves at once; the fade itself is slowed by speedFactor too, so we look at the engine, not the picture)
  await expect.poll(() => page.evaluate(() => window.__adv.engine.state.location), { timeout: 3_000 }).toBe('mountain');
});

test('a single click on a far exit still walks', async ({ page }) => {
  await walkSpeed(page, 0.05);
  await clickAt(page, 110, 50); // the mountains on the horizon
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__adv.backgroundKey)).toBe('asset:backgrounds/plain.png');
  expect((await player(page)).walking).toBe(true);
});

test('double-clicking a blocked exit shows the refusal at once', async ({ page }) => {
  await say(page, 'east');
  await walkSpeed(page, 0.05);
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom: number = await page.evaluate(() => window.__adv.zoom);
  await page.mouse.dblclick(box.x + 310.5 * zoom, box.y + 80.5 * zoom);
  await expect.poll(() => page.evaluate(() => window.__adv.answer), { timeout: 3_000 }).toBe('Chapel door is blocked by zombie.');
});

// --- Step 12: cutscenes -------------------------------------------------------------------------

const cutscene = (page: Page) => page.evaluate(() => window.__adv.cutscene);

test('hitting the zombie plays a cutscene: input is locked, the picture changes only at "sync", then control returns', async ({ page }) => {
  await walkSpeed(page, 0.2); // slowly, so the test can look in between
  await say(page, 'east');
  await page.evaluate(() => window.__adv.session.performText('use rusty sword on zombie'));

  expect((await cutscene(page)).running).toBe(true);
  // the engine has already moved on, but the picture has not: the zombie still stands
  expect(await page.evaluate(() => window.__adv.engine.state.things.zombie.description)).toContain('trapped');
  expect((await sprites(page))[0].image).toBe('sprites/zombie_standing.png');

  // locked: a click on the floor does not walk
  await clickAt(page, 100, 120);
  expect((await player(page)).walking).toBe(false);

  await expect.poll(async () => (await sprites(page))[0].image, { timeout: 15_000 }).toBe('sprites/zombie_down.png');
  await expect.poll(() => page.evaluate(() => window.__adv.answer), { timeout: 15_000 }).toContain('stumbles and falls');
  expect((await cutscene(page)).running).toBe(true); // still waiting for the player to read

  await walkSpeed(page, 10);
  await dismissAnswer(page);
  await expect.poll(async () => (await cutscene(page)).running).toBe(false);
  expect((await cutscene(page)).log).toEqual(['face e', 'shake 0.3', 'sfx sword_hit', 'wait 0.2', 'sync', 'sfx zombie_fall', 'wait 0.4', 'narrate use_rusty_sword_on_zombie']);
  expect((await cutscene(page)).audio).toEqual(['sfx sword_hit', 'sfx zombie_fall']);

  await clickAt(page, 100, 120); // free again
  await expect.poll(async () => (await player(page)).walking).toBe(true);
});

test('hitting the zombie again is NOT a cutscene (the success message is only said once)', async ({ page }) => {
  await say(page, 'east');
  await say(page, 'use rusty sword on zombie');
  await page.evaluate(() => window.__adv.session.performText('use rusty sword on zombie'));
  expect((await cutscene(page)).running).toBe(false);
  expect(await page.evaluate(() => window.__adv.answer)).toContain('already trapped');
});

test('the blacksmith cutscene fades out, hammers, and the new sword appears in the inventory only at "sync"', async ({ page }) => {
  await say(page, 'north');
  await say(page, 'look at rubble');
  await say(page, 'take gemstone');
  await say(page, 'south');
  await say(page, 'west');
  await say(page, 'give gemstone to wizard');
  await say(page, 'take gemstone shards');
  await say(page, 'east');
  await say(page, 'south');

  await walkSpeed(page, 3);
  await page.evaluate(() => window.__adv.session.performText('give gemstone shards to blacksmith'));
  expect((await cutscene(page)).running).toBe(true);
  expect(await page.evaluate(() => window.__adv.inventory)).toContain('rusty_sword'); // not yet reforged on screen
  await expect.poll(async () => (await cutscene(page)).audio.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await cutscene(page)).log.includes('sync'), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__adv.answer), { timeout: 20_000 }).toContain('forge one half');
  await dismissAnswer(page);
  await expect.poll(async () => (await cutscene(page)).running).toBe(false);
  expect(await page.evaluate(() => window.__adv.inventory)).toContain('shining_sword');
  expect((await cutscene(page)).audio).toEqual(['sfx clang', 'sfx clang', 'sfx clang']);
});

test('the final blow plays the finale and ends on the end screen with credits', async ({ page }) => {
  for (const line of ['north', 'look at rubble', 'take gemstone', 'south', 'west', 'give gemstone to wizard', 'take gemstone shards', 'east', 'south', 'give gemstone shards to blacksmith', 'north', 'north']) {
    await say(page, line);
  }
  await walkSpeed(page, 1); // real time, so the test can catch Grelok's words before they fade
  await page.evaluate(() => window.__adv.session.performText('use shining sword on grelok'));
  expect(await page.evaluate(() => window.__adv.engine.state.over)).toBe(true);
  expect((await cutscene(page)).running).toBe(true);

  // Grelok's last words, above Grelok, in wine red
  await expect.poll(async () => (await page.evaluate(() => window.__adv.speech))?.speaker, { timeout: 15_000 }).toBe('grelok');
  // keep reading until the end screen is up
  await expect
    .poll(
      async () => {
        if ((await page.evaluate(() => window.__adv.answer)) !== '') await clickAt(page, 200, 5);
        return (await cutscene(page)).ended;
      },
      { timeout: 30_000, intervals: [50] },
    )
    .toBe(true);
  expect((await cutscene(page)).endLines).toContain('Reign of Grelok');
  await expect.poll(async () => (await cutscene(page)).running).toBe(false);
  await page.waitForTimeout(1600); // the end screen fades in
  await page.screenshot({ path: 'tests/e2e/screenshots/the-end.png' });

  // the game is over: clicking does nothing any more
  await clickAt(page, 100, 120);
  expect((await player(page)).walking).toBe(false);
});

test('a game that ends without a cutscene still gets an end screen, once the text has been read', async ({ page }) => {
  await page.evaluate(() => {
    // pretend the game ends with a plain message that no cutscene announces
    window.__adv.bundle.cutscenes = {};
  });
  for (const line of ['north', 'look at rubble', 'take gemstone', 'south', 'west', 'give gemstone to wizard', 'take gemstone shards', 'east', 'south', 'give gemstone shards to blacksmith', 'north', 'north', 'use shining sword on grelok']) {
    await say(page, line);
  }
  expect((await cutscene(page)).ended).toBe(false); // the victory text is still waiting to be read
  await dismissAnswer(page);
  await expect.poll(async () => (await cutscene(page)).ended).toBe(true);
});

// --- Step 13: title screen, save & load ----------------------------------------------------------

const menu = (page: Page) => page.evaluate(() => window.__adv.menu);

/** Click the row of the menu on screen whose label starts with `label`. */
async function clickMenu(page: Page, label: string): Promise<void> {
  const items: { label: string; enabled: boolean; x: number; y: number; w: number; h: number }[] = (await menu(page)).items;
  const item = items.find((i) => i.label.startsWith(label));
  expect(item, `menu row "${label}" in ${JSON.stringify(items.map((i) => i.label))}`).toBeDefined();
  await clickAt(page, Math.floor(item!.x + item!.w / 2), Math.floor(item!.y + item!.h / 2));
}

const sceneName = (page: Page) => page.evaluate(() => window.__adv.scene);

/** Open the page on the title screen (a fresh page keeps localStorage, so saves survive a reload). */
async function gotoTitle(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(() => sceneName(page)).toBe('TitleScene');
  await page.evaluate(() => (window.__adv.speedFactor = 10));
}

async function startNewGame(page: Page): Promise<void> {
  await gotoTitle(page);
  await clickMenu(page, 'New game');
  await expect.poll(() => sceneName(page)).toBe('RoomScene');
}

/** Esc opens the menu, then Save, then slot `slot`. */
async function saveInSlot(page: Page, slot: string): Promise<void> {
  await page.keyboard.press('Escape');
  await clickMenu(page, 'Save');
  await clickMenu(page, `${slot}:`);
  await expect.poll(() => page.evaluate(() => window.__adv.answer)).toBe('Game saved.');
}

test('the title screen offers New game, and Continue / Load only when there is something to load', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(() => sceneName(page)).toBe('TitleScene');
  expect(((await menu(page)).items as { label: string; enabled: boolean }[]).map((i) => [i.label, i.enabled])).toEqual([
    ['New game', true],
    ['Continue', false],
    ['Load', false],
  ]);
  await page.screenshot({ path: 'tests/e2e/screenshots/title.png' });

  await clickMenu(page, 'Continue'); // disabled: nothing happens
  expect(await sceneName(page)).toBe('TitleScene');
  await clickMenu(page, 'New game');
  await expect.poll(() => sceneName(page)).toBe('RoomScene');
  expect(await page.evaluate(() => window.__adv.engine.state.location)).toBe('plain');
});

test('Esc or the disk icon opens the menu; it is modal, and Esc closes it', async ({ page }) => {
  expect(await menu(page)).toBeUndefined();
  await page.keyboard.press('Escape');
  expect((await menu(page)).title).toBe('Menu');
  await page.screenshot({ path: 'tests/e2e/screenshots/menu.png' });

  await clickAt(page, 250, 120); // a click on the floor while the menu is open does nothing
  expect((await player(page)).walking).toBe(false);

  await page.keyboard.press('Escape');
  expect(await menu(page)).toBeUndefined();

  await clickAt(page, 311, 148); // the disk icon
  expect((await menu(page)).title).toBe('Menu');
  await clickMenu(page, 'Back');
  expect(await menu(page)).toBeUndefined();
});

test('save, reload the page, Continue: same place, same inventory, same position', async ({ page }) => {
  await startNewGame(page);
  await say(page, 'take pebble');
  await say(page, 'north');
  await clickAt(page, 200, 100);
  await waitUntilStopped(page);
  const where = await player(page);

  await saveInSlot(page, '2');
  expect(await page.evaluate(() => window.__adv.saves.find((s: { slot: string }) => s.slot === '2').location)).toBe('mountain');

  await gotoTitle(page); // a reload: everything in memory is gone, only localStorage is left
  expect(((await menu(page)).items as { label: string; enabled: boolean }[]).find((i) => i.label === 'Continue')!.enabled).toBe(true);
  await clickMenu(page, 'Continue');
  await expect.poll(() => sceneName(page)).toBe('RoomScene');

  expect(await page.evaluate(() => window.__adv.engine.state.location)).toBe('mountain');
  expect(await page.evaluate(() => window.__adv.backgroundKey)).toBe('asset:backgrounds/mountain.png');
  expect(await page.evaluate(() => window.__adv.inventory)).toContain('pebble');
  const back = await player(page);
  expect([back.x, back.y, back.facing]).toEqual([where.x, where.y, where.facing]);
  await page.screenshot({ path: 'tests/e2e/screenshots/continue.png' });
});

test('Load from the in-game menu goes back to the saved moment', async ({ page }) => {
  await startNewGame(page);
  await saveInSlot(page, '1'); // at the start, nothing picked up
  await say(page, 'take pebble');
  await say(page, 'north');
  expect(await page.evaluate(() => window.__adv.engine.state.location)).toBe('mountain');

  await page.keyboard.press('Escape');
  await clickMenu(page, 'Load');
  expect(((await menu(page)).items as { label: string }[]).map((i) => i.label.split(':')[0])).toEqual(['1', '2', '3', 'Auto', 'Back']);
  await clickMenu(page, '1:');
  await expect.poll(async () => (await page.evaluate(() => window.__adv.menu)) === undefined && (await sceneName(page)) === 'RoomScene').toBe(true);

  expect(await page.evaluate(() => window.__adv.engine.state.location)).toBe('plain');
  expect(await page.evaluate(() => window.__adv.inventory)).not.toContain('pebble');
  expect((await sprites(page)).map((s: { id: string }) => s.id)).toEqual(['standing_stone', 'pebble']); // drawn again: sprites follow the state
  // and the game keeps working after a load (one scene object is reused: nothing may be doubled up)
  await clickVerb(page, 'pick_up');
  await clickAt(page, 66, 116);
  await expect.poll(() => page.evaluate(() => window.__adv.inventory)).toContain('pebble');
});

test('what the puzzle changed is drawn again after loading (zombie down, door still shut)', async ({ page }) => {
  await startNewGame(page);
  await say(page, 'east');
  await say(page, 'use rusty sword on zombie');
  await saveInSlot(page, '3');

  await gotoTitle(page);
  await clickMenu(page, 'Load');
  await clickMenu(page, '3:');
  await expect.poll(() => sceneName(page)).toBe('RoomScene');
  expect((await sprites(page)).map((s: { image: string }) => s.image)).toEqual(['sprites/zombie_down.png']);
  await say(page, 'use rusty sword on zombie');
  expect(await page.evaluate(() => window.__adv.answer)).toContain('already trapped'); // the engine remembered, too
});

test('Quit to title autosaves; Continue picks the newest save', async ({ page }) => {
  await startNewGame(page);
  await say(page, 'west');
  await page.keyboard.press('Escape');
  await clickMenu(page, 'Quit to title');
  await expect.poll(() => sceneName(page)).toBe('TitleScene');
  await clickMenu(page, 'Continue');
  await expect.poll(() => sceneName(page)).toBe('RoomScene');
  expect(await page.evaluate(() => window.__adv.engine.state.location)).toBe('swamp');
});

test('a damaged save is ignored instead of crashing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('adventure:grelok:save:1', '{"version":1,"gameId":"grelok"');
    localStorage.setItem('adventure:grelok:save:2', JSON.stringify({ version: 1, gameId: 'grelok', savedAt: 5, location: 'plain', player: { x: 1, y: 2, facing: 's' }, engine: 'garbage' }));
  });
  await page.reload();
  await expect.poll(() => sceneName(page)).toBe('TitleScene');
  await clickMenu(page, 'Load'); // slot 2 looks valid but its engine data is broken
  await clickMenu(page, '2:');
  expect(await sceneName(page)).toBe('TitleScene'); // stays put
  expect(((await menu(page)).items as { label: string; enabled: boolean }[]).slice(0, 2).map((i) => [i.label, i.enabled])).toEqual([
    ['1: Empty', false],
    ['2: Plain  ' + (await page.evaluate(() => { const d = new Date(5); return `${d.getDate()}.${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; })), true],
  ]);
});
