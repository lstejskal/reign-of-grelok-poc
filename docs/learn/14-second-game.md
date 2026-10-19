# 14 - A second game on the same engine

`games/demo/` ("The Rusty Gate") is a complete, different game, and **nothing in `packages/` changed** to make
it work. Play it with `?game=demo` (add `&title=off` to skip the title screen); check it with `npm run validate -- demo`;
make its placeholder pictures with `npm run placeholders -- demo`.

## What a game is made of
```
games/demo/
  game.yml               title, start location and position, the player's sprite sheet
  logic/                 the rules and words (the same formats the text game used)
    locations.yml          rooms, their descriptions, exits
    things.yml             everything you can point at; hidden ones start with visible: false
    constraints.yml        blocked exits ("lane-e": "The gate is locked.") and true/false flags
    custom_actions.yml     scripted moves: use_key_on_gate, look_at_haystack, push_goat ...
    messages.yml           all the text, by key
    commands.yml           the words the text parser understands (demo adds "push")
  scenes/<location>.yml  the picture: background, walkmask, hotspots, exits, sprites
  cutscenes.yml          (optional) the ending
  speakers.yml           (optional; demo has none - no one talks)
  assets/                backgrounds, walkmasks, sprites, icons
  walkthrough.txt        the solution, used by tests
```

## How the puzzle is written
The rusty lock is a chain of flags in `constraints.yml`, read and changed by custom actions:

```yaml
use_key_on_gate:
- verify boolean gate_locked true error_gate_open    # already open? say so and stop
- verify boolean gate_oiled true error_gate_rusty     # not oiled yet? "rusted solid", stop
- set constraint-boolean gate_locked false
- set constraint-location lane-e nil                  # the east exit stops refusing
- set description-thing gate description_gate_open
- remove key
```
The client draws the open gate because the sprite in `scenes/lane.yml` has `when: {gate_locked: false}` (Step 11),
and the ending is a cutscene keyed by the message `push_goat` (Step 12). No code knows about gates or goats.

## Soft contracts (and how each one is now handled)
Making a second game is how you find what the engine silently assumes. Three were found; none is silent any more:

- **Fallback replies.** `gibberish1`..`gibberish3` answer input the parser does not understand. A game may write its
  own in `messages.yml` (the demo does, in goat-herder voice); if it does not, the engine says its own plain default
  (`DEFAULT_GIBBERISH`) instead of staying silent.
- **Talk / ask / give naming.** The talk menu sends "talk to X" and "ask X about Y", and the data answers with
  messages named `talk_to_<npc>`, `ask_<npc>_about_<topic>` (or the catch-all `ask_<npc>_about_anything`) and
  `give_anything_to_<npc>`. The first two are now checked by `npm run validate`: a speaker with a `thing` needs a
  `talk_to_` reply, and every topic needs an answer. (This caught a real bug: Grelok's priest listed the topic
  "grelok" but had no reply, so asking him fell back to "You can't chat with that." Fixed.) Giving needs no reply:
  the engine has a polite default.
- **The verb buttons.** They used to be a constant in the client. Now `game.yml` may list them:

  ```yaml
  verbs:                       # up to 6; column-major (the first three are the left column)
    - { verb: pick_up, label: Pick up, objects: 1 }
    - { verb: use, label: Use, objects: 2, preposition: with }
  ```

  `verb` is any lower_snake_case word: the built-in ones (`look_at`, `pick_up`, `use`, `give`, `talk_to`, `push`...) or
  a data-only verb like `open` that you answer with a message or custom action (`open_door`). Leave `verbs:` out and
  you get the default six. The demo lists four, because it has nobody to talk to. Validation checks the count, label
  length (9 characters), duplicates and that two-object verbs have a preposition.

Still fixed: the screen is 320x200 with a 320x144 scene, and right-click / clicking a carried thing always means
`look_at`, whether or not that verb has a button.
