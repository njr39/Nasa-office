// Review server: static files + the guarded KAST session route. Binds to loopback unless explicitly overridden.
// With no identity adapter wired, every token request is refused (401). That is intentional.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTokenHandler, readConfig, denyAllAuth } from './token-route.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const SECURITY = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-cache' };

export function createServer({ env = process.env, auth = denyAllAuth, fetchImpl = fetch, audit = (e) => console.log(JSON.stringify({ kast_token: e })), now } = {}) {
  const handler = createTokenHandler({ config: readConfig(env), auth, fetchImpl, audit, ...(now ? { now } : {}) });
  return http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/api/elevenlabs/session') return handler(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); return res.end(); }
    const clean = normalize(path).replace(/^(\.\.[/\\])+/, '');
    const name = clean === '/' ? '/index.html' : clean;
    try {
      const file = await readFile(join(root, name));
      res.writeHead(200, { ...SECURITY, 'content-type': types[extname(name)] ?? 'application/octet-stream' }); res.end(file);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}

export function resolveBind(env = process.env) {
  const host = env.HOST ?? '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && env.NASA_HQ_ALLOW_NON_LOOPBACK !== 'true') throw new Error(`Refusing to bind ${host}: set NASA_HQ_ALLOW_NON_LOOPBACK=true only behind an authenticated proxy.`);
  return { host, port: Number(env.PORT ?? 4530) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { host, port } = resolveBind();
  const cfg = readConfig();
  createServer().listen(port, host, () => console.log(`NASA HQ review on http://${host}:${port}. KAST token route: ${cfg.enabled ? 'gate ON' : 'gate OFF (default)'}; identity adapter: none (all token requests refused).`));
}
