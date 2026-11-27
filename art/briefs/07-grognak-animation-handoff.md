# Grognak animation handoff

The six selected sheets are committed in `art/raw/` (source commit `c624395`). The side-walk alternation, rear braids,
and rear-reaching hand placement have passed visual review at 76×116 and the smaller perspective size. Original WIP
sources remain preserved. The importer now normalizes cell sizes and figure scales with `partCells()`; the old custom
normalization script is unnecessary. Claude still needs to integrate the new layout and verify it in-game.

Final review evidence is in `art/wip/grognak-07/final-wide-candidate-preview/`. Current frames are **76×116**;
the layout is six columns by six rows, with 25 used poses. Two art tests fail until the runtime import and animation
table update are coordinated. Do not run a blanket import while the temporary `grognak_v1` entry remains.

## Approved design

On 2026-11-25 the user approved the right-hand recolour comparison: “I approve the version on the right. Please continue”. The exact approved candidate is now `art/reference/grognak_ref.png`. The original reference is preserved as `art/reference/grognak_ref_v1.png`.

## Claude integration

The brief requires a coordinated import and game animation-table update. Codex supplies raw art and QA derivatives only; no runtime Grognak texture, atlas, code or manifest is changed by this batch.

Before import, read `07-grognak-import-preflight.md` and the final geometry notes in this handoff. The importer currently shares raw cell coordinates across all sheets. All cells must therefore share the same coordinate space and comparable figure scale.

Remove the temporary `grognak_v1` manifest entry when integrating: it writes the same runtime sprite path as `grognak`. Then import the new `grognak` and update `games/grelok/game.yml` together. Tune walk stride and review actual gameplay transitions, mirrored left walking, talking and reaching.

Current manifest layout is six columns and six rows of 76×116 frames. Eleven unused cells are intentional. Use the animation table emitted by the importer; current expected indices are:

```yaml
columns: 6
animations:
  walk_e: [0, 1, 2, 3, 4, 5]
  walk_s: [6, 7, 8, 9]
  walk_n: [12, 13, 14, 15]
  idle_s: [18]
  idle_n: [19]
  idle_e: [20]
  talk_s: [24, 25]
  talk_e: [26, 27]
  reach_e: [30, 31]
  reach_s: [32]
  reach_n: [33]
```

The runtime mirrors right-facing art for left-facing motion; do not generate or map a second left-facing walk strip. Follow the existing game animation schema when copying the emitted table.
