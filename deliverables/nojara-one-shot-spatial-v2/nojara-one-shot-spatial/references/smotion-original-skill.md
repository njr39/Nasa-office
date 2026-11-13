---
name: Smotion
description: Master cinematic motion graphics, kinetic 3D typography, volumetric media planes, shader transitions, and spatial camera choreography for HAMZA OS, CEREBRO and film/web builds. Includes a weekly evidence-based motion stack audit and gated preset integration.
version: 1.0.0
triggers:
  - 'smotion: install'
  - 'smotion: weekly-update'
  - 'smotion: audit'
  - 'smotion: build'
  - 'cinematic motion'
  - 'kinetic typography'
  - 'spatial media'
---

# SMOTION / CinematicMotionOS

## Identity, scope and action contract

**SMOTION** is the reusable production specification and implementation toolkit for kinetic typography, spatial media, 3D interface motion, video-frame choreography, shaders, and performance audits. Applicable to HAMZA OS, CEREBRO and separately authorized web/film projects. It does not imply the originating application has adopted or deployed these files.

- `smotion: install` — inspect destination runtime and branch; select compatible renderer/dependencies; add packaged files to an owner-authorized working branch/worktree; verify imports, TypeScript, camera/media bindings and tests. Never push to `main`, merge, publish, deploy, mutate the live application or overwrite approved assets without separate authorization.
- `smotion: weekly-update` — verify official upstream sources, record changes, collect 2026 design patterns, run compatibility/performance tests if a runnable project is available, stage changes in versioned candidate patches; do not claim auto-integration without an evidenced successful build and explicit permitted destination.
- `smotion: audit` — evaluate existing implementation against the full acceptance matrix below and label each assertion `PASS`, `FAIL`, `NOT_TESTED` or `NOT_APPLICABLE` with evidence.
- `smotion: build` — implement approved patterns only in specified scope and retain the original identity, media rights, and user-approved project rules.

**Statuses must be separated:** Specified → Prepared → Implemented → Tested → Approved → Deployed. No assumption based on references or exported design screenshots.

### Visual and brand governance

- Preserve exact approved brand assets and wordmarks. HAMZA is **همزة** with mark **ء**; do not substitute حمزة as brand name. Retain locked mark until branding approval changes it. Use real NOJARA logo assets rather than redrawing or replacing them.
- Approved English Jaapokki font where required. Test actual Arabic font shaping and script fidelity. Arabic uses correct glyph connectivity, diacritics, bidi order, and RTL layout; English remains LTR.
- User-specified dark palette: obsidian `#05070B` + glass `rgba(10,14,22,.68)`; light: `#F2F1F0` + ink `#0A0D12`. Accents: `#00E5FF`, `#FF2D7A`, `#CCFF00`, `#C5A059`, `#4C8DFF`, `#EFDB0E`. Zero intentional purple/violet in SMOTION-scoped elements unless project-specific later approval supersedes it.
- Maintain cinematic depth, tactile motion, mobile-first legibility, interaction-safe camera sequences, accessible focus paths, captions, and reduced-motion alternatives.
- Avoid replacing production design systems with this generic palette when a project-specific approved design system takes precedence.

## 1 / Runtime libraries and renderer compatibility

### WebGL2 production path
- `three` + `@react-three/fiber` + `@react-three/drei`; install with mutually compatible peer dependencies, not arbitrary latest packages.
- `postprocessing` and its R3F wrapper `@react-three/postprocessing` for WebGL pipelines. Effects as needed: bloom/selective bloom, chromatic aberration, depth of field, tilt-shift, vignette, approved motion blur, grain and finishing. Measure every effect.
- `troika-three-text` SDF, with native bidirectional layout and Arabic joined-script shaping. Arabic is segmented into **grapheme clusters, not isolated codepoints** for animation. Do not detach an Arabic letter from its shaping context to animate it.
- `gsap` + licensed/available plugins (`SplitText`, `ScrollTrigger`, `Flip`, `CustomEase`) where permitted. `motion` for React-oriented springs and layout transitions; avoid double-driving the same DOM property from two engines.
- `lenis` (maintained package, NOT deprecated `@studio-freight/lenis`) for controlled scroll state. Map scroll position to camera progress using a single authoritative clock.
- WebCodecs where available for precise decoding and frame delivery; video-element fallback required. No 'zero dropped frames' guarantee for any device.
- `Remotion` / `Motion Canvas` as **optional offline render integrations**, not assumed installed or interchangeable with a real-time browser render loop.

### WebGPU experimental/adaptive path
- `three/webgpu` and `three/tsl` with `WebGPURenderer` and its node-based post-processing. It can fall back to WebGL2 where supported, but classic WebGL `EffectComposer`, old custom `ShaderMaterial`/`onBeforeCompile()` code are not drop-in compatible. Choose renderer path after a compatibility audit, and keep a tested WebGL fallback.
- Use Three.js AgX tone mapping where supported and visually calibrated; do not present AgX as an `@pmndrs/postprocessing` component.
- Honor browsers that decline WebGPU and devices with limited VRAM.

### Benchmark references, not implementation proof
- Materials Studio: https://materials-studio.pages.dev/
- Holographic material: https://threejs-holographic-material.vercel.app/
- Dungeon Forge: https://github.com/majidmanzarpour/threejs-procedural-dungeon
- ThreeJS Generator: https://github.com/wearywas/threejs-generator
- Cerebro Core: https://cerebro-core.vercel.app/cro/

**Optics reference target**: telephoto-style FOV 12°–28° where scene composition allows; adjustable 10-light studio rig; refractive glass IOR ~1.45, dispersion aesthetic ~0.03, film ~380 nm, controlled rim/glow. Other figures (`density:3.40`, `caustics:0.55`, `gain:1.75`) are art-direction presets, not standard physical units or guaranteed PBR parameters. Bind pointer, hand, camera and scroll velocities to stable, clamped motion uniforms.

## 2 / Signature kinetic typography presets

Use `src/spatial/KineticTypography.ts` as the authoritative typed preset inventory. Every headline, metric, and caption gets an explicit preset and a fallback. Typical token hierarchy: `lines → words → grapheme clusters`. A monospace telemetry prefix can be separate. Avoid standalone opacity-only fades in key editorial beats, but accessibility and performance fallbacks may use simpler motion.

1. **VELOCITY_STAGGER_3D** (default 25-beat story): 38 ms per word, masked 110% Y entry, -45 px Z, -28° X, critically damped spring target (`omega:5.2`, `zeta:.92`); variable weight 300→700 and Z movement coupled to clamped spline velocity.
2. **TACTICAL_DECODE_HUD** (telemetry): hexadecimal/Arabic-indic glyph scramble targeting 45 updates/s over ~320 ms, resolves to ground-truth numerals without ever changing data value; cyan/acid-green micro-flash. Do not scramble Arabic into illegal joined sequences.
3. **GLOTTAL_STOP_FREEZE** (`Shift + ء`): time-scale 1.0→0.04 in 180 ms, restrained RGB split ~0.0045, hold 420 ms, restore speed; if sound is approved, cue designed silence and impact. Never override the project's no-video-audio policy.
4. **SDF_LIQUID_METAMORPH**: use SDF vertex/fragment motion, flow-like glyph distortion and selective chromatic dispersion. English ↔ Arabic transitions use two properly shaped runs, masking/morphing between runs rather than interpolating mismatched Unicode character meshes.
5. **BRUTALIST_GRID_SNAP**: 1 px calibrated grid expands over 220 ms, numeric counters ease to precise final values, corner reticles align to bento layout.
6. **SLIT_SCAN_ECHO**: time-offset title slices follow high camera velocity; progressively collapse into a single sharp title.
7. **OPTICAL_LENS_REFRACT**: moving refractive slab/cylinder optically distorts background title with controlled refraction/RGB separation, subject to screen-space limitations and mobile fallback.
8. **BILINGUAL_KINETIC_MIRROR**: separately shaped RTL Arabic and LTR English tracks converge along a common composition axis; use semantic reading order and accurate text alternates for assistive technology.

## 3 / Spatial media architecture

Use `src/spatial/SpatialMediaPool.ts` as the lifecycle contract. Images, GIFs, video, reels, slides and stills can appear on volumetric 3D presentation planes; provide a DOM fallback for video accessibility, low-power devices, unsupported codecs, and user preference. The *world* may be 3D, but do not ban accessible native media elements needed for captions, controls, semantics, and fallbacks.

1. **CURVED_CINEMA_PLANE** — cylindrical segment mesh (~0.14 normalized curvature, 48 segments), optical glass bezel (thickness reference 2.4, Fresnel edge, rounded-corner mask 0.06).
2. **SHADER_COVER_CROP** — UV cover scaling centered for 9:16 / 1:1 / 16:9 / 2.39:1 source assets, no stretch and no deliberate black bars. See `references/shader-contracts.md`.
3. **VELOCITY_MESH_BEND** — `uVelocity` modulates parabolic plane bend and clamped edge RGB split; reset on focus to restore readability.
4. **DEPTH_PARALLAX_PHOTO** — depth map from a real asset-derived map where possible; luminance approximation only when labeled an artistic simulation.
5. **FLOW_TRANSITION** — FBM/curl-like displacement, directional reveal, exposure flash with seizure safety and reduced-motion fallback; optical flow only if actual motion vectors/depth evidence exists.
6. **POOLED_VIDEO_LIFECYCLE** — `muted=true`, `playsInline=true`, `loop=true` (unless editorial intent differs), two upcoming beats staged, bounded active VideoTextures, pause off-frustum videos and dispose stale GPU textures. User-controlled sound stays separate from videos.

No unsupported claim of 'zero black bars' is allowed until all assets are measured in target viewports. Do not confuse source `videoWidth/videoHeight` with `<img>.naturalWidth`.

## 4 / Camera choreography, physicality, and hand interaction

- One deterministic motion clock: `timeSec`, `frame`, `fps`, `beatId`, `cameraSplineProgress`; lock keyframes to absolute timeline time, not fluctuating rAF delta. Real-time target 60 FPS; offline film delivery frame rate is an explicit project setting (often 24/25/30). Support interpolation for 60/120 Hz displays.
- Camera rigs: spline travel, dolly, orbit, telephoto compositions, look-at targets, parallax, depth of field, controlled rack focus, dynamic light/atmosphere, motion blur budget and target locking.
- Interaction-safe beat sequence: user can touch, drag, rotate, pinch, manipulate and inspect without breaking narrative state; `pause → gesture → validate → resume` with camera snapshot and safe restoration.
- Hand rigging: 21-landmark tracking from supported camera hand-pose models, skeletal pose retargeting, joint constraints, inverse kinematics as appropriate, finger closure, hand-object alignment, grip confirmation, touch/mouse/keyboard fallback. Camera access requires explicit permission; never claim tracked hands without runtime evidence.
- Tactility: mass/inertia visual cues, spring physics, edge snapping, contact/hover feedback, haptics only on compatible devices. Never promise generic browser haptics on iOS or unsupported browsers.
- Brand props (e.g. Egyptian cultural motifs) must be approved and copyright-cleared.

## 5 / Tactical HUD and micro-telemetry

Target `SpatialHUD.tsx` contract in downstream project, with liquid-glass panels, dark/light adaptive contrast, stabilized spatial text projection and a fixed navigation safe area.

- `SMPTE_TIMECODE` with authoritative frame rate and timebase; never show 60-fps SMPTE for a 24-fps authored deliverable without explicit conversion.
- `SPLINE_SCRUBBER` with beat tick marks and keyboard/touch support.
- `LIVE_WAVEFORM` from authorized Web Audio sources, decoupled from muted video assets.
- `CAMERA_RETICLE` and `[X,Y,Z,FOV]` readouts when diagnostic display is enabled.
- `DRAWER_GUARD`: opening Settings / Optics / Projects / Ask HAMZA suppresses conflicting kinetic text and overlays; keep branding and navigation accessible, no mirror/back-face text.
- `WORLD_PANEL_SAFE_AREA`: prevent text-edge-on, out-of-viewport, mirrored transforms and occlusion behind sticky header/dock, especially at 390x844.

## 6 / Automated weekly update engine

- Canonical manifest path: `src/spatial/cinematicMotionManifest.json`.
- 7-day local freshness threshold: `Date.now() - Date.parse(lastWeeklyCheckISO) >= 7*86400*1000`; a missing timestamp triggers first review. Track **checks** separately from package **updates**.
- External schedule: Monday **09:00 Africa/Cairo**. Scheduling a review does **not** by itself install modified source code in a separate repository.
- Four sources: (1) verified official releases for Three.js/WebGPU/TSL and R3F/drei/postprocessing; (2) motion typography / Arabic RTL / variable font trends; (3) UV, optical-flow, chromatic, and volumetric-transition techniques; (4) regression/performance results.
- Research must cite primary sources and version/commit dates, distinguish releases from speculative examples, check legal/licensing constraints and compatibility with installed dependencies.
- **Auto-register candidates to manifest under `proposedPresets`, not silently to runtime `activePresets`.** Promote to runtime only after approved integration, compatible compilation and passing tests. No production auto-merge or auto-deploy.
- For successful weekly checks, log `lastWeeklyCheckISO`, package version, diff summary, source URLs, benchmark result and exact environment; if no runtime is available, benchmark status remains `NOT_TESTED`.
- Deliver a report with updated vs proposed vs blocked items, candidate patches, risks and recommended adoption order.

## 7 / Automated visual and performance audit gate

- Required devices: desktop `1440×900`, mobile `390×844`; browser, DPR, device, GPU and throttle must be logged.
- Walk every beat 1–25 and sample interior Snode / Investor scenes only when implemented.
- Frame time goal: average ≤16.67 ms for a 60 FPS target; report p50/p95/p99, long frames, dropped frames, shader compile spikes, GPU memory trend if observable. One frame under budget does not prove 60 FPS sustained.
- Validate tokenized words (`data-word-index`) and correct Arabic layout, bidi marks and grapheme joins; test English Jaapokki where required and fallback fonts where not loaded.
- For every active asset: video `readyState>=2`, `videoWidth>0`, texture usable, muted video audio; image `naturalWidth>0`; GIF animated/decoded appropriately; compare plane/media aspect mathematically and visually.
- Check overlapping HUD elements, world-space readable panels, target clipping, negative mirrored transforms, back-face visibility, hover/touch/camera conflicts, drawer guard, dark/light contrast and device permissions.
- Reduced motion and keyboard/touch fallback must be tested, not merely declared.
- Report screenshot + recorded browser test evidence before any production acceptance assertion. No playwright/screenshot output = `NOT_TESTED`.

## 8 / Acceptance outputs and source of truth

When called on a real destination, deliver: (1) changed file inventory/patch, (2) exact installed dependency versions, (3) manifest diff, (4) screenshots of actual output, (5) desktop/mobile QA and FPS numbers or `NOT_TESTED`, (6) approval/commit/deploy state. Do not silently modify unrelated projects or agents.

**Package layout**:
- `SKILL.md`: authoritative instruction contract
- `src/spatial/KineticTypography.ts`: preset types and catalog
- `src/spatial/SpatialMediaPool.ts`: video texture lifecycle helper
- `src/spatial/cinematicMotionManifest.json`: checked status and presets
- `references/shader-contracts.md`: aspect, TSL, right-to-left and hand-physics details
- `references/official-sources.md`: primary documentation/release links
- `tests/motion-audit.spec.ts`: Playwright-ready audit template
- `scripts/weekly-motion-check.mjs`: non-destructive release/manifest checker

## Vendor/license and safety notes

Never copy assets from benchmark sites without rights. Verify exact library versions with project lockfile. Treat user-supplied visual references as references, not an authorization to recreate a protected logo. Support motion reduced preferences, flashes safety, captions and permissions. Keep all scope/project identity boundaries, especially CEREBRO vs HAMZA, distinct.
