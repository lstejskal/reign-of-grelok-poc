# Art brief 07: Grognak's animations (walk, talk, reach)

Instructions for an image generator (ChatGPT Images / Codex) working in this repository.
Goal: give Grognak, the hero, a proper set of animations, drawn consistently from one approved design.

Read first: `docs/pixel-art-generation.md`, `docs/art-style.md`, [brief 01](01-plain.md) and its generation record.

## Why this brief
Grognak's current sheet has only three poses per direction (standing and two strides), so his walk looks thin, and he
cannot move when he talks or picks something up. The game can now play:
- a **6-pose walk to the right** (walking left is the same pictures mirrored by the game),
- **4-pose walks** towards and away from the viewer,
- **standing** in three views, **talking** (2 poses, front and side), and **reaching** for things (side, front, back).

Each animation is **its own picture** (a small grid of poses). An image generator keeps one character consistent far
better in a small strip than in one big sheet; the importer then joins the pictures into one sheet with the same
size, colours and outline for every frame.

There is also a known problem to fix on the way: in the game Grognak's skin, fur and leather are all close to the
**orange dirt road** of the plain, so he does not stand out. Step 0 fixes his colours once, in his reference picture,
before any frame is drawn.

| # | Picture | Save as | Ask for | Cells (read row by row) |
|---|---|---|---|---|
| 0 | Revised reference (not used in game) | `art/reference/grognak_ref.png` (keep the old one as `art/reference/grognak_ref_v1.png`) | 1024x1536 | one figure |
| 1 | Walk to the right | `art/raw/grognak_walk_e.png` | 1536x1024 | 3 x 2 = 6 poses |
| 2 | Walk towards the viewer | `art/raw/grognak_walk_s.png` | 1024x1024 | 2 x 2 = 4 poses |
| 3 | Walk away from the viewer | `art/raw/grognak_walk_n.png` | 1024x1024 | 2 x 2 = 4 poses |
| 4 | Standing: front, back, right | `art/raw/grognak_idle.png` | 1536x1024 | 3 x 1 |
| 5 | Talking | `art/raw/grognak_talk.png` | 1024x1024 | 2 x 2 |
| 6 | Reaching | `art/raw/grognak_reach.png` | 1024x1024 | 2 x 2 |

In the game each pose becomes a 76x116 frame (Grognak stands about 49 screen pixels tall). So: **big, simple, bold shapes**,
a strong silhouette, legs and arms clearly separated from the body.

## Step 0: the revised reference (needs the user's approval)
Attach the current `art/reference/grognak_ref.png` ("exactly this character") and `art/raw/bg_plain.png` ("the ground
he walks on"). Keep everything about him (proportions, horned helmet, braided beard, loincloth, belt, boots, sword),
and change **only colours**, so he reads clearly against the orange-brown dirt road and green grass:
> STYLE + Exactly the character in the reference image, same design, same pose, same proportions, but recoloured for
> contrast against an orange-brown dirt road: **skin** a lighter, less orange peach-tan with clear darker shading;
> **beard and hair** a deep dark chestnut brown; **fur loincloth and boot fur** a dark chocolate brown, almost black in
> the shadows; **belt, straps and boots** dark brown leather; **helmet and sword** cool blue-grey steel with bright
> highlights; **horns** off-white bone. Strong dark plum outline all round. Bold simple shapes that still read at
> 64x96 pixels.

Show the result to the user and **wait for approval** before step 1. Every other picture uses the approved reference.

## Rules for every picture
1. Save as **PNG**, exactly at the path in the table. Don't rename or move other files.
2. **Background: flat, solid magenta `#FF00FF`** (pure 255,0,255), the same colour everywhere: no gradient, no floor,
   no cast shadow, no transparency.
3. **No magenta, pink or purple-pink on Grognak** (it would be cut out too).
4. **No text, no labels, no numbers, no grid lines, no frames, no signature, no watermark.**
5. **One whole figure per cell**, the cells evenly spaced (each cell is exactly 1/columns of the width and 1/rows of the
   height), every figure **the same size**, centred in its cell, **feet on the same line** near the cell's bottom,
   nothing touching the next cell. The importer cuts the picture into equal cells.
6. **Exactly the approved reference**: same helmet, horns, beard, colours, proportions and sword in every pose. The
   sword is in the same hand in every pose of a picture.
7. Style (see `docs/art-style.md`): 16-bit Sega Mega Drive arcade pixel art; hard 1 px dark plum outlines; 2-3 tone cel
   shading, light from the upper left; no gradients, no blur, no anti-aliasing; about 16 colours.

> **STYLE:** 16-bit Sega arcade pixel art in the style of classic beat-em-up games, limited palette of about 16 colours,
> hard 1 pixel dark plum outlines, 2-3 tone cel shading with light from the upper left, no gradients, no anti-aliasing,
> no text, crisp square pixels. The subject is alone on a flat solid magenta #FF00FF background, nothing else in the
> picture, whole subject visible, no shadow on the background.

Every prompt below starts with the STYLE text and has the approved reference attached ("exactly this character").

## The prompts

### 1. Walk to the right → `art/raw/grognak_walk_e.png` (1536x1024, 3 columns x 2 rows)
A classic walk cycle seen exactly from the side, **facing right**, one step per row:
> STYLE + Exactly the character in the reference image, seen exactly from the side, facing and walking to the right,
> as a 6-pose walk cycle in a grid of 3 columns and 2 rows of equal cells, one whole figure per cell, all the same size,
> feet on the same line. Row 1: (1) CONTACT: front leg (the near leg) stretched forward with the heel touching the
> ground, back leg stretched behind on its toes, legs wide apart, arms swinging opposite to the legs; (2) DOWN: the
> front foot flat, that knee bent, body at its lowest; (3) PASSING: the near leg straight under the body, the far leg
> bent and swinging past it, body at its highest. Row 2: the same three poses with the legs swapped: (4) CONTACT with
> the FAR leg forward, (5) DOWN, (6) PASSING with the far leg straight and the near leg swinging past. The sword hangs
> from his near hand pointing down in all six. Strong, readable leg shapes; head and torso move only a little.

Check: in pose 1 and 4 the legs are wide apart but **different legs** are in front; in 3 and 6 the legs are close
together. A 6-frame walk only looks right when 1 → 2 → 3 → 4 → 5 → 6 flows like one movement.

### 2. Walk towards the viewer → `art/raw/grognak_walk_s.png` (1024x1024, 2 x 2)
> STYLE + Exactly the character in the reference image, seen from the front, walking towards the viewer, as a 4-pose
> walk cycle in a grid of 2 columns and 2 rows of equal cells, one whole figure per cell, all the same size, feet on the
> same line: (1) his right foot (on the viewer's left) forward and lower, body tilted a little, the opposite arm
> forward; (2) PASSING: feet together under the body, body at its highest; (3) his left foot (on the viewer's right)
> forward and lower, the other arm forward; (4) PASSING again, feet together. The sword in the same hand in all four.

### 3. Walk away from the viewer → `art/raw/grognak_walk_n.png` (1024x1024, 2 x 2)
> STYLE + Exactly the character in the reference image, seen from behind (we see his back, the back of the helmet and
> horns, braids hanging down), walking away from the viewer, as a 4-pose walk cycle in a grid of 2 x 2 equal cells, one
> whole figure per cell, all the same size, feet on the same line: (1) his left foot (on the viewer's left) forward,
> the heel of the back foot raised; (2) PASSING, feet together, body at its highest; (3) his right foot forward; (4)
> PASSING again. The sword in the same hand in all four.

### 4. Standing → `art/raw/grognak_idle.png` (1536x1024, 3 columns x 1 row)
> STYLE + Exactly the character in the reference image, standing still in a relaxed, heroic pose, three views side by
> side in 3 equal cells, all the same size, feet on the same line: (1) front, facing the viewer; (2) back, seen from
> behind; (3) side, facing right. The sword hangs from his hand pointing down in all three.

### 5. Talking → `art/raw/grognak_talk.png` (1024x1024, 2 x 2)
His mouth is mostly hidden by the beard, so talking shows in the **jaw, beard and a hand gesture**:
> STYLE + Exactly the character in the reference image, talking, in a grid of 2 x 2 equal cells, one whole figure per
> cell, all the same size, feet on the same line, standing still. Row 1, front view: (1) mouth shut, free hand at his
> side; (2) mouth wide open in the beard, chin dropped, the free hand raised with the palm up as if making a point.
> Row 2, side view facing right: (3) mouth shut; (4) mouth open, free hand raised forward. Only the head, beard and the
> free arm change between the two poses of a row; legs, body and sword stay exactly the same.

### 6. Reaching → `art/raw/grognak_reach.png` (1024x1024, 2 x 2)
> STYLE + Exactly the character in the reference image, reaching for something, in a grid of 2 x 2 equal cells, one
> whole figure per cell, all the same size, feet on the same line. (1) Side view facing right: leaning forward a little,
> the free arm half stretched out in front of him at waist height; (2) side view facing right: the free arm fully
> stretched out forward and down, hand open, as if picking something up from the ground or a ledge; (3) front view,
> bending forward and reaching down towards the viewer with the free hand; (4) back view, reaching forward and up with
> the free hand (towards something in front of him). Feet stay planted in all four.

## After the pictures are saved
- Run `npm run import-art -- --list` and check that `grognak` says "raw ready".
- **Do not import `grognak` yourself**: the new sheet has a new layout, and the game's `games/grelok/game.yml` must
  change at the same moment. Hand over to Claude.
- Record prompts, references used and results in `art/briefs/07-grognak-animation-generation-log.md`, as for brief 01,
  including the user's approval of the revised reference.
- Do **not** change code, scene files, `art/assets.yml`, or other assets, and do **not** commit.

## Then Claude does
`npm run import-art -- grognak`, copy the animation table it prints into `games/grelok/game.yml` (`columns: 6`,
`animations:`), tune `walkStride` until his feet don't slide on the ground, and check walk, talk and reach in the game.
