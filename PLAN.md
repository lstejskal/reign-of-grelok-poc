# Reign of Grelok — Point & Click: Implementation Plan

Turn the text adventure in `../reign-of-grelok-ts` into a LucasArts-style (SCUMM-like) point-and-click
game with Golden Axe-inspired pixel art and FM/chiptune-style fantasy music.

## Status at a glance
Keep this table current when a step changes. Each step below also has a **Status:** line; open tasks with
step-by-step instructions are in `docs/HANDOFF.md`.

| Step | What | Status |
|---|---|---|
| 1–16 | Engine, scenes, verbs, inventory, walking, exits, dialogs, sprites, cutscenes, save/load, demo game, audio system, art pipeline | ✅ Done |
| 17 | Art pass: all six screens, title and interface art, player animation system, perspective sizes | 🟡 Nearly done: only **Grognak's new animation sheet** (brief 07) is left: drafts in `art/wip/grognak-07/`, the side walk needs its second row redone, then import (HANDOFF Task 2) |
| 18 | Music & SFX pass (real tracks instead of the generated placeholders) | ⬜ To do |
| 19 | Polish (cursor states, text speed, fullscreen, verb shortcuts, skip cutscene, credits…) | 🟡 Started: custom cursor, readable speech outline, return to the title after THE END; the rest of the list is open |
| 20 | Builds & distribution (web zip for itch.io, desktop app) | ⬜ To do |

---

## 1. Technology decision

**TypeScript + Phaser 3 + Vite, npm workspaces monorepo. Vitest for unit tests, Playwright for smoke/e2e.**

Why:
- **You already know TypeScript**, and ~80% of the text game (models, `CustomActionRunner`, YAML data) can be reused as-is.
- **Phaser 3** is a readable, code-first 2D framework: scenes, loader, input, sprites, animations, tweens, audio, camera.
  It handles the plumbing (WebGL, asset loading, audio unlock) but leaves the *game architecture* to you —
  exactly the part worth learning. Huge example base, so coding agents know it well. Pin the latest stable 3.x.
- **Browser target** = instant reload, debuggable in DevTools, free hosting (itch.io), later wrap in Electron for Steam.
- **Phaser loads texture atlases (PNG + JSON) natively** → AI-generated art can be sliced into atlases by a script.

Alternatives considered:
| Option | Verdict |
|---|---|
| Godot 4 (GDScript) | Great editor, but you'd rewrite the logic and the editor hides much of "how it works". |
| Adventure Game Studio | Purpose-built for this genre, but Windows-centric, its own language, and it hides the engine. |
| Raw Canvas 2D | Max learning, but weeks of plumbing (loading, audio, input) before any game appears. |
| PixiJS / Excalibur.js | Viable; Pixi is renderer-only (more plumbing), Excalibur has a smaller community. |

## 2. Architecture: engine separated from data

Three layers, enforced by package boundaries:

```
reign-of-grelok-poc/
  package.json              # npm workspaces, root scripts: dev, test, e2e, validate, build
  packages/
    engine/                 # PURE TS game logic. No DOM, no Phaser, no Node APIs. Deterministic.
    client/                 # Phaser + Vite. GENERIC point-and-click runtime. Knows nothing about Grelok.
  games/
    grelok/                 # DATA ONLY: yml + assets. Swappable with another game.
      game.yml              # title, start location, verbs, fonts, palette, start music
      logic/                # copied from text game: things, locations, messages, constraints, custom_actions, commands
      scenes/<location>.yml # visuals: background, walkmask, hotspots, exits, sprites, music
      speakers.yml          # message key -> speaker id (who says the line)
      cutscenes.yml         # visual sequences triggered by custom action aliases
      assets/{backgrounds,walkmasks,sprites,icons,music,sfx,fonts}/
      palette.hex
  tools/                    # node scripts: placeholders, quantize, placeholder music, validate
  tests/e2e/                # Playwright specs
  docs/learn/               # one short note per step: the concept learned
```

Data flow (the core idea to learn):
```
mouse click -> client builds Command {verb, objects[]} -> engine.perform(cmd) -> EngineEvent[]
           -> client reacts to events (show text, move sprite, change scene, play sfx)
```

Engine API (target shape, refine in step 2):
```ts
type Verb = 'look_at' | 'pick_up' | 'use' | 'give' | 'talk_to' | 'ask' | 'go';
interface Command { verb: Verb; objects: string[] }          // e.g. {verb:'use', objects:['rusty_sword','zombie']}
type EngineEvent =
  | { type: 'say'; key?: string; text: string }               // key = message id (for speakers/cutscenes)
  | { type: 'location_changed'; from: string; to: string }
  | { type: 'inventory_changed'; inventory: string[] }
  | { type: 'thing_changed'; id: string }                     // visibility / location / description
  | { type: 'action_performed'; alias: string }               // custom action alias, e.g. use_rusty_sword_on_zombie
  | { type: 'game_over'; won: boolean };
class Engine {
  constructor(data: LogicData)
  perform(cmd: Command): EngineEvent[]
  performText(line: string): EngineEvent[]                    // old parser, kept for debug console + tests
  get state(): Readonly<GameState>                            // location, inventory, constraints, things
  visibleThings(location?: string): string[]
  serialize(): string;  static deserialize(data: LogicData, saved: string): Engine
}
```

Screen layout (SCUMM-style, native **320×200**, integer-scaled, `pixelArt: true`):
```
y 0..143    scene (320×144)
y 144..151  sentence line  "Use rusty sword with zombie"
y 152..199  verbs (3×2 grid, left)  | inventory (icons + scroll arrows, right)
```
Verbs: Look at, Pick up, Use, Give, Talk to, Walk to. "Attack" = Use X on Y (same as text game).
"Ask about" happens inside the Talk dialog. Right-click = Look at.

---

## 3. Rules for the implementing agent

- Do **one step at a time**. Each step ends with: `npm test` green, `npm run e2e` green, a visible result,
  a short `docs/learn/NN-<topic>.md` (≤15 lines: concept + where it lives in code). Do NOT run git commit (or push) - the human makes all commits.
- `packages/engine` must not import Phaser, DOM, or `node:*`. `packages/client` must not contain
  Grelok-specific ids or strings — everything comes from `games/<id>/`.
- Tests stay **basic**: a few unit tests per new pure module, one Playwright spec per visible feature.
- Expose a dev-only debug hook `window.__adv` (scene id, engine state, `perform()`, `clickHotspot(verb, id)`,
  audio state) so Playwright can drive the game without pixel-hunting.
- Placeholder art/audio is fine until steps 15–17. Never block on assets.
- All art and music are **AI-generated**, then normalized by `tools/` scripts. Assets must be **original**:
  inspired by Golden Axe's style (palette, chunky shading, proportions), never copies of its sprites or music.
- The focus of this project is the **engine**. Asset work is kept minimal: few frames, tweens/mirroring instead of extra art.
- Prefer small readable modules over clever abstractions. Comment the "why" for game-dev concepts.

---

## 4. Steps

### Step 1 — Scaffold & "hello canvas"
- npm workspaces, TS strict, Vite + Phaser in `client`, Vitest, Playwright (use the pre-installed Chromium if present).
- Phaser config: 320×200, `pixelArt: true`, `Scale.FIT` + integer zoom, black background.
- `BootScene` draws "REIGN OF GRELOK" with a bitmap pixel font (free font, e.g. a 5×7/8×8 pixel font; credit it).
- **Output:** `npm run dev` shows crisp, pixel-perfect title text in a scaled canvas.
- **Test:** dummy Vitest test; Playwright: page loads, canvas exists, no console errors, screenshot saved.
- **Concept:** game loop, logical resolution vs. screen scaling.

### Step 2 — Port the engine (pure, event-based)
- Copy `src/models`, `src/parser`, `src/utils.ts`, `src/gameData/types.ts` from `reign-of-grelok-ts` into `packages/engine`.
- Replace `output` callback + console with returned `EngineEvent[]`; add structured `perform(Command)`;
  keep `performText()` on top of the existing `CommandParser`. Remove `node:path`/`FileSaveStore`;
  saving becomes `serialize()/deserialize()`. Fix the TODO bug (drinking from a jug you don't carry) along the way.
- Copy `game-data/*.yml` into `games/grelok/logic/`.
- Add `packages/engine/node/cli.ts` (tiny Node adapter) so `npm run cli` plays the text game. Node-only code lives in `packages/engine/node/`, never in `src/`.
- **Output:** the text game is playable in the terminal from the new engine.
- **Test:** port `walkthrough.txt` → last event is `game_over {won:true}`; `perform({verb:'pick_up',objects:['pebble']})`
  emits `inventory_changed`; serialize/deserialize roundtrip keeps location + inventory.
- **Concept:** separating simulation (model) from presentation (view).
- **Status: done.** Deviations from the text game: `Autocompleter` not ported (terminal tab-completion only);
  `extended prompt`, `save`, `load`, `quit` are terminal-shell commands handled in `cli.ts`; engine start location
  defaults to the first location in `locations.yml` (Step 3 adds `game.yml`); engine uses a `clone()` helper instead of
  `structuredClone`; the jug bug is fixed in
  `games/grelok/logic` (the text game's own data is untouched); after `game_over` the engine ignores further commands.

### Step 3 — Load game data in the browser + validator
- `client` loads `games/grelok/**/*.yml` via `import.meta.glob(..., { query: '?raw' })` + `js-yaml`; game id from `?game=` (default `grelok`).
- Define scene schema in `packages/engine/src/sceneTypes.ts` (types only): background, walkmask, hotspots
  (`id` = thing alias, polygon, walkTo point, facing), exits (direction, polygon, walkTo, spawn point), sprites, music.
- `tools/validate.ts` (`npm run validate`): every location has a scene file; every hotspot/exit references existing
  thing/direction; every referenced asset file exists. Create minimal scene yml for all 6 locations.
- **Output:** on boot, a debug panel shows current location name + visible things from the engine.
- **Test:** validator unit test with a broken fixture (fails) and the real data (passes).
- **Concept:** data-driven design; content vs. code.
- **Status: done.** Added `games/<id>/game.yml` (title, start location). `assembleBundle()` (engine, pure) is shared by the
  Node loader and the browser loader. Exit `spawn` = where the player appears in THIS scene when arriving through that exit.
  `background`/`walkmask`/`music` are optional until Step 4. The validator also requires a hotspot for every thing that
  starts in a location. `noUncheckedIndexedAccess` is now off project-wide (the engine source is also compiled by the client).

### Step 4 — Scene rendering + debug console
- `tools/make-placeholders.ts`: generates 320×144 background PNGs (distinct color per location + grid) and
  1-bit walkmask PNGs (white = walkable floor area) using `pngjs`.
- `RoomScene` renders the background for the engine's current location; reacts to `location_changed`.
- Debug console (opens with the "/" key, Esc closes): text input → `engine.performText()`; prints `say` events.
- **Output:** the full game is playable in the browser via the debug console; backgrounds switch with location.
- **Test:** e2e types the walkthrough into the console → "THE END" appears.
- **Concept:** scenes, asset loading, event subscriptions.
- **Status: done.** Placeholders never overwrite existing files (`--force` to regenerate); the walkmask is 8-bit grayscale
  (white = walkable, floor starts at y=30). New `GameSession` (client) = engine + event fan-out; the debug console is plain
  HTML and prints every engine event (`:events` toggles non-text ones). The validator also checks that background and
  walkmask images are 320x144. Tests check the texture actually on screen, not just a variable.

### Step 5 — Hotspots & mouse hover
- Hotspot polygons from scene yml, only for things the engine reports visible. Pointer → hit test (point-in-polygon,
  topmost wins) → hovered name in sentence line (`Thing.aliasToName`).
- F1 toggles debug overlay: hotspot polygons, walkTo points, exits.
- **Output:** hovering the rubble shows "rubble"; F1 shows outlines.
- **Test:** unit `pointInPolygon`, `hitTest` ordering; e2e hover via `__adv` coordinates shows the name.
- **Concept:** input handling, screen→world coordinates.
- **Status: done.** Code in `client/src/scene/` (`hitTest.ts`, `hotspotOverlay.ts`); hover is re-checked after every engine
  event batch so hidden things appear under a still mouse. Sentence line is centred at the top of the UI strip; the
  location name moved to the bottom-left. Exits are drawn in the overlay but not yet hoverable (Step 9).

### Step 6 — Verb UI & sentence builder
- Pure `SentenceBuilder` state machine in `client/src/ui/` (no Phaser): verb → object1 → (preposition) → object2
  → emits `Command`. "Use X **with** Y", "Give X **to** Y". Right-click = Look at. Escape cancels.
- Render verb grid (bitmap font, hover highlight) and sentence line. Results temporarily shown in a bottom text box.
- **Output:** click "Look at" + rubble → description text; Use rusty sword with zombie works.
- **Test:** SentenceBuilder unit tests (1-object verb, 2-object verb, cancel); e2e look at standing stone.
- **Concept:** UI as state machine; translating input into game commands.
- **Status: done.** `client/src/ui/`: `SentenceBuilder.ts`, `verbs.ts`, `layout.ts`, `textPages.ts`. Deviations: (1) there is no
  inventory yet, so "Use rusty sword with zombie" waits for Step 7 (two-object sentences are tested with a pebble and the
  standing stone); (2) a sixth verb, Push, was added (the game data has zombie push messages) and `'push'` joined the engine's
  `Verb` type; (3) with no verb chosen a click does Look at (`DEFAULT_VERB`), which Step 8 replaces with walking;
  (4) the answer box has its own word-wrap (`wrapText`) instead of `chopToLines`, because `chopToLines` may overshoot the width.

### Step 7 — Inventory panel
- Inventory icons (placeholder 24×16 PNGs per pickable thing, generated), 2 rows × N, scroll arrows.
  Inventory items are valid objects for the sentence builder. Updates on `inventory_changed`.
- **Output:** pick up pebble → icon appears; Give gemstone to wizard removes it.
- **Test:** unit for pagination math; e2e pick up pebble → inventory contains pebble.
- **Concept:** UI driven by model state.
- **Status: done.** `client/src/ui/inventory.ts` (paging math, slot hit testing); icons at `assets/icons/<alias>.png`, checked by
  `validateGame` and generated by `npm run placeholders`. Deviations: the grid is 7 columns x 2 rows and scrolls sideways one
  column at a time (arrows `<` `>`); the engine's answer text moved from the bottom strip to a band at the top of the scene,
  because the strip is now full (clicking the band reads on and does not reach the scene).

### Step 8 — Player character & walking
- Placeholder Grognak sprite (32×48 colored figure, 4 facings). Click on floor = Walk to.
- Pathfinding: A* on a grid sampled from the walkmask (e.g., 4 px cells), path smoothing optional.
- Before any action on a hotspot: walk to its `walkTo` point, face it, then perform. Depth sorting by y;
  perspective scaling (scene yml: `scale: {top: 0.6, bottom: 1.0}`).
- **Output:** Grognak walks around obstacles, smaller in the distance, walks up to things before using them.
- **Test:** A* unit tests on tiny hand-written masks (straight, around wall, unreachable → nearest point).
- **Concept:** pathfinding, sprite depth, update loop & delta time.
- **Status: done.** Pure code in `client/src/walk/` (`pathfinding.ts` A* + string pulling, `PathFollower.ts`, `WalkArea.ts`
  perspective, `plan.ts`, `spawn.ts`); Phaser side in `client/src/scene/PlayerActor.ts`. Data: `game.yml` gained `player:` and
  `startPosition:`, scenes gained `scale:`. Deviations: (1) looking is done from where he stands (only other verbs walk), as in
  the classic games; (2) with no verb chosen, a click on a thing in the scene walks there (sentence "Walk to X") and on a
  carried thing looks at it; (3) arrival at a new location already uses the exit `spawn` points (Step 9 adds the fade and
  clickable exits); (4) the placeholder walkmasks of `plain` and `swamp` got an obstacle (regenerate with
  `npm run placeholders -- --force`); (5) debug hooks `__adv.player` and `__adv.speedFactor` (tests walk at 10x);
  (6) F1 also draws the blocked walk cells and the current route; (7) the "MORE >" marker got its own row.

### Step 9 — Exits & scene transitions
- Exit hotspots (screen edges / doors). Walk to exit → `perform({verb:'go', objects:[dir]})`.
  If blocked (zombie, locked door) show the engine's message and stay. On success: fade out/in, spawn at the
  matching entry point of the new scene.
- **Output:** walk plain → mountain → back; chapel door refuses entry until puzzle solved.
- **Test:** e2e: `__adv.clickHotspot('walk_to','exit_n')` → scene id = mountain.
- **Concept:** scene lifecycle, transitions, spawn points.
- **Status: done.** `RoomScene` hit-tests exits (things win over exits), walks to `walkTo`, then calls `go`; hovering an exit
  shows "Go to <place>". The engine's refusal is shown as the usual answer text. The fade (`transition()`) covers only the
  scene area, so the verb bar stays visible. `shownLocation` is what is on screen (lags the engine during a fade).
  Deviations: (1) tests use real mouse clicks, not a `clickHotspot` hook; (2) `__adv.transitioning` and `__adv.fade` were added.
  See `docs/learn/09-exits-and-transitions.md`.

### Step 10 — Speech & dialogs
- `say` events shown as text above the speaker (`speakers.yml` maps message keys → speaker; default = Grognak),
  per-speaker text color, duration from text length, click to skip, long text split into pages (reuse `chopToLines`).
- Talk to NPC → dialog choice list in verb area: topics = "Ask about <thing>" for things known/carried + "Goodbye".
- **Output:** talk to blacksmith, ask about Grelok → his line appears above him in his color.
- **Test:** unit for `speechDuration()` and page splitting; e2e talk + ask shows expected text.
- **Concept:** dialog systems, timed UI.
- **Status: done.** `games/<id>/speakers.yml` (optional; validated) maps message keys to speakers with colour, `thing` and `topics`.
  `client/src/ui/speech.ts` (`interpretSay`, `speechDuration`, `SpeechQueue`) and `ui/dialog.ts` are pure and unit-tested.
  Deviations: (1) only quoted words are speech, narration stays in the text box and is read first; (2) Grognak speaks only
  the quotes no one else owns (the default speaker); (3) the talk menu also hides the inventory and lists what you carry.
  See `docs/learn/10-speech-and-dialogs.md`.

### Step 11 — State-driven sprites in scenes
- Scene yml `sprites:` entries bind to things: position, image/anim, optional `states` with conditions on
  constraints or thing visibility, e.g. zombie: `standing` when `zombie_blocks_chapel_door: true`, `in_grave` otherwise.
  Picked-up things disappear; hidden gemstone appears after looking at rubble. Re-evaluate on `thing_changed`.
- **Output:** the world changes visibly as puzzles are solved.
- **Test:** unit for condition evaluation; e2e look at rubble → gemstone sprite visible.
- **Concept:** rendering derived from state (no duplicated state in the view).
- **Status: done.** `sprites:` entries have `id`, optional `thing`, `x`/`y` (feet) and `states` (first matching `when` on boolean
  constraints wins; `image:` shorthand for one look). `client/src/scene/spriteState.ts` (`lookOf`, pure, unit-tested);
  `RoomScene.refreshSprites()` re-evaluates after every event batch. Placeholder art is generated by `npm run placeholders`.
  Deviations: conditions are on boolean constraints plus the `thing`'s visibility (no separate thing-visibility `when`);
  sprites are static pictures (animation comes with the art pass). See `docs/learn/11-state-driven-sprites.md`.

### Step 12 — Cutscene sequencer
- Small data-driven sequencer: `cutscenes.yml` keyed by custom action alias; steps like
  `walk`, `face`, `anim`, `say`, `wait`, `fade`, `sfx`, `music`, `shake`. Input blocked while running.
- Cutscenes: zombie falls into grave, blacksmith forges the sword (fade + clang), Grelok finale → THE END screen → credits.
- **Output:** the final blow plays a short animated finale ending on an end screen.
- **Test:** sequencer unit test with fake actors (steps run in order, awaits finish, input lock released).
- **Concept:** scripting, async sequencing, cutscenes.
- **Status: done.** `games/<id>/cutscenes.yml` (optional, validated); step parser in `engine/src/cutscene.ts`; the pure,
  unit-tested `client/src/cutscene/Sequencer.ts` (async steps, input lock released in a `finally`, queueing);
  `RoomScene` implements the actor. Deviations: (1) cutscenes are keyed by the MESSAGE KEY the engine says (an action alias
  also "runs" on failure) and play only when that command also changed the world, so repeating a move does not replay
  them; (2) there is no `anim` step yet (no sprite animations until the art pass) and `sfx`/`music` are only logged
  until Step 15; (3) credits are a static list on the end screen; (4) the view (sprites, inventory) keeps its old look
  until the new `sync` step. Also fixed a race: a scene change that arrived while the fade was already fading in was lost.
  See `docs/learn/12-cutscenes.md`.

### Step 13 — Title screen, save & load
- Title scene: New game / Continue / Load. In-game menu (Esc or disk icon): Save (3 slots), Load, Quit to title.
  `localStorage` persistence of `engine.serialize()` + current scene/player position (wrap in try/catch).
- **Output:** save, reload page, continue from same spot with same inventory.
- **Test:** unit roundtrip of the save envelope; e2e save → reload → location restored.
- **Concept:** game state serialization, scene flow.
- **Status: done.** `TitleScene` (New game / Continue / Load), the in-game menu (Esc or the disk icon: Save, Load, Quit to title)
  built on a reusable modal `ui/MenuPanel.ts`; pure, unit-tested `save/saveGame.ts` (envelope, slots, `SaveStore` that never
  throws). Deviations: (1) a fourth `auto` slot is written when entering a scene and on Quit to title, and Continue loads the
  newest of all slots; (2) `?title=off` skips the title (used by the e2e tests); (3) Esc now opens the menu when nothing is
  half-done (it still cancels a half-built sentence or a conversation first); (4) `GameSession.engine` is now swappable, so the
  debug console keeps working after a load. See `docs/learn/13-title-save-load.md`.

### Step 14 — Prove engine/data separation: second mini game
- `games/demo/`: 2 rooms, 1 item, 1 puzzle, placeholder assets. Loaded via `?game=demo`. Zero changes in
  `packages/` allowed; if needed, fix the leak in the engine/client instead. (Foundation for "Save the Lunch!".)
- **Output:** `?game=demo` plays a different tiny game.
- **Test:** `npm run validate -- demo`; e2e: demo boots and its puzzle completes.
- **Concept:** reusable engine.
- **Status: done.** `games/demo/` is "The Rusty Gate": 2 screens (lane, orchard), haystack/key/oil can/gate/goat, a rusty-lock
  puzzle, a blocked exit, a state-driven sprite (open gate) and a short ending cutscene. Zero changes in `packages/`; the only
  game-specific additions are data (demo's `commands.yml` adds "push"). e2e `tests/e2e/demo.spec.ts` solves it with the mouse
  and from the console. Soft contracts found (documented in `docs/learn/14-second-game.md`): `gibberish1..3` message keys,
  the talk/ask key conventions, and the verb list being a client constant.

### Step 15 — Audio system (placeholder sound)
- `AudioManager`: per-scene music (from scene yml) with crossfade, SFX hooks on events (pickup, door, sword hit,
  UI click), M = mute, volume in settings, audio unlock on first click. Persist volume in localStorage.
- `tools/make-placeholder-music.ts`: writes short looping WAV/OGG tunes (square/saw + noise drums, Dorian/minor
  modes, fantasy-march feel) so every scene has music. SFX via jsfxr presets saved as files.
- **Output:** each location has its own loop; crossfades on scene change; SFX on actions.
- **Test:** validator checks audio files exist; e2e reads `__adv.audio.currentTrack` after scene change.
- **Concept:** audio in games, browser autoplay policy.
- **Status: done.** `AudioManager` (Phaser) + pure `audio/mix.ts` (fades, volume, settings; unit-tested). Scenes get a `music:` path; cutscene `sfx:`/`music:` now really play; click / pickup / door sounds are optional files. `M` mutes (not while typing in the console); the menu has a Volume row; both persist. `npm run placeholder-music` synthesises the tunes and effects itself (plain maths, deterministic; no jsfxr). Deviations: `.wav` only, one master volume. Validation also checks cutscene sound files. See `docs/learn/15-audio.md`.

### Step 16 — Art direction & AI asset pipeline
- `docs/art-style.md`: Golden Axe-inspired guidelines — limited palette (~32 colors, Mega Drive-like 9-bit RGB look),
  hard dark outlines, 2–3 tone shading, saturated sunset skies, chunky muscular proportions; one mood line per location.
- Character briefs (original designs, written as reusable prompt fragments in `art/prompts/characters.md`):
  - **Grognak** (player): blend of a tall barbarian and a stocky dwarf warrior — broad torso, powerful legs,
    braided brown beard, horned helmet, fur loincloth, big sword. Target ~32×48 px.
  - **Grelok** (villain): evil wizard mashed up from the Golden Axe series' sorcerer villains — tall, gaunt, hooded,
    flowing **cape and cloak in wine red**, dark armour pieces, skull-topped staff, glowing eyes. ~40×64 px.
  - NPCs: stout blacksmith (leather apron, hammer), chubby tipsy priest, bespectacled wizard in tower window, zombie.
- `art/prompts/*.md`: one prompt per asset with a shared style prefix ("16-bit Sega arcade pixel art, side view,
  limited palette, dark outlines, flat magenta #FF00FF background, ...") + exact target size and frame layout.
- `tools/gen-image.ts` (provider-agnostic): if an image API key is set in `.env`, generates images from prompts into
  `art/raw/`; otherwise it just lists prompts for you to paste into any image generator and drop results into `art/raw/`.
- `tools/import-art.ts` — the pipeline, run per asset (config in `art/assets.yml`: source, type, target size, frames):
  1. remove magenta background (chroma key) → transparency
  2. downscale to target size with nearest-neighbour (pixelate), optional crop/trim
  3. quantize to `palette.hex`, remove stray single pixels, add 1 px dark outline for sprites
  4. sprites: slice a frame grid → write Phaser atlas (`.png` + `.json`) with animation tags
  5. write result into `games/grelok/assets/...` under the same names as the placeholders
- **Output:** one finished asset (standing stone) and one test character frame in game, pixelated and on-palette.
- **Test:** unit tests for quantize (known color → nearest palette color) and frame slicing (grid → N frames);
  palette test — every non-placeholder PNG in `assets/` uses only palette colors.
- **Concept:** asset pipelines, why palettes and nearest-neighbour scaling make the "retro" look.
- **Status: done.** `docs/art-style.md`, `art/palette.hex` (32 Mega Drive-level colours), `art/prompts/fragments.yml` (shared style + one brief per character; YAML instead of `characters.md` so the tool can read it), `art/assets.yml` (25 assets with prompts). `tools/art/pipeline.ts` (pure, tested: chroma key, crop-to-union, resize nearest/box, despeckle, quantize with optional ordered dithering, outline, grid slice/compose, Phaser atlas JSON), `npm run import-art`, `npm run gen-image` (prints prompts, or calls any OpenAI-style image API when `.env` has a key; tested with a fake service only). Shipped in game: `standing_stone` (new plain sprite) and the Grognak sheet (+ `grognak.json` atlas). Deviations: (1) I cannot generate images, so the two raw pictures are stand-ins drawn by `npm run sample-raw` (replace `art/raw/*.png` with real ones and re-import); (2) the client does not read the atlas yet (Step 17); (3) the palette test checks every asset that has an `art/raw` picture. See `docs/learn/16-art-pipeline.md`.

### Step 17 — Art pass (sub-steps, one logical change each)
- **Status: nearly done.** All screens, the title and the interface have final art; Grognak's new animation sheet
  (brief 07) is still open. Details in the Progress notes at the end of this step.
AI is bad at keeping a character consistent across many frames, so keep frame counts low and let code do the rest:
mirror left↔right, walk bob via tween, talk = 2-frame mouth swap, idle = slow breathing scale tween.
- 17a Grognak: generate a character sheet (front, back, side) → derive `idle` (3 dirs), `walk` (4 frames side,
  2 frames front/back), `talk`, `reach` (pickup/use). Mirror for left.
- 17b Six backgrounds (plain, mountain, town, swamp, chapel, chapel interior), generated at ~4× size, downscaled
  to 320×144. Walkmasks drawn by the agent as polygons in scene yml → `tools/make-walkmask.ts` renders them to PNG.
- 17c Grelok (idle, laugh, death/explode for finale), NPCs (idle + talk), items + inventory icons (24×16),
  cursor, UI panel frame, title screen art.
- **Output:** placeholders replaced scene by scene; game looks finished.
- **Test:** validate + palette test + existing e2e still green; `npm run screenshots` saves one PNG per scene for review.
- **Workflow:** art is made in Codex/ChatGPT from one brief per screen (`art/briefs/NN-<screen>.md`, see
  `docs/pixel-art-generation.md`), which also imports it; Claude then does the scene side (walkmask, hotspots, exits,
  sprite positions), checks it in game and writes the next brief.
- **Progress:** screen 1 (plain) done: Grognak sheet, standing stone, pebble + icon, background (brief 01), and the
  walkmask from polygons: `walkArea:` in the scene file → `npm run walkmask` (`tools/make-walkmask.ts`). The north exit
  is now the mountains on the horizon. Open: Grognak's colours are too close to the dirt road (needs an art revision).
  See `docs/learn/17-walkmasks.md`.
- **Screen 2 (mountain):** brief 02 art in place: Grelok on his ledge, the rubble with the gemstone on it (scene
  sprites may set `depth:` to be drawn in front of what they lie on), floor traced as `walkArea:` (not up onto the
  ledge, not through the rubble).
- **Screen 3 (town):** brief 03 art in place: the blacksmith in front of his smithy, the priest against the tree; the
  floor is the square plus the street up to the town gate, which is the north exit. All six screens now have their
  final art; only Grognak's new animation sheet (brief 07) is still to come.
- **Screen 4 (swamp):** brief 04 art in place: the tower is part of the background, the wizard a sprite in its window
  (at x 108.5: half scene pixels are fine, art has 2 pixels per scene pixel), the shards drop onto the shore in front;
  floor = the shore plus the path to the east exit.
- **Screens 5-6 (chapel, chapel interior):** brief 05/06 art in place. Hotspots may have `when:` (like sprite states),
  so a thing that moves is clicked where it is now: the zombie stands at the door, then lies in the open grave (its
  sprite state also sets `x/y/depth`); the door leaf is clickable only while locked, after that the doorway is the
  exit into the chapel. `chapel_door_open` is imported at 68x96 to cover the background's door exactly. The interior
  has the basin left of centre and the entrance door as the west exit.
- **Art resolution:** 32x48 was too small for AI-generated art (grainy). Art now has 2 picture pixels per game pixel
  (`ART_SCALE`): canvas 640x400, every camera zooms 2x, so positions, scene files, walkmasks and the interface stayed in
  320x200 units. Backgrounds 640x288, Grognak 64x96 frames, icons 48x32; all assets re-imported or doubled. The walk
  cycle now passes through "legs together" with a small bob (now `client/src/scene/playerAnimation.ts`, see below; the
  client uses frame numbers from game.yml, not the atlas). See `docs/learn/18-art-resolution.md`.
- **Character animation:** game.yml `player:` may name its animations (`animations:`, `columns:`, `walkStride:`):
  `idle_*`, `walk_*` (distance-driven, so feet don't skate), `talk_*` (while his own speech shows), `reach_*` (before
  pick up / use / give / push reach the engine). West mirrors east. Without `animations:` the original 3x4 layout is
  used (the demo). The perspective scale moves in 5% steps so the sprite doesn't "boil". The importer builds a sheet
  from several pictures (`parts:` in `art/assets.yml`) with one common scale and palette. Grognak's art for it is
  brief 07 (also fixes his colours against the dirt road); the e2e tests for walk/talk/reach skip until it is
  imported. See `docs/learn/19-character-animation.md`.
- **Perspective sizes:** the player is no longer scaled at runtime (it broke the pixel art and made it shimmer). The
  importer writes his sheet in 2-pixel steps down to 60% (`sizes:` in assets.yml and game.yml, files
  `grognak_<height>.png`); the game draws the nearest 1:1. Today's art comes from the temporary `grognak_v1` entry
  in assets.yml; delete it when brief 07's parts are imported.
- **Speech:** outlined in a dark colour on every side, so coloured words stay readable on any background.
- **Status 2026-11-25 / next (details and step-by-step instructions in `docs/HANDOFF.md`):**
  1. Importer fix for sheet parts with different cell sizes (Codex found it; bottom-align cells before cropping).
  2. Import Grognak's brief 07 sheet once its six pictures exist; wire `game.yml`; tune `walkStride`; drop `grognak_v1`.
  3. DONE: Codex's title and interface art ("08") is used: title panorama and logo, interface frame, cursor
     (`titleScreen:` / `ui:` in game.yml, optional).
  Then step 17 is done; steps 18 (music), 19 (polish) and 20 (builds) remain.

### Step 18 — Music & SFX pass (AI-generated)
- `audio/prompts.md`: one prompt per track with a shared prefix ("instrumental, 16-bit Sega Mega Drive FM synth,
  YM2612 style, fantasy arcade, loopable, no vocals") + mood and tempo: title theme (heroic), plain (march),
  mountain (ominous, Grelok's theme), town (light, folk), swamp (eerie), chapel (organ/choir pad), finale (boss battle),
  victory jingle.
- Generate with any AI music tool, drop into `audio/raw/`. SFX: jsfxr presets (sword clang, pickup, door, magic burst).
- `tools/import-audio.ts` (uses ffmpeg): trim silence, cut to a loop length, short crossfade at the loop seam,
  loudness normalize, encode OGG (+ M4A fallback for Safari), write to `games/grelok/assets/music/` with placeholder names.
- **Output:** final soundtrack in game. **Test:** validator — every track exists, duration > 10 s, files < 3 MB.
- **Status: to do.** (`ffmpeg` is installed; the game still plays the generated placeholder tunes.)

### Step 19 — Polish
- Cursor states (crosshair / highlighted over hotspot / busy), hotspot name follows cursor (optional),
  text speed setting, fullscreen toggle, keyboard shortcuts for verbs, "skip cutscene" (Esc), credits including
  original Bethesda Easter egg credit.
- **Output:** feels like a classic LucasArts game. **Test:** existing suite green; e2e full walkthrough via clicks.
- **Status: started.** Done so far: custom mouse cursor (brief 08 art), dark outline around speech text, a click on
  the end screen returns to the title. Still open: cursor states, hotspot name at the cursor, text speed, fullscreen,
  verb shortcuts, skip cutscene, Bethesda credit, full walkthrough by clicks in e2e.

### Step 20 — Builds & distribution
- `npm run build` → static web build (itch.io-ready zip).
- Desktop wrapper (Electron; `steamworks.js` later for achievements) → `npm run package` for macOS/Windows.
- **Output:** downloadable zip + runnable desktop app. **Test:** e2e smoke against the production build.
- **Status: to do.**

---

## 5. Done = 
Full walkthrough playable by mouse from title to THE END, in both web and desktop builds,
with `packages/` containing zero Grelok-specific content.
