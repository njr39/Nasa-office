# NASA HQ review build

Frontend review build for the NASA HQ portal (NOJARA). **All data is synthetic and labelled DEMO.** KAST is the original agent `agent_7501ky1tjmrzf4xa67v0zsqzz9hf`.

```
npm install
npm run typecheck && npm test && npm run test:db   # 10 + 9 tests
npm run build                                       # dist/ (app.js ~381 KB gzip) and dist/review.html (single file)
ELEVENLABS_API_KEY=... npm run serve                # server-side token route; key never reaches the browser
node scripts/e2e.mjs                                # real-browser run (Chromium); writes docs/e2e-receipts.json
```
- `src/core`: one validated action layer used by mouse, touch, keyboard and KAST client tools.
- `src/kast`: SDK adapter (state comes only from SDK status/mode/volume). `server/dev.mjs`: session token route.
- `db/`: reversible draft migration + tests. `docs/`: matrix, KAST branch spec, backend contract, receipts, screenshots.
- Deviations from the PRD stack: plain three.js instead of R3F/drei (smaller, same result for this scene); stand-in RoomEnvironment instead of the Poly Haven HDRI; fallback fonts; synthetic plate.
