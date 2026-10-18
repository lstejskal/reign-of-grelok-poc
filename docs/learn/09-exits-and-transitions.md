# 09 - Exits and scene transitions

An **exit** is a polygon in a scene's YAML (`exits:`) with a direction, a `walkTo` point (where Grognak stands
before leaving) and a `spawn` point (where he appears *in this scene* when he arrives through it).

## Clicking an exit
1. `RoomScene.exitAt()` hit-tests the exit polygons (same `hitTest` as hotspots; things win over exits).
2. Grognak walks to `walkTo`, turns the exit's direction, and only then we call
   `session.perform({ verb: 'go', objects: [direction] })`.
3. The **engine decides**. If a zombie blocks the door, it answers with a `say` event: the text shows in the
   answer band and he stays put. The client never knows *why*; that logic stays in the game data.
4. If the engine moves him it emits `location_changed`, and the client fades.

## The fade
The engine changes location instantly; only what we *show* is delayed. `transition()`:
fade a black rectangle in -> swap the picture and place the player (`arrivalAt`) while nothing is visible ->
fade out. `shownLocation` is "what is on screen", which lags behind `engine.state.location` during the fade,
so hotspots and the overlay never mix two scenes. Clicks are ignored while `transitioning`.

The rectangle covers only the scene area (320x144), so the verb bar stays visible, like in LucasArts games.

## Arrival
`arrivalAt(bundle, from, to)` finds the exit in `to` that leads back to `from`, and returns its `spawn`.
He faces the direction he travelled, i.e. into the new scene.

## Try it
Click the top of the plain to go to the Mountain, then the bottom to come back. Go east to the chapel
and click the right edge: the zombie blocks the door.
