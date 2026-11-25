# HAMZA · Spatial Pitch Studio V1 (rebuild)

`HAMZA-Spatial-Pitch-Studio-V1.html` is the original Hands Lab: Core file (`Ironoj-HAMZA.html`, SHA-256 `63fba5a8…`) with additions. The original file was not modified. The 3D engine, glass shaders, bloom, nodes, hand tracker and glove rig are untouched.

## What was added
| Feature | How |
|---|---|
| Live captions | Browser speech recognition (Chrome or Edge), interim and final results, active word highlighted, keyword words in amber. English and Egyptian Arabic (`ar-EG`) with RTL and the embedded GE font. Works in Core, touch and studio modes. While on, the fixed-time captions are hidden. Not ElevenLabs. |
| Screen towers | Two black wrought-iron racks, five tilted screens each, built as real 3D geometry in the Core's scene from the installation reference (`tests/screenshots/reference-installation.jpg`). Screens show animated warm and blue light fields with a label. On by default from 730 px wide. |
| Tower hands | Built for hands and gloves, following the HAMZA stage rules in `njr39/hamza-shark` `src/js/17-hands.js` (commit 60bad01). **Quick pinch** on a screen (under 350 ms, under 28 px of hand travel) selects it and lights it; again turns it off. **Pinch and keep pinching** (or move) carries the tower; open the hand to place it. Moving only: no resize from hand distance. **Both hands pinching one tower** resize it. **Open-hand swipe** left or right over a tower lights the next or previous screen. **Fist held 0.9 s** over a tower clears its lit screens, with a progress bar. 900 ms cooldown after each action. A label next to the hand names the gesture. Thumbs up and down are not used: on the stage they open approvals, and a gesture never approves. The Core keeps its own gestures. Mouse and touch still work but are not the intended input. |
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
- Camera mode with Chromium's **fake camera** and **synthetic hand landmarks** fed through the real tracker code (smoothing, pinch thresholds, mirroring), at 640×400 because software rendering here runs at about 8 fps: a pinch does not move the tower during its first 350 ms; a held pinch carries it with the "move tower" label while the Core stays put; an open-hand swipe lights the next screen ("next: OPERATE") and does not open the Core; a fist held 0.9 s shows "hold to clear" with progress, clears the lit screen and does not grab the tower; two hands resize one tower (1.00 to 1.73) with the Core closed; a pinch on the Core moves only the Core. The quick-pinch tap could not be timed with hands at 8 fps (the "short" pinch took longer than 350 ms in real time, so it correctly became a drag); the same tap rule passes with the mouse.
- Live captions with a **simulated** recognizer: interim and final words, active word, keyword lighting of 3D screens, Arabic RTL in GE, restart after end, microphone-denied fallback.
- Camera request: 1920×1080 applied on the fake device (which runs at 20 fps).
Screenshots in `tests/screenshots/`; scripts `tests/t1.js` (captions), `tests/t2.js` (camera), `tests/t5.js touch` (mouse), `tests/t6.js` (hand gestures), `tests/hand.js` (synthetic open, pinch and fist hands).

## Not tested
- Real microphone and the real speech service. Word accuracy and latency are unknown.
- Real hands and gloves. Synthetic landmarks prove the rules, not how they feel, real tap timing at full frame rate, or tracking accuracy near the towers.
- The Core's own open-palm and fist gestures still use its original rules; a real fist with the thumb on the index can read as a pinch there.
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
