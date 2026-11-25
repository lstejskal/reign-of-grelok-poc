# Art brief 01: the first screen (the plain)

Instructions for an image generator (ChatGPT Images / Codex) working in this repository.
Goal: replace every placeholder you see on the first screen of the game with real art.

## What the first screen shows
The game starts on **the plain**: a crossroads at golden hour with a huge standing stone in the middle, a pebble on
the ground, and Grognak (the player) walking around. The pebble can be picked up, so it also needs an inventory icon.

| # | Asset id | What | Save the raw picture as | Ask for | Ends up in game as | Status |
|---|---|---|---|---|---|---|
| 1 | `grognak_ref` | Grognak, one big reference picture (not used in game) | `art/reference/grognak_ref.png` | 1024x1536 | (not imported) | Generated; pending user review |
| 2 | `grognak` | Grognak character sheet, 3 x 4 frames | `art/raw/grognak.png` | 1024x1536 | 32x48 per frame | Generated and imported; pending user review |
| 3 | `standing_stone` | The standing stone | `art/raw/standing_stone.png` | 1024x1024 | 40x70 | Generated and imported; pending user review |
| 4 | `pebble` | The pebble lying in the scene | `art/raw/pebble.png` | 1024x1024 | 12x8 | Generated and imported; pending user review |
| 5 | `icon_pebble` | The pebble's inventory icon | `art/raw/icon_pebble.png` | 1024x1024 | 24x16 | Generated and imported; pending user review |
| 6 | `bg_plain` | The plain background | `art/raw/bg_plain.png` | 1536x1024 | 320x144 | Generated and imported; pending user review |

Generation prompts, actual raw dimensions, references, and verification results are in [the generation record](01-plain-generation-log.md).

The game shrinks every picture a lot (a 1024 px picture of Grognak becomes 32x48 pixels). So: **big, simple, bold
shapes**, strong silhouettes, few details. Faces become 4-6 pixels wide; don't spend effort on them.

## Rules for every picture
(Rules 2, 3 and 5 are for pictures 1-5. The background, picture 6, has its own rules in its section.)
1. Save as **PNG**, exactly at the path in the table. Overwrite the file if it exists. Don't rename or move other files.
2. **Background: flat, solid magenta `#FF00FF`** (pure 255,0,255), the same colour everywhere: no gradient, no vignette,
   no texture, no floor, no cast shadow on the background, no transparency. Code cuts the magenta out; anything else
   around the subject stays in the picture as garbage.
3. **No magenta, pink or purple-pink on the subject itself** (it would be cut out too).
4. Nothing but the subject: **no text, no labels, no numbers, no grid lines, no frames, no signature, no watermark.**
5. The whole subject is visible, nothing cut off by the picture edge. Leave a little magenta margin around it.
6. Style (the same for every picture, see `docs/art-style.md`): 16-bit Sega Mega Drive arcade pixel art, like classic
   fantasy beat-em-ups; chunky heroic proportions; hard 1 px dark plum outlines; 2-3 tone cel shading, light from the
   upper left; no gradients, no blur, no anti-aliasing; about 16 colours. Our own original designs, never a copy of an
   existing game's character.

## The prompts
Every prompt starts with the shared style text below. Paste it in front of each prompt.

> **STYLE:** 16-bit Sega arcade pixel art in the style of classic beat-em-up games, limited palette of about 16 colours,
> hard 1 pixel dark plum outlines, 2-3 tone cel shading with light from the upper left, no gradients, no anti-aliasing,
> no text, crisp square pixels. The subject is alone on a flat solid magenta #FF00FF background, nothing else in the
> picture, whole subject visible, no shadow on the background.

### 1. `grognak_ref` → `art/reference/grognak_ref.png` (portrait 1024x1536)
Make this first. It fixes how Grognak looks; use it as the reference image for picture 2.
> STYLE + Full-body character design of Grognak, a heroic barbarian-dwarf hero, standing facing the viewer, feet
> apart: tall but stocky, very broad torso and shoulders, powerful legs, big hands, head slightly oversized; long
> braided brown beard; horned iron helmet with two curved ivory horns; bare muscular arms and chest with a leather
> strap across it; brown fur loincloth with a wide leather belt and an iron buckle; fur-wrapped boots; a big
> broadsword held in his right hand, pointing down. Colours: tan skin, brown beard and fur, grey iron, dark brown
> leather. Bold simple shapes that still read when shrunk to 32x48 pixels.

### 2. `grognak` → `art/raw/grognak.png` (portrait 1024x1536)
Give the generator picture 1 as the reference ("exactly this character").
> STYLE + Character sprite sheet of exactly the character in the reference image (same helmet, beard, colours,
> proportions, sword), as a grid of **3 columns and 4 rows, 12 cells of equal size**, evenly spaced, no lines between
> them. Every cell shows the whole character at the same size, centred in its cell, feet on the same level.
> Row 1: facing the viewer (front). Row 2: seen from behind (back). Row 3: walking to the right (side view, facing
> right). Row 4: walking to the left (side view, facing left; the mirror image of row 3).
> Column 1: standing still. Column 2: walking, left leg forward. Column 3: walking, right leg forward.
> The sword is held in his hand, pointing down, the same in every cell.

Check before saving: 12 figures, 3 per row, 4 rows; same size; none touches another cell; nothing written on the picture.

### 3. `standing_stone` → `art/raw/standing_stone.png` (square 1024x1024)
> STYLE + A huge weathered standing stone (menhir): a tall, tapering grey monolith, about twice as tall as it is wide,
> slightly leaning, with a few faint carved runes, cracks, and a little green moss and grass at its base. Standing on
> the bottom edge of the picture. Seen from the side, like a prop on a stage.

### 4. `pebble` → `art/raw/pebble.png` (square 1024x1024)
> STYLE + A single small, smooth, rounded grey pebble lying on the ground, seen from the side and a little from above.
> Simple oval shape, one highlight on the upper left. The pebble fills the middle of the picture.

### 5. `icon_pebble` → `art/raw/icon_pebble.png` (square 1024x1024)
> STYLE + Inventory icon, big and simple so it reads when tiny: one smooth rounded grey pebble, wider than tall,
> centred and filling most of the picture, one bright highlight on the upper left, a darker underside.

### 6. `bg_plain` → `art/raw/bg_plain.png` (landscape 1536x1024)
A full scene, so **no magenta and no cut-out**: it fills the whole picture. The game keeps a wide strip from the middle
(320x144, about 2.2 times as wide as tall), so **the top and bottom of the picture get cut off**: keep everything
important in the middle band. Grognak walks on the floor, so the floor must be open and flat.
Use the STYLE text without its last sentence (the magenta part), then:
> Wide panoramic side-on game background, like a stage, no characters, no text. A wide open grassy plain at golden
> hour, a great crossroads of four dirt roads: one road leads away into the distance towards dark, menacing mountains
> on the horizon; one leads off to the left edge towards a gloomy green swamp; one leads off to the right edge towards
> a small old chapel on a hill; one comes towards the viewer (towards a town). Tall green grass on both sides of the
> roads, bending in the wind. The middle of the picture is an empty, flat dirt clearing where the roads meet (a huge
> standing stone will be placed there later, so leave the centre empty, no stone). The lower half is open, flat,
> walkable ground; the horizon sits a little above the middle. Saturated sunset sky in bands: pale yellow, amber,
> orange, wine red, purple. Long shadows from the left. Large flat colour areas, about 32 colours.

Check before saving: no standing stone or people in it; the centre and the whole lower half are open ground.

## After the pictures are saved (if you can run commands)
Run these in the repository root and fix (regenerate) any picture that fails:
```
npm run import-art -- grognak standing_stone pebble icon_pebble bg_plain
npm test
npm run validate
```
- `import-art` writes the finished, shrunk pictures into `games/grelok/assets/`. If it says *"nothing left after
  removing the magenta background"*, the background was not pure `#FF00FF`: regenerate.
- Look at the results in `games/grelok/assets/sprites/` and `games/grelok/assets/icons/`: a figure that came out tiny
  or cut off means the subject did not fill the picture, or the sheet's cells were not even.
- Do **not** change code, `art/assets.yml`, or other assets, and do **not** commit. Report which pictures you made.
