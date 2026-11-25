# HAMZA · Spatial Pitch Studio V1 (rebuild)

`HAMZA-Spatial-Pitch-Studio-V1.html` is the original Hands Lab: Core file (`Ironoj-HAMZA.html`, SHA-256 `63fba5a8…`) with additions. The original file was not modified. The 3D engine, glass shaders, bloom, nodes, hand tracker and glove rig are untouched.

## What was added
| Feature | How |
|---|---|
| Live captions | Browser speech recognition (Chrome or Edge), interim and final results, active word highlighted, keyword words in amber. English and Egyptian Arabic (`ar-EG`) with RTL and the embedded GE font. Works in Core, touch and studio modes. While on, the fixed-time captions are hidden. Not ElevenLabs. |
| Screen towers | Two black wrought-iron racks, five tilted screens each, built as real 3D geometry in the Core's scene from the installation reference (`tests/screenshots/reference-installation.jpg`). Screens show animated warm and blue light fields with a label. On by default from 730 px wide. |
| Tower interaction | One owner per gesture. Pinch and hold a tower to carry it; push or pull the hand to resize; turn the wrist to turn it. A quick pinch on a screen lights it (again turns it off). Both hands pinching the same tower resize and turn it. Pinches on the Core behave as before. Mouse or touch: drag to move, scroll wheel to resize, click a screen to light it. Reset puts towers back. |
| Keyword highlighting | Spoken SOPs, RACI, Precision (also the Arabic word), UNMADE, Blueprint, Validate, Intent, Context, Build, Operate light their screen for 5 s. Also reacts to the original fixed captions. Screens are set in `TW_DEF` (Core script), words in `KEYS` (last script). |
| Camera grade | Warmth 0.32, contrast 1.08, saturation 0.92, grain 0.018, vignette 0.18 set on the Core's own lens pass. Bloom was already 0.30 / 0.55 / 0.88 in the original. Grade button restores the original values. |
| 1080p / 30 fps | The camera request changed from 1280×720 to 1920×1080 at 30. The bar shows what the camera actually delivers. |
| Title | "HAMZA · Spatial Pitch Studio V1" |

Edits to the original script, all applied by `additions/build.py` with exact-match checks: the title, the camera request, the tower module (`additions/towers.js`), tower branches in pick, capture, move, release, the two-hand pair, the hint text, the wheel and the frame loop, Reset also resetting towers, and the lab-only `__ironoj` debug handle. The Core's own gestures, gloves, tracker and shaders are unchanged.

## Run
Open over localhost in Chrome (`python3 -m http.server`, then open the page). Open camera, then Live captions. Towers and Grade toggle independently. The hand model loads from jsdelivr, so the page needs internet.

## Tested here (headless Chromium, Linux, software GL)
- All 7 script blocks pass `node --check`. No page errors in any run.
- Touch mode with the mouse: drag moves a tower and not the Core; wheel resizes; clicking a screen lights it and a second click turns it off; spoken keywords light the right screens; Reset restores towers; the Towers button hides and shows them.
- Camera mode with Chromium's **fake camera** and **synthetic hand landmarks** fed through the real tracker code (smoothing, pinch thresholds, mirroring): pinch grabs a tower with the right hint, carrying moves it while the Core stays put, release drops it, a quick pinch lights RACI, two hands on one tower form a tower pair and resize it (1.00 to 1.73) while the Core stays closed, a pinch on the Core moves only the Core. Run at 640×400 because software rendering here is too slow at full size (3 fps; the Core drops a hand not updated within 260 ms).
- Live captions with a **simulated** recognizer: interim and final words, active word, keyword lighting of 3D screens, Arabic RTL in GE, restart after end, microphone-denied fallback.
- Camera request: 1920×1080 applied on the fake device (which runs at 20 fps).
Screenshots in `tests/screenshots/`; scripts `tests/t1.js` (captions), `tests/t2.js` (camera), `tests/t5.js touch|hands` (towers), `tests/hand.js` (synthetic hand).

## Not tested
- Real microphone and the real speech service. Word accuracy and latency are unknown.
- Real hands. Synthetic landmarks prove the logic, not how a real pinch, wrist turn or push/pull feels, or tracking accuracy near the towers.
- A real camera at 30 fps, and tracker cost at 1080p. If hands feel slow, lower the request in `camAttach`.
- Real Egyptian Arabic and English in one sentence. The browser recognizer takes one language at a time; use the EN/AR button. Automatic code-switching is not supported.
- Safari and Firefox (no speech recognition there), iPhone and iPad, Mac performance.
- Lip sync. The captions follow recognition results, not audio timing.

## Notes
- Chrome sends microphone audio to its speech service. The bar says so on first use.
- Screen labels use Jaapokki Subtract in capitals, where B and E are stylised. If that reads badly, change the label font in `twLabel` to `Vonca`.
- Screen content is generated light, not video. Real clips on the screens are a next step.
- Tilt angles and proportions are my reading of the photo, not measurements.
- The panel text is placeholder wording. Only SOP and RACI carry their standard expansions.
