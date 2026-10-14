// Single source for the integration matrix (UI status panel + docs/INTEGRATION_MATRIX.md).
export type Status = 'working' | 'prepared' | 'blocked';
export interface Row { feature: string; status: Status; evidence: string; next?: string }
export const MATRIX: Row[] = [
  { feature: 'Dimensional sphere, orbit, node select (mouse/touch/keyboard)', status: 'working', evidence: 'Browser e2e: drag orbit, 5px threshold, label click, arrow keys (scripts/e2e.mjs)' },
  { feature: 'Shared validated action layer (manual + KAST tools)', status: 'working', evidence: '10 unit tests incl. USER_CONTROL guard, confirm gate (tests/core.test.ts)' },
  { feature: 'Film open/play/pause with real player status', status: 'working', evidence: 'e2e + unit tests; synthetic slate only, no real film linked', next: 'Link real Vimeo/Drive sources after index' },
  { feature: 'Responsive layouts (auto / portrait / horizontal)', status: 'working', evidence: 'e2e screenshots at 390x844 and 1587x991' },
  { feature: 'Page-state read for KAST (nasa_get_state)', status: 'working', evidence: 'Returns live store + window.scrollY' },
  { feature: 'Save approved context -> fresh session retrieves latest (synthetic local store)', status: 'working', evidence: 'e2e reload test + version-conflict unit test; browser localStorage only, NOT the backend' },
  { feature: 'Live KAST voice session (WebRTC, token route, greeting)', status: 'prepared', evidence: 'Adapter built on @elevenlabs/react 1.18 and server token route; needs ELEVENLABS_API_KEY and a microphone', next: 'Run a real session on a host with the key' },
  { feature: 'KAST NASA tools attached to the original agent', status: 'prepared', evidence: 'Five nasa_* tools exist but are NOT attached to agent_7501...; nasa_view is a proposed addition (docs/KAST_TEST_BRANCH_SPEC.md)', next: 'Create test branch, attach, review, merge' },
  { feature: 'English greeting without changing global agent language', status: 'prepared', evidence: 'Per-session overrides.agent.firstMessage/language (both enabled on the agent today)', next: 'Verify the Arabic-first voice/prompt behaves in English on the test branch' },
  { feature: 'Supabase schema + migrations (membership, sources, contexts, handoffs, audit)', status: 'prepared', evidence: 'Reversible SQL + pglite tests with synthetic rows (db/)', next: 'Reconcile with Karsa and live schema, then apply' },
  { feature: 'Supabase project inspection (uczhbodqmsxcxymybonn)', status: 'blocked', evidence: 'No Supabase tool or credential available in this session', next: 'Karsa shares schema/migration list, or grant read access' },
  { feature: 'Drive HQ indexing (authorized subtree only)', status: 'prepared', evidence: 'Root folder listed read-only; allowlist rules + dedupe constraints in migration', next: 'Backend writer builds the single ingestion job' },
  { feature: 'Per-project permissions end to end', status: 'prepared', evidence: 'RLS policies tested in pglite; not tested against Supabase Auth', next: 'Apply to a branch DB and re-run tests there' },
  { feature: 'Real satellite plate, HDRI, licensed fonts, NASA mark', status: 'blocked', evidence: 'Plate is a synthetic DEMO; stand-in environment light; fallback fonts; no logo files' },
  { feature: 'Hosted review preview with live KAST', status: 'blocked', evidence: 'Static hosting cannot hold the API key; preview shows "KAST not connected"' },
];
