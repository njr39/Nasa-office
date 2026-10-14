import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Workspace, type PlayerAdapter } from '../src/core/store.ts';
import { SyntheticLocalStore, SupabaseBlockedStore, type ContextStore, PRIVATE_CONTEXT_ENABLED, SYNTHETIC_TTL_MS } from '../src/core/context.ts';
import { buildTools, buildContextUpdate, pageState } from '../src/core/tools.ts';

const J = (s: string) => JSON.parse(s);
const mem = (seed?: string) => { const m = new Map<string, string>(seed ? [['nasa_hq.synthetic.context.v2', seed]] : []); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), raw: () => m.get('nasa_hq.synthetic.context.v2') }; };

/** A player whose play() can be held open, so tests can act while a call is in flight. */
function player(ws: Workspace, opts: { hold?: boolean } = {}) {
  let playing = false, pos = 0; let release: () => void = () => {}; const calls: string[] = [];
  const p: PlayerAdapter = {
    async play() { calls.push('play'); if (opts.hold) await new Promise<void>((r) => (release = r)); playing = true; pos += 1.5; return { ok: true }; },
    pause() { calls.push('pause'); playing = false; },
    status: () => ({ status: playing ? 'playing' : 'paused', positionSec: pos }),
  };
  ws.registerPlayer(p);
  return { calls, release: () => release(), isPlaying: () => playing };
}
async function boot(store: ContextStore = new SyntheticLocalStore(mem()), agent = 'kast') {
  const ws = new Workspace(store);
  await ws.act({ type: 'choose_agent', id: agent }, 'mouse'); await ws.act({ type: 'enter', agent }, 'mouse');
  const session = ws.openSession(); const tools = buildTools(ws, { session });
  return { ws, session, tools };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---------- entry ----------
test('entry: Enter needs a real agent selection; nothing is preselected; tools are refused before Enter', async () => {
  const ws = new Workspace();
  assert.equal(ws.state.entryAgent, null);
  assert.equal((await ws.act({ type: 'enter', agent: '' }, 'mouse')).error, 'agent_required');
  assert.equal((await ws.act({ type: 'enter', agent: 'nobody' }, 'mouse')).error, 'agent_required');
  assert.equal((await ws.act({ type: 'choose_agent', id: 'nobody' }, 'mouse')).error, 'unknown_agent');
  assert.equal((await ws.act({ type: 'open_project', id: 'seven' }, 'mouse')).error, 'not_entered');
  const session = ws.openSession(); const t = buildTools(ws, { session });
  assert.equal(J(await t.nasa_open_media({ target: 'film-01' })).error, 'not_entered');
  await ws.act({ type: 'choose_agent', id: 'musa' }, 'mouse'); assert.equal((await ws.act({ type: 'enter', agent: 'musa' }, 'mouse')).ok, true);
  assert.equal(ws.state.entryAgent, 'musa'); assert.equal((await ws.act({ type: 'enter', agent: 'kast' }, 'mouse')).error, 'already_entered');
});

// ---------- control and session binding ----------
test('pointer input takes control; KAST mutation is then refused, KAST read still works', async () => {
  const { ws, tools } = await boot();
  assert.equal(ws.state.control, 'AGENT_CONTROL');
  await ws.act({ type: 'orbit', dyaw: 0.1, dpitch: 0 }, 'mouse'); assert.equal(ws.state.control, 'USER_CONTROL');
  assert.equal(J(await tools.nasa_view({ action: 'select_node', target: 'musa' })).error, 'user_control');
  assert.equal(J(await tools.nasa_get_state({})).control, 'USER_CONTROL');
});
test('KAST cannot grant itself control; only the user resolves the sheet', async () => {
  const { ws, tools } = await boot(); await ws.act({ type: 'orbit', dyaw: 0.1, dpitch: 0 }, 'touch');
  await tools.nasa_tracker({ action: 'set_control', value: 'AGENT_CONTROL' });
  assert.equal(ws.state.control, 'USER_CONTROL'); assert.equal(ws.state.confirm?.kind, 'take_control');
  assert.equal((await ws.act({ type: 'resolve_confirm', id: ws.state.confirm!.id, approve: true }, 'kast', { session: 1 })).error, 'user_only');
  await ws.act({ type: 'resolve_confirm', id: ws.state.confirm!.id, approve: true }, 'mouse'); assert.equal(ws.state.control, 'AGENT_CONTROL');
});
test('tools are bound to their session: ended session and superseded session both refuse, reads included', async () => {
  const { ws, session, tools } = await boot();
  assert.equal(J(await tools.nasa_get_state({})).phase, 'hq');
  ws.closeSession(session);
  for (const call of [() => tools.nasa_get_state({}), () => tools.nasa_find_media({ query: 'film' }), () => tools.nasa_view({ action: 'orbit', yaw: 0.1 }), () => tools.nasa_tracker({ action: 'select_project', target: 'seven' })])
    assert.equal(J(await call()).error, 'session_ended');
  assert.equal(ws.state.openProject, null);
  const s2 = ws.openSession(); const t2 = buildTools(ws, { session: s2 });
  assert.equal(J(await tools.nasa_get_state({})).error, 'session_ended', 'old handlers stay dead after a new session opens');
  assert.equal(J(await t2.nasa_get_state({})).phase, 'hq');
  assert.equal((await ws.act({ type: 'orbit', dyaw: 0.1, dpitch: 0 }, 'kast')).error, 'session_ended', 'a kast action with no session context is refused');
});

// ---------- deferred actions can never overwrite manual control ----------
test('DEFERRED play: the user takes control while play() is pending -> not committed, playback stopped, receipt says stale', async () => {
  const { ws, tools } = await boot(); const pl = player(ws, { hold: true });
  await tools.nasa_tracker({ action: 'select_project', target: 'yah' }); await tools.nasa_open_media({ target: 'film-01' });
  const pending = tools.nasa_control({ action: 'play' }); await tick(); assert.deepEqual(pl.calls, ['play']);
  await ws.act({ type: 'orbit', dyaw: 0.2, dpitch: 0 }, 'mouse');                 // manual action during the await
  assert.equal(ws.state.control, 'USER_CONTROL'); const camera = { ...ws.state.camera };
  pl.release(); const r = J(await pending);
  assert.equal(r.status, 'stale'); assert.equal(r.ok, false);
  assert.ok(pl.calls.includes('pause') && !pl.isPlaying(), 'the late play was undone');
  assert.notEqual(ws.state.media.status, 'playing'); assert.equal(ws.state.control, 'USER_CONTROL'); assert.deepEqual(ws.state.camera, camera);
});
test('DEFERRED play: the film or project changes while play() is pending -> stale, nothing restored over the newer state', async () => {
  const { ws, tools } = await boot(); const pl = player(ws, { hold: true });
  await tools.nasa_tracker({ action: 'select_project', target: 'yah' }); await tools.nasa_open_media({ target: 'film-01' });
  const pending = tools.nasa_control({ action: 'play' }); await tick();
  await ws.act({ type: 'close_project' }, 'mouse'); await ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse');   // user closes everything, hands control back
  pl.release(); const r = J(await pending);
  assert.equal(r.status, 'stale'); assert.equal(ws.state.media.id, null); assert.equal(ws.state.openProject, null); assert.ok(pl.calls.includes('pause'));
});
test('DEFERRED play: the voice session ends while play() is pending -> stale, stopped, and the result is not delivered as success', async () => {
  const { ws, session, tools } = await boot(); const pl = player(ws, { hold: true });
  await tools.nasa_tracker({ action: 'select_project', target: 'yah' }); await tools.nasa_open_media({ target: 'film-01' });
  const pending = tools.nasa_control({ action: 'play' }); await tick();
  ws.closeSession(session); pl.release(); const r = J(await pending);
  assert.equal(r.ok, false); assert.ok(['session_ended', 'stale'].includes(r.status === 'rejected' ? r.error : r.status)); assert.ok(!pl.isPlaying());
});
test('play/pause with an uninterrupted agent: applied, reports observed position', async () => {
  const { ws, tools } = await boot(); player(ws);
  await tools.nasa_tracker({ action: 'select_project', target: 'yah' }); await tools.nasa_open_media({ target: 'film-01' });
  const play = J(await tools.nasa_control({ action: 'play' })); assert.equal(play.status, 'applied'); assert.equal(play.observed.status, 'playing');
  const pause = J(await tools.nasa_control({ action: 'pause' })); assert.equal(pause.observed.status, 'paused');
  assert.equal(J(await buildTools(ws, { session: ws.openSession() }).nasa_control({ action: 'play' })).ok, true);
});
test('play with no film open or no player fails honestly', async () => {
  const { ws, tools } = await boot(); player(ws);
  assert.equal(J(await tools.nasa_control({ action: 'play' })).error, 'no_media');
  const { tools: t2 } = await boot(); assert.equal(J(await t2.nasa_control({ action: 'play' })).error, 'no_media');
  void ws;
});
test('DEFERRED scroll: reports the OBSERVED position; losing control mid-scroll cancels it and reports stale', async () => {
  const { ws, tools } = await boot(); let cancelled = 0; let release!: (o: { y: number; settled: boolean }) => void;
  ws.scrollHook = (to) => new Promise((r) => { release = r; void to; }); ws.cancelScroll = () => { cancelled++; };
  const p1 = tools.nasa_view({ action: 'scroll', section: 'viewer' }); await tick(); release({ y: 1686, settled: true });
  const r1 = J(await p1); assert.equal(r1.status, 'applied'); assert.equal(r1.observed.scrollY, 1686); assert.equal(r1.observed.settled, true);
  const p2 = tools.nasa_view({ action: 'scroll', dy: 300 }); await tick(); await ws.act({ type: 'select_node', id: 'musa' }, 'touch'); release({ y: 40, settled: false });
  const r2 = J(await p2); assert.equal(r2.status, 'stale'); assert.ok(cancelled >= 1);
});
test('DEFERRED save: while the save is in flight every other action is blocked; the saved result is not overwritten', async () => {
  const store = new SyntheticLocalStore(mem()); let release!: () => void; const real = store.save.bind(store);
  store.save = async (i) => { await new Promise<void>((r) => (release = r)); return real(i); };
  const { ws, tools } = await boot(store); await tools.nasa_tracker({ action: 'select_project', target: 'seven' });
  await tools.nasa_tracker({ action: 'remember' }); const id = ws.state.confirm!.id;
  const saving = ws.act({ type: 'resolve_confirm', id, approve: true }, 'mouse'); await tick();
  assert.equal(ws.state.confirm?.busy, true);
  assert.equal((await ws.act({ type: 'open_project', id: 'yah' }, 'mouse')).error, 'confirm_pending');
  assert.equal((await ws.act({ type: 'resolve_confirm', id, approve: false }, 'mouse')).error, 'busy');
  release(); const r = await saving; assert.equal(r.ok, true); assert.equal(ws.state.confirm, null); assert.equal(ws.state.openProject, 'seven');
  assert.equal(ws.savedContext?.version, 1);
});

// ---------- runtime validation ----------
test('runtime enum and option validation: nothing is cast or silently ignored', async () => {
  const { ws, tools } = await boot(); player(ws);
  await tools.nasa_tracker({ action: 'select_project', target: 'seven' }); await tools.nasa_open_media({ target: 'film-02' }).catch(() => {});
  const bad = async (p: Promise<string>, error: string) => assert.equal(J(await p).error, error);
  await bad(tools.nasa_tracker({ action: 'set_view', value: 'galaxy' }), 'bad_args');
  await bad(tools.nasa_tracker({ action: 'set_view' }), 'bad_args');
  await bad(tools.nasa_tracker({ action: 'set_control' }), 'bad_args');                       // a missing value is NOT turned into AGENT_CONTROL
  await bad(tools.nasa_tracker({ action: 'set_control', value: 'agent_control' }), 'bad_args');
  await bad(tools.nasa_tracker({ action: 'select_project', target: 'nope' }), 'unknown_project');
  await bad(tools.nasa_tracker({ action: 'select_project', target: 'seven', extra: 1 }), 'unsupported_option');
  await bad(tools.nasa_tracker({ action: 'add_task', value: 'x' }), 'not_implemented_in_review_build');
  await bad(tools.nasa_tracker({ action: 'remember', value: 'my private thought' }), 'free_text_not_allowed');
  await bad(tools.nasa_open_media({ target: 'film-01', screen: 'new' }), 'unsupported_screen');
  await bad(tools.nasa_open_media({ target: 'film-01', mystery: true }), 'unsupported_option');
  await bad(tools.nasa_open_media({ target: 'https://example.com/x.mp4' }), 'external_url_blocked');
  await bad(tools.nasa_open_media({ target: 'javascript:alert(1)' }), 'external_url_blocked');
  await bad(tools.nasa_open_media({}), 'bad_args');
  await bad(tools.nasa_open_media({ target: 7 as never }), 'bad_args');
  await bad(tools.nasa_control({ action: 'play', target: 'some-other-player' }), 'unknown_player');
  await bad(tools.nasa_control({ action: 'explode' }), 'unsupported_action');
  await bad(tools.nasa_control({ action: 'pause', volume: 3 }), 'unsupported_option');
  await bad(tools.nasa_find_media({ query: 'x'.repeat(500) }), 'bad_args');
  await bad(tools.nasa_find_media({ query: 'film', type: 'hologram' }), 'bad_args');
  await bad(tools.nasa_view({ action: 'orbit', yaw: Number.NaN }), 'bad_args');
  await bad(tools.nasa_view({ action: 'orbit', yaw: Infinity }), 'bad_args');
  await bad(tools.nasa_view({ action: 'orbit', pitch: 99 }), 'bad_args');
  await bad(tools.nasa_view({ action: 'orbit', yaw: '1' as never }), 'bad_args');
  await bad(tools.nasa_view({ action: 'scroll', section: 'moon' }), 'unknown_section');
  await bad(tools.nasa_view({ action: 'scroll', dy: 1e9 }), 'bad_args');
  await bad(tools.nasa_view({ action: 'scroll' }), 'bad_args');
  await bad(tools.nasa_view({ action: 'scroll', section: 'top', dy: 5 }), 'bad_args');
  await bad(tools.nasa_view({ action: 'select_node', target: '__proto__' }), 'unknown_node');
  await bad(tools.nasa_view({ action: 'propose', command: 'rm_rf' }), 'unknown_command');
  await bad(tools.nasa_get_state({ verbose: true }), 'unsupported_option');
  assert.ok(ws.state.control === 'AGENT_CONTROL' && ws.state.openProject === 'seven', 'rejected calls changed nothing');
  // the reducer is a second wall for callers that bypass the tool layer
  assert.equal((await ws.act({ type: 'set_view', view: 'galaxy' as never }, 'mouse')).error, 'bad_args');
  assert.equal((await ws.act({ type: 'set_layout', layout: 'diagonal' as never }, 'mouse')).error, 'bad_args');
  assert.equal((await ws.act({ type: 'orbit', dyaw: Number.NaN, dpitch: 0 }, 'test')).error, 'bad_args');
  assert.equal((await ws.act({ type: 'set_control', owner: 'ROOT' as never }, 'mouse')).error, 'bad_args');
});
test('duplicate delivery of an identical in-flight call executes once', async () => {
  const { ws, tools } = await boot(); player(ws);
  await tools.nasa_tracker({ action: 'select_project', target: 'yah' }); await tools.nasa_open_media({ target: 'film-01' });
  const before = ws.receipts.length;
  const [a, b, c] = await Promise.all([tools.nasa_view({ action: 'orbit', yaw: 0.3 }), tools.nasa_view({ action: 'orbit', yaw: 0.3 }), tools.nasa_view({ action: 'orbit', yaw: 0.3 })]);
  assert.equal(a, b); assert.equal(b, c); assert.equal(ws.receipts.length, before + 1);
  assert.ok(Math.abs(ws.state.camera.yaw - (0.35 + 0.3)) < 1e-9);
  await tools.nasa_view({ action: 'orbit', yaw: 0.3 });                                // a later, separate command still runs
  assert.ok(Math.abs(ws.state.camera.yaw - (0.35 + 0.6)) < 1e-9);
});
test('revision increases on every committed change and never on a rejection', async () => {
  const { ws } = await boot(); const r0 = ws.state.revision;
  await ws.act({ type: 'open_project', id: 'nope' }, 'mouse'); assert.equal(ws.state.revision, r0);
  await ws.act({ type: 'open_project', id: 'seven' }, 'mouse'); assert.ok(ws.state.revision > r0);
});

// ---------- read-only (S07) and commands (S08) ----------
test('read-only mode: KAST cannot change anything and cannot switch it off; the user can', async () => {
  const { ws, tools } = await boot();
  assert.equal((await ws.act({ type: 'set_mode', mode: 'read_only' }, 'kast', { session: 1 })).error, 'user_only');
  await ws.act({ type: 'set_mode', mode: 'read_only' }, 'mouse'); assert.equal(ws.state.mode, 'read_only');
  const r = J(await tools.nasa_tracker({ action: 'select_project', target: 'seven' })); assert.equal(r.error, 'read_only'); assert.match(r.detail, /No changes made/);
  assert.equal(ws.state.openProject, null); assert.equal(J(await tools.nasa_get_state({})).mode, 'read_only');
  assert.equal((await ws.act({ type: 'open_project', id: 'seven' }, 'mouse')).ok, true, 'the user is not restricted by read-only');
});
test('command proposal: bound to the DISPLAYED target; KAST proposes, nothing runs until the USER presses Run; stale, cancel and no-project paths are real', async () => {
  const { ws, tools } = await boot();
  assert.equal(J(await tools.nasa_view({ action: 'propose', command: 'open_viewer' })).error, 'no_project', 'a proposal must name a target; with no project there is none');
  await tools.nasa_tracker({ action: 'select_project', target: 'seven' });
  assert.equal(J(await tools.nasa_view({ action: 'propose', command: 'open_viewer' })).ok, true);
  const card = ws.state.command!; assert.equal(card.status, 'ready'); assert.equal(card.targetLabel, 'SEVEN / Working brief'); assert.equal(card.projectId, 'seven'); assert.equal(card.docId, 'doc-seven'); assert.equal(ws.state.openDocument, null);
  assert.equal((await ws.act({ type: 'resolve_command', id: card.id, run: true }, 'kast', { session: 1 })).error, 'user_only');
  await ws.act({ type: 'resolve_command', id: card.id, run: true }, 'mouse'); assert.equal(ws.state.command!.status, 'done'); assert.equal(ws.state.openDocument, 'doc-seven');
  // the displayed target goes stale when the project changes, and Run then does nothing
  await ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse'); await tools.nasa_view({ action: 'propose', command: 'open_viewer' });
  const c2 = ws.state.command!; assert.equal(c2.status, 'ready');
  await ws.act({ type: 'open_project', id: 'yah' }, 'mouse'); assert.equal(ws.state.command!.status, 'stale', 'invalidated as soon as the project changed');
  const docBefore = ws.state.openDocument; const run = await ws.act({ type: 'resolve_command', id: c2.id, run: true }, 'mouse');
  assert.equal(run.error, 'stale_command'); assert.equal(ws.state.openDocument, docBefore, 'a stale proposal opened nothing');
  await ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse'); await tools.nasa_view({ action: 'propose', command: 'reset_view' });
  assert.equal(ws.state.command!.projectId, null); await ws.act({ type: 'open_project', id: 'seven' }, 'mouse'); assert.equal(ws.state.command!.status, 'ready', 'a view-reset proposal is not bound to a project');
  await ws.act({ type: 'resolve_command', id: ws.state.command!.id, run: false }, 'mouse'); assert.equal(ws.state.command, null);
  assert.equal((await ws.act({ type: 'resolve_command', id: 'stale', run: true }, 'mouse')).error, 'stale_command');
});
test('blocked web viewer: opens only allowlisted sources and never embeds', async () => {
  const { ws, tools } = await boot();
  assert.equal(J(await tools.nasa_view({ action: 'open_web', target: 'nojara-site' })).ok, true); assert.equal(ws.state.openWeb, 'nojara-site');
  assert.equal(J(await tools.nasa_view({ action: 'open_web', target: 'https://evil.test' })).error, 'unknown_web_source');
});

// ---------- synthetic-only context ----------
test('release gate: private context is disabled', () => { assert.equal(PRIVATE_CONTEXT_ENABLED, false); });
test('saved context is an app-generated view summary, scoped per project, and requires approval and an open project', async () => {
  const storage = mem(); const { ws, tools } = await boot(new SyntheticLocalStore(storage));
  assert.equal(J(await tools.nasa_tracker({ action: 'remember' })).error, 'no_project');
  await tools.nasa_tracker({ action: 'select_project', target: 'seven' }); await tools.nasa_open_media({ target: 'doc-seven' });
  await tools.nasa_tracker({ action: 'remember' });
  assert.equal(storage.raw(), undefined, 'nothing stored before approval');
  assert.equal((await ws.act({ type: 'resolve_confirm', id: ws.state.confirm!.id, approve: true }, 'mouse')).ok, true);
  const stored = JSON.parse(storage.raw()!)[0]; assert.equal(stored.synthetic, true); assert.deepEqual(Object.keys(stored.view).sort(), ['documentId', 'mediaId', 'projectId', 'slideIndex']);
  assert.equal(stored.projectId, 'seven');
  await ws.act({ type: 'open_project', id: 'yah' }, 'mouse');
  assert.equal(await new SyntheticLocalStore(storage).latest('yah'), null, 'a note saved for SEVEN is not served for Young & Human');
  assert.equal((await new SyntheticLocalStore(storage).latest('seven'))?.view.documentId, 'doc-seven');
});
test('a fresh session reads the latest valid synthetic view; a stale writer is refused; declining stores nothing', async () => {
  const storage = mem(); const a = await boot(new SyntheticLocalStore(storage)); const b = await boot(new SyntheticLocalStore(storage));
  for (const x of [a, b]) await x.tools.nasa_tracker({ action: 'select_project', target: 'seven' });
  await a.tools.nasa_tracker({ action: 'remember' }); await b.tools.nasa_tracker({ action: 'remember' });
  await a.ws.act({ type: 'resolve_confirm', id: a.ws.state.confirm!.id, approve: true }, 'mouse');
  const stale = await b.ws.act({ type: 'resolve_confirm', id: b.ws.state.confirm!.id, approve: true }, 'mouse');
  assert.equal(stale.ok, true, 'b re-reads the current version immediately before saving, so this is a clean v2, not an overwrite of v1');
  assert.equal((await new SyntheticLocalStore(storage).latest('seven'))?.version, 2);
  const direct = new SyntheticLocalStore(storage);
  assert.deepEqual(await direct.save({ view: { projectId: 'seven', documentId: null, mediaId: null, slideIndex: 0 }, projectId: 'seven', expectedVersion: 1 }), { ok: false, error: 'version_conflict', current: 2 });
  assert.deepEqual(await direct.save({ view: { projectId: 'seven', documentId: null, mediaId: null, slideIndex: 0 }, projectId: 'seven', expectedVersion: Number.NaN }), { ok: false, error: 'invalid' });
  const c = await boot(new SyntheticLocalStore(mem())); await c.tools.nasa_tracker({ action: 'select_project', target: 'yah' }); await c.tools.nasa_tracker({ action: 'remember' });
  await c.ws.act({ type: 'resolve_confirm', id: c.ws.state.confirm!.id, approve: false }, 'mouse'); assert.equal(await c.ws.contexts.latest('yah'), null);
});
test('synthetic notes expire; corrupt, tampered or foreign storage is ignored', async () => {
  let now = 1_000_000; const storage = mem(); const st = new SyntheticLocalStore(storage, () => now);
  await st.save({ view: { projectId: 'yah', documentId: null, mediaId: null, slideIndex: 0 }, projectId: 'yah', expectedVersion: 0 });
  assert.equal((await st.latest('yah'))?.version, 1); now += SYNTHETIC_TTL_MS + 1; assert.equal(await st.latest('yah'), null);
  for (const raw of ['not json', '{"a":1}', '[{"version":1}]', JSON.stringify([{ version: 1, synthetic: false, savedAt: 'x', expiresAt: new Date(now + 9e9).toISOString(), projectId: 'yah', view: { projectId: 'yah', documentId: null, mediaId: null, slideIndex: 0 } }]),
    JSON.stringify([{ version: 1, synthetic: true, savedAt: 'x', expiresAt: new Date(now + 9e9).toISOString(), projectId: 'EVIL', view: { projectId: 'yah', documentId: null, mediaId: null, slideIndex: 0 } }]),
    JSON.stringify([{ version: 1, synthetic: true, savedAt: 'x', expiresAt: new Date(now + 9e9).toISOString(), projectId: 'yah', view: { projectId: 'yah', documentId: '<script>', mediaId: null, slideIndex: 0 } }])])
    assert.equal(await new SyntheticLocalStore(mem(raw), () => now).latest('yah'), null, raw.slice(0, 40));
});
test('PRIVACY: what is sent to the provider never contains saved context or any stored text', async () => {
  const { ws, tools } = await boot(); await tools.nasa_tracker({ action: 'select_project', target: 'seven' }); await tools.nasa_tracker({ action: 'remember' });
  await ws.act({ type: 'resolve_confirm', id: ws.state.confirm!.id, approve: true }, 'mouse');
  assert.ok(ws.savedContext); const summary = ws.savedContext!.summary;
  const sent = [buildContextUpdate(ws), JSON.stringify(pageState(ws)), await tools.nasa_get_state({}), await tools.nasa_tracker({ action: 'get_state' })].join('\n');
  assert.ok(!sent.includes(summary), 'saved summary must not reach the provider'); assert.ok(!/saved_context|lastSaved|approved context/i.test(sent));
  const src = readFileSync(new URL('../src/kast/useKast.tsx', import.meta.url), 'utf8');
  assert.ok(!/savedContext|latest\(|loadLatestContext/.test(src), 'the voice adapter never reads the context store');
});
test('Supabase stub stays blocked: nothing is saved and the receipt says so', async () => {
  const { ws, tools } = await boot(new SupabaseBlockedStore()); await tools.nasa_tracker({ action: 'select_project', target: 'seven' }); await tools.nasa_tracker({ action: 'remember' });
  const r = await ws.act({ type: 'resolve_confirm', id: ws.state.confirm!.id, approve: true }, 'mouse'); assert.equal(r.ok, false); assert.equal(r.error, 'blocked'); assert.equal(ws.state.confirm, null);
});

// ---------- English-only ----------
test('English only: no Arabic script anywhere in the shipped source or page', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css|html)$/.test(f) ? [p] : []; });
  const root = new URL('..', import.meta.url).pathname;
  const files = [...walk(join(root, 'src')), join(root, 'index.html')];
  const hits = files.filter((f) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});

// ---------- manual media control, read-only and resource changes revoke pending agent work ----------
async function playing(opts = { hold: true }) {
  const b = await boot(); const pl = player(b.ws, opts);
  await b.tools.nasa_tracker({ action: 'select_project', target: 'yah' }); await b.tools.nasa_open_media({ target: 'film-01' });
  return { ...b, pl };
}
test('DELAYED play -> MANUAL PAUSE: control is revoked synchronously, the pause is not queued behind the play, the late play is undone', async () => {
  const { ws, tools, pl } = await playing(); const pending = tools.nasa_control({ action: 'play' }); await tick();
  assert.equal(ws.state.control, 'AGENT_CONTROL');
  const pause = ws.act({ type: 'media', op: 'pause' }, 'mouse');                  // manual Pause while the agent's Play is unresolved
  assert.equal(ws.state.control, 'USER_CONTROL', 'ownership changed synchronously, before anything was awaited');
  const r = await Promise.race([pause, new Promise((res) => setTimeout(() => res('QUEUED_BEHIND_PLAY'), 50))]);
  assert.notEqual(r, 'QUEUED_BEHIND_PLAY', 'manual pause did not wait for the pending agent play'); assert.equal((r as { ok: boolean }).ok, true);
  pl.release(); const late = J(await pending);
  assert.equal(late.status, 'stale'); assert.ok(!pl.isPlaying(), 'the late play was undone: the user paused and it stays paused'); assert.notEqual(ws.state.media.status, 'playing');
});
test('DELAYED play -> MANUAL PLAY: the user\'s own play also revokes the agent and wins', async () => {
  const { ws, tools, pl } = await playing({ hold: false }); const a = tools.nasa_control({ action: 'play' });
  const u = ws.act({ type: 'media', op: 'play' }, 'keyboard'); assert.equal(ws.state.control, 'USER_CONTROL'); await u; pl.release();
  assert.ok(['stale', 'applied'].includes(J(await a).status)); assert.equal(ws.state.control, 'USER_CONTROL');
});
test('DELAYED play -> READ-ONLY: switching mode voids the pending play, which is undone and not reported as success', async () => {
  const { ws, tools, pl } = await playing(); const pending = tools.nasa_control({ action: 'play' }); await tick();
  await ws.act({ type: 'set_mode', mode: 'read_only' }, 'mouse'); assert.equal(ws.state.control, 'AGENT_CONTROL', 'control did not change: only the mode did');
  pl.release(); const r = J(await pending);
  assert.equal(r.status, 'stale'); assert.notEqual(r.ok, true); assert.ok(!pl.isPlaying()); assert.notEqual(ws.state.media.status, 'playing');
});
test('DELAYED play -> CLOSE then REOPEN the SAME film id: the resource generation changed, so the old play is stale', async () => {
  const { ws, tools, pl } = await playing(); const pending = tools.nasa_control({ action: 'play' }); await tick();
  await ws.act({ type: 'close_project' }, 'mouse'); await ws.act({ type: 'open_project', id: 'yah' }, 'mouse'); await ws.act({ type: 'open_media', id: 'film-01' }, 'mouse');
  await ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse');          // the agent holds control again, with the SAME media id open
  pl.release(); const r = J(await pending);
  assert.equal(r.status, 'stale', 'same id, different generation'); assert.ok(!pl.isPlaying()); assert.equal(ws.state.media.status, 'ready');
});
test('a later pause supersedes an earlier pending play from the same agent', async () => {
  const { ws, tools, pl } = await playing(); const play = tools.nasa_control({ action: 'play' }); await tick();
  const pause = J(await tools.nasa_control({ action: 'pause' })); assert.equal(pause.status, 'applied');
  pl.release(); assert.equal(J(await play).status, 'stale'); assert.ok(!pl.isPlaying()); assert.equal(ws.liveMedia().status, 'paused');
});
test('RESULT recheck: a read whose authority is withdrawn before it returns is discarded, not leaked; the agent\'s own handover is exempt', async () => {
  const { ws, tools } = await boot();
  const read = tools.nasa_get_state({}); await ws.act({ type: 'orbit', dyaw: 0.1, dpitch: 0 }, 'mouse');       // user takes control in the same tick
  const r = J(await read); assert.equal(r.error, 'stale'); assert.ok(!('catalog' in r) && !('phase' in r), 'no state leaked in a discarded result');
  await ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse');
  const read2 = tools.nasa_find_media({ query: 'film' }); await ws.act({ type: 'set_mode', mode: 'read_only' }, 'mouse'); assert.equal(J(await read2).error, 'stale');
  await ws.act({ type: 'set_mode', mode: 'normal' }, 'mouse');
  assert.equal(J(await tools.nasa_tracker({ action: 'set_control', value: 'USER_CONTROL' })).ok, true, 'giving control away changes the lease on purpose and is not flagged stale');
});
test('list view is shared page state, changeable by the same validated path', async () => {
  const { ws, tools } = await boot(); assert.equal(J(await tools.nasa_get_state({})).phase, 'hq'); assert.equal(ws.state.listView, false);
  await ws.act({ type: 'set_list', on: true }, 'mouse'); assert.equal(ws.state.listView, true); assert.equal((await ws.act({ type: 'set_list', on: 'yes' as never }, 'mouse')).error, 'bad_args');
});

test('DELAYED play -> read-only ON then OFF again: the mode is back to normal, but the lease changed, so the old play is still void', async () => {
  const { ws, tools, pl } = await playing(); const pending = tools.nasa_control({ action: 'play' }); await tick();
  await ws.act({ type: 'set_mode', mode: 'read_only' }, 'mouse'); await ws.act({ type: 'set_mode', mode: 'normal' }, 'mouse');
  pl.release(); assert.equal(J(await pending).status, 'stale'); assert.ok(!pl.isPlaying());
});
test('DELAYED play -> the agent itself RE-OPENS the same film (no control change): the resource generation voids the old play', async () => {
  const { ws, tools, pl } = await playing(); const pending = tools.nasa_control({ action: 'play' }); await tick();
  assert.equal(ws.state.control, 'AGENT_CONTROL'); const lease = ws.leaseId;
  await ws.act({ type: 'open_media', id: 'film-01' }, 'kast', { session: 1 });         // same id, re-opened: media state reset to ready
  assert.equal(ws.leaseId, lease, 'control and mode never changed, only the resource did');
  pl.release(); const r = J(await pending); assert.equal(r.status, 'stale'); assert.ok(!pl.isPlaying()); assert.equal(ws.state.media.status, 'ready');
});
