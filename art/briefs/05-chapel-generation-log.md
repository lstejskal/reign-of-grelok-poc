# Art brief 05: chapel exterior generation log

Status: all five assets generated and imported; Terra visual review passed after corrections. Pending user review. See [agent review and verification](05-06-agent-review.md).

## Final files and Claude handoff

Production used `pixel_art_director` (GPT-6.2 Sol / Medium), `pixel_asset_generator` (GPT-6 Luna / Low, built-in imagegen), and `pixel_art_reviewer` (GPT-6.1 Terra / Medium). Full review findings and corrected issues are in [the agent review](05-06-agent-review.md).

| Asset | Raw PNG | Actual raw size | Runtime PNG under games/grelok/assets/ | Picture size | Opaque colours |
|---|---|---|---|---|---|
| bg_chapel | art/raw/bg_chapel.png | 1536x1024 | backgrounds/chapel.png | 640x288 | 32 |
| zombie_standing | art/raw/zombie_standing.png | 1024x1536 | sprites/zombie_standing.png | 96x128 | 16 |
| zombie_down | art/raw/zombie_down.png | 1536x1024 | sprites/zombie_down.png | 120x48 | 16 |
| open_grave | art/raw/open_grave.png | 1774x887 | sprites/open_grave.png | 100x50 | 14 |
| chapel_door_open | art/raw/chapel_door_open.png | 1024x1536 | sprites/chapel_door_open.png | 80x120 | 15 |

The generator chose a different raw canvas size for the revised grave than requested. The importer still produces the exact manifest size. Final outputs meet palette, RGB-level and binary-alpha requirements. All 176 tests and data validation pass; see the review record for detailed evidence.

Proposed layouts: [standing/closed](05-chapel-layout-preview.png), [fallen/open](05-chapel-open-layout-preview.png). These use actual imported PNGs but are not implemented scene screenshots.

Suggested bottom-centre anchors in logical 320x144 units:

- Standing zombie: (245,120), in front of the door.
- Open grave: (145,125).
- Fallen zombie: (145,123), lying across/in the grave. This needs a different location from its standing state; the current scene changes its image only.
- Open doorway: (256,117), fitted to approximately **68x96 picture pixels**. The delivered file remains 80x120 as specified. The [door comparison](05-chapel-door-comparison.png) shows the original closed plate, oversized nominal overlay, and fitted overlay.
- Hero in previews: (90,126), for scale only.

Claude should add the grave sprite, fit both zombie states and doorway, adjust hotspots/exits and walk area to the new path, and verify depth/occlusion. In the current untouched scene, the open door at (275,100) is visibly misplaced and oversized; this is confirmed in [the live opened-state screenshot](05-chapel-live-open.png). Existing logic transitions and asset loading pass, but final placement remains development work. No scene/code/manifest changes or commit were made.

## bg_chapel

- Raw candidate: `art/raw/bg_chapel.png`
- Built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-270b52de-20d3-44ea-80e0-5934ce543d11.png`
- References actually attached: `art/raw/bg_plain.png` (Image 1; style and chapel identity), `art/raw/bg_mountain.png` (Image 2; dusk palette and pixel rendering).
- Generation: built-in image_gen, opaque full-scene output, no exposed model/quality controls.
- Iterations: first candidate was not selected because the doorway was too far left. Selected second candidate after one targeted prompt to keep the chapel at far right and leave separate grave/zombie staging clear.
- Visual check: crop-safe full scene, no characters, no open grave, doorway closed and readable, broad path clear. Door position/size may need scene fit by code owner; match future open overlay to actual selected doorway.

### Prompt used for selected candidate

Use case: illustration-story. Asset type: full-bleed 1536x1024 side-view game background for Reign of Grelok. Use Image 1 (bg_plain) for the exact style and tiny distant chapel design, Image 2 (bg_mountain) for the established cool purple shadow palette and chunky pixel rendering.

Generate a new exterior chapel graveyard background matching those supplied references: original 16-bit Sega MegaDrive arcade pixel art, crisp broad square pixel clusters, flat large colour masses, 2–3 tones/material, warm upper-left light, sparse texture, about 32 colours, no blur, antialiasing, smooth gradients, grain, text/UI or added sprite outlines. Purple/wine dusk bands, thin amber horizon, pale moon, low lilac mist; dead tree and broken wall, crooked grave stones and wooden crosses in rear. Wide flat walkable dirt path across lower half, open west edge.

CRITICAL SCREEN LAYOUT: final scene is raw x=0–1535 and crop y=166–857. Put the chapel only on the FAR RIGHT, occupying approximately raw x=1190–1530. Its doorway must be centered around raw x=1320 (final scene x≈550; logical x≈275), footprint x=1224–1416, y=358–646, with threshold on floor near raw y=694. Keep left two thirds clear for graveyard, walkable path, separate grave around x=576–816 y=646–766 and zombie feet around x=1056 y=694. No objects at those marked staging areas.

Chapel: pale cream stone front gable, compact square bell turret directly above with a single dark bell opening and a small stone cross, dark brown pitched roof extending right, muted mauve side wall with two slim arched windows. Roof and cross fully within crop. Door faces perfectly square to camera, human scale and unmistakable, a plain round-arched pale stone frame exactly within x=1224–1416, y=358–646, dark brown vertical board leaf with two simple charcoal iron bands. Clear flat threshold. No extra decorative work outside that doorway footprint, so a separately layered open-door overlay can align. Maintain 2:3 frame proportions.

Full scene to all edges, no magenta, no people, no zombies, no open grave, no shovel, no basin. Floor unobstructed and continuously traversable. Keep essential chapel silhouette inside y=166–857.

## zombie_standing

- Raw candidate: `art/raw/zombie_standing.png`
- Built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-0e9d9f0d-bf43-4a18-9582-f21b82cde0a5.png`
- References actually attached: `art/reference/grognak_ref.png` (Image 1; chunky hand/leg/silhouette readability), `art/reference/grelok_ref.png` (Image 2; face/eye shadow accents).
- Status: generated, pending review. Broad shoulder tear, rope belt, ragged brown tunic, grey trousers, green-grey skin, forward arms and bare feet are visible; separate zombie-down prompt will preserve these landmarks.
- Prompt: see approved exact template at `art/briefs/05-06-chapel-production-plan.json`, entry `zombie_standing`.

## bg_chapel mood edit

- Built-in imagegen edit output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-6ee0ea18-f4a1-4ae4-bc89-4203041c41ce.png`
- Edit target: selected `art/raw/bg_chapel.png` candidate; attached by viewing actual local image.
- Prompt: “Edit the provided bg_chapel full scene. Preserve the exact image dimensions, chapel location, complete architecture geometry, closed doorway placement, stone and roof materials, graveyard objects, flat dirt floor, foreground, and overall composition pixel-for-pixel as closely as possible. Change only the outdoor atmosphere to read as chapel dusk rather than mountain sunset: make the dominant sky bands dusky purple and violet, retain wine-red only in a few muted bands, reduce orange to a thin narrow horizon accent, and soften/remove the strong red mountain rim lights into subdued violet shade. Add restrained clear pale-lilac low mist bands among the distant background gravestones and wall, behind the walkable floor, never across the dirt path. Keep the chapel's cream stone warm upper-left highlights. Keep the door closed and identical. No new objects, people, zombies, grave, shovel, basin, text, blur, gradients, or anti-aliasing. Maintain crisp square 16-bit Sega MegaDrive pixel clusters and approximately 32 colours.”
- Applied requested atmosphere change; geometry and doorway retained. Pending review/user approval.

## zombie_down

- Raw candidate: `art/raw/zombie_down.png`
- Built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-03ab722b-f2b3-49c2-9c71-7485e8e80801.png`
- References actually attached: `art/raw/zombie_standing.png` (Image 1; zombie identity), `art/reference/grognak_ref.png` (Image 2; rendering anchor).
- Status: generated, pending review. Lying pose reads wide and low; same costume colours, tears, rope belt and bare feet are present; X eyes and a small dazed swirl.
- Prompt: see exact prompt template `zombie_down` in `art/briefs/05-06-chapel-production-plan.json`.

## open_grave

- Raw candidate: `art/raw/open_grave.png`
- Built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-c6a62b10-bd36-47fb-ac20-863b1d4232e0.png`
- References actually attached: `art/raw/bg_chapel.png` (Image 1; path dirt/palette), `art/raw/standing_stone.png` (Image 2; prop edge/shading).
- Status: generated, pending review. Dark pit with short lip, low mound, shovel and marker form a wide silhouette.
- Prompt: see exact prompt template `open_grave` in `art/briefs/05-06-chapel-production-plan.json`.

## chapel_door_open

- Raw candidate: `art/raw/chapel_door_open.png`
- Selected built-in imagegen output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-64a1f54d-caee-4a59-832b-88ed4ef754a3.png`
- Reference actually attached: `art/raw/bg_chapel.png` (actual corrected exterior; doorway stone/wood identity and palette).
- First output was rejected because it included the entire chapel. Selected second output after a targeted isolated-cutout prompt; it contains only arch, jambs, threshold, open leaf and dark aperture.
- Status: generated, pending review/user approval. Single arch silhouette with pale wedge stones, squared threshold, left-swinging walnut leaf, two studded iron bands and small candle pixels.
- Prompt: see `chapel_door_open` in `art/briefs/05-06-chapel-production-plan.json`; selected correction prompt explicitly restricts to one isolated doorway prop on uniform opaque #FF00FF.

## open_grave targeted edit

- Built-in imagegen edit output: `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-238c2a35-e043-43b6-8b7c-2b1bdc830e55.png`
- Target: local `art/raw/open_grave.png`, viewed and attached as the actual edit target.
- Prompt: “Edit the attached open_grave cutout only. Preserve the same isolated magenta background, material palette, upper-left light, crisp chunky 16-bit pixel-art style and compact overall 2:1 silhouette. Change the prop proportions so it reads unmistakably as an open grave at final game size 100×50: make a much larger, broad uninterrupted near-black brown rectangular cavity dominate the foreground and occupy roughly the lower half of the grave silhouette, with distinct sturdy pale/dark-earth rim around its opening. Keep the cavity clearly open and dark, not filled or covered. Lower and simplify the rear earth mound. Keep the shovel planted in that mound and the small unwritten leaning marker, but reduce both their height and visual weight to reserve more pixels for the hole. Maintain flat bottom baseline and whole prop visible. No extra objects, grass, tile, scenery, text, transparency or cast shadow. Background remains perfectly uniform opaque #FF00FF.”
- Status: pending review/user approval; hole enlarged and dominates foreground; mound and tools reduced.

## chapel_door_open selected isolated-cutout correction prompt

This is the exact selected prompt for output `C:\Users\lukas\.codex\generated_images\01a213c0-408e-7863-87a0-4cd1109dcd6e\exec-64a1f54d-caee-4a59-832b-88ed4ef754a3.png`; the first door output included a full chapel façade and was rejected.

Generate chapel_door_open as a SINGLE isolated cutout prop, portrait PNG 1024×1536, intended game size 80×120. The attached image is a visual reference for the exact exterior doorway style/materials only. Do not reproduce the chapel building.

ONE OBJECT ONLY: the complete freestanding round-arched limestone doorway frame with an open wooden door. No chapel façade, no roof, no bell tower, no cross, no windows, no wall extending beyond the frame, no ground or floor plane. Entire silhouette is just a narrow stone arch and two straight jambs with flat threshold, plus door leaf. Fill canvas behind it with perfectly flat solid opaque #FF00FF, no transparency. Leave generous magenta margin.

Match the exterior doorway: warm pale cream limestone, rounded arch made from a fan of large wedge-shaped stones, straight rectangular jamb blocks, flat squared pale threshold; dark walnut vertical-board door swung inward along viewer-left jamb, with two horizontal studded charcoal iron bands. View straight-on. Fill entire doorway aperture behind the door with opaque near-black interior, with only a few tiny warm candle pixels far back. Door leaf must be visibly open while the aperture stays dark. Frame outer silhouette proportions around 0.71 width per 1 height; full threshold flat at bottom.

Reign of Grelok original 16-bit Sega MegaDrive fantasy arcade pixel art: crisp large square pixel clusters, broad flat colour masses, 2–3 tones/material, upper-left warm light and cool purple-brown shadows, hard dark plum outline target one pixel at final size, about 16 colours, no blur/antialiasing/gradients, no text, no extra trim. Crisp clean cutout silhouette with no cast shadow against magenta; do not let subject contain magenta.

The already recorded bg_chapel mood-edit section above contains the exact selected edit prompt and selected output path.
