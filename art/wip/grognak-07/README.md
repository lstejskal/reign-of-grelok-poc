# Grognak animation source archive

The selected production inputs are the six `art/raw/grognak_*.png` sheets. The six original sheets in this directory
are preserved as pre-correction sources, not replacements for those selected inputs.

Accepted correction sources retained here:

- `grognak_walk_e_far_contact_v1.png`, `grognak_walk_e_far_down_v1.png`, `grognak_walk_e_far_passing_v1.png`:
  individually generated opposite-leg steps used to replace the side-walk's second row.
- `grognak_walk_e_far_step_assembled_wide_candidate.png`: selected 1536×1536 side-walk assembly; identical to the
  selected `art/raw/grognak_walk_e.png`. Wider cells retain the original first-row scale and fit the new strides.
- `grognak_idle_braids_candidate.png`: selected idle sheet with consistent rear braids.
- `grognak_correction_plate.png`: generated correction plate; only its lower-right rear-reaching pose was selected.
  Its three walk poses were rejected and are not production frames.
- `grognak_reach_rear_plate_candidate.png`: selected reach assembly using that rear-reaching pose.

`final-wide-candidate-preview/` contains the reviewed combined 76×116 and 70px previews. Review and prompts are
recorded in `art/briefs/07-grognak-animation-generation-log.md`; current integration instructions are in
`art/briefs/07-grognak-animation-handoff.md`.

Other untracked attempts and earlier preview folders are local rejected or superseded work. The
`runtime-import-recovery/` folder is a local recovery snapshot, not an approved runtime asset set. It is deliberately
excluded from the artwork commits. No local files were deleted as part of this archive.
