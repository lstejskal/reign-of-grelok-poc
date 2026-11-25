# 19 - Character animation: walk, talk, reach

**Concept:** an animation is a list of frames plus a rule for when to move on. A walk moves on by **distance**: one
whole cycle (two steps) per `walkStride` scene pixels, shorter in the distance, so the feet keep pace with the ground
and never skate, at any speed. Talking and reaching move on by **time**.

- Data: `game.yml` `player:` `animations:` (frame numbers per `idle_*`, `walk_*`, `talk_*`, `reach_*`), `columns:`,
  `walkStride:`. West mirrors east (art drawn once, never out of step). No table = the original 3x4 sheet.
- Logic: `client/src/scene/playerAnimation.ts` (pure, tested): `playerFrame()` picks the frame (reach > talk > walk
  > idle), `reachTiming()` says when the hand is out, `quantizeScale()` keeps the perspective scale in 5% steps.
  Nearest-neighbour scaling by a slightly different factor drops different pixel rows, so a scale that changes
  every frame makes a sprite "boil"; steps change it rarely.
- `PlayerActor.reach(then)`: RoomScene sends pick up / use / give / push to the engine when the hand is out.
  `talking` is set every frame while his own words are on screen.
- A good walk cycle: contact (legs apart, heel down), down (lowest), passing (legs together, highest), then the same
  with the other leg. The up-and-down is drawn into the frames.
- Art: an image generator keeps one character consistent in a small strip far better than in a big grid, so each
  animation is its own picture (`parts:` in `art/assets.yml`); `processPartsSheet` treats all frames together (one
  scale, one palette) and the importer prints the matching `animations:` table.
