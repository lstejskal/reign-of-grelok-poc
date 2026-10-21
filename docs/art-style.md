# Art style guide

The look we are after: **a 16-bit Sega arcade game** (think the Mega Drive era and Golden Axe), but with our own
characters and places. Everything in the game is drawn small and then shown at a whole-number zoom, so every pixel
is deliberate. This page is the reference for anyone (human or AI image generator) who makes pictures for the game.

## The rules
1. **Size.** The screen is 320x200. The scene is 320x144; the bottom 56 px is the interface. Backgrounds are exactly 320x144.
   Grognak is 32x48, inventory icons 24x16, scene objects as big as their hotspot (see `scenes/*.yml`).
2. **Palette.** Every picture has its own small palette chosen to suit it (sprites 16 colours including the outline,
   backgrounds 32), and every colour is a Mega Drive colour: each of R, G, B is one of 0, 52, 87, 116, 144, 172, 206, 255
   (9-bit). The importer chooses and enforces this. `art/palette.hex` is a fixed 32-colour alternative (`palette: shared`).
3. **Outlines.** Every character and object has a hard 1 px dark outline in the palette's plum (`#340034`). Backgrounds do not.
4. **Shading.** 2-3 tones per material (shadow, base, light), light from the upper left. No gradients, no blur, no
   anti-aliasing. Large areas of flat colour are good; texture comes from a few well-placed dither pixels.
5. **Proportions.** Chunky and heroic: big torsos, big hands, strong legs, heads slightly oversized so faces read at 32 px.
6. **Skies.** Saturated, sunset-style bands: pale yellow into amber into orange into wine red into purple.
7. **View.** Side-on, like a stage. Characters stand on the floor of the scene; their feet are the bottom of the picture.
8. **Original.** Inspired by the genre, never copying a specific character, logo or screenshot.

## Why these rules
- A **small palette of console colours** is what makes things look like they belong together. Without it, a picture made by an AI (or by
  three different artists) looks like three different games. Each picture may pick its own colours, because that is how real
  16-bit games did it; what they share is the chunky 9-bit colour grid.
- **Nearest-neighbour scaling** and **hard outlines** keep pixels square and crisp. Smooth scaling blurs them and
  instantly looks "modern and cheap".
- **Few frames** (see the plan for Step 17): AI generators cannot keep a character consistent over many frames, so we
  draw a few and let code do the rest (mirror left/right, bob while walking, swap mouths when talking).

## Characters
| Who | Brief |
|---|---|
| **Grognak** (player, 32x48) | A tall barbarian crossed with a stocky dwarf warrior: broad torso, powerful legs, braided brown beard, horned helmet, fur loincloth, big sword. |
| **Grelok** (villain, ~40x64) | Gaunt, hooded evil wizard. Flowing cape and cloak in **wine red**, dark armour pieces, skull-topped staff, glowing eyes. |
| Blacksmith (~40x70) | Stout, sweaty, leather apron, hammer. |
| Priest (~30x40) | Small and chubby, tipsy, sits under a tree with a jug. |
| Wizard (~25x20 in a window) | Tall and bespectacled, lost in thought; we only see him in the tower window. |
| Zombie (~40x60) | Ragged, green-grey, arms forward; a second picture lying down. |

The same briefs, as reusable prompt text, live in `art/prompts/fragments.yml`.

## Places (one mood line each)
| Location | Mood |
|---|---|
| plain | Open crossroads at golden hour; a huge standing stone, long shadows, warm orange sky. |
| mountain | Menacing: red-lit rock, dark cliffs, rubble, a cold wine-red sky. Grelok's home. |
| town | Busy and warm: wooden houses, a smithy with a glowing forge, dusty street. |
| swamp | Gloomy green mist; a wizard's tower on a tiny island; sickly yellow light. |
| chapel | Calm and old: pale stone, a graveyard path, a locked door, purple dusk. |
| chapel interior | Dark and quiet: candles, stone arches, a marble basin glowing faintly. |

## How a picture gets into the game
1. Write or pick a prompt (`art/assets.yml` has one per asset; fragments are in `art/prompts/fragments.yml`).
2. Generate the picture with any image tool, or run `npm run gen-image` if an API key is configured.
   Ask for a **flat magenta (#FF00FF) background** so code can cut the figure out. Save it in `art/raw/<asset>.png`.
3. `npm run import-art -- <asset>` cleans it up (cut out, choose a palette, shrink, outline) and writes the finished
   file into `games/<game>/assets/` under the same name the placeholder had.
4. `npm test` checks that every imported picture stays within its colour budget and uses only Mega Drive colours.

See `docs/learn/16-art-pipeline.md` for how each cleaning step works and why.
