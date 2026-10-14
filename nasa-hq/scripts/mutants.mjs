// Reproducible mutation check: each mutant deliberately breaks one protection; the matching suite must then FAIL.
// A mutant that survives is either a real test gap or an equivalent mutant (documented below). REPORTED by the author.
//   node scripts/mutants.mjs [core|hook|db|controller|server|all]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SUITES = {
  core: ['--test', '--test-force-exit', 'tests/core.test.ts'],
  controller: ['--test', '--test-force-exit', 'tests/controller.test.ts'],
  server: ['--test', '--test-force-exit', 'tests/server.test.mjs'],
  hook: ['scripts/hook-tests.mjs'],
  db: ['--test', '--test-force-exit', '--test-timeout=120000', 'db/tests/backend.test.mjs'],
};
const SQL = 'db/migrations/0001_nasa_hq_backend.up.sql';
const M = (suite, id, file, find, replace, equivalent) => ({ suite, id, file, find, replace, equivalent });
const MUTANTS = [
  // ---- action layer / workspace (core suite)
  M('core', 'no_sync_control_flip_on_manual_media', 'src/core/store.ts', "      if (takesControl) this.commit((s) => ({ ...s, control: 'USER_CONTROL' }));\n", ''),
  M('core', 'mode_change_does_not_bump_lease', 'src/core/store.ts', 'if (next.control !== before.control || next.mode !== before.mode) {', 'if (next.control !== before.control) {'),
  M('core', 'resource_generation_ignored', 'src/core/store.ts', 'const gone = () => this.state.media.id !== mediaId || this.resourceGen !== res0;', 'const gone = () => this.state.media.id !== mediaId;'),
  M('core', 'later_pause_does_not_supersede_play', 'src/core/store.ts', 'const superseded = () => seq !== this.mediaSeq;', 'const superseded = () => false;'),
  M('core', 'pause_queued_behind_play', 'src/core/store.ts', "      if (a.op === 'pause') {                                    // pause is idempotent and safe: never queued behind a pending play", '      if (false) {'),
  M('core', 'agent_lease_ignored', 'src/core/store.ts', "const stillValid = () => !isAgent || (this.capabilityValid(cap) && this.state.control === 'AGENT_CONTROL' && this.state.mode === 'normal');", 'const stillValid = () => true;'),
  M('core', 'no_undo_of_late_play', 'src/core/store.ts', "          p.pause();                                              // undo the side effect: never leave media playing under someone else's control or after a later pause\n", ''),
  M('core', 'tool_result_not_rechecked', 'src/core/tools.ts', 'if (!ownLeaseChange(p) && !ws.capabilityValid(cap)) return refuse(', 'if (false) return refuse('),
  M('core', 'in_flight_duplicates_not_collapsed', 'src/core/tools.ts', 'const existing = inflight.get(key); if (existing) return existing;', 'const existing = undefined as Promise<string> | undefined; if (existing) return existing;'),
  M('core', 'saved_context_leaks_to_provider', 'src/core/tools.ts', 'return `NASA HQ page state (English UI, synthetic demo data): ${JSON.stringify(pageState(ws, readScrollY))}`;', 'return `NASA HQ page state (English UI, synthetic demo data): ${JSON.stringify(pageState(ws, readScrollY))} ${ws.savedContext?.summary ?? \'\'}`;'),
  M('core', 'unknown_tool_options_ignored', 'src/core/validate.ts', "return extra.length ? bad('unsupported_option'", "return false ? bad('unsupported_option'"),
  M('core', 'missing_control_value_defaults_to_agent', 'src/core/validate.ts', "return oneOf(CONTROLS, v.value) ? good({ action: 'set_control', value: v.value }) : bad('bad_args', `value must be USER_CONTROL or AGENT_CONTROL.`);", "return good({ action: 'set_control', value: (oneOf(CONTROLS, v.value) ? v.value : 'AGENT_CONTROL') as never });"),
  M('core', 'reducer_accepts_any_view', 'src/core/actions.ts', "case 'set_view': return oneOf(PROJECT_VIEWS, a.view) ?", "case 'set_view': return true ?"),
  M('core', 'confirm_not_busy_blocked', 'src/core/actions.ts', "      if (s.confirm.busy) return fail(s, 'busy', 'Already saving.');\n", ''),
  M('core', 'proposal_not_invalidated_when_target_changes', 'src/core/store.ts', 'const next = settle(fn(before));', 'const next = fn(before);'),
  M('core', 'tool_session_guard_removed', 'src/core/tools.ts', "    if (!ws.sessionLive(b.session)) return refuse('session_ended', 'The voice session has ended.');\n", '\n',
    'Equivalent: the same property is enforced after the call (result discarded) and inside act() for writes; the pre-check only avoids doing work.'),
  M('core', 'proposal_resolved_at_run_time', 'src/core/actions.ts', "const doc = DOCS.find((d) => d.id === c.docId);\n      if (!doc || s.openProject !== c.projectId)", "const doc = DOCS.find((d) => d.projectId === s.openProject);\n      if (!doc)",
    'Equivalent: settle() already marks the proposal stale before Run, so the Run-time binding check is defence in depth.'),
  // ---- voice controller
  M('controller', 'rejected_start_marked_verified', 'src/kast/controller.ts', "      this.teardown = 'unverified';\n      return this.set(this.stopRequested ? 'closed' : 'failed'", "      this.teardown = 'verified';\n      return this.set(this.stopRequested ? 'closed' : 'failed'"),
  M('controller', 'disconnect_during_start_ignored', 'src/kast/controller.ts', "if (this.phase === 'fetching_token' || this.phase === 'starting') { this.providerEvent ??= 'provider_disconnected_during_start'; return this.finished; }", 'return this.finished;'),
  M('controller', 'late_session_not_ended', 'src/kast/controller.ts', 'if (this.stopRequested || this.providerEvent) {', 'if (false) {'),
  // ---- the real hook under React Strict Mode (hook suite)
  M('hook', 'late_message_reaches_new_attempt', 'src/kast/useKast.tsx', 'onMessage: (m) => { if (isCurrent()) setLines', 'onMessage: (m) => { if (alive.current) setLines'),
  M('hook', 'late_mode_reaches_new_attempt', 'src/kast/useKast.tsx', "onModeChange: ({ mode }) => { if (isCurrent()) setSpeaking(mode === 'speaking'); },", "onModeChange: ({ mode }) => { if (alive.current) setSpeaking(mode === 'speaking'); },"),
  M('hook', 'provider_error_does_not_invalidate', 'src/kast/useKast.tsx', 'onError: (m) => { ws.closeSession(gen); if (isCurrent()) setError(String(m)); void ctrl.providerError(String(m)); },', 'onError: (m) => { if (isCurrent()) setError(String(m)); },'),
  M('hook', 'tools_not_closed_when_teardown_begins', 'src/kast/useKast.tsx', "if (p === 'stopping' || p === 'closed' || p === 'failed') ws.closeSession(gen);", '/* removed */'),
  M('hook', 'typed_questions_blocked_in_read_only', 'src/kast/useKast.tsx', "sendText: (t) => { if (phase === 'connected') {", "sendText: (t) => { if (phase === 'connected' && ws.state.mode === 'normal') {"),
  M('hook', 'conversation_ref_assigned_to_current_not_own_attempt', 'src/kast/useKast.tsx', '        att.conv = conv;                                                          // this attempt\'s record only', '        if (current.current) current.current.conv = conv;',
    'Equivalent today: a new attempt cannot start until the old one is verified closed, so an old start can never resolve after a new attempt is current. Kept as defence in depth.'),
  // ---- token route
  M('server', 'client_disconnect_does_not_cancel_upstream', 'server/token-route.mjs', "if (!res.writableEnded) { clientGone = true; ac.abort(); }", 'if (false) { clientGone = true; ac.abort(); }'),
  M('server', 'auth_stage_unbounded', 'server/token-route.mjs', 'const t = setTimeout(() => reject(Object.assign(new Error(\'timeout\'), { code: \'timeout\' })), config.authTimeoutMs);', 'const t = setTimeout(() => {}, 1);'),
  M('server', 'csrf_not_checked', 'server/token-route.mjs', "if (!safeEq(req.headers['x-csrf-token'], session.csrfToken)) return", 'if (false) return'),
  M('server', 'gate_defaults_on', 'server/token-route.mjs', "enabled: env.NASA_HQ_KAST_ENABLED === 'true',", "enabled: env.NASA_HQ_KAST_ENABLED !== 'false',"),
  // ---- candidate SQL (real PostgreSQL)
  ...[
    ['naive_ancestry_check', "  select coalesce(\n    p_root is not null and length(p_root) > 0 and p_anc is not null and cardinality(p_anc) > 0\n    and not exists (select 1 from unnest(p_anc) a where a is null)\n    and exists (select 1 from unnest(p_anc) a where a = p_root), false);", '  select p_root = any (p_anc);'],
    ['null_expected_version_allowed', 'if p_expected is null or p_expected < 0 then\n    perform nasa_hq.audit(me, \'save_context\'', "if false then\n    perform nasa_hq.audit(me, 'save_context'"],
    ['conversation_ownership_unchecked', '    if not found or conv.owner_id <> me or conv.project_id is distinct from p_project then', '    if false then'],
    ['former_editor_can_invalidate', "(nasa_hq.has_role(c.project_id, 'owner') or (c.owner_id = me and nasa_hq.has_role(c.project_id, 'editor')))));", "(nasa_hq.has_role(c.project_id, 'owner') or c.owner_id = me)));"],
    ['root_state_ignored_in_visibility', "where f.id = p_file and f.status = 'indexed' and r.enabled and", "where f.id = p_file and f.status = 'indexed' and"],
    ['moved_files_not_revoked', 'if revoke_existing and r.id is not null then', 'if false then'],
    ['no_per_file_advisory_lock', "  perform pg_advisory_xact_lock(hashtextextended(p_root_drive_id || ':' || p_drive_file_id, 0));\n", ''],
    ['audit_deletable', "if tg_op = 'DELETE' and current_setting('nasa_hq.purging', true) = 'on' and old.retain_until < now() then return old; end if;\n  raise exception", 'return coalesce(old, new);\n  raise exception'],
    ['stale_snapshot_accepted', '  if p_observed_at < ex.authz_observed_at then', '  if false then'],
    ['same_instant_does_not_restore_guard', "  if ex.status = 'revoked' and p_observed_at = ex.authz_observed_at then", '  if false then'],
    ['tightening_waits_for_newer_observation', ' or nasa_hq.access_rank(p_access_class) < nasa_hq.access_rank(ex.access_class) then\n    new_class', ' then\n    new_class'],
    ['loosening_at_same_instant_allowed', '  if p_observed_at > ex.authz_observed_at or nasa_hq.access_rank(p_access_class) < nasa_hq.access_rank(ex.access_class) then', '  if true then'],
    ['removed_member_keeps_conversation_read', "((owner_id = auth.uid() and (project_id is null or nasa_hq.has_role(project_id, 'viewer')))", '((owner_id = auth.uid())'],
    ['expired_conversation_can_seed_context', '    if conv.retain_until <= now() then', '    if false then'],
    ['context_does_not_inherit_classification', '    eff_synth := conv.synthetic; eff_consent := conv.consent_basis; eff_retain := least(eff_retain, conv.retain_until);', '    eff_synth := coalesce(p_synthetic, true); eff_consent := p_consent;'],
    ['grants_expiry_and_revocation_ignored', 'where g.file_id = f.id and g.user_id = auth.uid() and not g.revoked and g.expires_at > now()', 'where g.file_id = f.id and g.user_id = auth.uid()'],
    ['null_access_class_unchecked', 'elsif p_access_class is null or p_access_class not in', 'elsif p_access_class not in'],
    ['source_revisions_mutable', 'create trigger source_revisions_immutable before update or delete on nasa_hq.source_revisions for each row execute function nasa_hq.immutable_guard();', ''],
    ['revocation_does_not_advance_clock', "update nasa_hq.source_files set status = 'revoked', authz_observed_at = greatest(authz_observed_at, p_observed_at)", "update nasa_hq.source_files set status = 'revoked'"],
    ['stale_grant_observation_accepted', 'if found and p_observed_at <= g.observed_at then', 'if false then'],
  ].map(([id, find, replace]) => M('db', id, SQL, find, replace)),
];

const want = process.argv[2] ?? 'all';
const results = [];
for (const m of MUTANTS.filter((x) => want === 'all' || x.suite === want)) {
  const src = readFileSync(m.file, 'utf8');
  if (!src.includes(m.find)) { results.push({ ...m, status: 'PATTERN_MISSING' }); console.log('??', m.suite, m.id, 'pattern missing'); continue; }
  const mutated = src.replace(m.find, m.replace);
  let r;
  if (m.suite === 'db') {                                                       // never touch the real migration: mutate a temp copy
    const dir = mkdtempSync(join(tmpdir(), 'mut-')); const f = join(dir, 'up.sql'); writeFileSync(f, mutated);
    r = spawnSync(process.execPath, SUITES.db, { encoding: 'utf8', env: { ...process.env, MIGRATION_UP: f }, timeout: 300000 });
  } else {
    copyFileSync(m.file, m.file + '.mutbak'); writeFileSync(m.file, mutated);
    try { r = spawnSync(process.execPath, SUITES[m.suite], { encoding: 'utf8', timeout: m.suite === 'server' ? 60000 : 300000 }); }
    finally { renameSync(m.file + '.mutbak', m.file); }
  }
  const failing = (r.stdout.match(/^not ok (?!\d+ - db\/tests|\d+ - tests\/)/gm) ?? []).length + (m.suite === 'hook' ? (r.stdout.match(/^✗/gm) ?? []).length : 0);
  const hung = r.status === null;                                                // a suite that never finishes has noticed the break too (e.g. an unbounded wait)
  const caught = failing > 0 || hung || (r.status !== 0 && /not ok|✗|Error/.test(r.stdout + r.stderr));
  const status = caught ? 'caught' : m.equivalent ? 'survived (equivalent)' : 'SURVIVED';
  results.push({ suite: m.suite, id: m.id, status, failingTests: failing, ...(hung ? { note: 'suite hung until its timeout' } : {}), ...(m.equivalent ? { reason: m.equivalent } : {}) });
  console.log(caught ? '✓' : m.equivalent ? '≈' : '✗', m.suite.padEnd(10), m.id, caught ? `(${failing} failing)` : '');
}
const bad = results.filter((r) => r.status === 'SURVIVED' || r.status === 'PATTERN_MISSING');
const prior = (() => { try { return JSON.parse(readFileSync('docs/mutation-receipts.json', 'utf8')).results ?? []; } catch { return []; } })();
const merged = want === 'all' ? results : [...prior.filter((p) => p.suite !== want), ...results];
const bad2 = merged.filter((r) => r.status === 'SURVIVED' || r.status === 'PATTERN_MISSING');
if (want === 'all' || prior.length) writeFileSync('docs/mutation-receipts.json', JSON.stringify({ ranAt: new Date().toISOString(), kind: 'REPORTED by the author; a mutant is a deliberate break of one protection; "caught" means a suite failed', summary: { total: merged.length, caught: merged.filter((r) => r.status === 'caught').length, equivalent: merged.filter((r) => r.status === 'survived (equivalent)').length, survived: bad2.length }, results: merged }, null, 2) + '\n');
console.log(bad.length ? `UNCAUGHT: ${bad.map((b) => b.id).join(', ')}` : 'all mutants caught or documented equivalent');
process.exit(bad.length ? 1 : 0);
