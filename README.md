# Reign of Grelok - point & click (proof of concept)

See `PLAN.md` for the full implementation plan.

## Commands
- `npm install` - install dependencies
- `npm run dev` - start the game at http://localhost:5173 (press / for the debug console)
- `npm run cli` - play the text version in the terminal (uses the pure engine)
- `npm run validate` - check a game's data files (`npm run validate -- <game-id>`)
- `npm run import-audio` - turn the music in `audio/raw/` into game-ready loops (needs ffmpeg; see `audio/tracks.yml`)
- `npm run placeholders` - generate placeholder backgrounds/walkmasks for a game (never overwrites existing files)
- `npm test` - unit tests (Vitest)
- `npm run e2e` - browser tests (Playwright). Needs a Chromium: `npx playwright install chromium`,
  or set `PW_CHROMIUM_PATH=/path/to/chromium`.
- `npm run typecheck`

## Layout
- `packages/engine/src` - pure game logic (no DOM / Phaser / Node)
- `packages/engine/node` - Node-only helpers: YAML loader, terminal player
- `packages/client` - generic Phaser point & click runtime
- `games/<id>` - one game = data only: `game.yml`, `logic/*.yml` (rules, text), `scenes/*.yml` (hotspots, exits), later `assets/`
- `tools` - node scripts (validator, later asset tools). Play another game with `?game=<id>`
