# Pixel art generation workflow

Practical instructions for generating consistent assets for **Reign of Grelok**, an old-school point-and-click adventure. Codex handles graphic design and asset production; Claude handles code. Use the existing project specifications for every asset.

## Start every session here

Read these files before generating anything:

- [Art style](art-style.md): the visual rules and location moods.
- [Asset manifest](../art/assets.yml): asset IDs, output paths, dimensions, frame grids, and colour budgets.
- [Prompt fragments](../art/prompts/fragments.yml): shared style and character descriptions.
- [First-screen brief](../art/briefs/01-plain.md): detailed prompts and composition requirements for the plain.
- [Art pipeline](learn/16-art-pipeline.md): how generated pictures become game assets.

Use the manifest for exact technical requirements and the style guide for visual direction. Check the relevant brief for additional constraints. If they conflict, identify the conflict before producing the affected asset. Do not silently invent a new specification. Old generated prompt lists such as `images-to-generate.txt` can be stale; check them against the current manifest.

## Consistency is the main acceptance criterion

**Every asset must look as if the same artist made it for the same game.** A beautiful image that clashes with the approved art is unsuitable. Match existing approved assets before adding detail or visual novelty.

1. Establish a small approved reference set before mass production: Grognak, a representative prop, an inventory icon, and the plain background. Treat these as the visual baseline once the user approves them; placeholders and unapproved generations are not style references.
2. Attach actual reference images to each generation when supported. State which reference controls identity, rendering style, or scene composition. File paths in a prompt alone do not provide an image to the generator.
3. Reuse the same style wording and character descriptions. Change only the subject, pose, required state, and location-specific mood. Avoid improvising a different interpretation of "retro" for each asset.
4. Preserve silhouettes, body proportions, costume, equipment, material colours, outline weight, pixel density, shading, and lighting across all appearances. A new pose must not redesign the character.
5. Compare each result with the approved references and neighbouring assets at **final game resolution**. Inspect it in the intended scene as well as on its own.
6. Keep the last approved reference as the anchor for edits. Repeatedly using the newest unapproved variant as the next reference causes gradual design drift.
7. Reject inconsistent candidates. Do not redefine the game's style to accommodate an isolated generation. A deliberate style change needs user agreement and a review of affected assets.

Keep the successful prompt, attached reference names, generation settings when available, and approval status with each production batch, for example in its art brief. Never mark a reference approved without user approval.

## Fixed visual rules from this project

| Element | Required treatment |
|---|---|
| Overall look | Original 16-bit Sega Mega Drive fantasy arcade art, adapted to a point-and-click adventure. Chunky, bold shapes and readable silhouettes. |
| Screen | 320x200 logical pixels: 320x144 scene plus 56 px interface. |
| Asset sizes | Follow `art/assets.yml`. Grognak uses 32x48 frames; inventory icons are 24x16; backgrounds are 320x144. Props and NPCs have individual sizes. |
| Pixel treatment | Crisp square pixels; no blur, anti-aliasing, smooth gradients, or painterly rendering. Use whole-number nearest-neighbour enlargement for inspection. |
| Outlines | Characters and objects have a hard 1 px dark plum outline (`#340034`) at final resolution. Backgrounds have no added silhouette outline. |
| Shading | Two or three tones per material, upper-left light, large flat areas. Sparse deliberate dithering only; avoid noisy surface texture. |
| Palette | Normally 16 colours for sprites/icons including the outline, 32 for backgrounds; check manifest overrides. Each RGB channel must use 0, 52, 87, 116, 144, 172, 206, or 255 after import. |
| Perspective | Stage-like side view. Stable camera angle, relative scale, floor plane, and character foot placement. No accidental isometric or overhead treatment. |
| Characters | Chunky heroic proportions, big hands, strong legs, slightly oversized heads. Preserve the approved individual design. |
| Outdoor skies | Saturated sunset bands: pale yellow, amber, orange, wine red, purple, interpreted through the location's established mood. |

The importer permits per-asset palettes; it does **not** guarantee visual consistency. Keep the same material colours and contrast relationships across related assets. Grognak's leather, beard, iron, and skin must not change hue between frames. Use `art/palette.hex` only when the manifest requests the shared palette; do not force all assets into it as a new default.

The final 1 px outline is a target-resolution requirement. A one-source-pixel line in a 1024 px raw image will not necessarily survive reduction. Design strong simple edges and let the existing importer enforce the final outline and palette.

## Identity and state continuity

- **Grognak:** follow the current character brief and approved reference: heroic barbarian-dwarf build, braided brown beard, horned iron helmet, fur loincloth, and sword. Keep helmet shape, horn curves, beard shape, equipment, and proportions consistent in every direction and frame.
- **Grelok:** gaunt hooded wizard, wine-red cloak, dark armour pieces, skull-topped staff, glowing eyes. Preserve the same silhouette and costume between appearances.
- **Other characters:** use their descriptions in the shared fragments and the art style guide; establish a reference before generating variants.
- **Object states:** intact/broken, closed/open, rusty/shining, and standing/defeated variants must visibly belong to the same original object or character. Preserve unchanged features.
- **Scene object and inventory icon:** preserve identity, material, main colour, and distinguishing marks. Simplify the icon for readability at 24x16 rather than redesigning it.
- **Animation:** preserve size, palette, baseline, face, outfit, and equipment across frames. Movement changes the pose, not the anatomy or costume. Follow the manifest's frame order exactly; do not add frames or substitute mirroring without checking the specification.

## Raw images and composition

For sprites, sheets, and icons, follow the current **solid magenta cutout workflow**:

- Use a flat solid `#FF00FF` background, with no floor, gradient, texture, vignette, or cast shadow on it. Do not substitute a checkerboard or transparent background unless the project workflow is explicitly changed.
- Keep magenta and pink-magenta off the subject because the importer removes them.
- Show the whole subject with a small safe margin, large enough in the raw canvas to survive reduction. Keep feet aligned; centre inventory icons.
- Add no labels, grid lines, borders, signatures, watermarks, or incidental text. Any required markings must be explicitly specified in the asset brief.
- Save raw PNGs to the manifest's `raw` path, normally `art/raw/<asset-id>.png`. Preserve approved reference images separately; the plain brief specifies `art/reference/grognak_ref.png`.

For backgrounds, fill the canvas; omit the magenta cutout instructions and the sprite outline requirement. Follow the requested generation size and keep essential content inside the final 320x144 crop. The importer crops rather than stretches, so composition must survive that crop. Leave the walkable floor and exits readable. Do not bake separately rendered characters or interactive props into the background: the plain's standing stone, for example, is a separate sprite.

For sheets, check the exact grid and cell count. Grognak currently needs **3 columns by 4 rows**: front, back, right, left; each row contains standing, walking step one, walking step two. Keep every figure fully inside its cell, at the same scale and baseline, with no grid lines.

## Model and effort for good value

Recommendations recorded on 2026-11-25; availability and pricing can change. These are starting points, not measured pixel-art benchmarks.

| Work | Starting choice |
|---|---|
| Establish art direction, reference designs, and reusable prompts | GPT-6.2 Sol, Medium effort |
| Produce assets from an approved reference and fixed prompt template | GPT-6 Luna, Low effort, Standard speed |
| Inspect images and diagnose visual inconsistencies | GPT-6.1 Terra, Medium effort |

The selected chat model plans the work and calls a separate image generator. Higher chat reasoning effort does not directly set image rendering quality. Use the image settings actually exposed by the tool; do not claim to select an image model or quality level when the tool has no such control.

Start with a small representative batch. If Luna misses constraints or needs repeated corrections, use Sol for that task. Evaluate **cost per accepted asset**, including rejected generations, rather than token price alone. Reserve deeper reasoning for a specific difficult design or consistency problem. Preserve the reference set and prompt template when switching models.

Source references: [model selection](https://learn.chatgpt.com/docs/model-selection), [image generation](https://learn.chatgpt.com/docs/image-generation), and [pricing](https://learn.chatgpt.com/docs/pricing). Recheck these before relying on exact rates. This guide deliberately does not lock in a particular image backend or API price.

## Reusable generation request

### Project subagents

Reusable project agents are defined in `.codex/agents/`:

| Agent | Model / effort | Use |
|---|---|---|
| `pixel_art_director` | GPT-6.2 Sol / Medium | Prepare reference designs and fixed prompt templates within the current specs. |
| `pixel_asset_generator` | GPT-6 Luna / Low | Generate an assigned batch from approved references and templates. |
| `pixel_art_reviewer` | GPT-6.1 Terra / Medium | Inspect images and report consistency defects without editing files. |

Example request: "Use pixel_art_director to prepare the pebble prompt from our approved references, pixel_asset_generator to generate the candidate, and pixel_art_reviewer to inspect it."

Run dependent stages in order: direction, any needed user reference approval, generation, then visual review. Reuse approved templates without repeating art direction on every asset. Give each writer separate candidate paths and explicit asset ownership. Run independent assets in parallel only when requested; do not start all three roles for every small task. Review readiness does not replace user approval of a new reference.

The parent must pass asset IDs, the relevant brief, actual reference images or accessible paths, approval status, allowed changes, candidate output paths, and import scope to each agent. These agents inherit the parent session's tools and permissions. If a client does not expose custom agent names, the parent can spawn the same role with its explicit model, effort, and instructions; do not silently substitute another model. A configured file alone does not verify runtime loading or image-tool availability.

### Prompt template

Replace the bracketed fields. Attach the referenced images through the generation tool.

```text
Act as the graphic designer for Reign of Grelok. Follow docs/art-style.md,
art/assets.yml, art/prompts/fragments.yml, and the relevant art brief.

ASSET: [manifest ID and purpose]
RAW OUTPUT: [path and requested generation dimensions]
FINAL GAME SIZE: [width x height, or frame size and sheet grid]
SUBJECT / STATE: [specific content and pose]

REFERENCES:
1. [approved image] controls rendering style, palette relationships, and detail density.
2. [approved character/object image, if needed] controls exact identity and proportions.
3. [scene image, if needed] controls relative scale, camera, and placement.
Preserve these established designs. Change only [explicit allowed differences].

STYLE LOCK:
Original 16-bit Sega Mega Drive fantasy arcade pixel art, stage-like side view,
bold simple silhouettes, crisp square pixels, 2-3 tones per material,
light from the upper left, restrained texture, no smooth gradients,
no blur, no anti-aliasing, no incidental text or decorative presentation.
Match the approved references' pixel density, contrast, and material colours.
Design for readability at the final game size, not for detail in the raw image.

ASSET-TYPE RULES:
[Sprite/icon/sheet: about 16 colours unless manifest overrides; dark plum
#340034 outline at final resolution; flat solid #FF00FF background;
whole subject visible; no magenta on subject; no floor or background shadow.
OR background: about 32 colours unless overridden; no added sprite outline;
full scene with no magenta; preserve the 320x144 crop and walkable area.]

LAYOUT: [framing, safe margins, foot baseline, exact grid/frame order if applicable]
CONTINUITY: [specific colours, costume, geometry, and features that must remain fixed]
```

Use only the applicable asset-type rules. Expand the relevant shared character description into the prompt; do not assume the image generator can read repository files.

For revisions, say: **"Using the approved reference, change only [specific feature]. Preserve identity, silhouette, proportions, palette, camera, lighting, outline, pixel density, and all other details."** Describe the actual mismatch, such as a changed helmet or overly smooth shading, rather than asking vaguely for "more retro."

## Review before accepting an asset

- [ ] Matches the approved reference set in style, pixel density, outlines, shading, contrast, and detail density.
- [ ] Same character/object identity and material colours across poses, states, and icons.
- [ ] Correct manifest ID, dimensions, file path, frame count, and frame order.
- [ ] Readable silhouette and key features at final size; nothing clipped or reduced to visual noise.
- [ ] Stable baseline, camera, relative scale, and equipment placement.
- [ ] Sprite cutout is clean; no magenta fringe, unwanted floor, or cast background shadow.
- [ ] Background crop preserves navigation, walkable space, and separately layered objects.
- [ ] Imported result meets palette, outline, and size rules and fits beside neighbouring assets.
- [ ] User approval is recorded before promoting a candidate to an approved reference.

The importer can enforce technical constraints; it cannot repair a different art style, incorrect anatomy, costume drift, or bad composition.

## Handoff between graphic design and code

Codex's default scope is art direction, prompts, reference management, generation, visual review, and asset handoff. Claude handles implementation. Do not change source code, scene logic, walkmasks, manifest dimensions, frame layouts, or shared prompt definitions just to make a generated image fit. Report a concrete specification or pipeline issue for the coding workflow when needed.

For each batch, report asset IDs, raw file paths, references used, approval status, and unresolved visual issues. Follow the relevant brief for whether to run the existing importer or hand raw files to Claude. When importing is part of the task, use the existing commands:

```sh
npm run import-art -- <asset-id> [other-asset-ids]
npm test
npm run validate
```

Inspect the imported files and the game scene afterward; passing checks alone does not establish visual consistency. Keep raw sources and approved references, and do not overwrite approved artwork with an unreviewed candidate. Do not commit unless requested.
