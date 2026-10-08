# TamTam Community Dashboard

Full-screen 3D invention game. Pinch, pull parts off a robot, snap them back, wake it up.
React + TypeScript + Vite, Three.js (R3F, drei, Rapier, postprocessing), MediaPipe hand tracking, GSAP, Zustand, IndexedDB.

    npm install     # also copies the MediaPipe wasm and downloads the hand model into public/
    npm run dev     # http://localhost:5173  (camera works on localhost; use HTTPS anywhere else)
    npm run build   # typechecks, then builds to dist/  (serve over HTTPS; add to Home Screen on iPad for true fullscreen)

Everything is driven by `src/spec/tamtam.production.json` (parts, colors, thresholds, strings en/ar, mission).

Controls: pinch = grab, pull a connected part = detach, release near its ghost = snap, two open hands spreading = exploded view,
two pinching hands = rotate, open palm 1.5s = reset (confirm). Touch/mouse do the same. Keys: E explode, R reset, Ctrl+Z / Ctrl+Y undo / redo, Esc exit.
Grown-up area (floating 💾 button, behind a sum gate): save, PNG, clean-feed recording, project JSON, GLB, STL (watertight parts only), delete data.

`prototype/` is the earlier single-file version.
