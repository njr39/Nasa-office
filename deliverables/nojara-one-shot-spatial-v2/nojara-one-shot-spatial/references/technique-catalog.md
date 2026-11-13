# Techniques, libraries and repository inventory

## Source-derived environment and material references
See Drive locations for exact snapshots. Licenses below are recorded in retrieved archive notes, not a fresh full legal audit. Recheck LICENSE and asset-level notices at the pinned revision before redistribution.

| Repository | What to look for | Recorded license / limitations |
|---|---|---|
| https://github.com/majidmanzarpour/threejs-procedural-dungeon | seeded room/door construction, assembly staging, route graph overlays | MIT; replace dungeon motifs with project-specific architecture |
| https://github.com/wearywas/threejs-generator | procedural neighborhood/components, trees, cottage, butterfly swarm | MIT; do not load every example |
| https://github.com/Amir-Abushanab/materials3d | glass/metal/plastic, aperture/skewer material demonstrations | MIT plus third-party notices; renderer inspiration, not business logic |
| https://github.com/tiveor/city-simulator | moving map, road/traffic visual language | MIT; not a real railway/timetable/safety model |
| https://github.com/adamjenkins/moodle-vrroomenv_rooms | connected interior room assets; archive excludes kitchen | GPL-3.0-or-later code, mixed CC0/CC-BY/MPL room assets |
| https://github.com/ClementCariou/virtual-art-gallery | gallery staging, movement, world-space artwork display | MIT code; remote artwork rights separate |
| https://github.com/aws-robotics/aws-robomaker-small-warehouse-world | warehouse scale/layout/reference assets | MIT-0 archived ros1; unsupported; not a runtime web engine |
| https://github.com/nasa/NASA-3D-Resources | selected science/space geometry if story requires it | NASA media policy and third-party/endorsement rules; not blanket permission |
| https://github.com/playcanvas/supersplat | 3DGS editing, scene cleanup and export | MIT editor; hosted scenes have separate licenses |
| https://huggingface.co/datasets/Voxel51/gaussian_splatting | drjohnson/playroom/train/truck reconstruction reference | card reports Apache-2.0; upstream attribution/assets review; Drive incomplete |

## Runtime stack inherited from Smotion
Direct page availability checked during this task for Three.js, R3F, Lenis and SuperSplat. Other links below are source-derived official pointers from Smotion or proposed implementation candidates; no fresh version/compatibility/installation claim. All resolved package versions and licenses must be recorded by the builder.

| Library / official source | Role and effects | Gate |
|---|---|---|
| https://github.com/mrdoob/three.js | WebGL scene graph, perspective camera, splines, meshes, PBR, lights | choose compatible pinned version; one renderer owner |
| https://github.com/pmndrs/react-three-fiber | React lifecycle binding | only if target is React; match React/Three peer dependencies |
| https://github.com/pmndrs/drei | helpers for assets/text/materials | helpers do not replace camera ownership contract |
| https://github.com/pmndrs/postprocessing | controlled bloom, DOF, vignette/grain and finishing | WebGL path; measure each pass |
| https://github.com/pmndrs/react-postprocessing | R3F effect wrapper `@react-three/postprocessing` | not `@pmndrs/postprocessing` |
| https://github.com/protectwise/troika/tree/main/packages/troika-three-text | SDF text and shaped world-space typography | verify Arabic/bidi/font asset behavior |
| https://gsap.com/docs/v3/ | sequenced motion, eased timelines, ScrollTrigger when needed | current license/plugin availability must be checked; no competing camera writer |
| https://motion.dev/docs | UI springs/layout response | avoid controlling a property already driven by GSAP |
| https://github.com/darkroomengineering/lenis | optional smoothed input → shared progress | use `lenis`, not deprecated namespace; not mandatory for one-shot |
| https://threejs.org/manual/en/webgpurenderer.html | optional WebGPU/TSL path | separate shader/postprocess compatibility and fallback |
| https://www.remotion.dev/docs/ | optional deterministic offline video export | license/runtime assessment; not the interactive world renderer |
| https://motioncanvas.io/docs/ | optional authored motion export | separate implementation path, not assumed installed |
| https://playwright.dev/docs/test-intro | UI, media, screenshot and regression evidence | tests must actually run to be PASS |

## Effects to inventory and preview
1. Camera: dolly, truck, pedestal, controlled orbit, push-through doorway, occlusion reveal, crane-like transition, rack focus, parallax, speed ramps with smooth joins.
2. Architecture: modular assembly, disassembly, object-to-room scale reveal, connected rooms/corridors, procedural repeatability, route overlays.
3. Materials: transmission/refraction, Fresnel edge, rough metal/plastic, restrained dispersion, contact shadow, controlled fog/atmosphere, holographic wireframe. Physical quantities and art-direction presets must not be confused.
4. Media: curved cinema plane, aspect-correct UV cover, depth-map parallax, velocity bend, bounded video pool, actual frame readiness, authored audio fades/ducking.
5. Typography: velocity stagger, tactical decode, glottal-stop freeze, SDF liquid morph, grid snap, slit-scan echo, optical refraction, bilingual kinetic mirror. These are Smotion preset names; inspect actual implementation and test before claiming rendered capability.
6. Touch/hand: constrained drag, mass/inertia, snap, press depth, hover/contact feedback, optional hand skeleton tracking with confidence and consent. Hand rig is separate from splat geometry and camera controls.
7. Finish: selective bloom, subtle grain/vignette, restrained chromatic aberration, optional blur; never obscure actual content or simulate proof with unreadable motion.

Use minimal selection appropriate to each project. A catalog is not a requirement to add every effect. No arbitrary site's visuals, proprietary scripts, fonts or audio may be copied merely because they are observable in a browser.
