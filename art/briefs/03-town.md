# Art brief 03: the town of Homeburg

Instructions for an image generator (ChatGPT Images / Codex) working in this repository.
Goal: replace every placeholder on the **town** screen with real art, in the same style as screens 1 and 2.

Read first: `docs/pixel-art-generation.md`, `docs/art-style.md`, and briefs [01](01-plain.md) and [02](02-mountain.md)
with their generation records. The pictures of screens 1 and 2 are the style baseline: attach them as references.

## What the town screen shows
South of the plain lies the little town of **Homeburg**. Its main square would be picturesque, were it not for the
**gallows** where captured orcs hang. Everything is closed except the **smithy**: in front of it, on the left, stands
the **blacksmith**, sweaty and tired, forging swords for the army. On the right, under a tree, sits a small chubby
**priest** who has clearly been drinking. The road back north to the plain leads away into the distance.

What happens here: the priest gives Grognak a **jug** and the **chapel key** and asks him to fetch holy water. Later
the blacksmith forges the gemstone shards into Grognak's sword, which becomes the **shining sword**.

| # | Asset id | What | Save the raw picture as | Ask for | Ends up in game as (picture pixels, 2 per screen pixel) | Status |
|---|---|---|---|---|---|---|
| 1 | `bg_town` | The town square background | `art/raw/bg_town.png` | 1536x1024 | 640x288 | Generated/imported; Terra reviewed; pending user review |
| 2 | `blacksmith` | The blacksmith, standing | `art/raw/blacksmith.png` | 1024x1536 | 80x140 | Generated/imported; Terra reviewed; pending user review |
| 3 | `priest` | The priest, sitting | `art/raw/priest.png` | 1024x1024 | 60x80 | Generated/imported; Terra reviewed; pending user review |
| 4 | `icon_jug` | Inventory icon: the priest's clay jug | `art/raw/icon_jug.png` | 1024x1024 | 48x32 | Generated/imported; Terra reviewed; pending user review |
| 5 | `icon_chapel_key` | Inventory icon: the chapel key | `art/raw/icon_chapel_key.png` | 1024x1024 | 48x32 | Generated/imported; Terra reviewed; pending user review |
| 6 | `icon_shining_sword` | Inventory icon: the reforged, glowing sword | `art/raw/icon_shining_sword.png` | 1024x1024 | 48x32 | Generated/imported; Terra reviewed; pending user review |

Order: 1 first (it sets the place), then 2-3 with 1 and screen 1-2 characters as style references, then 4-6.

Completed files, prompts, visual review, previews, verification, asset coverage and Claude placement notes are in [the generation record](03-town-generation-log.md).

The game shrinks every picture a lot (the blacksmith becomes 80x140 pixels, an icon 48x32). So: **big, simple, bold
shapes**, strong silhouettes, few details.

## References to attach
- `art/raw/bg_plain.png` and `art/raw/bg_mountain.png`: style, pixel density and colour treatment of a background.
- `art/reference/grognak_ref.png` and `art/reference/grelok_ref.png`: how characters are drawn (outline, shading,
  chunky proportions, level of detail). Do not copy their content.
- For 6: `games/grelok/assets/icons/rusty_sword.png` (enlarged) or `art/raw/icon_rusty_sword.png`: the shining sword is
  **the same sword**, reforged: same shape, same crossguard and grip, but clean with a glowing blade.

## Rules for every picture
(Rules 2, 3 and 5 are for the cut-out pictures 2-6. The background, picture 1, has its own rules in its section.)
1. Save as **PNG**, exactly at the path in the table. Overwrite the file if it exists. Don't rename or move other files.
2. **Background: flat, solid magenta `#FF00FF`** (pure 255,0,255), the same colour everywhere: no gradient, no vignette,
   no texture, no floor, no cast shadow on the background, no transparency.
3. **No magenta, pink or purple-pink on the subject itself** (it would be cut out too). Careful with rosy cheeks and the
   priest's red nose: keep them warm red-orange, never pink.
4. Nothing but the subject: **no text, no labels, no numbers, no grid lines, no frames, no signature, no watermark.**
5. The whole subject is visible, nothing cut off by the picture edge. Leave a little magenta margin around it.
6. Style (the same as screens 1-2, see `docs/art-style.md`): 16-bit Sega Mega Drive arcade pixel art, like classic
   fantasy beat-em-ups; chunky proportions; hard 1 px dark plum outlines; 2-3 tone cel shading, light from the
   upper left; no gradients, no blur, no anti-aliasing; about 16 colours. Our own original designs.

## The prompts
Every cut-out prompt starts with the shared style text below.

> **STYLE:** 16-bit Sega arcade pixel art in the style of classic beat-em-up games, limited palette of about 16 colours,
> hard 1 pixel dark plum outlines, 2-3 tone cel shading with light from the upper left, no gradients, no anti-aliasing,
> no text, crisp square pixels. The subject is alone on a flat solid magenta #FF00FF background, nothing else in the
> picture, whole subject visible, no shadow on the background.

### 1. `bg_town` → `art/raw/bg_town.png` (landscape 1536x1024)
A full scene, so **no magenta and no cut-out**: it fills the whole picture. The game keeps a wide strip from the middle
(640x288, about 2.2 times as wide as tall: the band from about y=166 to y=857 of a 1536x1024 picture), so **the top
and bottom get cut off**: keep everything important inside that band. Grognak walks on the floor, so it must be open
and flat. Use the STYLE text without its last sentence (the magenta part), then:
> Wide panoramic side-on game background, like a stage, no characters, no text. The small main square of a medieval
> fantasy town in the late afternoon: a broad, flat, dusty square of packed earth and a few cobbles in the lower half,
> open and walkable. On the left, a stone and timber **smithy** with an open front, a glowing orange forge inside, an
> anvil and a rack of swords, a chimney with smoke (leave the space in front of it empty: the blacksmith will stand
> there). In the middle background, half-timbered houses with closed shutters and closed doors, a dusty road leading
> away into the distance between them (the way back north). Further back on the right, a grim wooden **gallows** with
> three small dark hanged figures, seen from far away as simple silhouettes, no gore. On the right in front, a single
> leafy tree with a patch of grass at its foot (leave the ground under it empty: a priest will sit there). Warm sky in
> saturated bands: pale yellow, amber, orange, with a few purple clouds. Light from the upper left, long shadows. Large
> flat colour areas, about 32 colours. Busy and warm, with a dark joke in the background.

Check before saving: no people in it (the gallows figures are tiny silhouettes); the lower half is open ground; the
smithy front and the space under the tree are empty; nothing important in the top or bottom sixth.

### 2. `blacksmith` → `art/raw/blacksmith.png` (portrait 1024x1536)
> STYLE + A stout, broad, sweaty blacksmith standing, facing the viewer and turned slightly to the right of the
> picture: big round belly, huge forearms, short dark beard, bald head with a soot smudge, tired but friendly face,
> rolled-up sleeves, a long brown leather apron, heavy boots. He holds a big smithing hammer resting on his shoulder.
> Full body, standing on the bottom edge of the picture, filling most of its height. Colours: warm tan skin, brown
> leather, dark grey hammer head, black beard. Simplify into bold colour blocks: he will be 80x140 pixels in the game.

### 3. `priest` → `art/raw/priest.png` (square 1024x1024)
> STYLE + A small, chubby, tipsy priest sitting on the ground, legs stretched out in front of him, leaning back as if
> against a tree trunk (no tree in the picture), seen from the front and a little from the side, facing the left of the
> picture: a simple brown monk's robe with a rope belt, a round bald head with a ring of grey hair, rosy cheeks and a
> red nose, half-closed happy eyes, hands folded on his belly. He holds **nothing** (he gives his jug away). Whole
> figure, sitting on the bottom edge of the picture, filling most of it. He will be 60x80 pixels in the game.

### 4. `icon_jug` → `art/raw/icon_jug.png` (square 1024x1024)
> STYLE + Inventory icon, big and simple so it reads when tiny: a squat brown clay jug with a round belly, a narrow
> neck, a cork and a small loop handle, with three big bold letters "XXX" painted on its belly in dark brown (the only
> text allowed). Upright and centred, filling the height of the picture.

### 5. `icon_chapel_key` → `art/raw/icon_chapel_key.png` (square 1024x1024)
> STYLE + Inventory icon, big and simple so it reads when tiny: a large old brass key with a round ornate bow and a
> chunky bit, lying diagonally (bow at the lower left, bit at the upper right), with a small pale paper tag tied to the
> bow with string. The tag is blank (no writing). Fills the picture from corner to corner, wider than tall.

### 6. `icon_shining_sword` → `art/raw/icon_shining_sword.png` (square 1024x1024)
Give the rusty sword icon as the reference ("exactly this sword, reforged").
> STYLE + Inventory icon, big and simple so it reads when tiny: exactly the sword in the reference image (same shape,
> crossguard and grip, same diagonal position: hilt at the lower left, point at the upper right), but reforged: a clean
> polished blade with a glowing pale blue core and a small blue gem set in the crossguard, a few short hard pixel
> sparkles near the point. No rust. Blue and steel only, no pink or purple.

## After the pictures are saved (if you can run commands)
Run these in the repository root and fix (regenerate) any picture that fails:
```
npm run import-art -- bg_town blacksmith priest icon_jug icon_chapel_key icon_shining_sword
npm test
npm run validate
```
- `import-art` writes the finished pictures into `games/grelok/assets/`. *"nothing left after removing the magenta
  background"* means the background was not pure `#FF00FF`: regenerate.
- Look at the results at final size (enlarged with nearest neighbour), and in the game: `npm run dev`, then in the
  browser console `__adv.session.performText('south')` takes you from the plain to the town. The blacksmith and the
  priest will not be on screen yet (Claude adds them to the scene file), but the background and icons will.
- Record prompts, references used and results in `art/briefs/03-town-generation-log.md`, as for brief 01.
- Do **not** change code, scene files, `art/assets.yml`, or other assets, and do **not** commit. Report which pictures
  you made.

## Then Claude does
Add the blacksmith and the priest as sprites in `games/grelok/scenes/town.yml`, fit their hotspots and the north exit
to the new background, trace the floor (`walkArea:` → `npm run walkmask`), and check the screen in the game.
