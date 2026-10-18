# 8. Grognak walks

**What you can see:** click the floor and Grognak walks there, around obstacles (the base of the standing stone),
smaller in the distance. Pick up the pebble and he first walks to it, then picks it up. Press **F1** to see the walk
grid (red = blocked), his route (white line) and the walk-to points.

## From picture to grid

The walkmask (`assets/walkmasks/<scene>.png`) is a black-and-white picture: white = floor. Searching a 320x144
picture pixel by pixel would be slow and pointless, so `gridFromMask` samples it into cells of 4x4 pixels (80x36 cells).
A cell is walkable only if its centre and corners are white, which keeps his feet out of obstacles.
Browsers do not hand you a picture's pixels directly: `scene/readMask.ts` draws the texture on a hidden canvas and reads
the numbers back.

## A* in one paragraph (`walk/pathfinding.ts`)

Start at his cell. Keep a list of cells to explore ("open"), always taking the one with the lowest
*cost so far + straight-line distance still to go*. Straight steps cost 1, diagonal ones 1.41. When we pop the goal
cell, follow the "came from" links backwards: that is the shortest route. The straight-line estimate is what makes it
fast: it explores towards the goal instead of in every direction. The open list is a small binary heap.
Two rules avoid ugly results: no diagonal step between two blocked corners, and if the goal is blocked or walled off,
we walk to the closest cell we *could* reach.

Raw A* routes zigzag along cell centres. **String pulling** fixes that: from each point, jump to the farthest later
point you can see in a straight line (`lineOfSight`). The line check uses three parallel lines, so he keeps a little
distance from walls. (A unit test found the bug that made me do that: a route that slipped exactly through the corner
where two blocked cells touch.)

## The update loop and delta time (`PathFollower`, `PlayerActor`)

Phaser calls `update(time, delta)` every frame; `delta` is the milliseconds since the last one. A game that moves
"3 pixels per frame" runs twice as fast on a 120 Hz screen. A game that moves **speed x delta** runs the same everywhere.
`PathFollower` does exactly that and nothing else, so it is easy to test: "30 fps for a second" and "120 fps for a second"
end up at the same place. A long frame (switching tabs) is capped so he never teleports.

## Depth sorting and perspective (`PlayerActor`, `WalkArea`)

- **Depth = y.** Phaser draws objects with a higher `depth` on top. Something whose feet are lower on screen is
  nearer to us, so `sprite.setDepth(y)` is the whole "walk behind things" trick (used with scene sprites in Step 11).
- **Perspective.** The scene's `scale: {top, bottom}` is the size at the farthest and the nearest row of floor;
  `WalkArea.scaleAt(y)` blends between them. His speed is multiplied by the same factor, so he seems to walk the same
  speed in the distance. (Scaling pixel art by 0.6 makes uneven pixels. Fine for a placeholder; real art would usually
  be drawn at 2-3 sizes or accept the softness.)
- The sprite's **origin is at his feet** (`setOrigin(0.5, 1)`), so `x, y` is where he stands.

## Walk, then act

Clicking "Pick up" + pebble produces a `Command` as before, but now `RoomScene.act()` asks `walk/plan.ts` where to stand:
the hotspot's `walkTo`. He walks there, turns (`facing` from the data, or towards the thing) and only then calls
`session.perform`. The engine still knows nothing about walking. Rules: looking is done from where he stands, and if
everything in the command is in his pocket there is nothing to walk to. With no verb chosen, a click on a thing is
just "Walk to", and clicking again somewhere else forgets the old walk and its pending action.

## Where he appears

When the engine reports `location_changed`, `walk/spawn.ts` finds the exit that leads back where he came from and puts
him at its `spawn` point (going north from plain, he arrives at the mountain's south exit). Step 9 adds the fade.

## Data

- `game.yml`: `player:` (sprite sheet, frame size) and `startPosition:`. The sheet has 3 columns (idle, walk 1, walk 2) and 4
  rows (facing south, north, east, west).
- `scenes/*.yml`: `scale: {top, bottom}`.
- `npm run placeholders` draws a placeholder Grognak, and blocked rectangles in two walkmasks (use `--force` to
  regenerate existing files). A test checks that every walk-to, spawn and start point is on walkable floor.

## Try it

- In `games/grelok/scenes/plain.yml` change `scale` to `{top: 1.0, bottom: 1.0}` and the perspective disappears.
- Paint a black wall into a walkmask with any image editor and watch him path around it (F1 shows the grid).
- Set `window.__adv.speedFactor = 0.2` in the browser console to watch the walk cycle in slow motion.
