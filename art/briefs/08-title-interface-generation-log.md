# Art brief 08: Title and interface generation log

Status: new candidate art, pending reviewer and user approval. This batch does not include or modify Grognak.

## cursor

- Raw fitted candidate: `art/raw/cursor.png` (32×32 picture pixels)
- Destination candidate: `games/grelok/assets/ui/cursor.png`
- Built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-b138f3ab-8c39-428b-b722-6981abcfa6a8.png`
- References actually attached: `art/raw/icon_pebble.png` (Image 1; crisp clusters), `art/raw/icon_rusty_sword.png` (Image 2; dark plum edge weight).
- Settings: built-in imagegen; transparent background requested. No model or quality controls exposed.
- Processing: detected visible alpha bounds (x=157,y=87,w=786,h=1138), cropped with project `crop`, nearest-neighbour resized to 22×29, placed bottom-centred in 32×32 with project `place` (x=5,y=3), snapped/quantized with existing `buildPalette`/`quantize` to five Mega Drive hardware colours. Kept binary alpha. Hotspot (upper-left tip) is picture pixel (5,3). Copied fitted PNG to candidate destination.
- Pending reviewer/user approval.
- Exact prompt used:

Create one standalone pixel-art mouse cursor as a 1024×1024 PNG with true transparent background. Images 1 and 2 are actual Reign of Grelok inventory-art references and control crisp square-pixel clusters, bold dark-plum edge weight, flat shading and restrained palette only; do not copy their objects.

Draw one clean, immediately recognizable classic arrow pointer aimed upper-left, large and centred with transparent margin. Use a chunky bone-ivory fill, one cool-steel inset facet and a tiny amber accent near the lower tail. Strong continuous dark-plum outline. High contrast, simple silhouette with obvious sharp upper-left tip as hotspot. Keep point and all edges comfortably within canvas. 16-bit Sega Mega Drive pixel-art style, hard stepped edges, no antialiasing, no gradients, no blur. True alpha around cursor. No weapon, staff, text, shadows, glyph, backplate, border, duplicates or decorative sparkles.

## title_background

- Raw generated candidate: `art/raw/title_background.png` (1536×1024 PNG)
- Processed destination candidate: `games/grelok/assets/backgrounds/title.png` (640×400 picture pixels)
- Built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-19f98c0c-9b63-4680-8a49-ce5e09a738a4.png`
- References actually attached: `art/raw/bg_plain.png` (Image 1), `art/raw/bg_mountain.png` (Image 2), `art/raw/bg_swamp.png` (Image 3), `art/raw/bg_chapel.png` (Image 4).
- Processing: `processBackground` from `tools/art/pipeline.ts`, centre-crop to 8:5 and dominant resize/quantize to 640×400 with 32 colours. No sprite outline.
- Pending reviewer/user approval.
- Exact prompt used:

Generate a new title-screen panorama for Reign of Grelok, opaque 1536×1024 landscape PNG, final 640×400 picture pixels (320×200 logical). The importer centre-crops to 8:5, retaining raw rows approximately y32–991. Keep important scenery in that band and away from its edges. Opaque and about 32 console colours.

Image 1 (Plain) controls the world’s open crossroads, distant skyline and strong grass banks. Image 2 (Mountain) controls recognizable jagged purple-grey peaks and large cool shadow planes. Image 3 (Swamp) supplies distant tangled trees and olive water at left. Image 4 (Chapel) supplies a small pale chapel silhouette, raised bell and stone cross at right. Use those places for a bespoke cohesive wide view.

Original Reign of Grelok 16-bit Sega Mega Drive fantasy arcade art: crisp square pixel steps, decisive silhouettes, large flat colour blocks, 2–3 tones per material, upper-left light. Keep details bold enough to read in a 320×200 logical canvas. No modern gradients, painterly texture, blur, anti-aliasing or watermark.

Wide introductory view of the same fantasy realm from a low rise: a small weathered standing stone at the far left among dim green grass, old mauve mountains across the horizon, dark swamp earth and green water peeking through twisted trees at the left, and a pale stone chapel on a far-right low hill. A low flat twilight sky with discrete cool plum and navy areas and a sparse muted amber horizon. Keep the centre subdued and quiet for live UI: y≈20–70 logical for the independently layered logo, including its dark upper-centre sky, and y≈80–160 logical for live title menu and load-slot labels. Keep the bright horizon streak and tall contrast edges to the sides. A quiet centre should feel like open screen space in the landscape, without a visible panel or spotlight. No text, title, buttons, labels, hero, villain or figure.

## title_logo

- Raw generated candidate: `art/raw/title_logo.png` (imagegen returned 2172×724 despite the requested nominal canvas)
- Processed destination candidate: `games/grelok/assets/ui/title_logo.png` (512×96 picture pixels)
- Built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-9b4a41a3-1c73-48f2-848b-68a16e43817a.png`
- References actually attached: `art/raw/icon_rusty_sword.png` (Image 1; angular steel bevel), `art/raw/bg_chapel.png` (Image 2; warm ivory/charcoal/plum contrast).
- Processing: alpha crop with project `crop` to visible bounds x=36,y=228,w=2100,h=268; nearest-neighbour resize preserving aspect to 512×65; centered in 512×96 using `place`; binary alpha threshold; `buildPalette`/`quantize` and hardware colour snap to 16 colours. Transparent letter counters retained.
- Pending reviewer/user approval.
- Exact prompt used:

Generate a transparent title-logo PNG with the exact text “REIGN OF GRELOK” in ONE line, all capitals. Nominal landscape 1536×1024 canvas, one very wide wordmark with a combined silhouette approximately 5.33:1 to fit a 512×96 picture-pixel box (256×48 logical). Leave clean transparent margin around the whole logo. All spaces around and inside the letter counters must be genuinely transparent. About 16 colours.

Image 1 (rusty sword inventory icon) shows the simple angular steel bevel treatment. Image 2 (chapel) shows the warm ivory, charcoal and plum contrast relationships. These are material/rendering references; copy no subject into logo.

Original Reign of Grelok 16-bit Sega Mega Drive fantasy arcade art: crisp square pixel steps, decisive silhouettes, large flat colour blocks, 2–3 tones per material, upper-left light. Keep details bold enough to read in a 320×200 logical canvas. No modern gradients, painterly texture, blur, anti-aliasing or watermark.

Lettering should feel like original chunky forged fantasy lettering: readable distinct glyphs, softened ivory-silver faces with crisp stepped cool steel shadows, restrained tiny brass edge accents, and slim dark plum outline. Strong shapes, consistently spaced, legible even across a small menu screen. Three words on a common baseline exactly as supplied. No line break, taglines, scenery, shields, sword overlays, oversized ornaments, extra symbols, box or shadow behind the words.

## ui_frame

- Raw generated candidate: `art/raw/ui_frame.png` (1536×1024 PNG)
- Processed destination candidate: `games/grelok/assets/ui/interface_frame.png` (640×112 picture pixels)
- Built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-316722a5-bd13-4143-8364-5d915ac41037.png`
- Reference actually attached: `art/raw/icon_rusty_sword.png` (Image 1; cool steel and plum edge style).
- Processing: extracted primary frame by alpha≥128 bounds x=27,y=418,w=1483,h=187, thresholded to binary alpha, resized with project `resize` to exact 640×112, and fit to 16 snapped Mega Drive colours using `buildPalette`/`quantize`. Generated divider initially mapped to picture x=220..226,y=27..84. Refit only the divider with project `crop`/`resize` to target picture x=218..223,y=28..91 (logical x=109..111,y=14..45). Frame interior and exterior remain transparent; no half-alpha glow retained. Divider sits clear of border.
- Pending reviewer/user approval.
- Exact prompt used:

Generate a transparent in-game interface frame, a single very wide rectangle on a 1536×1024 PNG canvas. Its frame silhouette is 5.714:1, roughly 1400×245 at source scale, to fit 640×112 picture pixels (320×56 logical). Its interior and exterior are transparent. Image 1 (rusty sword icon) is a small reference for cool-grey bevel and restrained plum edging only. Limit to 16 colours.

Original Reign of Grelok 16-bit Sega Mega Drive fantasy arcade art: crisp square pixel steps, decisive silhouettes, large flat colour blocks, 2–3 tones per material, upper-left light. Keep details bold enough to read in a 320×200 logical canvas. No modern gradients, painterly texture, blur, anti-aliasing or watermark.

The frame is a thin restrained dark-plum rim with cool charcoal iron bevels and small muted brass rivets at the corners. Edge weight roughly 1–3 picture pixels at output, corners visually compact, straight clean square-pixel lines. Open transparent interior: no backing panel, lettering, buttons, icons, slot grid, ornamental bars, or diagonals. Only one short vertical separator for verbs and inventory, at logical x=109..111 (roughly 34.4% width; picture x=218..223), from relative logical y=14 to y=45 inclusive (picture y=28..91). Do not extend the divider into the sentence or footer area. In the generated silhouette, size that divider proportionally and keep it disconnected from the outer rim if necessary.

Room UI is drawn over this art: sentence at relY4, verbs at x4 relY14 with 52×9 cells, inventory x112 relY14 with seven columns of 26×16 and two rows, menu at x306 relY3, inventory scroll at x296 and x308 relY14 for 32 px, footer relY48. Keep art clear of all live controls and labels. Transparent interior is mandatory, including the full area behind every runtime verb and slot.


### Interface frame fit correction

- Preserved the first processed version at `art/briefs/08-interface-frame-first-fit.png` before fitting.
- Rebuilt the 640×112 candidate from the generated frame with project `crop` and `resize` as nine-slice edge pieces. The top rail is 4 px high, bottom rail 2 px high, side rails are 4 px wide, and corner pieces are 4×4 px at top and 4×2 px at bottom. Side rails run within x=0..3 and x=636..639; sentence and footer bands are clear.
- Kept the generated separator at picture x=218..223,y=28..91 (logical x=109..111,y=14..45). Transparent safe zones were checked at sentence y=8..21, footer y=96..109, and interior x=4..635; only the divider is visible inside the panel.
