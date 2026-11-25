# Instructions for coding agents (Codex)

Start with `docs/HANDOFF.md`: current state, rules, and the open tasks in order. The full plan is `PLAN.md`;
the art workflow is `docs/pixel-art-generation.md` and the art briefs in `art/briefs/`.

Essentials:
- Engine (`packages/engine`) is pure TypeScript; client (`packages/client`) holds no game-specific content;
  game data lives in `games/<id>/`.
- Logical coordinates are 320x200; art has 2 picture pixels per logical pixel (`ART_SCALE`). Walkmasks are 320x144
  and are generated from `walkArea:` polygons (`npm run walkmask`).
- Before finishing: `npm run typecheck`, `npm test`, `npm run validate`, `npm run e2e`, and look at the result in the
  running game (restart the dev server after adding picture files).
- Do not commit unless the user asks. Record what you did in the "Log" section of `docs/HANDOFF.md`, and update the
  "Status at a glance" table at the top of `PLAN.md` when a step changes.
