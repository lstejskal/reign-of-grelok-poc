# 16 - Art direction and the AI asset pipeline

AI image generators are good at producing a nice picture and bad at producing a picture that **fits your game**: wrong
size, smooth edges, thousands of colours, a background you do not want. The art pipeline is the bridge. You generate
anything; code makes it look like it belongs.

![raw picture, then the imported one, for the stone and for Grognak](img/16-raw-vs-imported.png)

*Left of each pair: what an image generator gives (here, a stand-in drawn by `tools/make-sample-raw.ts`). Right: what the
game gets after `npm run import-art`.*

## The folders
| Path | What |
|---|---|
| `docs/art-style.md` | The rules: sizes, palette, outlines, shading, mood of each place. Read this first. |
| `art/palette.hex` | The 32 colours the game may use (Mega Drive-style 9-bit values). |
| `art/prompts/fragments.yml` | Reusable prompt text: the shared style line and a brief per character. |
| `art/assets.yml` | Every picture the game needs: its type, size, where it goes, and its prompt. |
| `art/raw/` | The pictures you generate (input of the pipeline). |
| `tools/gen-image.ts` | Prints the prompts, or generates the pictures if an image service is configured. |
| `tools/import-art.ts` | Runs the pipeline. |
| `tools/art/pipeline.ts` | The cleaning steps themselves: small pure functions, each unit-tested. |

## The workflow
```
npm run gen-image                  # see the prompt for every asset without a raw picture
  ... generate a picture, save it as art/raw/<asset>.png  (flat magenta #FF00FF background!)
npm run import-art -- standing_stone
npm run dev                        # look at it
```
`npm run import-art -- --list` shows which assets have a raw picture. To let `gen-image` call a service for you, copy
`.env.example` to `.env` and fill in `IMAGE_API_KEY` (any OpenAI-style image API works; see `tools/art/imageApi.ts`).
Each picture is requested in a shape that suits it (wide for backgrounds, portrait for the 3x4 character sheet, square for the
rest). An asset can say `gen_size: "1024x1536"` in `art/assets.yml`, and `IMAGE_SIZE` in `.env` forces one size for all.
`npm run sample-raw` redraws the two stand-in pictures used to demonstrate the pipeline.

## What the pipeline does, step by step (`processFrames`)
1. **Cut out.** The generator was asked for a flat magenta background. `chromaKey` makes everything close to magenta
   transparent. Generators never give a perfectly flat colour, and the edges blend with the figure, so it also removes
   anything *leaning* magenta, and one more layer of pinkish fringe around the figure.
2. **Crop to content.** One box around **all frames together** (not each frame alone): a walking frame with a leg stretched
   out must stay where it is relative to the standing frame, or the character would jitter.
3. **Shrink.** By one common factor, so the box plus its outline fits the target size. Two methods (`method:` in
   `assets.yml`): `nearest` copies one source pixel per new pixel (crisp, right for pixel art), `box` averages everything
   it covers (smoother, better when the source is a detailed picture).
4. **Remove specks.** Lonely single pixels left over from the cut-out.
5. **Snap to the palette.** Every pixel becomes the *nearest* palette colour. "Nearest" counts green differences more than
   blue ones, because that is how our eyes work. This is what makes pictures from different sources look like one game.
6. **Outline.** One pixel of dark plum around the figure. Outlines are the single biggest part of the arcade look.
7. **Place.** Put it on a canvas of exactly the size the game expects, feet on the bottom edge (icons: centred).

Backgrounds skip the cut-out and outline. They are shrunk and snapped, with **ordered dithering**: before choosing the
nearest colour, each pixel is nudged up or down by a repeating pattern (a "Bayer matrix"). A smooth sky then becomes a fine
checkerboard of two palette colours instead of hard bands, the classic way 16-bit games faked more colours.

Sheets (the player) are cut into a grid first, processed as one set of frames, pasted back together, and a Phaser-style
**atlas** file (`grognak.json`: where each frame is, plus named animations such as `walk_e`) is written next to the picture.
The game does not read the atlas yet; Step 17 will use it for animation.

## The tests
- `tools/art/pipeline.test.ts`: every step on tiny hand-drawn pictures (a known colour snaps to the expected palette colour,
  a grid slices into N frames and composes back identically, the outline touches only the edge...).
- `tools/art/art.test.ts`: the **palette test**. Every asset that has a raw picture (so, was imported) must use only palette
  colours, with no half-transparent pixels, and have the size the game expects. The prompt expansion and the image-service
  request are tested with a fake service. `npm run validate` still checks that the files exist and fit.
- `tests/e2e/art.spec.ts`: the imported stone and Grognak sheet really load and show in the game.

## What ships in this step
- `standing_stone` is now a sprite in the plain (an imported picture, in front of the placeholder background).
- `grognak.png` is the imported character sheet. Both come from stand-in raw pictures, not from a real image generator: I
  cannot generate images, so `tools/make-sample-raw.ts` draws them (smooth shapes, off-palette colours, noisy magenta
  background, 4x too big, like generator output). Replace `art/raw/standing_stone.png` and `art/raw/grognak.png` with real
  generated ones and import again.

## Limits
- The walk frames of the stand-in sheet differ little; a real generator sheet will do better. Consistency across frames is
  the hard part of AI art, which is why Step 17 keeps frame counts low.
- Placeholder pictures (backgrounds, other sprites, icons) are still the generated tiles; they are replaced scene by scene in Step 17.
- `gen-image` has not been run against a real service (there is no key here); it is tested with a fake one.
