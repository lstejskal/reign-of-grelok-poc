# Step 4 - Scenes react to events

**Placeholder art first.** `npm run placeholders` (`tools/make-placeholders.ts`) writes a 320x144 background and
a walkmask per location with `pngjs`. Real art can replace the files later under the same names - the generator
never overwrites existing files (unless `--force`). The walkmask is grayscale: white = walkable, black = blocked.

**Loading pictures.** `BootScene` reads the game data, queues every background with Phaser's loader and only starts
`RoomScene` once the loader reports `complete`. (Gotcha: `load.totalToLoad` is 0 until loading *starts*; use
`load.list.size` to ask "is anything queued?".) Vite turns image files into URLs via `import.meta.glob` (`data/assets.ts`).

**Session = the seam between engine and screen.** `GameSession` (`client/src/session.ts`) wraps the engine; anything
that changes the game calls `session.perform...()`, anything that shows it calls `session.onEvents(...)`.
`RoomScene` listens for `location_changed` and swaps its background texture. It never asks the engine "where am I"
on every frame - it is told when something changes.

**Debug console.** Press / to open it (Esc or / closes). It is plain HTML (text input is easier in the DOM than in a 320x200
canvas) and prints every engine event. `:events` toggles the non-text events - handy for seeing what the engine reports.

**Testing what is on screen.** A test that only checks a variable can pass while the screen is wrong (it did, once:
see the loader gotcha above). `__adv.backgroundKey` reads the texture the image really uses, and the test checks the
textures exist in Phaser's texture manager.

Try it: `npm run dev`, press `/`, type `north`, `look at rubble`, `:events`, `take gemstone`.
