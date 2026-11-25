# Art brief 02: the mountain (Grelok's lair)

Instructions for an image generator (ChatGPT Images / Codex) working in this repository.
Goal: replace every placeholder on the **mountain** screen with real art, in the same style as screen 1.

Read first: `docs/pixel-art-generation.md`, `docs/art-style.md`, and [brief 01](01-plain.md) with its
[generation record](01-plain-generation-log.md). Screen 1's pictures are the style baseline: attach them as references.

## What the mountain screen shows
North of the plain, high in the mountains: the realm of Grelok. The sky is red and dusky, a cold wind howls, the
ground is covered with black volcanic ash. **Grelok the Gruesome**, the villain, stands on the right and spews
heresies. On the left, beside the path, lies a heap of **rubble**; looking at it reveals a glowing **gemstone** in it,
which Grognak picks up. The path back south to the plain comes towards the viewer. Grognak fights Grelok here with his
**rusty sword** (no effect) and finally with the shining sword (the finale).

| # | Asset id | What | Save the raw picture as | Ask for | Ends up in game as (picture pixels, 2 per screen pixel) | Status |
|---|---|---|---|---|---|---|
| 1 | `grelok_ref` | Grelok, one big reference picture (not used in game) | `art/reference/grelok_ref.png` | 1024x1536 | (not imported) | **to do** |
| 2 | `grelok` | Grelok standing in the scene | `art/raw/grelok.png` | 1024x1536 | 80x128 | **to do** |
| 3 | `bg_mountain` | The mountain background | `art/raw/bg_mountain.png` | 1536x1024 | 640x288 | **to do** |
| 4 | `rubble` | The heap of rubble by the path | `art/raw/rubble.png` | 1536x1024 | 144x56 | **to do** |
| 5 | `gemstone` | The gemstone, lying on the rubble | `art/raw/gemstone.png` | 1024x1024 | 20x16 | **to do** |
| 6 | `icon_gemstone` | The gemstone's inventory icon | `art/raw/icon_gemstone.png` | 1024x1024 | 48x32 | **to do** |
| 7 | `icon_rusty_sword` | Inventory icon of Grognak's rusty sword (carried from the start, on every screen) | `art/raw/icon_rusty_sword.png` | 1024x1024 | 48x32 | **to do** |

Order: 1, then 2 (with 1 as reference), then 3, then 4-7 (with the background and screen 1 as style references).

The game shrinks every picture a lot (Grelok becomes 80x128 pixels, the gemstone 20x16). So: **big, simple, bold
shapes**, strong silhouettes, few details.

## References to attach
- `art/raw/bg_plain.png`: style, pixel density and colour mood of a background. The plain's horizon shows these very
  mountains (dark purple-grey peaks): the mountain screen must look like the same mountains seen up close.
- `art/reference/grognak_ref.png` and `games/grelok/assets/sprites/standing_stone.png` (enlarged): how characters and
  props are drawn (outline, shading, chunkiness). Do not copy their content.
- For 2: picture 1 controls Grelok's identity. For 6: picture 5 controls the gemstone's identity.

## Rules for every picture
(Rules 2, 3 and 5 are for the cut-out pictures 1, 2, 4-7. The background, picture 3, has its own rules in its section.)
1. Save as **PNG**, exactly at the path in the table. Overwrite the file if it exists. Don't rename or move other files.
2. **Background: flat, solid magenta `#FF00FF`** (pure 255,0,255), the same colour everywhere: no gradient, no vignette,
   no texture, no floor, no cast shadow on the background, no transparency.
3. **No magenta, pink or purple-pink on the subject itself** (it would be cut out too). Careful with Grelok's wine red
   cloak and the gemstone's glow: keep them clearly red / blue, never pink.
4. Nothing but the subject: **no text, no labels, no numbers, no grid lines, no frames, no signature, no watermark.**
5. The whole subject is visible, nothing cut off by the picture edge. Leave a little magenta margin around it.
6. Style (the same as screen 1, see `docs/art-style.md`): 16-bit Sega Mega Drive arcade pixel art, like classic
   fantasy beat-em-ups; chunky proportions; hard 1 px dark plum outlines; 2-3 tone cel shading, light from the
   upper left; no gradients, no blur, no anti-aliasing; about 16 colours. Our own original designs, never a copy of an
   existing game's character.

## The prompts
Every cut-out prompt starts with the shared style text below.

> **STYLE:** 16-bit Sega arcade pixel art in the style of classic beat-em-up games, limited palette of about 16 colours,
> hard 1 pixel dark plum outlines, 2-3 tone cel shading with light from the upper left, no gradients, no anti-aliasing,
> no text, crisp square pixels. The subject is alone on a flat solid magenta #FF00FF background, nothing else in the
> picture, whole subject visible, no shadow on the background.

### 1. `grelok_ref` → `art/reference/grelok_ref.png` (portrait 1024x1536)
Make this first. It fixes how Grelok looks for every later picture of him (the finale may need more poses).
> STYLE + Full-body character design of Grelok the Gruesome, an original evil sorcerer, standing facing the viewer,
> slightly turned to his right (towards the left of the picture, where the hero comes from): tall and gaunt, a head
> taller than a strong man, narrow shoulders under spiked dark armour pauldrons; a deep hood that hides the face in
> shadow except two glowing yellow-green eyes; a long flowing cape and cloak in **wine red** (dark crimson, not pink)
> with a darker red lining; dark iron armour pieces on chest and forearms; long bony grey-green hands; a tall gnarled
> black staff topped with a horned skull, held in his left hand, its foot on the ground. One free hand raised, fingers
> spread, menacing, as if laughing and casting a curse. Colours: wine red, near-black iron, bone, grey-green skin,
> glowing yellow-green eyes. Strong, simple silhouette (hood point, cape flaring wide at the bottom, the staff) that
> still reads when shrunk to 80x128 pixels.

### 2. `grelok` → `art/raw/grelok.png` (portrait 1024x1536)
Give the generator picture 1 as the reference ("exactly this character").
> STYLE + Exactly the character in the reference image (same hood, glowing eyes, wine red cape and cloak, armour,
> skull staff, proportions), as a single game sprite: full body, standing on the bottom edge of the picture, facing
> the viewer and turned slightly towards the left of the picture, the free hand raised in a menacing laugh. The figure
> fills most of the picture height. Simplify into bold colour blocks: it will be 80x128 pixels in the game.

Check: feet (cape hem) and staff foot on the same level at the bottom; nothing cut off; no pink anywhere.

### 3. `bg_mountain` → `art/raw/bg_mountain.png` (landscape 1536x1024)
A full scene, so **no magenta and no cut-out**: it fills the whole picture. The game keeps a wide strip from the middle
(640x288, about 2.2 times as wide as tall: the band from about y=166 to y=857 of a 1536x1024 picture), so **the top
and bottom get cut off**: keep everything important inside that band. Grognak walks on the floor, so it must be open
and flat. Use the STYLE text without its last sentence (the magenta part), then:
> Wide panoramic side-on game background, like a stage, no characters, no text. High in menacing mountains, the realm
> of an evil sorcerer: a broad, flat plateau of black volcanic ash and dark rock in the lower half, open and walkable,
> with a dirt path coming from the bottom centre (towards the viewer, back down to the plain). Behind the plateau,
> jagged dark purple-grey cliffs and peaks (the same mountains seen from the plain, now up close), sharp black rock
> spires, a few dead twisted trees, thin smoke rising from cracks. On the right, a low flat rocky ledge on the plateau
> where a villain will stand (leave it empty); on the left beside the path, an empty patch of ash ground (a heap of
> rubble will be placed there later, leave it empty). Cold, dusky sky in saturated bands: wine red, deep red, dark
> purple, with a dim red sun low behind the peaks and dark streaks of cloud blown by the wind. Red rim light on the
> rocks from the left, deep cold purple shadows. Large flat colour areas, about 32 colours. Gloomy and threatening,
> but clearly readable: the floor must stand out from the cliffs.

Check before saving: no people, no rubble heap, no stone circle or altar in the middle; the lower half is open ground;
nothing important in the top or bottom sixth of the picture.

### 4. `rubble` → `art/raw/rubble.png` (landscape 1536x1024)
> STYLE + A low, wide heap of rubble lying on the ground, seen from the side and a little from above, like a prop on a
> stage: big and small broken rocks and stones in dark grey and purple-grey (the same rock as the mountain
> background), a few sharp edges, one or two flat slabs, a little black ash between them. About three times as wide as
> tall, flat bottom on the bottom edge of the picture, highest in the middle. No gemstone, nothing glowing.

### 5. `gemstone` → `art/raw/gemstone.png` (square 1024x1024)
> STYLE + A single beautiful magical gemstone lying on the ground: a large faceted oval cut stone, bright cold blue with
> pale cyan facets and one white sparkle at the upper left, a few short rays of soft blue glow drawn as hard pixel
> lines (not a blurry halo). Wider than tall (about 5 to 4). Fills the middle of the picture. Blue only, no pink or
> purple.

### 6. `icon_gemstone` → `art/raw/icon_gemstone.png` (square 1024x1024)
Give picture 5 as the reference ("exactly this gemstone").
> STYLE + Inventory icon, big and simple so it reads when tiny: exactly the gemstone in the reference image, same cut,
> same blue and cyan facets, same white sparkle, centred and filling most of the picture, wider than tall. No glow
> rays (they would turn into noise at 48x32).

### 7. `icon_rusty_sword` → `art/raw/icon_rusty_sword.png` (square 1024x1024)
Give `art/reference/grognak_ref.png` as the reference for the sword's shape (his broadsword, now rusty).
> STYLE + Inventory icon, big and simple so it reads when tiny: Grognak's broadsword from the reference image, old and
> rusty: a straight wide blade with orange-brown rust patches and a notched edge, a simple iron crossguard, a grip
> wrapped in dark brown leather. Lying diagonally, hilt at the lower left, point at the upper right, filling the
> picture from corner to corner. Wider than tall.

## After the pictures are saved (if you can run commands)
Run these in the repository root and fix (regenerate) any picture that fails:
```
npm run import-art -- grelok bg_mountain rubble gemstone icon_gemstone icon_rusty_sword
npm test
npm run validate
```
- `import-art` writes the finished pictures into `games/grelok/assets/`. *"nothing left after removing the magenta
  background"* means the background was not pure `#FF00FF`: regenerate.
- Look at the results at final size (enlarged with nearest neighbour), and in the game: `npm run dev`, then in the
  browser console `__adv.session.performText('north')` takes you to the mountain. Grelok and the rubble will not be on
  screen yet (Claude adds them to the scene file), but the background, gemstone and icons will.
- Record prompts, references used and results in `art/briefs/02-mountain-generation-log.md`, as for brief 01.
- Do **not** change code, scene files, `art/assets.yml`, or other assets, and do **not** commit. Report which pictures
  you made.

## Then Claude does
Add Grelok and the rubble as sprites in `games/grelok/scenes/mountain.yml`, fit the hotspots, gemstone position and the
south exit to the new background, trace the floor (`walkArea:` → `npm run walkmask`), and check the screen in the game.
