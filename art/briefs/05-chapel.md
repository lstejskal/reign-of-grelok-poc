# Art brief 05: the chapel and its graveyard

Instructions for an image generator (ChatGPT Images / Codex) working in this repository.
Goal: replace every placeholder on the **chapel** screen (outside: the graveyard) with real art, in the same style as
the screens before it.

Read first: `docs/pixel-art-generation.md`, `docs/art-style.md`, and the earlier briefs in this folder with their
generation records. The pictures of the finished screens are the style baseline: attach them as references.

## What the chapel screen shows
East of the plain stands an **abandoned chapel**, surrounded by a **graveyard** half-covered in mist. A **zombie**
stands right in front of the chapel's entrance and won't let anyone in. Near the path is an **open grave**. The
chapel's wooden **door** is on the right and it is locked. The path back west to the plain leaves on the left.

What happens here: Grognak hits the zombie with his rusty sword and it **falls down** (a second picture of the same
zombie, lying flat). He unlocks the door with the priest's key and the door **stands open** (a picture of the open
door, laid over the closed one in the background). Through it he goes east, into the chapel.

The two zombie pictures already in `art/raw/` were early tests made before the style baseline: **replace them**.

| # | Asset id | What | Save the raw picture as | Ask for | Ends up in game as (picture pixels, 2 per screen pixel) | Status |
|---|---|---|---|---|---|---|
| 1 | `bg_chapel` | The chapel and graveyard background | `art/raw/bg_chapel.png` | 1536x1024 | 640x288 | Generated/imported; Terra reviewed; pending user review |
| 2 | `zombie_standing` | The zombie, standing, arms forward | `art/raw/zombie_standing.png` | 1024x1536 | 96x128 | Generated/imported; Terra reviewed; pending user review |
| 3 | `zombie_down` | The same zombie, lying flat, defeated | `art/raw/zombie_down.png` | 1536x1024 | 120x48 | Generated/imported; Terra reviewed; pending user review |
| 4 | `open_grave` | The open grave by the path | `art/raw/open_grave.png` | 1536x1024 | 100x50 | Generated/imported; Terra reviewed; pending user review |
| 5 | `chapel_door_open` | The chapel door, standing open | `art/raw/chapel_door_open.png` | 1024x1536 | 80x120 | Generated/imported; Terra reviewed; pending user review |

Order: 1 first (it fixes the door's look), then 2, then 3 (with 2 as reference), then 4, then 5 (with 1 as reference).

The game shrinks every picture a lot (the zombie becomes 96x128 pixels). So: **big, simple, bold shapes**, strong
silhouettes, few details.

## References to attach
- `art/raw/bg_plain.png` and `art/raw/bg_mountain.png`: style, pixel density and colour treatment of a background.
  The plain's horizon shows this chapel on its hill (right edge: a small pale chapel with a cross): the chapel screen
  must look like that building seen up close.
- `art/reference/grognak_ref.png` and `art/reference/grelok_ref.png`: how characters are drawn. Do not copy them.
- For 3: picture 2 controls the zombie's identity. For 5: picture 1 controls the door (its wood, frame and size).

## Rules for every picture
(Rules 2, 3 and 5 are for the cut-out pictures 2-5. The background, picture 1, has its own rules in its section.)
1. Save as **PNG**, exactly at the path in the table. Overwrite the file if it exists. Don't rename or move other files.
2. **Background: flat, solid magenta `#FF00FF`** (pure 255,0,255), the same colour everywhere: no gradient, no vignette,
   no texture, no floor, no cast shadow on the background, no transparency.
3. **No magenta, pink or purple-pink on the subject itself** (it would be cut out too). The zombie's flesh is green-grey,
   its wounds dark red-brown, never pink.
4. Nothing but the subject: **no text, no labels, no numbers, no grid lines, no frames, no signature, no watermark.**
5. The whole subject is visible, nothing cut off by the picture edge. Leave a little magenta margin around it.
6. Style (the same as the earlier screens, see `docs/art-style.md`): 16-bit Sega Mega Drive arcade pixel art, like
   classic fantasy beat-em-ups; chunky proportions; hard 1 px dark plum outlines; 2-3 tone cel shading, light from the
   upper left; no gradients, no blur, no anti-aliasing; about 16 colours. Our own original designs. Spooky, not gory.

## The prompts
Every cut-out prompt starts with the shared style text below.

> **STYLE:** 16-bit Sega arcade pixel art in the style of classic beat-em-up games, limited palette of about 16 colours,
> hard 1 pixel dark plum outlines, 2-3 tone cel shading with light from the upper left, no gradients, no anti-aliasing,
> no text, crisp square pixels. The subject is alone on a flat solid magenta #FF00FF background, nothing else in the
> picture, whole subject visible, no shadow on the background.

### 1. `bg_chapel` → `art/raw/bg_chapel.png` (landscape 1536x1024)
A full scene, so **no magenta and no cut-out**: it fills the whole picture. The game keeps a wide strip from the middle
(640x288, about 2.2 times as wide as tall: the band from about y=166 to y=857 of a 1536x1024 picture), so **the top
and bottom get cut off**: keep everything important inside that band, including the chapel's roof and cross.
Grognak walks on the ground, so it must be open and flat. Use the STYLE text without its last sentence, then:
> Wide panoramic side-on game background, like a stage, no characters, no text. An abandoned old chapel at purple dusk:
> on the **right third** of the picture, the front of a small chapel of pale weathered stone, seen from the side like a
> stage set, with a small bell tower and a stone cross on top, and at ground level a **closed, arched, old wooden door
> with iron bands** in a pale stone frame (the door is about a quarter of the chapel's height, its bottom on the ground
> line). The rest of the picture is a **graveyard**: crooked gravestones and leaning wooden crosses in the background,
> a low broken stone wall, a dead tree, and bands of pale lilac mist lying low over the graves. A broad, flat, open
> dirt path in the lower half runs from the left edge (back west to the plain) to the chapel door, open and walkable;
> the ground in the middle of the path is left empty (an open grave will be placed there later). Sky in saturated
> bands: dusky purple, wine red, a thin line of orange at the horizon, a pale moon. Cold purple shadows, a warm last
> light from the left. Large flat colour areas, about 32 colours. Calm, old and spooky.

Check before saving: no people or zombies, no open grave; the door is clearly visible and closed; the path across the
lower half is open; nothing important in the top or bottom sixth.

### 2. `zombie_standing` → `art/raw/zombie_standing.png` (portrait 1024x1536)
> STYLE + An original shambling zombie, standing, turned a little to the left of the picture (towards the hero), both
> arms stretched forward, head tilted: ragged green-grey skin, sunken hollow eyes glowing faint yellow, a gaping jaw,
> thin straggly dark hair, the torn remains of a brown peasant tunic and rope belt, ragged trousers, bare bony feet.
> Gaunt but sturdy enough to block a door. Full body, standing on the bottom edge, filling most of the picture height.
> Spooky and a little comic, not gory. He will be 96x128 pixels in the game.

### 3. `zombie_down` → `art/raw/zombie_down.png` (landscape 1536x1024)
Give picture 2 as the reference ("exactly this zombie").
> STYLE + Exactly the zombie in the reference image (same skin, hair, tunic, trousers, colours), now **lying flat on
> his back on the ground, defeated**, seen from the side: head on the left, feet on the right, arms flopped out, eyes
> shut as crosses, a dazed swirl above the head. Much wider than tall (about 2.5 to 1), resting on the bottom edge,
> filling the width of the picture. Comic, not gory.

### 4. `open_grave` → `art/raw/open_grave.png` (landscape 1536x1024)
> STYLE + A freshly dug open grave in a dirt path, seen from the side and a little from above, like a prop on a stage:
> a dark rectangular hole in the ground (deep black-brown inside), a mound of loose brown earth heaped behind it with a
> shovel stuck in it, and a small leaning wooden grave marker with no writing. About twice as wide as tall, flat bottom
> on the bottom edge of the picture.

### 5. `chapel_door_open` → `art/raw/chapel_door_open.png` (portrait 1024x1536)
Give picture 1 as the reference ("exactly the chapel door in this picture").
> STYLE + Exactly the arched wooden chapel door from the reference image (same wood, same iron bands, same pale stone
> frame), but **standing open**: the door leaf swung inwards and seen at an angle along the left side, and inside a
> deep dark interior with a faint warm glow of candles far back. Seen straight on, the stone frame filling the picture
> from top to bottom, standing on the bottom edge. Only the doorway and its frame, no wall around it.

## After the pictures are saved (if you can run commands)
Run these in the repository root and fix (regenerate) any picture that fails:
```
npm run import-art -- bg_chapel zombie_standing zombie_down open_grave chapel_door_open
npm test
npm run validate
```
- `import-art` writes the finished pictures into `games/grelok/assets/`. *"nothing left after removing the magenta
  background"* means the background was not pure `#FF00FF`: regenerate.
- Look at the results at final size (enlarged with nearest neighbour), and in the game: `npm run dev`, then in the
  browser console `__adv.session.performText('east')` takes you from the plain to the chapel. The zombie is already in
  the scene; the open grave is not yet (Claude adds it), and the open door's position will be fitted to the new
  background by Claude.
- Record prompts, references used and results in `art/briefs/05-chapel-generation-log.md`, as for brief 01.
- Do **not** change code, scene files, `art/assets.yml`, or other assets, and do **not** commit. Report which pictures
  you made.

## Then Claude does
Add the open grave as a sprite in `games/grelok/scenes/chapel.yml`, place the zombie (both looks) and the open door
exactly over the background's door, fit the hotspots and both exits, trace the path (`walkArea:` →
`npm run walkmask`), and check the screen in the game, including the zombie fight and the door opening.
