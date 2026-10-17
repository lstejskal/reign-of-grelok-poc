# Step 2 - Simulation vs. presentation

**The engine only simulates.** `packages/engine/src/Engine.ts` holds the world (things, locations, flags) and the
rules. It never prints or draws. You call `engine.perform({ verb, objects })` and get back a list of
`EngineEvent`s: what was said, what moved, whether the game ended (`src/types.ts`).

**Clients show events.** `node/cli.ts` prints them to a terminal; in later steps a Phaser scene will turn the same
events into speech bubbles, fades and walking. One engine, any number of front ends.

**Events by diffing.** `run()` snapshots the world, runs the command, snapshots again, and reports what differs
(`thing_changed`, `inventory_changed`, `location_changed`). The game rules stay free of event bookkeeping.

**Data holds the puzzles.** `games/grelok/logic/custom_actions.yml` is a tiny scripting language
(`verify`, `set`, `add`, `say`...) interpreted by `parser/CustomActionRunner.ts`.

**Determinism & purity.** No `Math.random()` unless injected, no Node/DOM imports in `src/`
(`test/purity.test.ts` enforces it). Same input, same output - easy to test, safe to save and replay.

Try it: `npm run cli`, then `north`, `look at rubble`. Or read `test/engine.test.ts` for the API in action.
