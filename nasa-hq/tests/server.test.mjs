import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer, resolveBind } from '../server/dev.mjs';

const ORIGIN = 'https://hq.example.test', KEY = 'sk_test_SECRET_KEY_VALUE', FUTURE = Date.now() + 3_600_000;
const goodAuth = (over = {}) => ({
  authenticate: async (req) => (req.headers.cookie === 'sid=ok' ? { userId: 'u1', csrfToken: 'csrf-1', expiresAt: FUTURE, ...over } : req.headers.cookie === 'sid=expired' ? { userId: 'u1', csrfToken: 'csrf-1', expiresAt: Date.now() - 1 } : null),
  can: async (id) => id === 'u1',
});
const okFetch = (calls = []) => async (url, init) => { calls.push({ url: String(url), init }); return { ok: true, json: async () => ({ token: 'tok_abc' }) }; };
const baseEnv = { NASA_HQ_KAST_ENABLED: 'true', ELEVENLABS_API_KEY: KEY, NASA_HQ_ALLOWED_ORIGINS: ORIGIN };

async function run(opts, req = {}) {
  const logs = []; const srv = createServer({ audit: (e) => logs.push(e), ...opts });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  const out = await new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: req.path ?? '/api/elevenlabs/session', method: req.method ?? 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', cookie: 'sid=ok', 'x-csrf-token': 'csrf-1', ...(req.headers ?? {}) } }, (res) => {
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    r.on('error', reject); r.end(req.body ?? '{}');
  });
  srv.close(); return { ...out, logs };
}
const noKeyLeak = (r) => { assert.ok(!r.body.includes(KEY)); assert.ok(!JSON.stringify(r.logs).includes(KEY)); assert.ok(!JSON.stringify(r.logs).includes('tok_abc')); };

test('integration gate defaults OFF: nothing is issued even with a key, a session and a good origin', async () => {
  const calls = []; const r = await run({ env: { ...baseEnv, NASA_HQ_KAST_ENABLED: undefined }, auth: goodAuth(), fetchImpl: okFetch(calls) });
  assert.equal(r.status, 404); assert.equal(calls.length, 0);
  assert.equal((await run({ env: { ...baseEnv, NASA_HQ_KAST_ENABLED: '1' }, auth: goodAuth(), fetchImpl: okFetch(calls) })).status, 404);   // only the exact string enables
  assert.equal(calls.length, 0);
});
test('missing key fails closed', async () => { assert.equal((await run({ env: { ...baseEnv, ELEVENLABS_API_KEY: '' }, auth: goodAuth() })).status, 503); });
test('anonymous caller (default adapter) is refused and upstream is never called', async () => {
  const calls = []; const r = await run({ env: baseEnv, fetchImpl: okFetch(calls) });          // no auth adapter = deny all
  assert.equal(r.status, 401); assert.equal(calls.length, 0); noKeyLeak(r);
});
test('expired and unknown sessions are 401', async () => {
  const calls = []; for (const c of ['sid=expired', 'sid=nope', '']) assert.equal((await run({ env: baseEnv, auth: goodAuth(), fetchImpl: okFetch(calls) }, { headers: { cookie: c } })).status, 401);
  assert.equal(calls.length, 0);
});
test('authenticated but not permitted for HQ voice: 403', async () => {
  const calls = []; const auth = { ...goodAuth(), can: async () => false };
  assert.equal((await run({ env: baseEnv, auth, fetchImpl: okFetch(calls) })).status, 403); assert.equal(calls.length, 0);
  assert.equal((await run({ env: baseEnv, auth: { ...goodAuth(), can: async () => { throw new Error('db down'); } }, fetchImpl: okFetch(calls) })).status, 403);   // permission errors fail closed
});
test('Origin must match exactly; missing, null, look-alike and cross-site fetches are refused', async () => {
  const calls = [];
  for (const origin of [undefined, 'null', 'https://hq.example.test.evil.test', 'http://hq.example.test', 'https://HQ.example.test'])
    assert.equal((await run({ env: baseEnv, auth: goodAuth(), fetchImpl: okFetch(calls) }, { headers: { origin: origin ?? '' , ...(origin === undefined ? {} : {}) } })).status, 403, String(origin));
  assert.equal((await run({ env: baseEnv, auth: goodAuth(), fetchImpl: okFetch(calls) }, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await run({ env: { ...baseEnv, NASA_HQ_ALLOWED_ORIGINS: '' }, auth: goodAuth(), fetchImpl: okFetch(calls) })).status, 403);   // empty allowlist denies all
  assert.equal(calls.length, 0);
});
test('CSRF token is required and compared exactly', async () => {
  const calls = []; for (const t of [undefined, '', 'wrong', 'csrf-', 'CSRF-1'])
    assert.equal((await run({ env: baseEnv, auth: goodAuth(), fetchImpl: okFetch(calls) }, { headers: { 'x-csrf-token': t ?? '' } })).status, 403, String(t));
  assert.equal((await run({ env: baseEnv, auth: goodAuth({ csrfToken: '' }), fetchImpl: okFetch(calls) }, { headers: { 'x-csrf-token': '' } })).status, 403);   // empty never matches empty
  assert.equal(calls.length, 0);
});
test('method, content type, body size and client-chosen fields are rejected', async () => {
  const calls = []; const o = { env: baseEnv, auth: goodAuth(), fetchImpl: okFetch(calls) };
  assert.equal((await run(o, { method: 'GET' })).status, 405);
  assert.equal((await run(o, { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await run(o, { body: 'x'.repeat(5000) })).status, 413);
  assert.equal((await run(o, { body: '{"agentId":"agent_other"}' })).status, 400);
  assert.equal((await run(o, { body: '{"branch_id":"b"}' })).status, 400);
  assert.equal((await run(o, { body: '{nope' })).status, 400);
  assert.equal(calls.length, 0);
});
test('per-user rate limit (429 + Retry-After) and global concurrency cap', async () => {
  const calls = []; let t = 1_000_000;
  const o = { env: { ...baseEnv, NASA_HQ_TOKEN_RATE_PER_MIN: '2' }, auth: goodAuth(), fetchImpl: okFetch(calls), now: () => t };
  const srv = createServer({ ...o, audit: () => {} }); await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const hit = () => new Promise((resolve) => { const r = http.request({ host: '127.0.0.1', port, path: '/api/elevenlabs/session', method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', cookie: 'sid=ok', 'x-csrf-token': 'csrf-1' } }, (res) => { res.resume(); res.on('end', () => resolve(res)); }); r.end('{}'); });
  const s = []; for (let i = 0; i < 4; i++) s.push((await hit()).statusCode);
  assert.deepEqual(s, [200, 200, 429, 429]); assert.equal(calls.length, 2);
  const limited = await hit(); assert.ok(Number(limited.headers['retry-after']) >= 1);
  srv.close();
  // concurrency: hold upstream open, cap = 1
  let release; const gate = new Promise((r) => (release = r)); let started = 0;
  const slow = async () => { started++; await gate; return { ok: true, json: async () => ({ token: 'tok_abc' }) }; };
  const srv2 = createServer({ env: { ...baseEnv, NASA_HQ_TOKEN_MAX_INFLIGHT: '1', NASA_HQ_TOKEN_RATE_PER_MIN: '50' }, auth: goodAuth(), fetchImpl: slow, audit: () => {} });
  await new Promise((r) => srv2.listen(0, '127.0.0.1', r)); const p2 = srv2.address().port;
  const hit2 = () => new Promise((resolve) => { const r = http.request({ host: '127.0.0.1', port: p2, path: '/api/elevenlabs/session', method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', cookie: 'sid=ok', 'x-csrf-token': 'csrf-1' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); r.end('{}'); });
  const first = hit2(); while (started < 1) await new Promise((r) => setTimeout(r, 10));
  assert.equal(await hit2(), 429); release(); assert.equal(await first, 200); srv2.close();
});
test('upstream is bounded: hang -> 504 within the timeout; failures map to safe 502s without leaking provider detail', async () => {
  const hang = (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
  const t0 = Date.now(); const r = await run({ env: { ...baseEnv, NASA_HQ_UPSTREAM_TIMEOUT_MS: '500' }, auth: goodAuth(), fetchImpl: hang });
  assert.equal(r.status, 504); assert.ok(Date.now() - t0 < 3000); noKeyLeak(r);
  const bad = await run({ env: baseEnv, auth: goodAuth(), fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ detail: 'invalid key sk_test_SECRET_KEY_VALUE' }) }) });
  assert.equal(bad.status, 502); assert.deepEqual(JSON.parse(bad.body), { error: 'upstream_unavailable' }); noKeyLeak(bad);
  assert.equal((await run({ env: baseEnv, auth: goodAuth(), fetchImpl: async () => ({ ok: true, json: async () => ({ token: 42 }) }) })).status, 502);
  assert.equal((await run({ env: baseEnv, auth: goodAuth(), fetchImpl: async () => { throw new Error('ECONNRESET ' + KEY); } })).status, 502);
});
test('success: token only, original agent fixed, branch only when explicitly configured, no-store headers, nonsecret audit', async () => {
  const calls = []; const r = await run({ env: baseEnv, auth: goodAuth(), fetchImpl: okFetch(calls) });
  assert.equal(r.status, 200); assert.deepEqual(JSON.parse(r.body), { conversationToken: 'tok_abc' });
  assert.match(r.headers['cache-control'], /no-store/); assert.match(r.headers['cache-control'], /private/);
  assert.equal(calls[0].init.headers['xi-api-key'], KEY); assert.ok(calls[0].url.includes('agent_7501ky1tjmrzf4xa67v0zsqzz9hf')); assert.ok(!calls[0].url.includes('branch_id'));
  assert.equal(r.logs.length, 1); assert.equal(r.logs[0].outcome, 'issued'); assert.match(r.logs[0].user, /^[0-9a-f]{12}$/); noKeyLeak(r);
  const c2 = []; await run({ env: { ...baseEnv, NASA_HQ_KAST_BRANCH_ID: 'agtbrch_test' }, auth: goodAuth(), fetchImpl: okFetch(c2) }); assert.ok(c2[0].url.includes('branch_id=agtbrch_test'));
});
test('binds to loopback by default and refuses a public bind without an explicit override', () => {
  assert.equal(resolveBind({}).host, '127.0.0.1');
  assert.throws(() => resolveBind({ HOST: '0.0.0.0' }), /Refusing to bind/);
  assert.equal(resolveBind({ HOST: '0.0.0.0', NASA_HQ_ALLOW_NON_LOOPBACK: 'true' }).host, '0.0.0.0');
});
