# 17 - Walkmasks drawn as polygons

**Concept:** the walkmask (white = floor) has to match its background exactly, or the hero walks on the sky or
through a wall. Instead of painting it by hand, the floor is written down as a few polygons in the scene file and a
tool paints the picture. Points are easy to read, review in a diff, and nudge when the background changes.

- Data: `walkArea:` in `games/<id>/scenes/<location>.yml`: `floor` polygons, minus `blocked` ones (the base of
  something big standing on the floor, like the standing stone, so he walks round it).
- `npm run walkmask -- grelok plain` paints `assets/walkmasks/plain.png` (`tools/make-walkmask.ts`, pure part in
  `tools/walkmask.ts`; each pixel is judged by its centre, the same rule as hotspots).
- The game still reads only the PNG, so nothing in `packages/client` changed.
- `tools/walkmask.test.ts` fails when a picture is older than its polygons; `validateGame` checks the polygons.
- Tracing: blow the background up 4x with a 10 px grid, follow the edge of the ground, then check with F1 in game.
- Exits follow the picture too: in the plain the way north is the mountains on the horizon, and he walks up the road
  behind the stone (a thing wins where it overlaps an exit).
