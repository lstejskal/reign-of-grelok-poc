# Handoff: where the project stands and what to do next

> Brief 07 update (2026-11-27): the six reviewed source sheets are committed in `art/raw/` (`c624395`).
> Side-walk alternation is resolved; older open-art notes below are historical. Remaining work is Claude's coordinated
> runtime import and animation-table integration. See `art/briefs/07-grognak-animation-handoff.md` and the final Log entry.

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
  backgrounds 640x288, Grognak frames 76x116 (enlarged 20% from 64x96), icons 48x32. Walkmasks stay 320x144. See `docs/learn/18`.
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
  synthesised by `npm run make-sfx` (tools/make-sfx.ts). Step 20: the web zip is done, the desktop app is open.

## Division of work
- **Codex:** art direction, briefs' pictures, imports of single assets, review; may take Tasks 1 and 3 (code) while
  Claude is away, following the rules above and leaving a short note in this file under "Log".
- **Claude:** scene wiring, engine/client code, Task 2's game.yml wiring and tuning, next briefs.

## Log
- 2026-11-25 Claude: wrote this handoff. Tasks 1-3 open.
- Claude: Task 1 done (importer normalises sheet parts). Codex's brief 07 is unfinished: all six raws exist, the
  reference is approved, but the side walk's second row needs the repair prompt and no picture has been reviewed.
  Brief 08 art is complete and waits for Task 3 (code).
- 2026-11-27 Claude: size pass after the user played the game. Grognak 20% bigger (frames 64x96 -> 76x116, sizes
  `_114` .. `_70`, the old `_58` .. `_68` deleted; `grognak` and `grognak_v1` in `art/assets.yml` both use the new
  frame). NPCs sized against Grognak at the spot where they stand: blacksmith 62x84 (about his height), priest 56x54
  (sitting, a little smaller), zombie 52x78 (about his size; lying 64x30), zombie moved to x 252 to stand in the
  doorway. Hotspots fitted to the new pictures. Validator tests now read the frame size from game.yml.
- 2026-11-27 Claude: step 20 web build while Codex works on brief 07. `npm run package:web` writes
  `release/reign-of-grelok-web.zip` for itch.io (see PLAN step 20); `E2E_BUILD=1 npm run e2e` tests the build.
  After Task 2, run `npm run package:web` again so the zip has the new animations.
- 2026-11-27 Codex: updated `art/briefs/07-preview-animations.ts` to use the importer’s `partCells()` normalization
  before palette selection and fitting; added `--substitute-idle` for isolated candidate review. The original six
  WIP raws rendered as a complete 25-frame diagnostic preview at 76x116 and 70px: `art/wip/grognak-07/07-animation-preview.html`.
  Generator supplied a braided-idle candidate plus walk-east and rear-reach attempts. Reviewer accepted the idle candidate
  for user review conditional on import/in-scene validation; walk-east and rear-reach attempts failed their central pose
  requirements. The candidate preview is `art/wip/grognak-07/idle-candidate-preview/07-animation-preview-idle-candidate.html`.
  Originals remain unchanged; no files were moved to `art/raw/`. `npm run import-art -- --list` therefore still reports only
  `grognak_v1`, and the game has not been validated with this candidate. Typecheck, unit tests (190), and validate pass.
  E2E and live-game visual checks remain pending: Playwright cannot start its configured server because port 5173 is already
  occupied by an unidentified process, and the CUA browser surface is unavailable. Side-walk and rear-reach repairs remain open.
- 2026-11-27 Codex follow-up: reviewer approved the rear pose in `grognak_correction_plate.png` (rear view, sword on
  viewer-right, free hand on viewer-left, paired braids). Assembled only that lower-right 627x627 cell into a new WIP
  reach sheet, preserving all three original reach cells: `grognak_reach_rear_plate_candidate.png`. Combined normalized
  idle + reach preview at 76x116 and 70px: `idle-reach-candidate-preview/07-animation-preview-idle-candidate-reach-candidate.html`.
  Reviewer approved the combined preview: idle and rear reach have consistent helmet/braids/sword, clear free hand,
  aligned feet, and no obvious clipping or fringe. Both candidates are ready for user review; actual import/in-scene
  validation is still pending. Walk-east still fails the side-step leg-role requirement and is the sole identified core art
  blocker; raw promotion/import remains with Claude after art acceptance. A fresh temporary
  Playwright config on port 5175 also stalled without test output and was stopped; e2e is unverified. No process on port
  5173 was stopped, and no runtime asset, manifest, or raw files were changed by this QA follow-up.
- 2026-11-27 Codex final brief 07 handoff: Terra approved the combined wide-cell walk candidate at 76x116 and 70px;
  the six selected raws are now staged in `art/raw/`: `grognak_walk_e.png` (assembled 3x2, 1536x1536), original
  `grognak_walk_s.png`, original `grognak_walk_n.png`, braided `grognak_idle.png`, original `grognak_talk.png`, and
  rear-plate `grognak_reach.png`. All source drafts/candidates remain in WIP. Final review path:
  `art/wip/grognak-07/final-wide-candidate-preview/07-animation-preview-idle-candidate-reach-candidate-walk-e-candidate.html`.
  Reviewer found scale and baseline consistent, leg roles alternate, and no obvious clipping/fringe. Current game has
  not been reviewed in-scene.
- Command incident and status: `npm run import-art -- --list` was intended as list-only, but Windows npm treated
  `--list` as an unknown npm config argument and ran the full importer. It completed `grognak`, then `grognak_v1`
  (which overwrote the shared output), and the other raw-backed assets. No pre-import bytes were available; the runtime
  assets had already appeared modified in the initial worktree. No blind restore was attempted. The current runtime
  copies of the 28 tracked changed game assets were snapshotted to `art/wip/grognak-07/runtime-import-recovery/`.
  Read-only listing works as `npx tsx tools/import-art.ts --list` and shows all six selected raws as ready.
  Current `grognak.png` and its JSON metadata are the legacy 3x4 output at 228x464 because `grognak_v1` imported last;
  do not treat this as brief 07 integration. Unit tests now report 188 pass / 2 fail: expected transition failures until
  Claude updates `game.yml` and imports the 6x6 sheet (the PNG size test expects 456x696 and the player columns test
  expects 6; current game config has no `player.columns`). Typecheck (last run before the accidental import) and validate
  passed. E2E was attempted with Edge but stalled without output on the occupied 5173 and temporary 5175 servers, then
  was stopped; no unknown process was touched. Claude should resume integration and rerun the full checks.

- 2026-11-27 Codex: committed the six selected animation sources as c624395, followed by a separate review/handoff commit. Only animation files and documentation are included; sound effects, package scripts, runtime sprite changes, and test screenshots remain outside these commits. Rechecked typecheck and validation (pass); unit tests 188 pass / 2 documented integration failures; e2e again stalled at server startup and was stopped. No in-game verification completed in this commit-only task.
- 2026-11-27 Claude: step 18 sound effects. `tools/make-sfx.ts` (`npm run make-sfx`) synthesises all seven Grelok
  sounds (FM, filtered noise, reverb); tweak a recipe and rerun. Audio and walkthrough e2e pass (on the build: port 5173
  is held by a stale dev server, pid 27780 at 18:00, which no longer answers; not stopped).

- 2026-11-27 Codex: archived accepted brief 07 WIP correction sources and selected assemblies in a separate artwork-provenance commit, with art/wip/grognak-07/README.md distinguishing accepted inputs from local rejected drafts and the excluded recovery snapshot. No runtime, code, or sound-effects changes.
