// POST /api/elevenlabs/session: issues a short-lived conversation token for the ORIGINAL KAST agent.
// Fail-closed order: gate -> key -> method/origin -> body -> authentication -> CSRF -> permission -> rate/concurrency -> bounded upstream call.
// The API key and the upstream response body never leave this module. Nothing here proves a live KAST session.
import { createHash, timingSafeEqual } from 'node:crypto';

export const KAST_AGENT_ID = 'agent_7501ky1tjmrzf4xa67v0zsqzz9hf';
export const PERMISSION = 'hq:kast:token';

/** Default adapter: denies everyone. A real adapter must be supplied by the application's identity layer. */
export const denyAllAuth = { authenticate: async () => null, can: async () => false };

export function readConfig(env = process.env) {
  const int = (v, d, lo, hi) => { const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  return {
    enabled: env.NASA_HQ_KAST_ENABLED === 'true',                       // default OFF; only the exact string enables it
    apiKey: env.ELEVENLABS_API_KEY ?? '',
    origins: new Set((env.NASA_HQ_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)),
    branchId: env.NASA_HQ_KAST_BRANCH_ID || null,                       // explicit and optional; unset = main
    perUserPerMinute: int(env.NASA_HQ_TOKEN_RATE_PER_MIN, 5, 1, 60),
    maxInFlight: int(env.NASA_HQ_TOKEN_MAX_INFLIGHT, 4, 1, 50),
    upstreamTimeoutMs: int(env.NASA_HQ_UPSTREAM_TIMEOUT_MS, 5000, 500, 15000),
  };
}

export function createRateLimiter({ perMinute, now = () => Date.now() }) {
  const hits = new Map();
  return {
    take(key) {
      const t = now(); const w = (hits.get(key) ?? []).filter((x) => t - x < 60_000);
      if (w.length >= perMinute) { hits.set(key, w); return { ok: false, retryAfterSec: Math.max(1, Math.ceil((60_000 - (t - w[0])) / 1000)) }; }
      w.push(t); hits.set(key, w); return { ok: true };
    },
  };
}

const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store, private', pragma: 'no-cache', 'x-content-type-options': 'nosniff', vary: 'Origin, Cookie' };
const safeEq = (a, b) => { const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? '')); return x.length === y.length && x.length > 0 && timingSafeEqual(x, y); };
const hashId = (id) => createHash('sha256').update(String(id)).digest('hex').slice(0, 12);

export function createTokenHandler({ config = readConfig(), auth = denyAllAuth, fetchImpl = fetch, now = () => Date.now(), audit = () => {}, limiter } = {}) {
  const rate = limiter ?? createRateLimiter({ perMinute: config.perUserPerMinute, now });
  let inFlight = 0;

  const send = (res, status, body, extra = {}) => { res.writeHead(status, { ...HEADERS, ...extra }); res.end(JSON.stringify(body)); };
  const done = (res, status, outcome, who, body, extra) => { audit({ at: new Date(now()).toISOString(), outcome, status, user: who ?? null }); send(res, status, body, extra); };

  const readBody = (req) => new Promise((resolve) => {
    let n = 0, over = false; const chunks = [];
    req.on('data', (c) => { n += c.length; if (over) return; if (n > 1024) { over = true; chunks.length = 0; resolve({ tooLarge: true }); } else chunks.push(c); });
    req.on('end', () => { if (!over) resolve({ text: Buffer.concat(chunks).toString('utf8') }); });
    req.on('error', () => resolve({ tooLarge: true }));
  });

  return async function handle(req, res) {
    if (!config.enabled) return done(res, 404, 'gate_off', null, { error: 'not_available' });
    if (!config.apiKey) return done(res, 503, 'no_key', null, { error: 'not_configured' });
    if (req.method !== 'POST') return done(res, 405, 'method', null, { error: 'method_not_allowed' }, { allow: 'POST' });

    const origin = req.headers.origin;
    if (!origin || !config.origins.has(origin)) return done(res, 403, 'origin', null, { error: 'forbidden' });
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin') return done(res, 403, 'fetch_site', null, { error: 'forbidden' });
    if (!/^application\/json(;|$)/i.test(req.headers['content-type'] ?? '')) return done(res, 415, 'content_type', null, { error: 'unsupported_media_type' });

    const body = await readBody(req);
    if (body.tooLarge) return done(res, 413, 'too_large', null, { error: 'payload_too_large' }, { connection: 'close' });
    let parsed; try { parsed = body.text ? JSON.parse(body.text) : {}; } catch { return done(res, 400, 'bad_json', null, { error: 'bad_request' }); }
    // The agent and branch are fixed server-side. A client may not pick them.
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length > 0) return done(res, 400, 'unexpected_fields', null, { error: 'bad_request' });

    let session = null;
    try { session = await auth.authenticate(req); } catch { return done(res, 401, 'auth_error', null, { error: 'unauthorized' }); }
    if (!session || !session.userId || !(session.expiresAt > now())) return done(res, 401, 'unauthenticated', null, { error: 'unauthorized' });
    const who = hashId(session.userId);
    if (!safeEq(req.headers['x-csrf-token'], session.csrfToken)) return done(res, 403, 'csrf', who, { error: 'forbidden' });
    let allowed = false; try { allowed = (await auth.can(session.userId, PERMISSION)) === true; } catch { allowed = false; }
    if (!allowed) return done(res, 403, 'not_permitted', who, { error: 'forbidden' });

    const r = rate.take(session.userId);
    if (!r.ok) return done(res, 429, 'rate_limited', who, { error: 'rate_limited' }, { 'retry-after': String(r.retryAfterSec) });
    if (inFlight >= config.maxInFlight) return done(res, 429, 'busy', who, { error: 'busy' }, { 'retry-after': '2' });

    inFlight++;
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), config.upstreamTimeoutMs);
    try {
      const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/token');
      url.searchParams.set('agent_id', KAST_AGENT_ID);
      if (config.branchId) url.searchParams.set('branch_id', config.branchId);       // provider support for this parameter is unverified
      const up = await fetchImpl(url, { headers: { 'xi-api-key': config.apiKey }, signal: ac.signal });
      if (!up.ok) return done(res, 502, 'upstream_status', who, { error: 'upstream_unavailable' });
      const j = await up.json();
      if (typeof j?.token !== 'string' || j.token.length === 0 || j.token.length > 4096) return done(res, 502, 'upstream_shape', who, { error: 'upstream_unavailable' });
      return done(res, 200, 'issued', who, { conversationToken: j.token });
    } catch (e) {
      return e?.name === 'AbortError' ? done(res, 504, 'upstream_timeout', who, { error: 'upstream_timeout' }) : done(res, 502, 'upstream_error', who, { error: 'upstream_unavailable' });
    } finally { clearTimeout(timer); inFlight--; }
  };
}
