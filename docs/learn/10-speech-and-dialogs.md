# 10 - Speech and dialogs

## Who says what: `speakers.yml`
The engine only emits `say` events (text, plus the message `key` when it comes from `messages.yml`). It does not know
who is talking. A game's `speakers.yml` adds that: each speaker has a colour, the `thing` they are (their words appear
above its hotspot), and the message keys they own (`ask_blacksmith_about_*`). Quoted text nobody owns is said by the
`default` speaker (Grognak, above his head).

## Narration vs speech
`interpretSay()` splits a message on its double quotes. What is outside the quotes is **narration** and goes to the
black text box as before; what is inside is **speech** and floats above the speaker in their colour. Narration is read
first (click to continue); the speech starts when the text box is gone.

## Timed UI
`SpeechQueue` (pure, no Phaser) holds the lines. Long speech is cut into pages of 3 lines. Each page lives for
`speechDuration()` seconds (reading time grows with the text), and a click in the scene skips it. `update(seconds)`
is called every frame with the real elapsed time, the same delta-time idea as walking.

## Talking
After a successful "Talk to <speaker>" the verbs and inventory are replaced by a menu (`ui/dialog.ts`): "Ask about
<topic>" for the speaker's `topics` and for everything you carry, then "Goodbye". A choice sends
`perform({verb: 'ask', objects: [npc, topic]})`; the engine picks the answer. The menu closes on Goodbye, Esc,
a click in the scene, or leaving the location.

## Try it
Go south to the town, choose Talk to, click the blacksmith, then ask him about Grelok.
