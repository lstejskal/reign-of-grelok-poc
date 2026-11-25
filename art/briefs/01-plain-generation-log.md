# First-screen generation record

Generated on 2026-11-25 using the built-in image generation tool. These are the first consistent candidate designs, pending user approval; they are not previously approved references. The six deliverables follow [brief 01](01-plain.md). The brief authorizes replacing its listed placeholders and running the existing importer. No source code or manifest changes.

## Reference use

- `grognak_ref`: original generation from the character brief; saved to `art/reference/grognak_ref.png`.
- `grognak`: used that exact reference image for identity and rendering.
- `bg_plain`: original generation from the location brief, with crop-safe composition instructions.
- `standing_stone` and `pebble`: attached Grognak's reference for rendering and the background for environment colour/lighting.
- `icon_pebble`: attached the generated scene pebble to preserve its identity.

The built-in tool controls its own backend and rendering settings. Dimensions below are requested canvas sizes; actual delivered raw sizes are recorded in the verification section. Final game sizes are enforced by the existing importer.

## Walk-pose revisions

The initial sheet repeated walking poses. Targeted image edits corrected the front/back frames; a final reflection of the legs in the rightmost side-view cells produced distinct alternating strides. The final imported sheet contains twelve full figures with consistent costume and scale. This is the brief's compact two-step walking set, not an extended animation cycle.

### grognak_walk_correction

```text
Precise-object-edit of Image 1, the existing Grognak sprite sheet. Keep EXACT canvas 1024x1536, THREE columns and FOUR rows, all 12 cells, the character identity, colours, outlines, helmet, beard, costume, sword, background and all standing poses unchanged. FIX ONLY THE WALKING POSES so columns 2 and 3 are opposite steps rather than duplicated forward legs. Row1 FRONT: col2 anatomical LEFT leg/viewer RIGHT foot forward; col3 anatomical RIGHT leg/viewer LEFT foot forward. Row2 BACK: col2 anatomical LEFT leg/viewer LEFT foot forward; col3 anatomical RIGHT leg/viewer RIGHT foot forward. Rows3 and4 SIDE: col2 near leg forward and far leg back; col3 near leg back and far leg forward, with clear alternating leg silhouette, no moonwalking. Row3 faces RIGHT, row4 faces LEFT. Col1 of every row remains neutral standing. Maintain stable head height and foot baseline, scale, centre and safe margin in each cell. Sword in same hand pointing down, never swapped between frames of same view. Match existing crisp low-resolution chunky pixel art, dark plum outlines, upper-left light and large flat 2-3 tone shading. All background pixels flat opaque #FF00FF, no cast shadows, no text/gridlines/labels/extra figures. This is an animation-step correction, NOT a redesign. Preserve all existing visual features outside the legs and the small movement of arms needed for the steps.
```

### grognak_side_step_correction

```text
EDIT Image 1 only. Preserve EXACT 1024x1536 canvas and 3-column 4-row sprite grid. Preserve rows1 and2 in their entirety. Preserve every standing pose in column1. Preserve column2 in its entirety. Change ONLY THE LEGS AND BOOTS in the bottom two cells of COLUMN THREE (rightmost column, ROW THREE facing right and ROW FOUR facing left). They must be visibly the OPPOSITE walking stride from column2: the NEAR LEG (lighter tan) is now extended BACKWARD, and the FAR LEG (darker brown) is extended FORWARD. Row3 col3: light near thigh bends BACK toward LEFT, near boot behind hips to LEFT; dark far leg extends FORWARD toward RIGHT, dark far boot at RIGHT. Row4 col3: light near thigh bends BACK toward RIGHT, near boot behind hips to RIGHT; dark far leg extends FORWARD toward LEFT, dark far boot at LEFT. This alternates depth of legs between two walking steps. Make the nearer backward leg visibly bent at knee, and the farther forward leg more straight. Keep both feet at same bottom level and character head, arms, sword, torso, outfit, palette, scale, cell centre unchanged. No drifting. All other pixels, including first two rows and first two columns, remain unchanged. Keep flat #FF00FF magenta background, crisp chunky Sega-era pixels, dark plum outlines. No added figures, cells, text, borders or grid lines.
```

### grognak_final_leg_correction

```text
Precise leg-pose correction to supplied sprite sheet. Preserve 1024x1536 canvas, 3 columns x4 rows, magenta background, all characters and all body parts except TWO selected pairs of legs. The RIGHT-FACING character in ROW3 COLUMN3 (cell x683..1023,y768..1151): move the LIGHT TAN near leg BACKWARD so its knee is LEFT of the belt buckle and its boot is LEFT of the sword. Its DARK TAN far leg stretches to the RIGHT with boot in front. The LEFT-FACING character in ROW4 COLUMN2 (cell x342..682,y1152..1535): move LIGHT TAN near leg BACKWARD so knee is RIGHT of belt buckle and its boot is RIGHT of torso. Its DARK TAN far leg stretches to LEFT, boot in front. These TWO poses should clearly show light leg behind and dark leg ahead. Do NOT leave the light-coloured leg extended forward in these two selected cells. All remaining ten cells must stay exactly as supplied. No change to head, torso, arms, sword, colours, pixel style, identity, silhouettes above belt, or cell alignment. Use sharp square pixel art matching original, dark plum outlines, no antialiasing, no blur, no extra detail or labels. Keep all feet within their cell. Pure opaque #FF00FF everywhere outside subjects.
```


### grognak_mirror_stride_correction (final selected revision)

```text
Edit the provided 3-column 4-row pixel-art sprite sheet. Only edit the LEGS BELOW THE LOINCLOTH in the two RIGHTMOST side-view cells: row3 column3 and row4 column3. HORIZONTALLY MIRROR the two legs and boots beneath each character's hips, so their extended light-coloured leg now points BEHIND them rather than ahead. For row3col3 facing RIGHT, the extended light leg and big light boot must point toward LEFT, while the dark bent leg is toward RIGHT. For row4col3 facing LEFT, the extended light leg and big light boot must point toward RIGHT, while the dark bent leg is toward LEFT. Think of reflecting only the legs horizontally around the vertical centre of the pelvis. Keep the pelvis attachment anatomical. Keep the torso, head, arms and sword facing their original directions and absolutely unchanged. Do NOT mirror the whole character, only legs/boots below loincloth. Preserve all other ten cells, all colours, all magenta background, exact 1024x1536 canvas, 3x4 layout, no labels or text, no added objects. It is essential that the biggest light-tan thigh and large light-brown boot in these two rightmost cells end up on the REARWARD side. Crisp square pixel art exactly matching input.
```

## Verification and handoff

All six deliverables are generated and saved. All five runtime assets are imported and ready for user review. No reference has been marked user-approved. No code, scene data, shared prompts, or asset manifest were changed; no commit was made.

| Asset | Raw/reference PNG | Actual raw size | Runtime file | Final size | Opaque colours |
|---|---|---|---|---|---|
| grognak_ref | `art/reference/grognak_ref.png` | 1024x1536 | Reference only | n/a | n/a |
| grognak | `art/raw/grognak.png` | 1024x1536 | `games/grelok/assets/sprites/grognak.png` | 96x192 sheet; 32x48 per frame | 15 |
| standing_stone | `art/raw/standing_stone.png` | 1254x1254 | `games/grelok/assets/sprites/standing_stone.png` | 40x70 | 14 |
| pebble | `art/raw/pebble.png` | 1254x1254 | `games/grelok/assets/sprites/pebble.png` | 12x8 | 4 |
| icon_pebble | `art/raw/icon_pebble.png` | 1536x1024 | `games/grelok/assets/icons/pebble.png` | 24x16 | 5 |
| bg_plain | `art/raw/bg_plain.png` | 1536x1024 | `games/grelok/assets/backgrounds/plain.png` | 320x144 | 31 |

The built-in generator returned different raw dimensions for the stone and pebble images than requested. The existing importer accepts these and produces the exact specified game sizes. Raw generations have many intermediate colours; the importer enforces the final Mega Drive colour grid and budgets. Every imported image has binary alpha with no partially transparent pixels.

- `npm run import-art -- grognak standing_stone pebble icon_pebble bg_plain`: passed; Grognak was reimported after the final pose revision.
- `npm test`: 18 test files and 157 tests passed after the final revision. Existing art tests check imported dimensions, colour budgets, console colour levels, and binary alpha.
- `npm run validate`: passed for all six scenes and fourteen hotspots.
- Existing `tests/e2e/art.spec.ts`: passed after the final revision, using installed Edge and an isolated local server on port 5176. A temporary config was removed afterward. Default port 5173 was occupied, and sandboxed browser launch was unavailable; no repository test configuration was changed.
- Visually inspected the final imported background and character sheet and the actual running first screen. Confirmed a readable crossroads, mountain/swamp/chapel directions, separate standing stone and pebble, clear centre floor, consistent light and chunky pixel treatment, and twelve unclipped character frames.
- Preview: [actual game screenshot](../../tests/e2e/screenshots/art-imported.png). The green starting inventory item and interface are pre-existing UI assets, outside this art brief.

## Exact initial generation prompts

### grognak_ref

```text
Use case: stylized-concept. Asset: grognak_ref for an original old-school point-and-click fantasy game. Generate a portrait 1024x1536 PNG character reference, NOT a poster. Pure flat solid magenta #FF00FF background across every pixel outside subject. No transparency, floor, shadow on background, text, labels, frame or watermark. One full-body Grognak facing viewer, feet apart, whole figure including horns, boots and sword visible with small magenta margin. A heroic barbarian-dwarf: tall but stocky, very broad muscular torso and shoulders, powerful legs, big hands, slightly oversized head. Long braided brown beard. Horned grey iron helmet with two curved ivory horns. Bare muscular arms and chest, dark brown leather strap across chest. Brown fur loincloth, wide leather belt with iron buckle, fur-wrapped boots. Big steel broadsword held in HIS RIGHT hand (viewer left), pointing down. Tan skin, brown beard/fur, grey iron, dark brown leather. Original 16-bit Sega Mega Drive fantasy arcade pixel art reminiscent of the era of Golden Axe, NOT a copied character. Deliberately low resolution pixel clusters, hard dark plum #340034 outline, crisp square pixels, about 16 colours, 2-3 flat tones per material, upper-left light. No gradients, blur, antialiasing, painterly shading or tiny decorative details. Strong simple bold silhouette and large colour blocks designed to remain readable at only 32x48 game pixels. Full character should fill most of portrait without cropping. Show exactly ONE character.
```

### grognak

```text
Use case: stylized-concept. Generate a production sprite sheet PNG 1024x1536 for an original Sega Mega Drive era fantasy point-and-click game. Image 1 is the EXACT Grognak identity AND pixel-rendering reference: keep his horned iron helmet, curved ivory horns, braided brown beard, tan skin, broad muscular torso, chest leather strap, fur loincloth, iron belt buckle, fur boots, steel broadsword in his RIGHT hand. No redesign. CRITICAL layout: exactly THREE COLUMNS and FOUR ROWS, twelve equal cells (each 1/3 image width and 1/4 image height). Each cell contains exactly one complete figure, centred horizontally, at same scale with same baseline near the bottom of that cell, with safe magenta margin. No contact or overlap between cells. NO extra figures. Row 1 front facing viewer: stand, walk left leg forward, walk right leg forward. Row 2 BACK view facing away: stand, walk left leg forward, walk right leg forward. Row 3 SIDE view facing RIGHT: stand, step one, step two. Row 4 SIDE view facing LEFT: stand, step one, step two, mirror poses of row 3. Keep anatomy, clothing, horn shape, beard, colours, sword and equipment the same across all twelve cells. Sword always in hand pointing downward, not floating. Broad chunky heroic proportions. Final each frame will be 32x48 so simplify into bold colour blocks, avoid tiny detail. Match reference's crisp square pixels, dark plum outlines, 2-3 flat shading tones per material, upper-left light, about 16 colours. Pure FLAT SOLID MAGENTA #FF00FF background across whole sheet and all cell gaps, fully opaque. No magenta on character. No floor, cast shadows, gradients, blur, antialiasing, text, numbers, labels, grid lines, borders, watermarks. Portrait sprite sheet, twelve full figures, precise 3 by 4 grid.
```

### bg_plain

```text
Use case: stylized-concept. Production game BACKGROUND bg_plain, landscape PNG 1536x1024. Original old-school 16-bit Sega Mega Drive fantasy arcade pixel art with Golden Axe era atmosphere, not a copied screenshot. Broad deliberate pixel clusters and bold flat colour regions, about 32 colours, 2-3 tones per material, crisp square pixels, sparse deliberate texture, NO blur, NO antialiasing, NO smooth gradients, NO painterly rendering, NO heavy black outlines around landscape. Upper-left golden hour light, long shadows toward right. Wide side-on stage-like grassy plain, a crossroads of FOUR dirt roads: north road narrows into distant dark menacing mountains at top centre; west road exits left toward gloomy deep-green swamp; east road exits right toward a small ancient pale-stone chapel on a distant hill; south road comes toward viewer toward unseen town. Lush tall green grasses on both sides of roads bending in wind, broad ochre dirt clearing at centre where four roads meet, EMPTY centre reserved for a separately rendered menhir. Lower half is open, FLAT unobstructed walkable ground, paths to both lateral edges readily traversable. No giant foreground foliage or rocks covering lower floor. Horizon slightly above middle; sky in discrete saturated bands pale yellow, amber, orange, wine-red and plum-purple, no smooth gradient. Composition is CRITICALLY CROP-SAFE: game takes central horizontal strip y=166 to 857 from this 1536x1024 image and reduces it to 320x144. ALL important scenery, chapel, mountains and crossroads must be readable inside that strip, keep important mountain peaks below y=180. Horizon approximately y=400. Centre clearing empty at x~768 y~600; roads left/right should cross side edges within y=450..750. Bottom crop contains mostly open ochre path and sparse small grass edging. Background only, no characters, no standing stone, no collectible pebble, no signposts, no text, no UI, no borders, no watermark, no magenta. Full scene edge-to-edge, like actual low-resolution adventure game environment, not an illustration displayed inside a mockup. Strong atmospheric but simple readable silhouettes, warm sunset against dark green grass.
```

### standing_stone

```text
Use case: stylized-concept. Asset standing_stone, square 1024x1024 PNG cutout for Reign of Grelok, an original 16-bit Sega Mega Drive fantasy point-and-click game. Image 1 controls the game's bold crisp pixel style, dark plum outlines and upper-left lighting (do NOT include the character). Image 2 is the grassy sunset environment where the stone will stand, use its warm-left-light mood and grey-plum mountain materials, NOT its scenery. On a completely FLAT SOLID MAGENTA #FF00FF opaque background, render exactly ONE huge weathered standing stone/menhir in stage-like side view with a little visible front face. Tall tapering irregular grey monolith, about twice as tall as wide, slight lean, chipped corners, 2-3 broad flat grey planes, few bold cracks, a few faint short abstract carved rune marks (not readable writing), little olive green moss and tiny tufts of grass at base. Broad silhouette, entire stone and its base visible, centred, full height with small safe margin; no floor slab or ground plane. No magenta/pink on subject. Crisp deliberately low-resolution square pixel clusters, dark plum #340034 silhouette outline, about 16 colours, 2-3 flat tones per material, light upper-left. Simple enough to remain readable at 40x70 pixels after reduction. No smooth gradients, no blur, no antialiasing, no realistic fine grain, no cast shadow on background. Nothing except single stone with attached little moss/grass. No people, trees, landscape, border, text, label, watermark, UI. Preserve the consistent arcade-era pixel treatment.
```

### pebble

```text
Use case: stylized-concept. Generate exactly one small collectible smooth GREY PEBBLE for Reign of Grelok, original 16-bit Sega Mega Drive fantasy point-and-click adventure. Square 1024x1024 PNG. Image 1 controls crisp square pixel art treatment and upper-left lighting ONLY, do not include its character. Image 2 controls environment palette/mood ONLY, do not include scenery. A simple wide rounded oval stone, width about 1.7 times height, side view with slightly visible top, one broad muted warm-light-grey highlight on upper left, medium grey base and dark grey underside, hard dark plum #340034 outline. About 5-7 flat colours, 2-3 tones on stone, broad deliberate chunky pixel steps, no facets like gemstone, no cracks, moss, engraving or decoration. It will become only 12x8 game pixels so keep silhouette extremely simple and readable. Fill central 75 percent of square width, complete object with clean small margin, centred. Pure uniform opaque solid magenta #FF00FF outside stone; no floor, cast shadow, background gradient, texture or other objects. No magenta on subject. No blur, no antialiasing, no smooth gradients, no painterly rendering. No text, labels, border, watermark, UI. Single isolated pebble with dark outline.
```

### icon_pebble

```text
Use case: stylized-concept. Asset icon_pebble, square 1024x1024 PNG inventory icon for original 16-bit Sega Mega Drive fantasy point-and-click adventure. Image 1 is the exact pebble object to preserve: same smooth wide oval silhouette, warm light grey upper-left highlight, neutral medium grey base, dark grey underside and dark plum silhouette outline. Generate a simplified inventory portrayal of exactly this pebble, not a different rock. Centre the full object, filling most of width with clean magenta margin, width about 1.7 times height. Ultimately 24x16 game pixels. About 5-7 flat colours with 2-3 clear tones on stone, crisp coarse square pixels, bold stepped edges. Keep the upper-left highlight as one flat coherent shape. No texture, facets, cracks, decoration, smooth gradients or antialiasing. Pure flat solid opaque #FF00FF background, no transparency, no ground, no shadow outside stone. No magenta on subject. Nothing except one simple pebble. No text, label, UI, frame, signature or watermark. Match the supplied object's identity and Sega-era pixel-art style exactly.
```

