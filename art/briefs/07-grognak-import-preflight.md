# Grognak animation import preflight

Brief 07 calls for six raw animation sheets. Step 0 still requires explicit user approval of the recoloured Grognak reference. No animation frames were generated for this preflight.

## Reproduced with the existing importer

`tools/art/pipeline.ts` slices each grid, then passes the cells directly to `framesPalette` and `processFrames`. The shared content box uses absolute top-origin coordinates inside each cell. The brief’s requested sheets give 512×512 cells for the walk, talk and reach parts, and 512×1024 cells for the three idle views. With identical bottom margins, the taller cells place art 512 pixels below the corresponding coordinates of the shorter cells. The shared crop treats this gap as part of the combined art. At final size this can shrink every frame and leave the shorter-cell frames floating above their intended baseline.

A disposable, in-memory test used opaque magenta canvases and identical 300×400 synthetic silhouettes, each 32 pixels above its own cell bottom. The test invoked the unchanged shared palette selection and parts-sheet functions at 64×96. Bounds are given as `x, y, width, height` in picture pixels.

| Inputs | Walk output bounds | Idle output bounds |
| --- | --- | --- |
| Requested canvases with bottom-aligned subjects | 15, 0, 33, 43 | 15, 53, 33, 43 |
| Idle top 512 rows removed while empty | 0, 11, 64, 85 | 0, 11, 64, 85 |

The test used rectangular stand-ins only. It isolates the coordinate issue; the actual poses still need a visual check for cutout strength, foot placement and continuous motion.

## Production choices and handoff

- Request the exact brief canvases and grids. For the 1536×1024 idle prompt, place all three standing figures in the lower 512 rows at the same local scale and baseline as the other sheets. Keep the top 512 rows entirely magenta. Retain all three views in left-to-right order, even if a derivative is used.
- Inspect the actual pixel dimensions emitted by image generation. Earlier batches received canvases that differed from the requested size. Record actual dimensions, check equal cells and gutters, and measure comparable limb, head and baseline landmarks before treating coordinates as shared. Normalize with a consistent scale per sheet and preserve pose-relative offsets, including purposeful walk bob and reach lean.
- Preserve original generator outputs separately. If the real idle sheet has an empty upper band and aligned lower cells, one possible documented production derivative is its exact lower 1536×512 crop, still a 3×1 sheet. Use it only after confirming that no art is removed and that the fitted cells match the other parts. The preflight does not change the brief or require rewriting unavailable art.
- If Claude needs the production raw to retain the requested 1536×1024 size, or if actual cell geometry needs a more general solution, hand over the original raw sheets and these measurements. A bottom-origin normalization must happen before both shared palette selection and frame fitting. Normalize cell sizes and preserve original pose-relative offsets. Keep the brief grid and pose order.
- After approval and generation, preview the complete batch with the real importer functions in memory and inspect all frames at 64×96 and a smaller perspective size. Compare idle contact height, boot baseline and left/right step order, and check transitions for size jumps, clipped props, duplicate poses and intent. The raw-only handoff can use `import-art --list` to verify readiness. Claude runs the actual import and updates the animation table together.

