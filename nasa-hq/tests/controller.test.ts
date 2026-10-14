import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceController, type Phase, type VoiceDeps } from '../src/kast/controller.ts';

/**
 * A fake provider that OWNS a fake microphone: opened when a session is created, released only by session.end().
 * Partial acquisition (mic opened, then start rejects) is modelled with `startFailsAfterMic`: the stream stays open,
 * which is exactly the case the controller must NOT claim is clean.
 */
function harness(over: Partial<{ end: () => Promise<void>; startFailsAfterMic: boolean }> = {}) {
  const log: string[] = []; const phases: Phase[] = [];
  const mic = { open: 0, released: 0 };
  const gates: Record<string, (v?: unknown) => void> = {};
  const deps: VoiceDeps = {
    startTimeoutMs: 200,
    onPhase: (p) => phases.push(p),
    fetchToken: (signal) => new Promise((resolve, reject) => {
      log.push('token:begin'); signal.addEventListener('abort', () => { log.push('token:aborted'); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
      gates.token = () => resolve('tok'); gates.tokenFail = (e) => reject(e);
    }),
    startSession: () => new Promise((resolve, reject) => {
      log.push('start:begin');
      gates.start = () => { mic.open++; resolve({ end: async () => { log.push('end'); if (over.end) await over.end(); mic.released++; } }); };
      gates.startFail = reject as never;
      gates.micThenFail = () => { mic.open++; reject(new Error('connection refused after microphone opened')); };
    }),
  };
  return { c: new VoiceController(deps), log, phases, mic, gates, tick: () => new Promise((r) => setTimeout(r, 0)) };
}
type H = ReturnType<typeof harness>;
const noLeak = (h: H) => assert.equal(h.mic.open, h.mic.released, `mic streams open=${h.mic.open} released=${h.mic.released}`);
const connect = async (h: H) => { h.c.start(); h.gates.token(); await h.tick(); h.gates.start(); await h.tick(); };

test('repeated clicks: start() is a synchronous one-shot latch; one token request and one start ever happen', async () => {
  const h = harness(); assert.equal(h.c.start(), true); assert.equal(h.c.start(), false); assert.equal(h.c.start(), false);
  h.gates.token(); await h.tick(); h.gates.start(); await h.tick();
  assert.equal(h.c.phase, 'connected'); assert.equal(h.log.filter((x) => x === 'token:begin').length, 1); assert.equal(h.log.filter((x) => x === 'start:begin').length, 1);
  assert.equal(h.c.start(), false); await h.c.stop(); assert.equal(h.c.phase, 'closed'); assert.equal(h.c.start(), false);
  assert.equal(h.c.teardown, 'verified'); assert.equal(h.c.canStartNew, true); noLeak(h);
});
test('cancel while the token request is pending: aborted, the SDK is never touched, teardown trivially verified', async () => {
  const h = harness(); h.c.start(); await h.tick(); await h.c.stop();
  assert.equal(h.c.phase, 'closed'); assert.ok(h.log.includes('token:aborted')); assert.ok(!h.log.includes('start:begin')); assert.equal(h.c.teardown, 'verified'); assert.equal(h.c.reachedProvider, false); noLeak(h);
});
test('token resolves AFTER stop (provider ignored abort): still no session started', async () => {
  const h = harness(); h.c.start(); await h.tick(); const stopped = h.c.stop(); h.gates.token(); await stopped;
  assert.ok(!h.log.includes('start:begin')); assert.equal(h.c.phase, 'closed'); noLeak(h);
});
test('token request fails (not signed in): failed with the reason, SDK never touched, verified, a new instance may try', async () => {
  const h = harness(); h.c.start(); await h.tick(); h.gates.tokenFail(new Error('not_signed_in')); await h.tick();
  assert.equal(h.c.phase, 'failed'); assert.match(h.c.error ?? '', /not_signed_in/); assert.ok(!h.log.includes('start:begin')); assert.equal(h.mic.open, 0); assert.equal(h.c.canStartNew, true);
});
test('cancel while start is pending, then start resolves late: the late session is ended exactly once and never reported connected', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick(); assert.equal(h.c.phase, 'starting');
  const stopped = h.c.stop(); await h.tick(); assert.notEqual(h.c.phase, 'connected'); h.gates.start(); await stopped;
  assert.equal(h.log.filter((x) => x === 'end').length, 1); assert.equal(h.c.phase, 'closed'); assert.equal(h.c.teardown, 'verified'); assert.ok(!h.phases.includes('connected')); noLeak(h);
});
test('cancel while start is pending, then start REJECTS late: contained but UNVERIFIED; a new attempt is blocked', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick();
  const stopped = h.c.stop(); h.gates.startFail(new Error('denied')); await stopped;
  assert.equal(h.log.filter((x) => x === 'end').length, 0, 'there is no session to end'); assert.equal(h.c.teardown, 'unverified'); assert.equal(h.c.canStartNew, false);
});
test('PARTIAL ACQUISITION: microphone opened, then the start rejects. The controller must NOT claim the microphone is released', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick(); h.gates.micThenFail(); await h.tick();
  assert.equal(h.c.phase, 'failed'); assert.equal(h.mic.open, 1); assert.equal(h.mic.released, 0, 'the fake stream really is still open');
  assert.equal(h.c.teardown, 'unverified'); assert.equal(h.c.teardownVerified, false); assert.equal(h.c.canStartNew, false);       // blocked: reload required
  assert.equal(h.c.start(), false);
});
test('microphone denied (SDK rejects): contained, unverified, retry blocked until reload', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick(); h.gates.startFail(new Error('NotAllowedError: Permission denied')); await h.tick();
  assert.equal(h.c.phase, 'failed'); assert.match(h.c.error ?? '', /Permission denied/); assert.equal(h.c.canStartNew, false); assert.equal(h.c.start(), false);
});
test('start never settles: times out as failed/unverified, and a session that finally arrives is ended', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await new Promise((r) => setTimeout(r, 300));
  assert.equal(h.c.phase, 'failed'); assert.equal(h.c.teardown, 'unverified'); assert.equal(h.c.canStartNew, false);
  h.gates.start(); await h.tick(); await h.tick(); assert.equal(h.log.filter((x) => x === 'end').length, 1); noLeak(h);
});
test('DISCONNECT BEFORE START RESOLVES: never reported connected; the late session is ended; ends failed with a receipt', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick(); assert.equal(h.c.phase, 'starting');
  const p = h.c.providerClosed(); h.gates.start(); await p; await h.c.finished;
  assert.ok(!h.phases.includes('connected')); assert.equal(h.log.filter((x) => x === 'end').length, 1); assert.equal(h.c.phase, 'failed'); assert.match(h.c.error ?? '', /disconnected_during_start/);
  assert.equal(h.c.teardown, 'verified'); noLeak(h);
});
test('PROVIDER ERROR before connect, and while connected: invalidates and ends, once', async () => {
  const a = harness(); a.c.start(); a.gates.token(); await a.tick(); const pa = a.c.providerError('webrtc exploded'); a.gates.start(); await pa; await a.c.finished;
  assert.ok(!a.phases.includes('connected')); assert.equal(a.log.filter((x) => x === 'end').length, 1); assert.match(a.c.error ?? '', /webrtc exploded/); noLeak(a);
  const b = harness(); await connect(b); await b.c.providerError('socket error'); assert.equal(b.log.filter((x) => x === 'end').length, 1); assert.equal(b.c.phase, 'failed'); assert.equal(b.c.teardown, 'verified'); noLeak(b);
});
test('provider disconnect while CONNECTED is an observation: end() is still called and must succeed before teardown counts as verified', async () => {
  let release!: () => void; const h = harness({ end: () => new Promise<void>((r) => (release = r)) }); await connect(h);
  const p = h.c.providerClosed(); await h.tick();
  assert.equal(h.c.phase, 'stopping'); assert.equal(h.c.teardown, 'pending'); assert.equal(h.c.canStartNew, false, 'blocked while cleanup is still pending');
  release(); await p; assert.equal(h.c.teardown, 'verified'); assert.equal(h.c.canStartNew, true); assert.equal(h.log.filter((x) => x === 'end').length, 1); noLeak(h);
});
test('DELAYED cleanup blocks replacement; FAILED cleanup keeps it blocked', async () => {
  let release!: () => void; const slow = harness({ end: () => new Promise<void>((r) => (release = r)) }); await connect(slow);
  const stopping = slow.c.stop(); await slow.tick(); assert.equal(slow.c.canStartNew, false); assert.equal(slow.c.teardown, 'pending');
  release(); await stopping; assert.equal(slow.c.canStartNew, true); noLeak(slow);
  const bad = harness({ end: async () => { throw new Error('socket stuck'); } }); await connect(bad); await bad.c.stop();
  assert.equal(bad.c.phase, 'failed'); assert.match(bad.c.error ?? '', /teardown_failed/); assert.equal(bad.c.teardown, 'unverified'); assert.equal(bad.c.canStartNew, false);
});
test('unmount (dispose) while connected ends the session once; repeated dispose/stop share one teardown', async () => {
  const h = harness(); await connect(h); const a = h.c.dispose(), b = h.c.stop(), c = h.c.dispose(); assert.equal(a, b); assert.equal(b, c);
  await a; assert.equal(h.log.filter((x) => x === 'end').length, 1); assert.equal(h.c.phase, 'closed'); noLeak(h);
});
test('unmount before anything started closes the latch for good (a re-mounted component gets its own instance)', async () => {
  const first = harness(); await first.c.dispose(); assert.equal(first.c.start(), false); assert.equal(first.c.phase, 'closed'); assert.equal(first.c.canStartNew, true);
  const second = harness(); assert.equal(second.c.start(), true); second.gates.token(); await second.tick(); second.gates.start(); await second.tick(); assert.equal(second.c.phase, 'connected');
  assert.equal(first.log.length, 0); await second.c.dispose(); noLeak(second);
});
