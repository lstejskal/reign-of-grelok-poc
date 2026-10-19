# 11 - Sprites that follow the game state

The background is one flat picture. Things that change (a zombie that falls, a door that opens, a gem that
appears) are separate **sprites** listed in the scene's yml:

```yaml
sprites:
  - id: zombie
    thing: zombie              # only drawn while this thing is visible in this location
    x: 220                     # feet (bottom centre)
    y: 110
    states:                    # the FIRST state whose "when" holds is drawn
      - when: {zombie_blocks_chapel_door: true}
        image: sprites/zombie_standing.png
      - image: sprites/zombie_down.png     # no "when" = always holds (the fallback)
```
A sprite with a single look may say `image:` instead of `states:`. If no state holds, nothing is drawn.

## Derived, not stored
The scene keeps **no copy** of "is the zombie standing?". `lookOf(sprite, world)` (pure, unit-tested) answers from
the engine's state: the boolean constraints and the visible things. `RoomScene.refreshSprites()` runs after every
batch of engine events and simply draws the answers. Because there is only one source of truth (the engine), the
picture cannot disagree with the game, and save/load (Step 13) will get correct pictures for free.

## Depth
Sprites are sorted by their `y` like the player (depth = y), so Grognak walks in front of a sprite when he is lower
on the screen and behind it when he is higher.

## Placeholders
`npm run placeholders` makes a coloured block the size of the thing's hotspot for every picture a sprite uses
and never overwrites existing files, so real art can replace them under the same names.
