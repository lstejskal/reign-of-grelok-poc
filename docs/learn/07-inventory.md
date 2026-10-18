# 7. The inventory panel

**What you can see:** pick up the pebble and a little icon appears in the panel at the bottom right. Click
an icon in a sentence ("Use pebble with ...", "Give gemstone to wizard"), hover it to see its name, right-click to
look at it. Give the gemstone away and the icon disappears.

## UI driven by model state

The panel owns no list of items. After every batch of engine events the scene reads
`engine.state.inventory` and redraws the slots from it. There is no "add icon" / "remove icon" code to get out of
sync with the game: whatever the engine says you carry is what you see. This is the same idea as the sentence
line and hotspots, and it is how most game UIs stay correct.

## Paging is just arithmetic (`ui/inventory.ts`)

The grid has 2 rows and 7 columns, filled top to bottom, then left to right. With more than 14 items the grid
scrolls one column at a time. `maxScroll`, `clampScroll` and `visibleItems` are pure functions, so the unit
tests check the edge cases (exactly full, one too many, scrolled too far after giving things away) without any
graphics. `slotAt` / `itemAt` turn a mouse position into an item, and the scene treats an inventory item exactly
like a scene hotspot: both are just "a thing under the mouse".

## Icons are data

Every pickable thing needs `assets/icons/<thing alias>.png`, 24x16 pixels. The validator enforces it (so a
forgotten icon is a clear message and not a missing-texture box), and `npm run placeholders` generates
a coloured tile with a small symmetric pattern from the name, so each item looks different until real art arrives.
Existing icons are never overwritten.

## The answer band moved

The bottom strip is now full (verbs, inventory), so the engine's answers appear on a dark band at the top of the
scene. Clicking the band reads on and does not reach the scene, as in the classic games, which is why the end-to-end
test for "Give gemstone to wizard" first has to dismiss the room description that covered the wizard.

## Try it

- Delete `games/grelok/assets/icons/pebble.png` and run `npm run validate`.
- Change `INVENTORY.cols` in `ui/inventory.ts` to 2 and see how the arrows light up once you carry three items.
