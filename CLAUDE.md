# Reign of Grelok - notes for Claude

Read `docs/HANDOFF.md` first (state, rules learned, open tasks, the "Log" of what Codex did meanwhile), then
`PLAN.md`. Codex does the art (briefs in `art/briefs/`, generation logs next to them); Claude wires scenes and writes
engine/client code, and writes the next briefs.

- Keep the "Status at a glance" table at the top of `PLAN.md` (and each step's Status line) current.
- Follow `PLAN.md` section 3 rules. Commit only when the user asks; keep Codex's unfinished work out of unrelated
  commits.
- Logical 320x200, art at 2x (`ART_SCALE`); floors as `walkArea:` polygons; never scale pixel art at runtime.
- Restart the dev server (`.claude/launch.json` "game") after new picture files appear.
- Verify in the real game (headless Playwright + `window.__adv`), not only with tests.
- On Windows, don't write TypeScript through `node -e` or `sed` with backticks; use the file editor.
