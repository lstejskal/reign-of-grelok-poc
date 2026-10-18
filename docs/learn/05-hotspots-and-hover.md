# 5. Hotspots and hover

**What you can see:** point the mouse at the standing stone and "standing stone" appears in the sentence line.
Press **F1** to draw every outline the scene data describes.

## Screen to game coordinates

The browser reports the mouse in *screen* pixels, but the game lives in a 320x200 picture that is magnified by
an integer zoom (Step 1). Phaser divides by the zoom for us, so `pointer.x` is already a game pixel
(0..319). If you ever draw the canvas some other way, this conversion is the first thing to check.

## Is the point inside the shape? (`scene/hitTest.ts`)

A hotspot is a polygon from the scene yml. To test a point we shoot a ray to the right and count the polygon
edges it crosses: odd = inside, even = outside. It works for any shape, also concave ones.
Two small decisions make it dependable:

- we test the pixel's **centre** (x + 0.5), so a point never sits exactly on an edge;
- hotspots later in the list are drawn on top, so we test **from the last to the first** and the first hit wins.

## The engine decides what exists

A hotspot is only the *shape*. Whether the thing is there at all is the engine's business:
`engine.visibleThings()`. The gemstone is hidden under the rubble, so its hotspot is skipped (you hover
"rubble") until `look at rubble` reveals it, even if the mouse never moves. That is why RoomScene re-checks
the hover after every batch of engine events, not only when the mouse moves.

## Debug overlay (`scene/hotspotOverlay.ts`)

Green = hotspot, grey = hidden thing, blue = exit, yellow cross = walk-to point, magenta cross = spawn point.
Drawing the data over the picture is the fastest way to find a polygon that is in the wrong place.
It is the first of several debug views you will want in any game you build.

## Try it

- Hover the pebble, then press F1 and compare the outline with the picture.
- In `games/grelok/scenes/plain.yml` move a polygon, save, and watch the hover area follow (Vite reloads).
- Type `/` and `north`, `look at rubble`, and watch the sentence line change under a still mouse.
