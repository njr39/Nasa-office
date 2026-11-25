# Primary source list for scheduled weekly updates

Use primary release notes and documentation, with dates, before changing package versions or code:

- Three.js WebGPURenderer and TSL: https://threejs.org/manual/en/webgpurenderer.html ; https://threejs.org/docs/
- Three.js official releases: https://github.com/mrdoob/three.js/releases
- React Three Fiber: https://github.com/pmndrs/react-three-fiber/releases
- Drei: https://github.com/pmndrs/drei/releases
- Postprocessing: https://github.com/pmndrs/postprocessing/releases
- React Postprocessing: https://github.com/pmndrs/react-postprocessing/releases
- Troika text: https://github.com/protectwise/troika/tree/main/packages/troika-three-text
- GSAP: https://gsap.com/docs/v3/
- Motion: https://motion.dev/docs
- Lenis (maintained): https://github.com/darkroomengineering/lenis
- Remotion: https://www.remotion.dev/docs/
- Motion Canvas: https://motioncanvas.io/docs/
- WebCodecs: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- Playwright: https://playwright.dev/docs/test-intro

A trend report may cite third-party visual examples, but never install packages or copy code based solely on a visual sample. Verify provenance and terms of use.

Known 2026 corrections:
- `@studio-freight/lenis` deprecated: use `lenis`.
- `@pmndrs/postprocessing` is not the R3F npm wrapper: use `@react-three/postprocessing` (+ `postprocessing`).
- WebGPU is not a drop-in backend for classic ShaderMaterial/EffectComposer pipelines.
