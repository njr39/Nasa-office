# Integration matrix

Generated from `src/integration.ts` (same data as the in-app STATUS panel).

- **WORKING**: exercised by a test or real-browser run in this repo, with the evidence shown.
- **PREPARED**: built, not proven end to end because a credential, access or review step is missing.
- **BLOCKED**: cannot proceed from this session.

| Feature | Status | Evidence | Next |
|---|---|---|---|
| Dimensional sphere, orbit, node select (mouse/touch/keyboard) | **WORKING** | Browser e2e: drag orbit, 5px threshold, label click, arrow keys (scripts/e2e.mjs) |  |
| Shared validated action layer (manual + KAST tools) | **WORKING** | 10 unit tests incl. USER_CONTROL guard, confirm gate (tests/core.test.ts) |  |
| Film open/play/pause with real player status | **WORKING** | e2e + unit tests; synthetic slate only, no real film linked | Link real Vimeo/Drive sources after index |
| Responsive layouts (auto / portrait / horizontal) | **WORKING** | e2e screenshots at 390x844 and 1587x991 |  |
| Page-state read for KAST (nasa_get_state) | **WORKING** | Returns live store + window.scrollY |  |
| Save approved context -> fresh session retrieves latest (synthetic local store) | **WORKING** | e2e reload test + version-conflict unit test; browser localStorage only, NOT the backend |  |
| Live KAST voice session (WebRTC, token route, greeting) | **PREPARED** | Adapter built on @elevenlabs/react 1.18 and server token route; needs ELEVENLABS_API_KEY and a microphone | Run a real session on a host with the key |
| KAST NASA tools attached to the original agent | **PREPARED** | Five nasa_* tools exist but are NOT attached to agent_7501...; nasa_view is a proposed addition (docs/KAST_TEST_BRANCH_SPEC.md) | Create test branch, attach, review, merge |
| English greeting without changing global agent language | **PREPARED** | Per-session overrides.agent.firstMessage/language (both enabled on the agent today) | Verify the Arabic-first voice/prompt behaves in English on the test branch |
| Supabase schema + migrations (membership, sources, contexts, handoffs, audit) | **PREPARED** | Reversible SQL + pglite tests with synthetic rows (db/) | Reconcile with Karsa and live schema, then apply |
| Supabase project inspection (uczhbodqmsxcxymybonn) | **BLOCKED** | No Supabase tool or credential available in this session | Karsa shares schema/migration list, or grant read access |
| Drive HQ indexing (authorized subtree only) | **PREPARED** | Root folder listed read-only; allowlist rules + dedupe constraints in migration | Backend writer builds the single ingestion job |
| Per-project permissions end to end | **PREPARED** | RLS policies tested in pglite; not tested against Supabase Auth | Apply to a branch DB and re-run tests there |
| Real satellite plate, HDRI, licensed fonts, NASA mark | **BLOCKED** | Plate is a synthetic DEMO; stand-in environment light; fallback fonts; no logo files |  |
| Hosted review preview with live KAST | **BLOCKED** | Static hosting cannot hold the API key; preview shows "KAST not connected" |  |
