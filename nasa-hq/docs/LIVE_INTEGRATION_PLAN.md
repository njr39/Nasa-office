# Live integration: what was inspected, what is needed, in what order

Inspected read-only on 2026-10-14. Nothing below was changed anywhere.

## Original KAST `agent_7501ky1tjmrzf4xa67v0zsqzz9hf` (main branch `agtbrch_4401ky1tjms9fcgbbn9tx7r52gdc`, version `agtvrsn_5801m4q0pmpee1brek7vrte341ma`)
* Attached tools: `kast_bridge_health` (webhook GET to the Wix bridge, diagnostic only), `transfer_to_agent` (to Hamza, Al-Ahram), `end_call`, `language_detection`. **No `nasa_*` tool is attached.**
* The five reusable client tools exist in the workspace, unattached, 0 calls: `nasa_get_state` `tool_1301m4rtgz9tf4wae6ywjf7gkyrt`, `nasa_open_media` `tool_3001m4rtgvnaebssmehj688v7as2`, `nasa_find_media` `tool_4601m4rtgskzfv3tm3hfwxd51gyh`, `nasa_control` `tool_1901m4rtgxh3edxs2kr2v2a25nt9`, `nasa_tracker` `tool_7201m4scbvchfwwt7qpqcgw1aabg`. Their schemas match the handlers in `src/core/tools.ts` (the app reuses them as is).
* Agent language is `ar`; auth is disabled; origin allowlist is `www.aistudio.google.com`, `www.nojara.com`, `seven-nojara-strategy.nojara.chatgpt.site`. The app asks for English **per session** only. Whether the agent permits a per-session language/first-message override is **unverified** and is checked in the first live run; if refused, the greeting may arrive in Arabic. No global setting will be changed to fix that without your approval. A localhost review origin is not on the allowlist; it only matters if auth is later enabled.
* Not seen and not needed for the first live run: `nasa_view` (review-only proposal tool, spec in `docs/KAST_TEST_BRANCH_SPEC.md`).

## Proposed agent change (NOT made; needs your separate approval)
On a **new test branch** of the original agent (never main): attach the five tool ids above, add a short NASA-session instruction (English, use receipts, do not claim success without a receipt, read-only text Q&A). Nothing else: no language, auth, voice, workflow or main-branch change. Rollback: delete the branch. The app's token route can then target it with `NASA_HQ_KAST_BRANCH_ID`.

## NOJARA HQ Drive `151TXi5udU_tAWo-dyfOuzeufB1f4MBa0`
Reached read-only through the assistant's own Drive connector: folder "NOJARA_HQ_26", owner `elwalaagents@gmail.com`, modified 2026-10-07. Children seen on page 1: `Communication`, `02_ORG_PACK`, `01_CLIENT_READY_Seven_Pitch`, `NASA_ON_AIR`, `2 days report 2026-10-10` (more on a next page). No file content was read. **The app has no Drive route and no credential.** A server-side credential limited to this folder (service account shared on the folder, or an OAuth grant) is required, plus a decision on which project maps to which subfolder.

## Supabase `uczhbodqmsxcxymybonn`
No credential, tool or connector is available in this session. Schema and migrations are **not inspected**. Nothing can be proposed safely until Karsa (single backend writer) or you supply read-only schema access or a schema dump.

## Missing package files (exact)
`NASA_HQ_PREPARED_BACKEND_v02/` (the folder, and every file in it, including the successor of `NASA_HQ_PREPARED_BACKEND_v01/reconciled_nasa_hq.sql`). The PRD v1.2 text was pasted in chat; no PRD file other than `NASA_HQ_PRD_v1.0_DRAFT_docs.zip` is on this machine.

## Order of work (one blocker at a time)
1. **ElevenLabs key + where the preview runs** (first action below).
2. Approval to create the test branch and attach the five tools (proposal above).
3. Karsa's v02 package and read-only Supabase schema access; reconcile; then the migration is applied by the single backend writer only.
4. Drive credential limited to the HQ folder; project-to-folder mapping.
5. Server routes (not yet written, deliberately): `GET /api/hq/files?q=` (Drive, permission-checked, returns name, webViewLink, modifiedTime, version), `POST /api/hq/notes/propose`, `POST /api/hq/notes` (idempotency key, expected version, receipt), `GET /api/hq/notes/latest`, `DELETE /api/hq/notes/:id`. They are written after steps 3-4 so they match the real schema, not a guess.
6. HQ identity (Supabase Auth) replaces the review passcode; per-project permissions enforced in SQL, not in the UI.
