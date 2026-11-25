# HAMZA · Spatial Pitch Studio V1 (rebuild)

`HAMZA-Spatial-Pitch-Studio-V1.html` is the original Hands Lab: Core file (`Ironoj-HAMZA.html`, SHA-256 `63fba5a8…`) with additions. The original file was not modified. The 3D engine, glass shaders, bloom, nodes, hand tracker and glove rig are untouched.

## What was added
| Feature | How |
|---|---|
| Live captions | Browser speech recognition (Chrome or Edge), interim and final results, active word highlighted, keyword words in amber. English and Egyptian Arabic (`ar-EG`) with RTL and the embedded GE font. Works in Core, touch and studio modes. While on, the fixed-time captions are hidden. Not ElevenLabs. |
| Screen towers | Two angled glass panel stacks framing the picture, CSS 3D perspective overlays. They are DOM, not WebGL. Hidden under 560 px wide. |
| Keyword highlighting | SOPs, RACI, Precision (also the Arabic word), UNMADE, Blueprint, Validate light their panel for 5 s. Also reacts to the original fixed captions. Edit `TOWERS` and `KEYS` at the top of the last script block. |
| Camera grade | Warmth 0.32, contrast 1.08, saturation 0.92, grain 0.018, vignette 0.18 set on the Core's own lens pass. Bloom was already 0.30 / 0.55 / 0.88 in the original. Grade button restores the original values. |
| 1080p / 30 fps | The camera request changed from 1280×720 to 1920×1080 at 30. The bar shows what the camera actually delivers. |
| Title | "HAMZA · Spatial Pitch Studio V1" |

Four small edits to the original script: the camera request, the `__ironoj` debug handle (now also exposes `lens`, `bloom`, `OPT`, `camVideo`), the title, and the new CSS, markup and script block (copies in `additions/`).

## Run
Open over localhost in Chrome (`python3 -m http.server`, then open the page). Open camera, then Live captions. Towers and Grade toggle independently. The hand model loads from jsdelivr, so the page needs internet.

## Tested here (headless Chromium, Linux, software GL)
- All 7 script blocks pass `node --check`.
- Touch mode: grade values applied and restored; towers toggle; bar shows only in a session; leaving the session stops captions. No page errors.
- Live captions with a **simulated** recognizer: interim and final words, active word, keyword to panel lighting, language switch to `ar-EG` with `dir=rtl` and the GE font, restart after the recognizer ends, microphone-denied message and fall back to the fixed captions.
- Open camera with Chromium's **fake camera** and a **stubbed hand model**: 1920×1080 applied, readout shown, mirrored backdrop and bar visible. The fake device runs at 20 fps.
- Mobile width (390×844): towers hidden, controls fit.
Screenshots in `tests/screenshots/`; scripts `tests/t1.js`, `tests/t2.js`.

## Not tested
- Real microphone and the real speech service. Word accuracy and latency are unknown.
- Real hand tracking and gloves with this build. The stub returns no hands.
- A real camera at 30 fps, and tracker cost at 1080p. If hands feel slow, lower the request in `camAttach`.
- Real Egyptian Arabic and English in one sentence. The browser recognizer takes one language at a time; use the EN/AR button. Automatic code-switching is not supported.
- Safari and Firefox (no speech recognition there), iPhone and iPad, Mac performance.
- Lip sync. The captions follow recognition results, not audio timing.

## Notes
- Chrome sends microphone audio to its speech service. The bar says so on first use.
- Tower titles use Jaapokki Subtract in capitals, where B and E are stylised. If that reads badly, change the `.tp b` font to `Vonca`.
- The panel text is placeholder wording. Only SOP and RACI carry their standard expansions.
