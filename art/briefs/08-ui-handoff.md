# Title and interface artwork handoff

These are standalone art assets, not integrated into game source or its manifest.

| Asset | File under `games/grelok/assets/` | Picture pixels | Logical pixels |
|---|---|---|---|
| Title panorama | `backgrounds/title.png` | 640×400 | 320×200 |
| Transparent title lettering | `ui/title_logo.png` | 512×96 | 256×48 |
| Transparent interface frame | `ui/interface_frame.png` | 640×112 | 320×56 |
| Transparent pointer | `ui/cursor.png` | 32×32 | 16×16 if drawn at art scale |

## Claude integration

- Title: draw panorama at logical (0,0), scale 0.5. Place a 50% black dimmer above the panorama but below the logo and live text. Draw logo at logical (32,4), scale 0.5. Replace the old bitmap title/shadow with the logo. Keep subtitle, menu, load slots and footer live. The generated panorama needs no second copy of the existing plain background.
- Disabled menu options retain the existing subdued grey styling. Active options passed the real title/load composition review. The image contains no baked buttons or labels.
- Frame: place at logical (0,144), scale 0.5. Keep the existing dark interface backing and live controls. The transparent interior contains no slot grid or labels. The separator occupies picture x218–223, relative y28–91. Verify controls after integration; this art does not alter their hit areas.
- Native cursor at its supplied 32×32 CSS size uses hotspot **(5,3)**. If the bitmap is scaled, multiply the hotspot by the same scale and use nearest-neighbour rendering. The CSS hotspot was accepted in the browser preview. Native cursors are absent from canvas screenshots.

## Review evidence

`08-title-preview.png`, `08-title-load-preview.png` and `08-interface-preview.png` were captured from the actual game with art injected into browser memory only. `08-preview-ui.cjs` reproduces the review without source changes. The real New game menu click successfully entered RoomScene.

`08-cursor-contrast.png` checks the cursor against road, grass, mountain shadow and interface black. Exact image-generation prompts, references and fitting operations are in `08-title-interface-generation-log.md`.

Final frame: the first fitting crowded verbs and covered the footer; it is preserved as `08-interface-frame-first-fit.png`. The final standard border fitting confines the outer rails to x0–3/x636–639, y0–3/y110–111. A pixel check found zero opaque pixels in the interior x4–635,y4–109 except the specified separator. The visual reviewer cleared the corrected populated runtime preview: first verb letters, inventory slots, location name and control hints are visible. The sentence line was empty in that capture; its region passes the transparency check.

Validation: 185 tests passed across 20 files; project validation passed for six locations, six scenes and 15 hotspots. These checks cover the current project, while the new art still needs Claude's source integration.

## Grognak status

The user approved the recolour on 2026-11-25. The exact candidate is now the active `art/reference/grognak_ref.png`, and six animation strips are in production. See `07-grognak-reference-review.md` and its road/grass comparisons. Do not import the strips independently: Claude must coordinate the manifest/game animation update. The reproduced importer cell-height issue and its production options are documented in `07-grognak-import-preflight.md`.
