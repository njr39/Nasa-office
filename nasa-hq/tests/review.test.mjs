import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReviewServer } from '../server/review.mjs';
import { createReviewAuth } from '../server/review-auth.mjs';

const start = async (env = {}, fetchImpl) => {
  const auth = createReviewAuth({ passcode: 'correct horse battery' });
  const srv = createReviewServer({ env, auth, fetchImpl, audit: () => {}, origin: 'http://127.0.0.1:0' });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
  return { srv, base, close: () => srv.close() };
};
const login = async (base, code = 'correct horse battery') => fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `passcode=${encodeURIComponent(code)}` });

test('review server: the app is not served without sign-in; wrong passcode is refused; right one sets an HttpOnly SameSite cookie', async () => {
  const t = await start();
  assert.equal((await fetch(`${t.base}/`)).status, 401); assert.equal((await fetch(`${t.base}/app.js`)).status, 401);
  assert.equal((await login(t.base, 'nope')).status, 401);
  const ok = await login(t.base); assert.equal(ok.status, 303); const c = ok.headers.get('set-cookie'); assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/);
  const cookie = c.split(';')[0];
  const home = await fetch(`${t.base}/`, { headers: { cookie } }); assert.equal(home.status, 200); assert.match(await home.text(), /name="csrf-token" content="[A-Za-z0-9_-]{10,}"/);
  t.close();
});
test('review server: repeated wrong passcodes lock sign-in', async () => {
  const t = await start(); for (let i = 0; i < 5; i++) await login(t.base, 'bad' + i);
  assert.equal((await login(t.base)).status, 429, 'even the right passcode is refused during the lock'); t.close();
});
test('review server: the token route stays closed with the gate off, and never reveals the key with it on', async () => {
  const off = await start({ ELEVENLABS_API_KEY: 'sk_test_SECRET' }); const cookie = (await login(off.base)).headers.get('set-cookie').split(';')[0];
  const csrf = /content="([^"]+)"/.exec(await (await fetch(`${off.base}/`, { headers: { cookie } })).text())[1];
  const r = await fetch(`${off.base}/api/elevenlabs/session`, { method: 'POST', headers: { cookie, 'x-csrf-token': csrf, origin: 'http://127.0.0.1:0', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 404); assert.ok(!(await r.text()).includes('SECRET')); off.close();
  let upstream;
  const on = await start({ NASA_HQ_KAST_ENABLED: 'true', ELEVENLABS_API_KEY: 'sk_test_SECRET' }, async (u, o) => { upstream = { u: String(u), key: o.headers['xi-api-key'] }; return new Response(JSON.stringify({ token: 'tok_abc' }), { status: 200 }); });
  const c2 = (await login(on.base)).headers.get('set-cookie').split(';')[0]; const csrf2 = /content="([^"]+)"/.exec(await (await fetch(`${on.base}/`, { headers: { cookie: c2 } })).text())[1];
  const base = { method: 'POST', headers: { cookie: c2, 'x-csrf-token': csrf2, origin: `http://127.0.0.1:0`, 'content-type': 'application/json' }, body: '{}' };
  assert.equal((await fetch(`${on.base}/api/elevenlabs/session`, { ...base, headers: { ...base.headers, 'x-csrf-token': 'wrong' } })).status, 403, 'CSRF enforced');
  assert.equal((await fetch(`${on.base}/api/elevenlabs/session`, { ...base, headers: { ...base.headers, origin: 'https://evil.example' } })).status, 403, 'Origin enforced');
  assert.equal((await fetch(`${on.base}/api/elevenlabs/session`, { method: 'POST', headers: { origin: 'http://127.0.0.1:0', 'content-type': 'application/json' }, body: '{}' })).status, 401, 'no cookie, no token');
  const good = await fetch(`${on.base}/api/elevenlabs/session`, base); const txt = await good.text();
  assert.equal(good.status, 200, txt); assert.ok(!txt.includes('SECRET'), 'the API key never reaches the browser'); assert.match(upstream.u, /agent_7501ky1tjmrzf4xa67v0zsqzz9hf/); assert.equal(upstream.key, 'sk_test_SECRET'); on.close();
});

test('review server: /api/status needs sign-in and never contains secrets', async () => {
  const t = await start({ ELEVENLABS_API_KEY: 'sk_test_SECRET', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv_SECRET' });
  assert.equal((await fetch(`${t.base}/api/status`)).status, 401);
  const cookie = (await login(t.base)).headers.get('set-cookie').split(';')[0];
  const txt = await (await fetch(`${t.base}/api/status`, { headers: { cookie } })).text(); const j = JSON.parse(txt);
  assert.equal(j.kast.keyPresent, true); assert.equal(j.supabase.wired, false); assert.ok(!/SECRET|supabase\.co/.test(txt)); t.close();
});
