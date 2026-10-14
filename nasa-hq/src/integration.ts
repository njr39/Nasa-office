// Single source for the integration matrix (in-app STATUS dialog and docs/INTEGRATION_MATRIX.md).
// "reported" = the author ran it in the environment named in the evidence. It is NOT independently run.
// "live" = verified against the real provider, backend, device or real media. Nothing is live-verified yet.
export type Reported = 'pass' | 'partial' | 'not_run';
export type Live = 'not_tested' | 'blocked' | 'on_hold';
export interface Row { feature: string; reported: Reported; live: Live; evidence: string; next?: string }
export const MATRIX: Row[] = [
  { feature: 'English-only UI including the header; agent selection gates Enter', reported: 'pass', live: 'not_tested', evidence: 'Browser run (Chromium + SwiftShader, no GPU): Enter disabled until an agent is chosen; no Arabic text in the DOM.' },
  { feature: 'Sphere: orbit, 5 px drag threshold, node select (mouse, touch path, keyboard)', reported: 'pass', live: 'not_tested', evidence: 'Browser run. Touch is covered through the same pointer handler, not a physical device.', next: 'Real touch device' },
  { feature: 'One validated action layer; session, control-lease and revision checks after every await', reported: 'pass', live: 'not_tested', evidence: 'Node unit tests including delayed play, delayed save, manual override, disconnect and duplicate delivery.' },
  { feature: 'Strict runtime validation of tool arguments (enums, targets, unsupported options)', reported: 'pass', live: 'not_tested', evidence: 'Node unit tests. The provider-side tool schemas still allow values the page now rejects.' },
  { feature: 'Slate-control test: open, play, pause on a SYNTHETIC canvas slate', reported: 'pass', live: 'not_tested', evidence: 'Proves the control path and clock only. No film, no <video>/<audio> element, no provider embed, no autoplay policy was exercised.', next: 'Real sources after approval' },
  { feature: 'Scroll: receipt reports the observed final position', reported: 'pass', live: 'not_tested', evidence: 'Browser run asserts receipt scrollY equals window.scrollY after settle.' },
  { feature: 'Layouts auto / portrait / horizontal; 390x844 no horizontal overflow', reported: 'partial', live: 'not_tested', evidence: 'Screenshots at 390x844 and 1587x991 only. Tablet, 360, 430, 1280, 200% zoom and screen readers not run.', next: 'Full acceptance matrix' },
  { feature: 'S05 blocked web viewer, S07 read-only, S08 command Run/Cancel, project views, entry selection', reported: 'pass', live: 'not_tested', evidence: 'Unit + browser run. Web embedding is intentionally absent.' },
  { feature: 'Other S01-S15 states and workspace modules', reported: 'not_run', live: 'not_tested', evidence: 'Not built: map (S12), conversation history and line switching (S10), updates, sign-in/out, real handoffs. See docs/PRD_STATE_MATRIX.md.' },
  { feature: 'Token route: gate off by default, auth, permission, Origin, CSRF, rate limit, bounded upstream', reported: 'pass', live: 'not_tested', evidence: 'Node tests with a fake identity adapter and fake provider fetch. No real identity layer exists; the default adapter denies everyone.', next: 'Real identity adapter + HQ permission source' },
  { feature: 'Voice lifecycle: one-attempt controller, cancellation, late results, unmount, no unmanaged microphone', reported: 'pass', live: 'not_tested', evidence: 'Node tests against a fake provider that owns a fake microphone. The real SDK, WebRTC and a real microphone were not exercised.', next: 'Real session after approval' },
  { feature: 'Demo context is synthetic-only and never sent to KAST', reported: 'pass', live: 'not_tested', evidence: 'Unit tests: view-summary only, scoped by project, expires, free text refused, absent from provider messages.' },
  { feature: 'Live KAST voice session, greeting, tool calls delivered by the provider', reported: 'not_run', live: 'on_hold', evidence: 'Not run. Live KAST changes, the test branch and tool attachment are on hold. nasa_view stays a review-only spec.' },
  { feature: 'Backend candidate SQL on real PostgreSQL 17 (embedded), synthetic rows', reported: 'pass', live: 'on_hold', evidence: '18 tests incl. concurrent writers and mutation checks. Not applied anywhere. Karsa owns the single backend; the prepared nasa_private foundation was not available to this author.', next: 'Reconcile into ONE migration' },
  { feature: 'Supabase project, Drive ingestion, per-file permissions, Auth JWTs', reported: 'not_run', live: 'on_hold', evidence: 'Not inspected, not applied, not connected.' },
  { feature: 'Real film/player, real satellite plate, HDRI, licensed fonts, NASA mark', reported: 'not_run', live: 'blocked', evidence: 'Synthetic slate, synthetic plate, stand-in lighting, fallback fonts, no logo files.' },
];
