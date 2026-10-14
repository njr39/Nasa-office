# NASA HQ review build

**Synthetic review build.** All data is invented and labelled. Nothing here is connected to Supabase, Drive, ElevenLabs or any real media. Live KAST, the backend, publishing and every KAST/tool/branch change are on hold pending separate approval.

```
npm ci                                 # exact pins + lockfile
npm run typecheck
npm test                               # core, tools, voice controller, token route (node:test)
npm run test:db                        # candidate SQL on a real PostgreSQL 17 (embedded)
npm run build                          # dist/app.js (~376 KB gzip) and dist/artifact.html
npm run e2e                            # real Chromium run; writes docs/e2e-receipts.json
node scripts/receipts.mjs              # counts + environment + file hashes -> docs/test-receipts.json
npm run matrix                         # docs/INTEGRATION_MATRIX.md
```
Needs Node >= 22.18 (runs `.ts` tests natively) and a Chromium binary for `e2e` (`CHROMIUM=/path`).

## Layout
- `src/core`: one validated action layer (`Workspace.act`) used by mouse, touch, keyboard and KAST tools. Agent actions carry a voice session and are rechecked against the control lease after every await. `validate.ts` rejects unknown options and out-of-range values at runtime.
- `src/kast`: `controller.ts` is the one-attempt voice controller. `useKast.tsx` wires it to `@elevenlabs/client` and **never reads the context store**. The app opens no microphone itself.
- `server/token-route.mjs`: guarded session-token route. **Off by default.** Needs `NASA_HQ_KAST_ENABLED=true`, `ELEVENLABS_API_KEY`, `NASA_HQ_ALLOWED_ORIGINS`, and an identity adapter (none is wired; the default denies everyone). Binds to loopback unless `NASA_HQ_ALLOW_NON_LOOPBACK=true`. Do not expose it without an authenticated proxy.
- `db/`: **candidate** migration and tests for the single backend owner. Not applied.
- `docs/`: integration matrix (reported vs live), PRD state matrix, backend contract, KAST branch spec (review only), receipts, screenshots.

## Boundaries
- Saved demo context is an app-generated view summary, scoped to a project, expires after 24 h, stored in this browser only and **never sent to KAST**. `PRIVATE_CONTEXT_ENABLED` is `false`.
- The film is a synthetic canvas slate. The test proves the control path, not film playback.
- Deviations from the PRD stack: plain three.js instead of R3F/drei; stand-in environment light; fallback fonts; synthetic plate.
