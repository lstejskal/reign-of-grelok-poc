# 18 - Art at twice the resolution of the game

**Concept:** logical resolution and art resolution don't have to be the same. The game still thinks in 320x200: every
position, hotspot, walkmask, exit and piece of interface is in those units. Pictures have 2 pixels per game pixel
(`ART_SCALE` in `packages/engine/src/sceneTypes.ts`): a background is 640x288, Grognak's frames 76x116 (64x96 until the size pass of November 2026), icons 48x32.
Why: AI-generated art has much more detail than 32x48 can hold. Squeezing it that small turned Grognak into speckle;
at 64x96 the face, beard, belt and legs survive.

- `packages/client/src/config.ts`: the canvas is 640x400, every scene's camera zooms by 2 (`useLogicalCamera`), so the
  interface looks exactly as before. Pictures are drawn at `artScale` (1/2) and so show every pixel they have.
- Input: `logicalPointer()` turns canvas pixels into game units. `__adv.zoom` = screen pixels per game pixel.
- The player is placed on whole picture pixels (half game pixels), which makes walking smoother too.
- Walkmasks are not art: they stay 320x144. The validator knows which is which.
- `art/assets.yml` sizes are picture pixels; placeholders are drawn at game size and doubled.

**Walk cycle:** now in `client/src/scene/playerAnimation.ts` (see 19). Swapping two stride frames looks like sliding (seen from the side they
have the same outline). The cycle is stride, legs together, other stride, legs together, with a 1 picture-pixel bob on
"legs together".
