# Handoff: where the project stands and what to do next

Written 2026-11-25 for whoever continues: **Codex** (art, and code tasks while Claude is unavailable) or **Claude**.
Read this first, then `PLAN.md` (the plan and every step's status) and the `docs/learn/` note named in a task.

## State (all committed on `main` unless said otherwise)
- Steps 1-16 of `PLAN.md` are done. Step 17 (art pass) is nearly done: all **six screens** have final art and are
  wired (scene files, hotspots, sprites, walkmasks). Last commits: `d12f31d` (town), `b9a91c6` (speech outline).
- Checks that pass: `npm run typecheck`, `npm test` (185), `npm run validate` and `npm run validate -- demo`,
  `npm run e2e` (69 pass, 3 skip until task 1 is done).
- **Uncommitted, by Codex:** brief 07 preparation (the approved recoloured `art/reference/grognak_ref.png`, the old
  one as `grognak_ref_v1.png`, reviews, `07-grognak-import-preflight.md`) and the title/interface set
  `08-*` (`games/grelok/assets/backgrounds/title.png`, `games/grelok/assets/ui/*`, raws, `08-ui-handoff.md`).
  Ignore: `package-lock.json`, `games/grelok/assets/sprites/grognak.json` (line endings only), test screenshots.

## Rules (from PLAN.md, plus what this session learned)
- Engine (`packages/engine`) stays pure: no DOM, Phaser or Node. Client (`packages/client`) has no Grelok-specific
  content; everything game-specific lives in `games/<id>/`.
- **Coordinates are logical 320x200** (scene 320x144). **Art has 2 picture pixels per logical pixel** (`ART_SCALE`):
  backgrounds 640x288, Grognak frames 64x96, icons 48x32. Walkmasks stay 320x144. See `docs/learn/18`.
- Floors are polygons in the scene file (`walkArea:`) -> `npm run walkmask -- grelok <scene>`; a test fails if the
  PNG is stale. See `docs/learn/17`.
- Scene data features: sprite `states` with `when`, `x/y`, `depth`; sprite `depth`; hotspot `when` (a thing that
  moves gets one hotspot per place). Things win over exits where they overlap.
- Art never gets scaled at runtime. The player sheet is imported in sizes (`grognak_<h>.png`) and drawn 1:1.
- **New picture files need a dev-server restart** (Vite's glob only sees files present at start). Symptom:
  "CANNOT LOAD GAME / Missing picture" on boot.
- Verify visually in the real game, not just with tests: run `npm run dev`, and drive it with `window.__adv`
  (`session.performText('east')`, `player`, `sprites`, `sentence`, `speedFactor`). Headless Playwright scripts that
  click at `box.x + (x + 0.5) * __adv.zoom` work well for screenshots.
- Commit only when the user asks. Keep Codex's unfinished art out of unrelated commits. Commit messages end with the
  co-author line the tooling asks for.
- Windows: `bash -c` here mangles backticks inside inline scripts; edit TypeScript with a file editor, not
  `node -e` / `sed` with template strings.

## Tasks, in order

### Task 1 - DONE (Claude, after the limit reset): `partCells()` in `tools/art/pipeline.ts` scales every part to one
figure size and stands each part's feet on one line before the shared crop (unit test included). A dry run on the
real brief 07 pictures gives one consistent size for all 34 frames. Still open on the ART side: the side walk's second
row (frames 4-6) repeats the first row's leg order; Codex's repair prompt `art/briefs/07-walk-e-far-step-repair.md`
was never generated. Also note: while all six raws exist but the sheet is not imported, two art tests fail on
purpose ("raw ready but not imported"); they pass again after Task 2.

Original description, kept for reference:
Codex reproduced it (`art/briefs/07-grognak-import-preflight.md`): `processPartsSheet` (`tools/art/pipeline.ts`)
slices each part and crops all cells to one shared **top-origin** box. Cells of different heights (idle 3x1 at
512x1024 vs 2x2 parts at 512x512) put the figures at different y, so the shared box grows, everything shrinks and
the shorter cells' figures float. Fix: before `framesPalette`/`processFrames`, pad every cell to the largest cell
size **anchored bottom-centre** (feet stay on the bottom line), so the shared crop compares like with like. Add a
unit test in `tools/art/pipeline.test.ts` with two parts of different cell heights: the figures' bottoms must land
on the same row and both keep the same size. Run `npm test`.

### Task 2 - Import Grognak's new animation sheet (brief 07; Claude preferred, Codex can do it carefully)
Precondition: the six pictures are final. Today they wait in `art/wip/grognak-07/` (kept out of `art/raw/` so the art
tests don't treat them as ready); the side walk `grognak_walk_e.png` still needs its second row redone
(`art/briefs/07-walk-e-far-step-repair.md`). Then **move all six into `art/raw/`** (same names) and check that
`npm run import-art -- --list` shows `grognak` "raw ready". Task 1 is done.
1. `npm run import-art -- grognak`. It prints a `game.yml` block: `columns: 6`, `animations:` and `sizes:`.
2. In `games/grelok/game.yml` `player:` add `columns: 6`, the `animations:` table and `walkStride: 40`, and replace
   `sizes:` with the printed list. Update the comment above `player:` (layout is now 6 columns, see brief 07).
3. Delete the temporary `grognak_v1` entry from `art/assets.yml` (and its comment).
4. Restart the dev server. `npm run validate`, `npm test` (an art test checks game.yml matches the sheet).
5. `npm run e2e`: the 3 skipped animation tests (mirror, reach, talk) must now run and pass. Two tests read the
   sheet layout from game.yml already.
6. Look at him in the game: walk left/right/up/down at `__adv.speedFactor = 0.3`. Tune `walkStride` until the feet
   don't slide (bigger = slower legs). Check talk (`talk to blacksmith`... his own lines) and reach (pick up pebble).
7. Update `PLAN.md` step 17 progress, `docs/learn/19` if something changed; commit raws + sheet + sizes + game.yml.

### Task 3 - DONE (Claude): `game.yml` has `titleScreen: {background, logo}` and `ui: {frame, cursor: {image,
hotspot}}` (types in `sceneTypes.ts`, checks in `validateGame.ts`, loaded in `BootScene.ts`, used by `TitleScene.ts`
and `RoomScene.ts`; the cursor via Phaser's `input.setDefaultCursor`). All optional: the demo looks as before. The four
pictures are Codex's hand-fitted files and have no `art/assets.yml` entries (regenerate them by hand, see the 08 log).

Original description, kept for reference:
Codex's instructions: `art/briefs/08-ui-handoff.md` (positions, scales, cursor hotspot). Summary:
- `TitleScene.ts`: draw `backgrounds/title.png` at (0,0) scale `artScale` instead of the start scene's background,
  a 50% black dimmer above it, `ui/title_logo.png` at logical (32,4) scale `artScale` instead of the bitmap title
  and its shadow; keep subtitle, menu and footer.
- `RoomScene.ts`: draw `ui/interface_frame.png` at logical (0,144) scale `artScale` above the strip's dark backing,
  below the live verbs/inventory. Check nothing is covered (the handoff lists the free interior).
- Cursor: CSS `cursor: url(<cursor.png url>) 5 3, auto` on the game canvas (nearest-neighbour; hotspot 5,3 at
  32x32). The URL comes from `assetUrl()` in `packages/client/src/data/assets.ts`.
- Keep the client game-agnostic: put the file names in `games/grelok/game.yml` (e.g. `title: {background, logo}`,
  `ui: {frame, cursor}`, all optional), types in `sceneTypes.ts` (`GameConfig`), checks in `validateGame.ts`, and
  load them in `BootScene.ts`. Without them (the demo) everything looks as now. Add the files to `art/assets.yml`
  only if they need re-importing.
- Tests: update `tests/e2e` title screenshots if needed; add one check that the title uses the logo texture.
  Restart the dev server first.

### Task 4 - Step 19 (polish) is DONE (see PLAN.md). Still possible later:
- Grelok finale poses (laugh, death) and NPC talk animations: need art briefs first (Codex), then code.
- Step 18: the music is done (`npm run import-audio`, originals in `audio/raw/`, not in git); the sound effects are
  still the generated placeholders. Step 20 (builds) is open.

## Division of work
- **Codex:** art direction, briefs' pictures, imports of single assets, review; may take Tasks 1 and 3 (code) while
  Claude is away, following the rules above and leaving a short note in this file under "Log".
- **Claude:** scene wiring, engine/client code, Task 2's game.yml wiring and tuning, next briefs.

## Log
- 2026-11-25 Claude: wrote this handoff. Tasks 1-3 open.
- Claude: Task 1 done (importer normalises sheet parts). Codex's brief 07 is unfinished: all six raws exist, the
  reference is approved, but the side walk's second row needs the repair prompt and no picture has been reviewed.
  Brief 08 art is complete and waits for Task 3 (code).
