# 15 - Audio

Sound is half of what makes an adventure game feel alive. This step adds a looping tune per scene, sound effects for
actions, a mute key and a volume setting. All the sound is placeholder, made from maths by a script, so real music can
replace it later under the same file names.

## The pieces
| File | Job |
|---|---|
| `client/src/audio/mix.ts` | The **pure** part: fade maths (`stepLevel`), volume steps, settings load/save, the `AudioPlayer` interface. No Phaser, fully unit-tested. |
| `client/src/audio/AudioManager.ts` | The Phaser part: plays tracks and effects, runs the crossfade. |
| `tools/make-placeholder-music.ts` | Synthesises the tunes (encoded to `.mp3` with ffmpeg) and the effects (`.wav`) (`npm run placeholder-music -- <game>`). |

`RoomScene` only knows the small `AudioPlayer` interface (`setMusic`, `playSfx`, ...). Tests and a game with no sound use
`silentAudio`. This is the same trick as `SaveStore`: the scene does not care what is behind it.

## How a game uses it (data only)
- **Scene music:** `music: music/plain.mp3` in `scenes/plain.yml`. Entering the scene starts it; leaving crossfades to the next.
- **Cutscene sounds:** `sfx: clang` plays `assets/sfx/clang.wav`; `music: battle` plays `assets/music/battle.mp3`; `music: stop` fades out.
- **Everyday sounds:** if the game ships `sfx/click.wav`, `sfx/pickup.wav` and `sfx/door.wav` the client plays them when you click
  the interface, pick something up or change scene. Without those files there is just silence (nothing breaks).
- `npm run validate` checks every referenced file exists.

## Concepts worth knowing
**Browsers will not play sound until the player has interacted.** This is the *autoplay policy*: a page that blasted music on
load would be awful. Phaser notices the locked state, keeps the sounds waiting, and starts them on the first click or key
press. That is why the music begins when you first click, not at page load. (`window.__adv.game.sound.locked` shows it.)

**Crossfade.** Each track has a `level` (0..1) and a `target`. Every frame `update(deltaMs)` moves the level a little towards
the target (`stepLevel`), and sets the real volume to `level x master volume`. Changing scene sets the old track's target to 0
and the new one's to 1, so they fade past each other over 0.9 s. A track that reaches silence is destroyed. Because the fade is
driven by elapsed time, it behaves the same at any frame rate.

**Looping tunes.** The generator makes four bars and makes sure every note has died away by the last sample, so the loop point is
seamless. Each location has a mood (a musical *mode*: Dorian for the road, Phrygian for the mountain, ...), a tempo and a seeded
random motif, so the same game always gets the same files.

**Master volume and mute** are multiplied in at the last moment, so they apply to music and effects alike. They are saved in
localStorage under `adventure:audio` (one setting for all games) and read back defensively: a missing, damaged or blocked store
just means the defaults. Controls: `M` toggles mute (ignored while you type in the debug console); the in-game menu has a
`Volume` row that steps OFF / 25% / 50% / 75% / 100%.

## Try it
`npm run dev`, click once, and walk between scenes. Open DevTools and look at `__adv.audio` (`currentTrack`, `played`, `muted`,
`volume`) and `__adv.game.sound.sounds` (watch two tunes exist during a fade).

## Limits
- Placeholder sound only. Real tunes: drop files over the generated ones (keep the names).
- No title-screen music, no positional or per-scene sound effects, no separate music/effects volume (one master volume).
- Music is `.mp3` (about a tenth of the size of the raw `.wav`); effects stay `.wav` because they are tiny. Real tunes can be
  `.mp3` dropped over the generated ones. Caveat: an mp3 encoder adds a few milliseconds of silence at the start and end of a
  file, so a loop can have a faint hiccup. If it bothers you, `.ogg` loops perfectly (the glob already accepts it; change `musicPath`).
