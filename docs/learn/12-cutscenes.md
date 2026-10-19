# 12 - Cutscenes: a sequencer

A cutscene is a list of steps in `games/<id>/cutscenes.yml`:

```yaml
use_rusty_sword_on_zombie:
  - face: e
  - shake: 0.3
  - sync              # the picture catches up with the world NOW
  - wait: 0.4
  - narrate: {message: use_rusty_sword_on_zombie}
```
Steps: `walk`, `face`, `narrate`, `say`, `wait`, `fade`, `shake`, `sfx`, `music`, `sync`, `end`
(listed at the top of the file). `parseStep()` in the engine package turns YAML into typed steps and the validator
checks them, so a typo is reported before you ever play.

## What starts a cutscene
The engine does not know about cutscenes. It says a message (every `say` event carries the message `key`) and the
client looks the key up in `cutscenes.yml`. It plays only if the same command also *changed the world* (a thing, the
inventory, the place, the end of the game): hitting the zombie a second time says the same key but changes nothing,
so it is a plain message. (An action's name would not do: an action "runs" even when it fails.)

## The sequencer
`cutscene/Sequencer.ts` is pure: it walks the list, calls a method of a `CutsceneActor` for each step and `await`s
it. Methods that take time (`wait`, `walk`, `narrate`, `fade`) return a Promise that resolves when they are done;
the next step starts then. That is the whole trick of "async sequencing": the code reads like a script, and no
step needs to know about the others. The scene implements the actor (tweens, the walking sprite, the text box); the
unit test implements it with a fake that records calls and finishes steps by hand.

While `sequencer.running` the scene ignores all clicks except the ones that move text along, and Esc. The lock is
released in a `finally`, so a broken step can never leave the game locked. A cutscene that starts while another
plays waits for its turn.

## Show it later: `sync`
The engine has already moved on when the cutscene starts (the zombie is in the grave, the sword is forged). The view
deliberately keeps its old look - sprites, inventory - until the `sync` step, or the end of the cutscene. Because the
picture is *derived* from state (Step 11), "catching up" is just refreshing.

## Ending
`end: {lines: [...]}` shows THE END with credits and locks the game for good. A game that ends without any
cutscene gets a plain end screen automatically, once its last text has been read.

## Try it
Hit the zombie (chapel), reforge the sword (town) and give the final blow (mountain) - or run
`north, look at rubble ... use shining sword on grelok` from the debug console (`/`).
