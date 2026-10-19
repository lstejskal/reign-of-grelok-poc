# 13 - Title screen, save and load

## Scene flow
`BootScene` (load data and pictures) -> `TitleScene` (New game / Continue / Load) -> `RoomScene` (the game).
From RoomScene the menu (Esc, or the little disk icon) can Save, Load or Quit to title. `?title=off` in the URL
skips the title for development and tests.

## What a save is
`engine.serialize()` already turns the *changing* part of the world into a string (where things are, constraints,
which messages were swapped). Static data - scenes, text, art - is never saved: it comes from the game folder.
The client wraps that string in a small **envelope** (`save/saveGame.ts`):

```json
{ "version": 1, "gameId": "grelok", "savedAt": 1792400000000, "location": "chapel",
  "player": { "x": 292, "y": 110, "facing": "e" }, "engine": "{...}" }
```
`parseSave()` accepts only a valid envelope of *this* game and version; anything else counts as an empty slot, so a
damaged or foreign save can never crash the game. The `version` field lets a future format refuse (or convert) old saves.

## Slots
Three the player picks (1-3) and one `auto` the game fills in whenever you enter a scene or quit to the title.
**Continue** loads the newest of the four. They live in `localStorage` under `adventure:<gameId>:save:<slot>`.
`localStorage` can be missing, full or blocked (private windows), so every access is wrapped in try/catch and
falls back to memory: the game still plays, it just cannot remember across a reload.

## Loading, and why the view needs no extra save
Loading swaps the session's engine (`GameSession.loadEngine`) and starts `RoomScene` again with the saved player
position. Nothing about the picture is stored: sprites, hotspots and the inventory are *derived* from the engine
(Steps 7 and 11), so they simply come out right. Zombie in the grave? The `zombie_down` sprite is drawn again.

One Phaser detail worth knowing: a scene is a single object that is *re-initialised* on every start, not recreated.
Fields keep their old values unless `init()` resets them, so `RoomScene.init()` starts every field from scratch.
