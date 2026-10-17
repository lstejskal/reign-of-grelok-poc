# Reign of Grelok - point & click (proof of concept)

See `PLAN.md` for the full implementation plan.

## Commands
- `npm install` - install dependencies
- `npm run dev` - start the game at http://localhost:5173
- `npm run cli` - play the text version in the terminal (uses the pure engine)
- `npm test` - unit tests (Vitest)
- `npm run e2e` - browser tests (Playwright). Needs a Chromium: `npx playwright install chromium`,
  or set `PW_CHROMIUM_PATH=/path/to/chromium`.
- `npm run typecheck`

## Layout
- `packages/engine/src` - pure game logic (no DOM / Phaser / Node)
- `packages/engine/node` - Node-only helpers: YAML loader, terminal player
- `packages/client` - generic Phaser point & click runtime
- `games/grelok` - game data (`logic/*.yml`) and, later, scenes and assets
