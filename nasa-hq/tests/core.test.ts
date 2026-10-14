import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Workspace, type PlayerAdapter } from '../src/core/store.ts';
import { SyntheticLocalStore } from '../src/core/context.ts';
import { buildTools } from '../src/core/tools.ts';

function fakePlayer(ws: Workspace): PlayerAdapter {
  let playing = false; let pos = 0;
  return {
    async play() { playing = true; pos += 1.5; ws.reportMedia({ status: 'playing' }); return { ok: true }; },
    pause() { playing = false; ws.reportMedia({ status: 'paused' }); },
    status: () => ({ status: playing ? 'playing' : 'paused', positionSec: pos }),
  };
}
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const J = (s: string) => JSON.parse(s);

test('gate blocks everything until enter', async () => {
  const ws = new Workspace();
  const r = await ws.act({ type: 'open_project', id: 'seven' }, 'kast');
  assert.equal(r.ok, false); assert.equal(r.error, 'not_entered');
});

test('kast and mouse share validation: unknown ids rejected for both', async () => {
  const ws = new Workspace(); await ws.act({ type: 'enter' }, 'mouse');
  for (const origin of ['kast', 'mouse', 'keyboard', 'touch'] as const) {
    const r = await ws.act({ type: 'open_project', id: 'nope' }, origin);
    assert.equal(r.error, 'unknown_project', origin);
  }
});

test('pointer input takes control; kast mutation then rejected; read still works', async () => {
  const ws = new Workspace(); await ws.act({ type: 'enter' }, 'mouse');
  const tools = buildTools(ws);
  assert.equal(ws.state.control, 'AGENT_CONTROL');
  await ws.act({ type: 'orbit', dyaw: 0.1, dpitch: 0 }, 'mouse');
  assert.equal(ws.state.control, 'USER_CONTROL');
  const r = J(await tools.nasa_view({ action: 'select_node', target: 'musa' }));
  assert.equal(r.ok, false); assert.equal(r.error, 'user_control');
  assert.equal(J(await tools.nasa_get_state()).control, 'USER_CONTROL');
});

test('kast cannot grant itself control: needs user approval', async () => {
  const ws = new Workspace(); await ws.act({ type: 'enter' }, 'mouse');
  await ws.act({ type: 'orbit', dyaw: 0.1, dpitch: 0 }, 'touch');
  const tools = buildTools(ws);
  await tools.nasa_tracker({ action: 'set_control', value: 'AGENT_CONTROL' });
  assert.equal(ws.state.control, 'USER_CONTROL');
  assert.equal(ws.state.confirm?.kind, 'take_control');
  const denied = await ws.act({ type: 'resolve_confirm', id: ws.state.confirm!.id, approve: true }, 'kast');
  assert.equal(denied.error, 'user_only');
  await ws.act({ type: 'resolve_confirm', id: ws.state.confirm!.id, approve: true }, 'mouse');
  assert.equal(ws.state.control, 'AGENT_CONTROL');
});

test('open project, open film, play/pause use real player status', async () => {
  const ws = new Workspace(); await ws.act({ type: 'enter' }, 'mouse'); ws.registerPlayer(fakePlayer(ws));
  const t = buildTools(ws);
  assert.equal(J(await t.nasa_tracker({ action: 'select_project', target: 'yah' })).ok, true);
  const found = J(await t.nasa_find_media({ query: 'showreel film 01', type: 'video' }));
  assert.equal(found.results[0].id, 'film-01');
  assert.equal(J(await t.nasa_open_media({ target: 'film-01' })).state.media.status, 'ready');
  const play = J(await t.nasa_control({ action: 'play' })); assert.equal(play.ok, true); assert.equal(play.state.media.status, 'playing');
  const pause = J(await t.nasa_control({ action: 'pause' })); assert.equal(pause.state.media.status, 'paused');
});

test('play with no film open fails honestly', async () => {
  const ws = new Workspace(); await ws.act({ type: 'enter' }, 'mouse'); ws.registerPlayer(fakePlayer(ws));
  const r = J(await buildTools(ws).nasa_control({ action: 'play' }));
  assert.equal(r.ok, false); assert.equal(r.error, 'no_media');
});

test('external URL refused; unsupported tracker actions are not faked', async () => {
  const ws = new Workspace(); await ws.act({ type: 'enter' }, 'mouse');
  const t = buildTools(ws);
  assert.equal(J(await t.nasa_open_media({ target: 'https://example.com/x.mp4' })).error, 'external_url_blocked');
  assert.equal(J(await t.nasa_tracker({ action: 'add_task', value: 'x' })).error, 'not_implemented_in_review_build');
});

test('orbit clamps pitch; scroll validates sections', async () => {
  const ws = new Workspace(); await ws.act({ type: 'enter' }, 'mouse');
  await ws.act({ type: 'orbit', dyaw: 0, dpitch: 3 }, 'test'); await ws.act({ type: 'orbit', dyaw: 0, dpitch: 3 }, 'test');
  assert.ok(ws.state.camera.pitch <= 1.2);
  assert.equal((await ws.act({ type: 'scroll', to: 'moon' as never }, 'test')).error, 'unknown_section');
});

test('save context: confirm pending blocks other actions; approve saves; fresh session reads latest; conflict does not overwrite', async () => {
  const storage = mem();
  const ws1 = new Workspace(new SyntheticLocalStore(storage)); await ws1.act({ type: 'enter' }, 'mouse');
  const t = buildTools(ws1);
  await t.nasa_tracker({ action: 'remember', value: 'Reviewing SEVEN slide 2; user prefers short answers.' });
  assert.equal((await ws1.act({ type: 'open_project', id: 'seven' }, 'mouse')).error, 'confirm_pending');
  assert.equal((await ws1.contexts.latest()), null, 'nothing saved before approval');
  const ok = await ws1.act({ type: 'resolve_confirm', id: ws1.state.confirm!.id, approve: true }, 'mouse');
  assert.equal(ok.ok, true); assert.match(ok.detail, /version 1/);

  const ws2 = new Workspace(new SyntheticLocalStore(storage)); // fresh session, same store
  const latest = await ws2.loadLatestContext();
  assert.equal(latest?.version, 1); assert.match(latest!.text, /SEVEN slide 2/);

  // two sessions race: ws2 saves v2, ws1 still believes v1 is current and must be refused
  await ws2.act({ type: 'enter' }, 'mouse');
  await ws2.act({ type: 'propose_save_context', text: 'Newer.' }, 'kast');
  await ws2.act({ type: 'resolve_confirm', id: ws2.state.confirm!.id, approve: true }, 'mouse');
  await ws1.act({ type: 'propose_save_context', text: 'Stale writer.' }, 'kast');
  const stale = await ws1.act({ type: 'resolve_confirm', id: ws1.state.confirm!.id, approve: true }, 'mouse');
  assert.equal(stale.ok, false); assert.equal(stale.error, 'version_conflict');
  assert.equal((await ws2.contexts.latest())?.text, 'Newer.');
});

test('declined save persists nothing; supabase stub reports blocked', async () => {
  const ws = new Workspace(new SyntheticLocalStore(mem())); await ws.act({ type: 'enter' }, 'mouse');
  await ws.act({ type: 'propose_save_context', text: 'x' }, 'kast');
  await ws.act({ type: 'resolve_confirm', id: ws.state.confirm!.id, approve: false }, 'mouse');
  assert.equal(await ws.contexts.latest(), null);
  const { SupabaseBlockedStore } = await import('../src/core/context.ts');
  const ws2 = new Workspace(new SupabaseBlockedStore()); await ws2.act({ type: 'enter' }, 'mouse');
  await ws2.act({ type: 'propose_save_context', text: 'x' }, 'kast');
  const r = await ws2.act({ type: 'resolve_confirm', id: ws2.state.confirm!.id, approve: true }, 'mouse');
  assert.equal(r.ok, false); assert.equal(r.error, 'blocked');
});
