# Integration matrix

Generated from `src/integration.ts` (same data as the in-app STATUS dialog). Two separate columns, on purpose:

- **Reported**: the author ran it, in the environment named in the evidence. **None of it has been independently run.** `pass`, `partial` or `not_run`.
- **Live verification**: checked against the real provider, backend, device or real media. **Nothing is live-verified.** `not_tested`, `on_hold` (waiting for an approval) or `blocked`.

| Feature | Reported | Live verification | Evidence and limits | Next |
|---|---|---|---|---|
| English-only UI including the header; agent selection gates Enter | **pass** | **not tested** | Browser run (Chromium + SwiftShader, no GPU): Enter disabled until an agent is chosen; no Arabic text in the DOM. |  |
| Sphere: orbit, 5 px drag threshold, node select (mouse, touch path, keyboard) | **pass** | **not tested** | Browser run. Touch is covered through the same pointer handler, not a physical device. | Real touch device |
| One validated action layer; session, control-lease and revision checks after every await | **pass** | **not tested** | Node unit tests including delayed play, delayed save, manual override, disconnect and duplicate delivery. |  |
| Strict runtime validation of tool arguments (enums, targets, unsupported options) | **pass** | **not tested** | Node unit tests. The provider-side tool schemas still allow values the page now rejects. |  |
| Slate-control test: open, play, pause on a SYNTHETIC canvas slate | **pass** | **not tested** | Proves the control path and clock only. No film, no <video>/<audio> element, no provider embed, no autoplay policy was exercised. | Real sources after approval |
| Scroll: receipt reports the observed final position | **pass** | **not tested** | Browser run asserts receipt scrollY equals window.scrollY after settle. |  |
| Layouts auto / portrait / horizontal; 390x844 no horizontal overflow | **partial** | **not tested** | Screenshots at 390x844 and 1587x991 only. Tablet, 360, 430, 1280, 200% zoom and screen readers not run. | Full acceptance matrix |
| S05 blocked web viewer, S07 read-only, S08 command Run/Cancel, project views, entry selection | **pass** | **not tested** | Unit + browser run. Web embedding is intentionally absent. |  |
| Other S01-S15 states and workspace modules | **not_run** | **not tested** | Not built: map (S12), conversation history and line switching (S10), updates, sign-in/out, real handoffs. See docs/PRD_STATE_MATRIX.md. |  |
| Token route: gate off by default, auth, permission, Origin, CSRF, rate limit, bounded upstream | **pass** | **not tested** | Node tests with a fake identity adapter and fake provider fetch. No real identity layer exists; the default adapter denies everyone. | Real identity adapter + HQ permission source |
| Voice lifecycle: one-attempt controller, cancellation, late results, unmount, no unmanaged microphone | **pass** | **not tested** | Node tests against a fake provider that owns a fake microphone. The real SDK, WebRTC and a real microphone were not exercised. | Real session after approval |
| Demo context is synthetic-only and never sent to KAST | **pass** | **not tested** | Unit tests: view-summary only, scoped by project, expires, free text refused, absent from provider messages. |  |
| Live KAST voice session, greeting, tool calls delivered by the provider | **not_run** | **on hold** | Not run. Live KAST changes, the test branch and tool attachment are on hold. nasa_view stays a review-only spec. |  |
| Backend candidate SQL on real PostgreSQL 17 (embedded), synthetic rows | **pass** | **on hold** | 18 tests incl. concurrent writers and mutation checks. Not applied anywhere. Karsa owns the single backend; the prepared nasa_private foundation was not available to this author. | Reconcile into ONE migration |
| Supabase project, Drive ingestion, per-file permissions, Auth JWTs | **not_run** | **on hold** | Not inspected, not applied, not connected. |  |
| Real film/player, real satellite plate, HDRI, licensed fonts, NASA mark | **not_run** | **blocked** | Synthetic slate, synthetic plate, stand-in lighting, fallback fonts, no logo files. |  |

Environment for every "reported" pass: see `docs/test-receipts.json` and `docs/e2e-receipts.json` (Node, Chromium, PostgreSQL and package versions, timestamps). Dependencies are pinned exactly and the lockfile is committed; install with `npm ci`.
