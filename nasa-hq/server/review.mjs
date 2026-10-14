// Private authenticated review server. Serves the built app only to a signed-in browser and wires the guarded KAST token route.
//   REVIEW_PASSCODE=...        required (>= 12 chars); printed nowhere
//   ELEVENLABS_API_KEY=...     server-side only; never sent to the browser
//   NASA_HQ_KAST_ENABLED=true  turns the integration gate on (default OFF)
// Binds to loopback. For another device use an authenticated tunnel you control; do not expose this port publicly.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTokenHandler, readConfig } from './token-route.mjs';
import { createReviewAuth } from './review-auth.mjs';
import { resolveBind } from './dev.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store', 'permissions-policy': 'microphone=(self), camera=()', 'x-frame-options': 'DENY' };
const page = (body, status = 200) => [status, { ...SEC, 'content-type': 'text/html; charset=utf-8' }, `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>NASA HQ review sign-in</title><body style="font:16px system-ui;background:#3a230a;color:#fff6e5;display:grid;place-items:center;min-height:100vh;margin:0">${body}`];

export function createReviewServer({ env = process.env, auth, fetchImpl = fetch, audit = (e) => console.log(JSON.stringify({ kast_token: e })), origin } = {}) {
  const config = readConfig(env); if (origin) config.origins.add(origin);
  const handler = createTokenHandler({ config, auth, fetchImpl, audit });
  return http.createServer(async (req, res) => {
    const send = ([st, h, b]) => { res.writeHead(st, h); res.end(b); };
    const url = new URL(req.url, 'http://x'); const path = url.pathname;
    if (path === '/api/elevenlabs/session') return handler(req, res);
    if (path === '/login' && req.method === 'POST') {
      let body = ''; for await (const c of req) { body += c; if (body.length > 2048) { res.writeHead(413); return res.end(); } }
      const r = auth.login(new URLSearchParams(body).get('passcode'));
      if (!r.ok) return send(page(`<form method=post action=/login><p>${r.status === 429 ? 'Too many attempts. Wait a minute.' : 'Passcode not accepted.'}</p><p><a style=color:#e9c47a href=/>Back</a></p></form>`, r.status));
      res.writeHead(303, { ...SEC, location: '/', 'set-cookie': `nasa_review=${r.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 3600}` }); return res.end();
    }
    if (path === '/logout' && req.method === 'POST') { auth.logout(req); res.writeHead(303, { ...SEC, location: '/', 'set-cookie': 'nasa_review=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); return res.end(); }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); return res.end(); }
    const s = auth.session(req);
    if (!s) return send(page('<form method=post action=/login style="display:grid;gap:12px;width:min(340px,90vw)"><h1 style="font-size:18px">NASA HQ review build</h1><label>Review passcode<input name=passcode type=password autocomplete=current-password required style="width:100%;padding:8px;margin-top:4px"></label><button style="padding:10px">Sign in</button><small>Synthetic review environment. This passcode is not an HQ account.</small></form>', 401));
    if (path === '/api/status') {   // authenticated, nonsecret: booleans and labels only
      const e = env; const cfg = readConfig(e);
      res.writeHead(200, { ...SEC, 'content-type': 'application/json' });
      return res.end(JSON.stringify({ server: true, identity: 'review-passcode (not HQ identity)', kast: { gate: cfg.enabled, keyPresent: !!cfg.apiKey, agentId: 'agent_7501ky1tjmrzf4xa67v0zsqzz9hf', branch: cfg.branchId },
        supabase: { wired: false, credentialPresent: !!(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY), note: 'No server route reads or writes Supabase yet. Schema not inspected.' },
        drive: { wired: false, credentialPresent: !!e.GOOGLE_SERVICE_ACCOUNT_JSON, note: 'No retrieval route exists yet.' } }));
    }
    const clean = normalize(path).replace(/^(\.\.[/\\])+/, ''); const name = clean === '/' ? '/index.html' : clean;
    try {
      let file = await readFile(join(root, name));
      if (name === '/index.html') file = Buffer.from(file.toString('utf8').replace('<meta charset="utf-8" />', `<meta charset="utf-8" /><meta name="csrf-token" content="${s.csrfToken}" />`));
      res.writeHead(200, { ...SEC, 'content-type': types[extname(name)] ?? 'application/octet-stream' }); res.end(file);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { host, port } = resolveBind(); const cfg = readConfig();
  const auth = createReviewAuth({ passcode: process.env.REVIEW_PASSCODE });
  createReviewServer({ auth, origin: `http://${host === '::1' ? '[::1]' : host}:${port}` }).listen(port, host, () => {
    console.log(`NASA HQ review on http://${host}:${port}  (sign-in required)`);
    console.log(`KAST token route: gate ${cfg.enabled ? 'ON' : 'OFF'}; ELEVENLABS_API_KEY ${cfg.apiKey ? 'present' : 'MISSING'}; identity: review passcode only (not HQ identity).`);
  });
}
