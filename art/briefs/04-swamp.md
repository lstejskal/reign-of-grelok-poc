# Art brief 04: the Swamp of Despair

Instructions for an image generator (ChatGPT Images / Codex) working in this repository.
Goal: replace every placeholder on the **swamp** screen with real art, in the same style as the screens before it.

Read first: `docs/pixel-art-generation.md`, `docs/art-style.md`, and the earlier briefs in this folder with their
generation records. The pictures of the finished screens are the style baseline: attach them as references.

## What the swamp screen shows
West of the plain lies the gloomy green **Swamp of Despair**: bleak swamp all around, except for a tall **white-stone
tower** on a small grass island in its midst. Near the top of the tower is a small **window**, and from it an eccentric
**wizard** eyes Grognak suspiciously. Grognak stands on the muddy shore in front; the path back east to the plain
leaves on the right.

What happens here: Grognak gives the wizard the gemstone. The wizard chants, there is a loud BANG, and the gemstone
splits in two: the **gemstone shards** fall on the shore in front of Grognak, who picks them up.

| # | Asset id | What | Save the raw picture as | Ask for | Ends up in game as (picture pixels, 2 per screen pixel) | Status |
|---|---|---|---|---|---|---|
| 1 | `bg_swamp` | The swamp background, with the tower | `art/raw/bg_swamp.png` | 1536x1024 | 640x288 | Generated/imported; Terra reviewed; pending user review |
| 2 | `wizard` | The wizard, chest up, as seen in the tower window | `art/raw/wizard.png` | 1024x1024 | 50x40 | Generated/imported; Terra reviewed; pending user review |
| 3 | `gemstone_shards` | The two shards lying on the ground | `art/raw/gemstone_shards.png` | 1536x1024 | 40x20 | Generated/imported; Terra reviewed; pending user review |
| 4 | `icon_gemstone_shards` | The shards' inventory icon | `art/raw/icon_gemstone_shards.png` | 1024x1024 | 48x32 | Generated/imported; Terra reviewed; pending user review |

Order: 1, then 2, then 3 (with the mountain's gemstone as reference), then 4 (with 3 as reference).

Completed files, prompts, visual review, previews, checks and Claude placement notes are in [the generation record](04-swamp-generation-log.md).

The game shrinks every picture a lot (the wizard becomes 50x40 pixels: he is far away, in a window). So: **big,
simple, bold shapes**, strong silhouettes, few details.

## References to attach
- `art/raw/bg_plain.png` and `art/raw/bg_mountain.png`: style, pixel density and colour treatment of a background.
  The plain's horizon shows the swamp on its left edge (dark twisted trees, green water): the swamp screen must look
  like that place seen up close.
- `art/reference/grognak_ref.png` and `art/reference/grelok_ref.png`: how characters are drawn. Do not copy them.
- For 3 and 4: `art/raw/gemstone.png` (and `art/raw/icon_gemstone.png`): the shards are **that gemstone** split in two
  halves: same blue, same cyan facets, same white sparkle.

## Rules for every picture
(Rules 2, 3 and 5 are for the cut-out pictures 2-4. The background, picture 1, has its own rules in its section.)
1. Save as **PNG**, exactly at the path in the table. Overwrite the file if it exists. Don't rename or move other files.
2. **Background: flat, solid magenta `#FF00FF`** (pure 255,0,255), the same colour everywhere: no gradient, no vignette,
   no texture, no floor, no cast shadow on the background, no transparency.
3. **No magenta, pink or purple-pink on the subject itself** (it would be cut out too). The wizard's robe is a deep
   **blue-violet**, never pink or magenta.
4. Nothing but the subject: **no text, no labels, no numbers, no grid lines, no frames, no signature, no watermark.**
5. The whole subject is visible, nothing cut off by the picture edge. Leave a little magenta margin around it.
6. Style (the same as the earlier screens, see `docs/art-style.md`): 16-bit Sega Mega Drive arcade pixel art, like
   classic fantasy beat-em-ups; chunky proportions; hard 1 px dark plum outlines; 2-3 tone cel shading, light from the
   upper left; no gradients, no blur, no anti-aliasing; about 16 colours. Our own original designs.

## The prompts
Every cut-out prompt starts with the shared style text below.

> **STYLE:** 16-bit Sega arcade pixel art in the style of classic beat-em-up games, limited palette of about 16 colours,
> hard 1 pixel dark plum outlines, 2-3 tone cel shading with light from the upper left, no gradients, no anti-aliasing,
> no text, crisp square pixels. The subject is alone on a flat solid magenta #FF00FF background, nothing else in the
> picture, whole subject visible, no shadow on the background.

### 1. `bg_swamp` → `art/raw/bg_swamp.png` (landscape 1536x1024)
A full scene, so **no magenta and no cut-out**: it fills the whole picture. The game keeps a wide strip from the middle
(640x288, about 2.2 times as wide as tall: the band from about y=166 to y=857 of a 1536x1024 picture), so **the top
and bottom get cut off**: keep everything important inside that band, including the top of the tower. Grognak walks
on the shore, so it must be open and flat. Use the STYLE text without its last sentence (the magenta part), then:
> Wide panoramic side-on game background, like a stage, no characters, no text. A gloomy green swamp at dusk: in the
> lower part, a broad, flat, muddy shore of dark earth and trampled reeds, open and walkable, running across the whole
> width, with a narrow path leaving at the right edge (back east to the plain). Behind the shore, still dark green
> water with lily pads, dead grey trees with twisted branches and hanging moss, low drifting bands of pale green mist.
> In the middle of the water, slightly left of centre, a small round grassy island with a **tall, slender white-stone
> wizard's tower**: round, a pointed dark slate roof, a crooked chimney, and near the top **one small square window,
> dark and empty inside** (a wizard will be placed in it later; make the window clearly visible, about a tenth of the
> tower's width or more). The whole tower, roof included, sits in the middle band of the picture. Sickly yellow-green
> light from a low sun on the left, deep teal shadows. Large flat colour areas, about 32 colours. Bleak and eerie,
> but the shore must stand out clearly from the water.

Check before saving: no people, no figure in the window; the whole tower inside the middle band; the shore across the
lower part is open ground.

### 2. `wizard` → `art/raw/wizard.png` (square 1024x1024)
> STYLE + A tall, thin, eccentric old wizard seen **from the chest up**, leaning on a window sill (draw only the sill's
> top edge in pale grey stone at the bottom of the picture, nothing else of the window): a deep blue-violet robe with
> wide sleeves, a tall pointed hat of the same colour with a few yellow stars, a long white beard, big round spectacles
> that catch the light, bushy white eyebrows, a suspicious squint, one bony hand stroking his beard. Facing the viewer,
> head turned a little down and to the left (looking down at the hero). Wider than tall overall, filling the picture.
> He will be only 50x40 pixels in the game: big shapes (hat, beard, spectacles) over small details.

### 3. `gemstone_shards` → `art/raw/gemstone_shards.png` (landscape 1536x1024)
Give `art/raw/gemstone.png` as the reference ("this gemstone, split in two").
> STYLE + Exactly the gemstone in the reference image, split cleanly into **two halves** lying side by side on the
> ground with a small gap between them, the broken faces showing bright cyan, a few short hard pixel sparkles. Same
> blue, same cyan facets, same white highlight at the upper left. About twice as wide as tall, filling the picture,
> resting on the bottom edge. Blue and cyan only, no pink or purple.

### 4. `icon_gemstone_shards` → `art/raw/icon_gemstone_shards.png` (square 1024x1024)
Give picture 3 as the reference ("exactly these shards").
> STYLE + Inventory icon, big and simple so it reads when tiny: exactly the two gemstone halves in the reference image,
> a little closer together and larger, centred and filling most of the picture, wider than tall. No sparkles or glow
> rays (they would turn into noise at 48x32).

## After the pictures are saved (if you can run commands)
Run these in the repository root and fix (regenerate) any picture that fails:
```
npm run import-art -- bg_swamp wizard gemstone_shards icon_gemstone_shards
npm test
npm run validate
```
- `import-art` writes the finished pictures into `games/grelok/assets/`. *"nothing left after removing the magenta
  background"* means the background was not pure `#FF00FF`: regenerate.
- Look at the results at final size (enlarged with nearest neighbour), and in the game: `npm run dev`, then in the
  browser console `__adv.session.performText('west')` takes you from the plain to the swamp. The wizard will not be in
  his window yet (Claude adds him to the scene file), but the background and the icon will be there.
- Record prompts, references used and results in `art/briefs/04-swamp-generation-log.md`, as for brief 01.
- Do **not** change code, scene files, `art/assets.yml`, or other assets, and do **not** commit. Report which pictures
  you made.

## Then Claude does
Put the wizard into the tower window as a sprite in `games/grelok/scenes/swamp.yml`, fit the tower, wizard and shards
hotspots and the east exit to the new background, trace the shore (`walkArea:` → `npm run walkmask`), and check the
screen in the game.
