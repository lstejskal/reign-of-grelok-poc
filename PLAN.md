# Reign of Grelok — Point & Click: Implementation Plan

Turn the text adventure in `../reign-of-grelok-ts` into a LucasArts-style (SCUMM-like) point-and-click
game with Golden Axe-inspired pixel art and FM/chiptune-style fantasy music.

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

### Step 7 — Inventory panel
- Inventory icons (placeholder 24×16 PNGs per pickable thing, generated), 2 rows × N, scroll arrows.
  Inventory items are valid objects for the sentence builder. Updates on `inventory_changed`.
- **Output:** pick up pebble → icon appears; Give gemstone to wizard removes it.
- **Test:** unit for pagination math; e2e pick up pebble → inventory contains pebble.
- **Concept:** UI driven by model state.

### Step 8 — Player character & walking
- Placeholder Grognak sprite (32×48 colored figure, 4 facings). Click on floor = Walk to.
- Pathfinding: A* on a grid sampled from the walkmask (e.g., 4 px cells), path smoothing optional.
- Before any action on a hotspot: walk to its `walkTo` point, face it, then perform. Depth sorting by y;
  perspective scaling (scene yml: `scale: {top: 0.6, bottom: 1.0}`).
- **Output:** Grognak walks around obstacles, smaller in the distance, walks up to things before using them.
- **Test:** A* unit tests on tiny hand-written masks (straight, around wall, unreachable → nearest point).
- **Concept:** pathfinding, sprite depth, update loop & delta time.

### Step 9 — Exits & scene transitions
- Exit hotspots (screen edges / doors). Walk to exit → `perform({verb:'go', objects:[dir]})`.
  If blocked (zombie, locked door) show the engine's message and stay. On success: fade out/in, spawn at the
  matching entry point of the new scene.
- **Output:** walk plain → mountain → back; chapel door refuses entry until puzzle solved.
- **Test:** e2e: `__adv.clickHotspot('walk_to','exit_n')` → scene id = mountain.
- **Concept:** scene lifecycle, transitions, spawn points.

### Step 10 — Speech & dialogs
- `say` events shown as text above the speaker (`speakers.yml` maps message keys → speaker; default = Grognak),
  per-speaker text color, duration from text length, click to skip, long text split into pages (reuse `chopToLines`).
- Talk to NPC → dialog choice list in verb area: topics = "Ask about <thing>" for things known/carried + "Goodbye".
- **Output:** talk to blacksmith, ask about Grelok → his line appears above him in his color.
- **Test:** unit for `speechDuration()` and page splitting; e2e talk + ask shows expected text.
- **Concept:** dialog systems, timed UI.

### Step 11 — State-driven sprites in scenes
- Scene yml `sprites:` entries bind to things: position, image/anim, optional `states` with conditions on
  constraints or thing visibility, e.g. zombie: `standing` when `zombie_blocks_chapel_door: true`, `in_grave` otherwise.
  Picked-up things disappear; hidden gemstone appears after looking at rubble. Re-evaluate on `thing_changed`.
- **Output:** the world changes visibly as puzzles are solved.
- **Test:** unit for condition evaluation; e2e look at rubble → gemstone sprite visible.
- **Concept:** rendering derived from state (no duplicated state in the view).

### Step 12 — Cutscene sequencer
- Small data-driven sequencer: `cutscenes.yml` keyed by custom action alias; steps like
  `walk`, `face`, `anim`, `say`, `wait`, `fade`, `sfx`, `music`, `shake`. Input blocked while running.
- Cutscenes: zombie falls into grave, blacksmith forges the sword (fade + clang), Grelok finale → THE END screen → credits.
- **Output:** the final blow plays a short animated finale ending on an end screen.
- **Test:** sequencer unit test with fake actors (steps run in order, awaits finish, input lock released).
- **Concept:** scripting, async sequencing, cutscenes.

### Step 13 — Title screen, save & load
- Title scene: New game / Continue / Load. In-game menu (Esc or disk icon): Save (3 slots), Load, Quit to title.
  `localStorage` persistence of `engine.serialize()` + current scene/player position (wrap in try/catch).
- **Output:** save, reload page, continue from same spot with same inventory.
- **Test:** unit roundtrip of the save envelope; e2e save → reload → location restored.
- **Concept:** game state serialization, scene flow.

### Step 14 — Prove engine/data separation: second mini game
- `games/demo/`: 2 rooms, 1 item, 1 puzzle, placeholder assets. Loaded via `?game=demo`. Zero changes in
  `packages/` allowed; if needed, fix the leak in the engine/client instead. (Foundation for "Save the Lunch!".)
- **Output:** `?game=demo` plays a different tiny game.
- **Test:** `npm run validate -- demo`; e2e: demo boots and its puzzle completes.
- **Concept:** reusable engine.

### Step 15 — Audio system (placeholder sound)
- `AudioManager`: per-scene music (from scene yml) with crossfade, SFX hooks on events (pickup, door, sword hit,
  UI click), M = mute, volume in settings, audio unlock on first click. Persist volume in localStorage.
- `tools/make-placeholder-music.ts`: writes short looping WAV/OGG tunes (square/saw + noise drums, Dorian/minor
  modes, fantasy-march feel) so every scene has music. SFX via jsfxr presets saved as files.
- **Output:** each location has its own loop; crossfades on scene change; SFX on actions.
- **Test:** validator checks audio files exist; e2e reads `__adv.audio.currentTrack` after scene change.
- **Concept:** audio in games, browser autoplay policy.

### Step 16 — Art direction & AI asset pipeline
- `docs/art-style.md`: Golden Axe-inspired guidelines — limited palette (~32 colors, Mega Drive-like 9-bit RGB look),
  hard dark outlines, 2–3 tone shading, saturated sunset skies, chunky muscular proportions; one mood line per location.
- Character briefs (original designs, written as reusable prompt fragments in `art/prompts/characters.md`):
  - **Grognak** (player): blend of a tall barbarian and a stocky dwarf warrior — broad torso, short powerful legs,
    braided red beard, horned helmet, fur loincloth, big sword. Target ~32×48 px.
  - **Grelok** (villain): evil wizard mashed up from the Golden Axe series' sorcerer villains — tall, gaunt, hooded,
    flowing **cape and cloak in wine red**, dark armour pieces, skull-topped staff, glowing eyes, horned circlet. ~40×64 px.
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

### Step 17 — Art pass (sub-steps, one logical change each, uncommitted)
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

### Step 18 — Music & SFX pass (AI-generated)
- `audio/prompts.md`: one prompt per track with a shared prefix ("instrumental, 16-bit Sega Mega Drive FM synth,
  YM2612 style, fantasy arcade, loopable, no vocals") + mood and tempo: title theme (heroic), plain (march),
  mountain (ominous, Grelok's theme), town (light, folk), swamp (eerie), chapel (organ/choir pad), finale (boss battle),
  victory jingle.
- Generate with any AI music tool, drop into `audio/raw/`. SFX: jsfxr presets (sword clang, pickup, door, magic burst).
- `tools/import-audio.ts` (uses ffmpeg): trim silence, cut to a loop length, short crossfade at the loop seam,
  loudness normalize, encode OGG (+ M4A fallback for Safari), write to `games/grelok/assets/music/` with placeholder names.
- **Output:** final soundtrack in game. **Test:** validator — every track exists, duration > 10 s, files < 3 MB.

### Step 19 — Polish
- Cursor states (crosshair / highlighted over hotspot / busy), hotspot name follows cursor (optional),
  text speed setting, fullscreen toggle, keyboard shortcuts for verbs, "skip cutscene" (Esc), credits including
  original Bethesda Easter egg credit.
- **Output:** feels like a classic LucasArts game. **Test:** existing suite green; e2e full walkthrough via clicks.

### Step 20 — Builds & distribution
- `npm run build` → static web build (itch.io-ready zip).
- Desktop wrapper (Electron; `steamworks.js` later for achievements) → `npm run package` for macOS/Windows.
- **Output:** downloadable zip + runnable desktop app. **Test:** e2e smoke against the production build.

---

## 5. Done = 
Full walkthrough playable by mouse from title to THE END, in both web and desktop builds,
with `packages/` containing zero Grelok-specific content.
