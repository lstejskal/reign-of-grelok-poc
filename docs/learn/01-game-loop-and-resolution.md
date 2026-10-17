# Step 1 - Game loop & logical resolution

**Logical resolution.** The game world is a fixed 320x200 pixel grid (`packages/client/src/config.ts`).
Everything is positioned in those coordinates. The browser window only magnifies it.

**Integer zoom.** `scale.ts` picks the largest whole-number zoom that fits the window (3x in a 960x600 window).
A fractional zoom would draw some game pixels 2 screen pixels wide and others 3 - uneven and blurry.
`pixelArt: true` in `main.ts` turns off smoothing, so pixels stay sharp squares.

**Game loop.** `new Phaser.Game(...)` starts a loop that runs ~60 times a second: update state, draw, repeat.
A `Scene` (`BootScene`) is one screen of the game; Phaser calls its `create()` once, `update()` every frame
(not needed yet - we draw static text).

**Bitmap font.** Retro games draw text from a sheet of tiny letter pictures. `gfx/pixelFont.ts` holds each
letter as 7 rows of `#`/`.`, paints them onto a canvas texture at startup and registers it with Phaser.

**Debug hook.** `window.__adv` (see `debug.ts`) lets tests - and you, in the browser console - peek into the game.

Try it: `npm run dev`, open the console, type `__adv.zoom`; resize the window and watch it change.
