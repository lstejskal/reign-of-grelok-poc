# 6. Verbs and the sentence line

**What you can see:** click **Look at**, point at the standing stone: the line says "Look at standing stone".
Click it and the engine's answer appears in the box on the right. **Use** and **Give** take two things
("Use pebble with standing stone"). Right-click looks at whatever is under the mouse. **Esc** cancels.

## The UI is a state machine

`ui/SentenceBuilder.ts` is a small state machine with no Phaser in it:

    idle --verb--> verb chosen --thing--> [first thing --thing-->] Command --> idle

It answers two questions: *what does the sentence say now?* (`text`) and *is it finished?* (`pickObject`
returns a `Command`). Because it is plain TypeScript, the unit tests drive it like a conversation:
select a verb, hover, pick, cancel. No window, no mouse. This is the main trick of UI code:
**keep the rules in a class you can test, and let the scene only translate input and draw.**

## Input becomes a command

    mouse click --RoomScene.onClick--> SentenceBuilder --Command--> session.perform --> engine
                                                                                          |
    text box <--- TextPager <--- 'say' events <-----------------------------------------+

Nothing in the scene knows what "Use X with Y" means in the game. The engine decides (puzzles live in the
data), and the scene shows the `say` events it gets back. The same events also reach the debug console.

## Layout as plain numbers

Where the verb buttons and the text box sit is in `ui/layout.ts` as rectangles, and `verbAt(x, y)` is a plain
function. The scene and the tests share the numbers, so a test can click "the middle of Push" without
Phaser knowing anything about it. (Phaser has built-in clickable objects; hit testing by hand is simpler to read
and test for a UI this small, and it is the same approach as the hotspots in Step 5.)

## Long answers

The box shows 4 lines of 34 characters. `TextPager` splits a long answer into pages; click the box to read on
("MORE >" appears). Step 10 reuses it for speech.

## Default verb

A click on a thing with no verb chosen does `Look at` (`DEFAULT_VERB`). In Step 8 the default becomes
"walk there", like in classic SCUMM games.

## Try it

- Add a verb to `ui/verbs.ts` (it must also exist as a `Verb` in the engine's `types.ts`) and see the grid grow.
  The grid has room for three rows; a fourth row needs a change in `layout.ts`.
- Watch the console (`/`) while you click: every click is a `Command`, and every answer an event.
