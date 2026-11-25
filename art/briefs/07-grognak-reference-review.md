# Grognak recolour reference review

**Status:** Approved by the user on 2026-11-25: “I approve the version on the right. Please continue”. The exact candidate has been promoted to `art/reference/grognak_ref.png`; the original remains preserved as `grognak_ref_v1.png`. Animation production is authorized.

- Existing hero reference and edit target: `art/reference/grognak_ref.png`
- Original reference backup: `art/reference/grognak_ref_v1.png`. Its SHA-256 matches the existing reference.
- Road and grass contrast reference: `art/raw/bg_plain.png`
- Candidate: [grognak_ref_v2_candidate.png](../reference/grognak_ref_v2_candidate.png)
- Built-in ImageGen output: `C:/Users/lukas/.codex/generated_images/01a213be-ef03-71d1-bf18-c6a129995978/exec-45bad098-79df-427e-97fd-0d4c080a8681.png`
- Preview: [64×96 candidate](07-grognak-reference-64x96.png)
- Road comparison at 2× nearest-neighbour, original left and candidate right: [comparison](07-grognak-reference-road-comparison.png)
- Grass comparison at 3× nearest-neighbour, original left and candidate right: [comparison](07-grognak-reference-grass-comparison.png). The visual reviewer checked both backgrounds and cleared the candidate for the user's approval decision. This is visual QA, not user approval.

The selected portrait is 1024×1536. An in-memory check used the existing chroma-key and frame pipeline with the manifest’s 64×96 frame and 16-colour budget. Original and candidate both used 16 opaque colours and binary alpha in the preview. Their keyed raw silhouettes overlap by 99.55% of the combined visible area. The recolour keeps the pose, proportions, horn shape, braids, sword hand and equipment. The lighter peach-tan skin, darker fur and beard, and cool steel separate from the ochre dirt and green grass at game size. The candidate and previews are separate from the runtime assets.

## Exact ImageGen prompt

```text
Use case: precise-object-edit. Recolour Image 1 only, a single full-body Grognak production reference on solid magenta. Image 2 supplies contrast context only: his figure will be viewed against its ochre-orange dirt road and dark green grass. Output a 1024×1536 portrait PNG of Image 1 with the colour substitutions below. Show the cutout alone.

Preserve the geometry from Image 1 as closely as a strict palette-swap: exactly the same frontal pose, broad dwarf-barbarian build, face and expression, helmet panel design, paired upturned horn curves, chest strap, paired beard braids and ties, belt and iron buckle, ragged fur loincloth, boot cuffs and wraps, broad hand shapes, feet and baseline. His right hand (viewer left) holds the exact existing broad steel sword pointing down, with unchanged crossguard, length, silhouette and hand position. Keep the same crop, subject size, and placement, and retain the original crisp pixel-cluster shapes, light and shadow boundaries and sharp outline linework. Treat this as a palette revision, with no posture, proportions, expression, anatomy, design or silhouette edits.

Colour changes only:
- Skin: lighter and distinctly less orange peach-tan with a cream-peach light plane, neutral warm peach-tan middle tone, and darker muted brown-tan shade. Avoid pink-magenta flesh, saturated orange, and grey cast.
- Hair and beard: deep dark chestnut brown with few muted chestnut highlight planes, the braids clearly readable as in Image 1.
- Fur loincloth and boot fur: dark chocolate-brown with near-black chocolate shadows and simple dark-brown top edges. Preserve their ragged original silhouettes.
- Belt, chest strap, wrist wraps and boots: dark brown leather with slightly warm muted light accents, no orange.
- Helmet, sword and hardware: cool blue-grey steel with sharply stepped pale blue-silver highlights; preserve material identities. Horns: ivory off-white bone, with restrained muted bone-grey shade and no strong golden cast.
- Keep the original strong near-black dark plum #340034 outline, about 16 visible colours at final game size, 2–3 flat tones per material, square pixels, upper-left lighting. Make the design readable after reduction to 64×96.

Everything outside the single figure and sword must be perfectly uniform solid opaque magenta #FF00FF. No skin or clothing magenta. Preserve safe margins and show the whole horns, feet and sword tip. No scenery, ground, cast shadow, extra figure, text, labels, blur, gradients, texture, antialiasing, border or signature.
```

