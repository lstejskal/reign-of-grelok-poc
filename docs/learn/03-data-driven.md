# Step 3 - Data-driven design

**Content is data, code is generic.** A game is a folder: `games/<id>/game.yml` (title, start), `logic/*.yml`
(things, locations, puzzles, text) and `scenes/*.yml` (what each location looks like and where you can click).
The engine and client know nothing about Grelok; `?game=<id>` in the URL picks which folder to load.

**One loader, two environments.** `assembleBundle()` (`packages/engine/src/bundle.ts`) turns
"path -> file text" into a `GameBundle`. Node feeds it files from disk (`node/loadGameBundle.ts`), the browser feeds
it text that Vite bundled with `import.meta.glob` (`client/src/data/loadGame.ts`). The shared code never
touches files or picks a YAML library itself - the caller passes `parseYaml` in.

**Scene schema.** `sceneTypes.ts` describes a scene: hotspots (clickable polygons bound to thing aliases), exits
(polygons + where you walk to + where you appear on arrival), later also background/walkmask/music/sprites.
Coordinates are in 320x144 scene pixels.

**Validator.** `validateGame()` catches data mistakes early: a hotspot for a thing that does not exist, an exit
that does not match `locations.yml`, a location without a scene, a missing asset file. Run `npm run validate`;
the same function is unit-tested with deliberately broken copies of the data (`test/validate.test.ts`).

Try it: `npm run dev` (the debug panel shows the loaded game); break something in `games/grelok/scenes/plain.yml`
and run `npm run validate`.
