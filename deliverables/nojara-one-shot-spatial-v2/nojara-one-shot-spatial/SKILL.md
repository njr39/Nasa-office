---
name: nojara-one-shot-spatial
description: Build and audit Nojara cinematic spatial prototypes as one continuous camera journey through connected rooms and environments. Use for WebGL, Three.js, 3D Gaussian splats, tactile interfaces, camera choreography, and reusable HAMZA subsystem prototypes, with verified Drive reference retrieval, preview approval, asset licensing, accessible fallbacks, and measured QA.
---

# Nojara one-shot spatial build

## Outcome and non-negotiables
Produce a real navigable prototype, not a stack of ordinary web sections dressed in gradients. One full-viewport world, one authoritative camera, one continuous authored journey through distinct spaces. Room → threshold → corridor → next room must be spatial travel, not navigation to a different page or teleporting between slides. The story and actual product workflow determine architecture; spectacular effects cannot substitute for working input, decisions, outputs and recovery.

Treat “3GS” as likely 3D Gaussian Splatting (3DGS), explicitly recording that assumption. It is not a synonym for Three.js. A captured splat environment is not automatically editable geometry, physics collision or a navigable scene.

Deliver the blueprint first, obtain approval of the journey, then build the approved slice. Do not rebuild every HAMZA subsystem merely because their names appear in context. Dr. Wonder, railway simulation, Make in Egypt, 39 OS, Batron Talents OS and Young & Human need distinct project manifests, visual identities, data and tests. Share the technical camera/effect contracts, not generic branding. 39 OS can remain standalone while conceptually a subsystem of HAMZA.

## Start with evidence, not a new questionnaire
1. Read `references/drive-locations.md`, `references/environment-index.md`, `references/spatial-reference-pack.txt` and `references/smotion-original-skill.md`. Read `references/web-reference-prd.md` for the 52-reference catalog, interaction and export requirements. These documents were retrieved in this package; some are historical checkpoints, not current runtime evidence.
2. Resolve the target repo, branch, current commit, package manager, lockfile, renderer, camera owner, media layer, fonts, token authority and existing tests. Report inaccessible sources precisely. Inspect, do not execute downloaded archives during discovery.
3. Inventory sources as METADATA_ONLY, TEXT_READ, BINARY_VERIFIED, VISUALLY_INSPECTED or RUNTIME_TESTED. Keep provenance, source date, retrieval date, version/commit, license, checksum and limitations. Do not call a Drive listing complete ingestion.
4. Use the supplied source corpus before requesting its links again. If Drive access is unavailable, use the included text snapshots, mark live access blocked and request only necessary files, not a whole new brief.
5. Preserve original archives. The inspected HAMZA GitHub snapshot was `njr39/CRB_NJR_26@d97b83ea0b4613b9fd745fbea2fe43bcf0fbe58b`; a separate Site v11 was recorded at `f0941a04d535164474240aad2917fd1d57d5b61b`. Neither proves current HEAD. In the inspected GitHub snapshot `src/three/camera/CameraDirector.ts` owns the camera. Reconcile before adding controls.

## Required first handoff: shooting board and technical blueprint
Provide a readable overhead spatial plan and numbered cinematic shots, not abstract “beats.” Each shot specifies objective, actual user input, output, geometry location, entry/exit, camera position/target/FOV, duration or progress range, movement, media asset, text, light/material, transition, audio cue, fallback and loading/error state. Show grayscale frames before styling. Explain what the user sees while moving between rooms. Provide editable `journey.json` and `source-register.json` alongside the board.

Propose a short vertical slice: entry room → visible corridor/threshold → working task room → result room. Include pause/read states and reverse travel. This slice proves the spatial grammar before expanding the full story. Show screenshots plus an actual screen recording when runnable; label still concepts and untested mockups accurately.

## Camera architecture
- One persistent renderer/canvas and shared coordinate system. Scene groups may stream, but changing sections never remounts the camera. One controller writes position, quaternion, FOV and focus. All other systems send intents to it.
- Use an arc-length-sampled spline with calibrated speed/easing and continuous position and tangent at joins. Use quaternion interpolation or stable look targets with roll limits. Avoid fixed Euler jumps and unwanted roll. Test forward and reverse joins.
- A single authoritative progress/time source drives camera, world reveal, typography, lights and audio events. Scroll, drag, keyboard and playback update this same source. Never run Lenis, GSAP, custom rAF and OrbitControls independently against the same camera property.
- Model states: LOADING, TRAVEL, FOCUS, INTERACT, RETURN, COMPLETE, ERROR. Preserve camera snapshot/progress when inspecting an object. Pause → manipulate → validate → restore smoothly → resume. Disable conflicting navigation while forms or dialogs own input. Escape returns control; history/back must not lose submitted work.
- Achieve the one-shot illusion with genuine doorways, near-object occlusion, turns, lighting continuity and composition changes. Do not hide unrelated scene teleportation behind a full-screen fade. A deliberate accessibility fallback may use instant navigation, clearly separate from the cinematic mode.
- Keep a continuous main camera even when video inserts play on world-space screens. If the editorial film requires a full-screen clip/cut, mark it as a different approved presentation mode rather than falsely calling it unbroken camera travel.
- Preload adjacent rooms and compile critical materials before crossing the threshold. On missing media hold in a deliberate safe focus zone, with progress and retry. No blank corridor or fake generation progress.

## Libraries and effects
Read `references/technique-catalog.md`. Choose compatible installed versions, not every library simultaneously. Default to WebGL2 Three.js; React Three Fiber/Drei only if host is React. Optional WebGPU/TSL must have its own compatibility plan. Classic ShaderMaterial/EffectComposer effects are not interchangeable with node-based WebGPU effects.

Implement only selected effects that clarify the scene: procedural assembly, depth parallax, glass/Fresnel, controlled metal/plastic, holographic wireframes, volumetric-feeling atmosphere, selective bloom, shadows/contact cues, rack focus, world-space kinetic type, curved media planes, UV cover crop, velocity bending and transition shaders. Start with restrained Apple-like material clarity and editorial rhythm, not copied Apple branding or unsupported claims that a specific Apple site uses a specific library. Do not flood every surface with neon, particles or blur.

### Gaussian splats
Use a dedicated compatible splat renderer or a deliberately isolated rendering adapter. SuperSplat is an editor/source reference, not automatic Three.js integration. Inspect exact splat format, scale, axis, origin, bounds, visibility and GPU costs. Align splats and mesh rooms at shared thresholds. Provide proxy meshes for occlusion, interaction and collision only when appropriate; label approximations. Test sorting/transparency, near clipping, movement outside captured viewpoints, holes and exposure continuity. Use selected rights-cleared scenes, not all downloadable scenes. Decimate/stream by device budget and provide mesh/image fallback. The archived Voxel51 PLY data is incomplete in Drive; do not build against missing files.

## Tactile, input and audio
- Tactility means stable depth, pressure/hover states, mass/inertia, spring settling, contact shadow, snapping, constrained drag and clear feedback. It does not mean moving all text with the pointer.
- Touch, mouse and keyboard are first-class. Hand tracking is optional, permission-gated, with confidence/loss handling and equivalent ordinary controls. No camera permission at page entry. Do not claim hand tracking merely because cursor animation exists.
- Hardware haptics are optional only where available; unsupported browsers, including typical iOS browser scenarios, must retain visual/audio equivalents. No universal haptic promise.
- Audio begins after a user gesture, with mute and volume controls. Use semantic cues, finite concurrency, gain limits, fades and ducking. Pausing or cancelling must stop orphan audio. Video audio policy is project-specific: Nojara story inserts can use approved faded speech; muted background media stays muted. Do not inherit Smotion's default muted policy blindly over a later approved editorial brief.
- Respect reduced motion: a stable readable direct-navigation version with equivalent content/actions. Keep captions/transcripts and accessible semantic DOM. Avoid camera movement while typing and unsafe flashes.

## Brand and media locks
Keep approved actual logos, product images, spec sheets and source footage. Never generate substitute product details or wordmarks. HAMZA Arabic spelling is همزة and mark ء where that project calls for it. Other projects retain their own identity. Inspect supplied font rights and Arabic shaping; use grapheme-safe text animation with complete shaped runs. Distinguish authored facts from estimates and pitch assumptions. A smooth demo is not evidence of business scalability or completed integrations.

## Build, test, archive
Use an isolated authorized branch. Do not overwrite another project, deploy, buy services, change permissions or expose private source/media publicly without appropriate authorization. Implement in stages: camera-only graybox → real end-to-end task state → approved visual ingredients → media/audio → performance/accessibility. Never substitute a progress simulation for a working external operation without a conspicuous demo label.

Deliver source, lockfile, manifests, changed-file list, runnable instructions, screenshots, recording, measured QA, credits and blockers. Archive by client and date in the approved 39 OS master / HAMZA source location, with a top-level index and stable links; discover exact destination rather than inventing folders. Preserve original outputs and version revisions. Use `references/acceptance.md` as the final gate. Report PREPARED, IMPLEMENTED, TESTED, APPROVED and DEPLOYED separately. A ZIP of this skill is not installation in Claude, execution of the prototype, or a deployment.

## Templates, example and verification record
- `templates/intake.md`: fill from the repo and sources first; ask the owner only for empty rows.
- `templates/storyboard.md`: the required shooting-board format. `templates/journey.example.json` and `templates/source-register.example.json` show the two editable files that ship with it.
- `templates/build-spec.md`: module boundaries, stages and budgets, written after journey approval.
- `examples/vertical-slice.md`: a proposed, untested four-space slice at the expected level of detail.
- `references/session-verification-2026-11-13.md`: what a Claude session actually read on that date, per source and per reference site. Treat it as a dated checkpoint.
