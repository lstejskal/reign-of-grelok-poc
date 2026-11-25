# Art brief 06: inside the chapel

Instructions for an image generator (ChatGPT Images / Codex) working in this repository.
Goal: replace every placeholder on the **chapel interior** screen with real art, in the same style as the screens
before it.

Read first: `docs/pixel-art-generation.md`, `docs/art-style.md`, and the earlier briefs in this folder with their
generation records. The pictures of the finished screens are the style baseline: attach them as references.

## What the chapel interior shows
Through the chapel door (brief 05) Grognak steps into a **small, dark chapel**. The benches are damp and half-rotten,
the altar is overgrown with ivy. The only thing still in one piece is the **holy water basin** standing on a marble
pillar. The way out, back west to the graveyard, is the door on the left.

What happens here: Grognak fills the priest's jug with holy water from the basin.

| # | Asset id | What | Save the raw picture as | Ask for | Ends up in game as (picture pixels, 2 per screen pixel) | Status |
|---|---|---|---|---|---|---|
| 1 | `bg_chapel_interior` | The chapel interior background | `art/raw/bg_chapel_interior.png` | 1536x1024 | 640x288 | Generated/imported; Terra reviewed; pending user review |
| 2 | `basin` | The holy water basin on its marble pillar | `art/raw/basin.png` | 1024x1536 | 60x100 | Generated/imported; Terra reviewed; pending user review |

Order: 1, then 2 (with 1 as the style and lighting reference).

The game shrinks every picture a lot (the basin becomes 60x100 pixels). So: **big, simple, bold shapes**, strong
silhouettes, few details.

## References to attach
- `art/raw/bg_plain.png`, `art/raw/bg_mountain.png` and `art/raw/bg_chapel.png`: style, pixel density and colour
  treatment of a background. The interior belongs to the chapel of `bg_chapel.png`: the same pale stone and the same
  dark wooden door (seen here from inside, on the left).
- `games/grelok/assets/sprites/standing_stone.png` (enlarged) or `art/raw/standing_stone.png`: how a stone prop is drawn.

## Rules for every picture
(Rules 2, 3 and 5 are for the cut-out picture 2. The background, picture 1, has its own rules in its section.)
1. Save as **PNG**, exactly at the path in the table. Overwrite the file if it exists. Don't rename or move other files.
2. **Background: flat, solid magenta `#FF00FF`** (pure 255,0,255), the same colour everywhere: no gradient, no vignette,
   no texture, no floor, no cast shadow on the background, no transparency.
3. **No magenta, pink or purple-pink on the subject itself** (it would be cut out too). Keep the marble cool grey-white
   and the water's glow pale blue.
4. Nothing but the subject: **no text, no labels, no numbers, no grid lines, no frames, no signature, no watermark.**
5. The whole subject is visible, nothing cut off by the picture edge. Leave a little magenta margin around it.
6. Style (the same as the earlier screens, see `docs/art-style.md`): 16-bit Sega Mega Drive arcade pixel art, like
   classic fantasy beat-em-ups; hard 1 px dark plum outlines; 2-3 tone cel shading, light from the upper left; no
   gradients, no blur, no anti-aliasing; about 16 colours. Our own original designs.

## The prompts
The cut-out prompt starts with the shared style text below.

> **STYLE:** 16-bit Sega arcade pixel art in the style of classic beat-em-up games, limited palette of about 16 colours,
> hard 1 pixel dark plum outlines, 2-3 tone cel shading with light from the upper left, no gradients, no anti-aliasing,
> no text, crisp square pixels. The subject is alone on a flat solid magenta #FF00FF background, nothing else in the
> picture, whole subject visible, no shadow on the background.

### 1. `bg_chapel_interior` → `art/raw/bg_chapel_interior.png` (landscape 1536x1024)
A full scene, so **no magenta and no cut-out**: it fills the whole picture. The game keeps a wide strip from the middle
(640x288, about 2.2 times as wide as tall: the band from about y=166 to y=857 of a 1536x1024 picture), so **the top
and bottom get cut off**: keep everything important inside that band. Grognak walks on the floor, so it must be open
and flat. Use the STYLE text without its last sentence (the magenta part), then:
> Wide panoramic side-on game background, like a stage, no characters, no text. The inside of a small, abandoned stone
> chapel, seen from the side like a stage set: a broad, flat floor of worn flagstones in the lower half, open and
> walkable, with puddles and a few fallen leaves. On the left edge, the inside of the arched wooden entrance door,
> ajar, with pale dusk light falling in across the floor (the way out). In the middle background, two rows of damp,
> half-rotten wooden benches, some collapsed. On the right, a raised stone altar overgrown with dark green ivy, a
> tarnished candlestick with a few burning candles, a tall pointed window above it with a broken, dim stained glass
> pattern in deep blue and amber (abstract shapes, no figures or writing). Rough stone arches and pillars along the
> back wall, cobwebs in the corners. The middle of the floor, a little left of centre, is left empty (a holy water
> basin on a pillar will be placed there later). Dark and quiet: deep blue and violet shadows, warm small pools of
> candle light, a cool shaft of light from the door. Large flat colour areas, about 32 colours. The floor must still
> stand out clearly from the walls.

Check before saving: no people; no basin or font in the middle of the floor; the floor across the lower half is open;
the door on the left is visible; nothing important in the top or bottom sixth.

### 2. `basin` → `art/raw/basin.png` (portrait 1024x1536)
Give picture 1 as the reference for stone colour and lighting.
> STYLE + A small holy water basin standing on the floor like a prop on a stage: a shallow round marble bowl with a
> carved rim, on a slender carved marble pillar with a square base, cool grey-white marble with darker grey veins and
> a few cracks, a little ivy curling up the base. The water in the bowl glows faintly pale blue, with two or three hard
> pixel sparkles above it. About twice as tall as wide, standing on the bottom edge of the picture, filling most of its
> height. Undamaged and dignified: the only thing in the chapel still in one piece.

## After the pictures are saved (if you can run commands)
Run these in the repository root and fix (regenerate) any picture that fails:
```
npm run import-art -- bg_chapel_interior basin
npm test
npm run validate
```
- `import-art` writes the finished pictures into `games/grelok/assets/`. *"nothing left after removing the magenta
  background"* means the background was not pure `#FF00FF`: regenerate.
- Look at the results at final size (enlarged with nearest neighbour), and in the game: `npm run dev`, then press `/`
  in the game to open its console and type these lines one by one: `south`, `talk to priest`, `north`, `east`,
  `use rusty sword on zombie`, `use chapel key on chapel door`, `east`. (The zombie and the locked door block the way
  until then.) The basin will not be on screen yet (Claude adds it to the scene file).
- Record prompts, references used and results in `art/briefs/06-chapel-interior-generation-log.md`, as for brief 01.
- Do **not** change code, scene files, `art/assets.yml`, or other assets, and do **not** commit. Report which pictures
  you made.

## Then Claude does
Add the basin as a sprite in `games/grelok/scenes/chapel_interior.yml`, fit its hotspot and the west exit to the new
background, trace the floor (`walkArea:` → `npm run walkmask`), and check the screen in the game.
