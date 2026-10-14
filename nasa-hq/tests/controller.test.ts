import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceController, type Phase, type VoiceDeps } from '../src/kast/controller.ts';

/** A fake provider that "owns" a microphone stream: opened on start, released only by session.end() (or by its own failure path). */
function harness(over: Partial<{ token: () => Promise<string>; start: () => Promise<void>; end: () => Promise<void> }> = {}) {
  const log: string[] = []; const phases: Phase[] = [];
  const mic = { open: 0, released: 0 };
  const gates: Record<string, (v?: unknown) => void> = {};
  const deps: VoiceDeps = {
    startTimeoutMs: 200,
    onPhase: (p) => phases.push(p),
    fetchToken: (signal) => new Promise((resolve, reject) => {
      log.push('token:begin'); signal.addEventListener('abort', () => { log.push('token:aborted'); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
      if (over.token) over.token().then(resolve, reject); else gates.token = () => resolve('tok');
    }),
    startSession: () => new Promise((resolve, reject) => {
      log.push('start:begin');
      const open = () => { mic.open++; resolve({ end: async () => { log.push('end'); if (over.end) await over.end(); mic.released++; } }); };
      if (over.start) over.start().then(open, reject); else { gates.start = open; gates.startFail = reject as never; }
    }),
  };
  return { c: new VoiceController(deps), log, phases, mic, gates, tick: () => new Promise((r) => setTimeout(r, 0)) };
}
const noLeak = (h: ReturnType<typeof harness>) => assert.equal(h.mic.open, h.mic.released, `mic streams open=${h.mic.open} released=${h.mic.released}`);

test('repeated clicks: start() is a synchronous one-shot latch; only one token request and one start ever happen', async () => {
  const h = harness();
  assert.equal(h.c.start(), true); assert.equal(h.c.start(), false); assert.equal(h.c.start(), false);
  h.gates.token(); await h.tick(); h.gates.start(); await h.tick();
  assert.equal(h.c.phase, 'connected'); assert.equal(h.log.filter((x) => x === 'token:begin').length, 1); assert.equal(h.log.filter((x) => x === 'start:begin').length, 1);
  assert.equal(h.c.start(), false);                                   // still refused while connected
  await h.c.stop(); assert.equal(h.c.phase, 'closed'); assert.equal(h.c.start(), false);   // and after teardown: this instance is spent
  assert.equal(h.c.canStartNew, true); noLeak(h);
});
test('cancel while the token request is pending: aborted, start never called, nothing opened', async () => {
  const h = harness(); h.c.start(); await h.tick();
  await h.c.stop();
  assert.equal(h.c.phase, 'closed'); assert.ok(h.log.includes('token:aborted')); assert.ok(!h.log.includes('start:begin')); assert.equal(h.c.teardownVerified, true); noLeak(h);
});
test('token resolves AFTER stop (provider ignored abort): still no session started', async () => {
  const h = harness(); h.c.start(); await h.tick();
  const stopped = h.c.stop(); h.gates.token(); await stopped;
  assert.ok(!h.log.includes('start:begin')); assert.equal(h.c.phase, 'closed'); noLeak(h);
});
test('cancel while start is pending, then start resolves late: the late session is ended exactly once', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick();
  assert.equal(h.c.phase, 'starting');
  const stopped = h.c.stop(); await h.tick();
  assert.notEqual(h.c.phase, 'connected'); h.gates.start(); await stopped;
  assert.equal(h.log.filter((x) => x === 'end').length, 1); assert.equal(h.c.phase, 'closed'); assert.equal(h.c.teardownVerified, true);
  assert.ok(!h.phases.includes('connected'), 'must never report connected'); noLeak(h);
});
test('cancel while start is pending, then start REJECTS late: closed, no end call on a session that never existed', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick();
  const stopped = h.c.stop(); h.gates.startFail(new Error('denied')); await stopped;
  assert.equal(h.c.phase, 'closed'); assert.equal(h.log.filter((x) => x === 'end').length, 0); assert.equal(h.mic.open, 0);
});
test('microphone denied: failed with the reason, teardown verified, a NEW instance may try again', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick(); h.gates.startFail(new Error('NotAllowedError: Permission denied')); await h.tick();
  assert.equal(h.c.phase, 'failed'); assert.match(h.c.error ?? '', /Permission denied/); assert.equal(h.c.canStartNew, true); assert.equal(h.c.start(), false);
});
test('start never settles: times out as failed with UNVERIFIED teardown, and a session that finally arrives is ended', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await new Promise((r) => setTimeout(r, 300));
  assert.equal(h.c.phase, 'failed'); assert.equal(h.c.teardownVerified, false); assert.equal(h.c.canStartNew, false);
  h.gates.start(); await h.tick(); await h.tick();
  assert.equal(h.log.filter((x) => x === 'end').length, 1); noLeak(h);
});
test('unmount (dispose) while connected ends the session once; repeated dispose/stop share one teardown', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick(); h.gates.start(); await h.tick();
  const a = h.c.dispose(), b = h.c.stop(), c = h.c.dispose(); assert.equal(a, b); assert.equal(b, c);
  await a; assert.equal(h.log.filter((x) => x === 'end').length, 1); assert.equal(h.c.phase, 'closed'); noLeak(h);
});
test('unmount before anything started closes the latch for good (Strict Mode: dispose then a fresh instance)', async () => {
  const first = harness(); await first.c.dispose(); assert.equal(first.c.start(), false); assert.equal(first.c.phase, 'closed');
  const second = harness(); assert.equal(second.c.start(), true);            // the re-mounted component gets its own instance
  second.gates.token(); await second.tick(); second.gates.start(); await second.tick(); assert.equal(second.c.phase, 'connected');
  assert.equal(first.log.length, 0); await second.c.dispose(); noLeak(second);
});
test('end() rejects: failed with unverified teardown, no new attempt allowed, no throw out of stop()', async () => {
  const h = harness({ end: async () => { throw new Error('socket stuck'); } }); h.c.start(); h.gates.token(); await h.tick(); h.gates.start(); await h.tick();
  await h.c.stop();
  assert.equal(h.c.phase, 'failed'); assert.match(h.c.error ?? '', /teardown_failed/); assert.equal(h.c.canStartNew, false);
});
test('provider closes the session itself: closed and verified; later stop() does not call end again', async () => {
  const h = harness(); h.c.start(); h.gates.token(); await h.tick(); h.gates.start(); await h.tick();
  h.c.providerClosed(); assert.equal(h.c.phase, 'closed'); assert.equal(h.c.canStartNew, true);
  await h.c.stop(); assert.equal(h.log.filter((x) => x === 'end').length, 0);
});
test('token request fails (not signed in): failed, nothing started, no microphone touched', async () => {
  const h = harness({ token: () => Promise.reject(new Error('not_signed_in')) }); h.c.start(); await h.tick(); await h.tick();
  assert.equal(h.c.phase, 'failed'); assert.match(h.c.error ?? '', /not_signed_in/); assert.ok(!h.log.includes('start:begin')); assert.equal(h.mic.open, 0);
});
