# Chapel batches: agent coordination and visual review

Work date: 2026-11-25. Production order: **05 chapel exterior, then 06 chapel interior**, because the interior uses the exterior as its architecture and material reference.

## Agents actually invoked

| Role | Agent task | Model | Effort |
|---|---|---|---|
| Art direction | pixel_art_director | gpt-6.2-sol | medium |
| Asset production | pixel_asset_generator | gpt-6-luna | low |
| Visual consistency review | pixel_art_reviewer | gpt-6.1-terra | medium |

Each was launched as a separate subagent with explicit model and effort settings and instructed to read its corresponding `.codex/agents/` definition. The chat models orchestrate the work; image generation uses the separate built-in image tool. The parent coordinates imports, technical checks, runtime inspection, and the handoff to Claude.

No source code, scene data, asset manifest, shared style definitions, or unrelated artwork is assigned for editing. The briefs explicitly authorize replacing their listed raw images and importing those asset IDs. New designs remain pending user review.

## Direction and baseline review

The director's ordered prompts and actual reference-role assignments are in [the production plan](05-06-chapel-production-plan.json).

The Terra reviewer actually viewed the existing plain and mountain backgrounds, Grognak and Grelok references, and imported standing stone. Its baseline acceptance criteria are:

- Match stepped silhouettes, flat saturated sky bands, restrained clusters of ground texture, stage-like framing, and clear flat light/shadow masses.
- Preserve the plain's chapel architecture: pale stone, front gable, compact bell opening and cross, dark pitched roof, longer side wall, and narrow windows.
- Keep roof/cross, doorway, interior exit, altar/window, and usable floor inside the central background crop. Keep the open grave and basin separate from backgrounds.
- Match closed/open doorway frame, material, dimensions and alignment; inspect them together after import.
- Preserve zombie identity between standing and fallen states: green-grey skin, dark straggly hair, yellow eyes, brown peasant clothes, rope belt and bare feet. Defeat is comic and non-gory.
- Inspect native-size assets and integer nearest-neighbour enlargements, plus proposed scene layouts; check silhouettes, outline weight, clipping, magenta fringes, and relative scale.

Two specification details were resolved within the authorized brief:

1. The manifest's generic interior prompt mentions a central basin; the specific interior brief requires a separate basin sprite and empty floor. Follow the specific brief. Do not change the manifest.
2. A literal quarter-chapel-height door conflicts with the existing human-scale 80x120 picture-pixel overlay. Prioritize the manifest size, a simple 2:3 frame and a usable human-scale entrance. The exterior prompt targets the existing logical doorway footprint (x255-295, y40-100); Claude may fit placement to the actual art afterward.

## Exterior review and corrections

Terra inspected the raw and imported exterior background and flagged its initial dominant red sky: it matched the game but read too much like Grelok's mountain. Luna made a targeted edit preserving architecture and floor geometry, shifting the sky toward purple dusk, reducing red peak highlights, and adding low lilac mist. Terra re-viewed both versions and cleared the revised background.

Terra inspected the standing and fallen zombies against Grognak/Grelok references and each other. Both retain the game's chunky outlines and stepped shading. The green-grey skin, dark hair, reddish-brown ragged tunic, rope belt, grey-purple trousers, bare feet, and comic defeated face remain recognizable. Both were cleared for user review.

The first grave looked like a dirt mound after import: its cavity shrank into a thin dark band. Terra identified this in both the native sprite and proposed layout. Luna enlarged the uninterrupted near-black cavity, strengthened its rim, and reduced the mound/tool height. Terra re-viewed the corrected raw, imported sprite, and layout and confirmed that it now reads as an open hole.

The first door generation included too much building and was discarded. The selected corrected asset contains only the limestone arch, jambs, threshold, open walnut leaf, two iron bands, and dark interior. Terra checked it against the closed doorway and the [three-panel comparison](05-chapel-door-comparison.png): original closed door; nominal 80x120 overlay; proposed fitted 68x96 overlay. The nominal overlay is visibly too large. The fitted version closely matches the actual arch and threshold, with no obvious closed-leaf remnants. Its stronger outline remains coherent with the sprite style.

**Exterior visual status: all five assets ready for user review.** This is a review result, not user approval. The [standing-state layout](05-chapel-layout-preview.png) and [open/defeated-state layout](05-chapel-open-layout-preview.png) are diagnostic compositions of actual assets, not screenshots of implemented placement. Door fitting, final grave placement, walkability and scene interactions remain Claude's integration work.

Proposed doorway integration target: bottom-centre logical (256,117), rendered footprint approximately 68x96 picture pixels (34x48 logical). The delivered PNG remains the manifest's 80x120. Claude must fit the rendered size or choose an equivalent pipeline adjustment; no manifest or source changes were made by this task.

## Interior review and corrections

Generation started only after the exterior's visual blockers were resolved. The final corrected exterior is its actual architectural/material reference.

Terra inspected the initial raw and imported interior and found two crop issues: the pointed window top was cut off, and the left entrance arch was crowded against the upper edge. A comparison against the hero also showed that the same entrance was implausibly taller inside than outside. Luna combined the fixes in a targeted image edit: shorten the actual door leaf and frame while anchoring the threshold, fill the removed area with matching masonry, and lower/shorten the window enough to retain its full point. The floor, benches, altar, light and material treatment were preserved.

Terra re-viewed the corrected raw and imported background and the [hero/basin composition](06-chapel-interior-layout-preview.png). It confirmed that both outlines survive the crop, the door now reads at plausible scale beside the hero, and the same pale stone and iron-banded timber connect the two locations. The cool blue/violet room and candle accents remain distinct from the exterior's dusk. There is no basin baked into the background.

Terra separately inspected the raw/imported 60x100 basin and then its scene composition. The shallow blue-water bowl, carved marble pillar, square base, ivy and small sparkles remain readable. Its colours, outline treatment and scale fit the existing game art.

**Final visual status: all seven assets ready for user review; no unresolved art blockers.** New work has not been marked user-approved. The three configured roles were actually used; the parent did not substitute direct image generation for the production agent.

## Technical and runtime evidence

- Existing importer completed for all seven assigned asset IDs. No other asset IDs were imported by this task.
- Final `npm test`: **20 files, 176 tests passed**, using the default timeout after the final selected interior edit.
- `npm run validate`: passed, six scenes and fourteen hotspots.
- [Final pixel measurements](05-06-technical-verification.json): every output matches its current manifest size and colour budget, uses only allowed console RGB levels, and has no partially transparent pixels. Backgrounds are 640x288; logical scene size remains 320x144.
- [Runtime evidence](05-06-runtime-check.json): an isolated Edge/Vite session travelled to the chapel with priest's key and jug, loaded the new standing zombie, defeated it (new fallen image), unlocked the door (new open image), entered the new interior, filled the jug with holy water, and returned outside. No browser page errors. Temporary server and browser were closed.
- Actual runtime screenshots: [exterior](05-chapel-live.png), [opened state](05-chapel-live-open.png), [interior](06-chapel-interior-live.png).

The runtime check proves loading and existing puzzle state transitions, **not finished visual integration**. The old scene still positions the open door at logical (275,100), visibly above/right of the new closed arch and at the wrong rendered size. It also leaves the fallen zombie at its old standing position. The new open grave and basin are not yet listed in the scene files. These expected integration issues are visible in the runtime captures and must be handled by Claude using the proposed layouts and anchors. No scene, source, walkmask, manifest or shared style changes were made; no commit was made.
