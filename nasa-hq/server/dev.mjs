// Review server: static files + the private KAST session route.
// ELEVENLABS_API_KEY is read from the environment only. It is never sent to the browser.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const AGENT_ID = 'agent_7501ky1tjmrzf4xa67v0zsqzz9hf';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

export function createServer({ fetchImpl = fetch, env = process.env } = {}) {
  return http.createServer(async (req, res) => {
    if (req.url === '/api/elevenlabs/session' && req.method === 'POST') {
      const key = env.ELEVENLABS_API_KEY;
      if (!key) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'not_configured' })); }
      try {
        // Only the original KAST agent id is allowed; the client cannot choose another.
        const r = await fetchImpl(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`, { headers: { 'xi-api-key': key } });
        if (!r.ok) { res.writeHead(502, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'upstream', status: r.status })); }
        const { token } = await r.json();
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({ conversationToken: token }));
      } catch { res.writeHead(502, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'upstream_unreachable' })); }
    }
    const p = normalize(new URL(req.url, 'http://x').pathname).replace(/^(\.\.[/\\])+/, '');
    try {
      const name = p === '/' ? '/index.html' : p;
      const file = await readFile(join(root, name));
      res.writeHead(200, { 'content-type': types[extname(name)] ?? 'application/octet-stream' }); res.end(file);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4530);
  createServer().listen(port, () => console.log(`NASA HQ review on http://localhost:${port} (KAST ${process.env.ELEVENLABS_API_KEY ? 'token route ENABLED' : 'not configured: set ELEVENLABS_API_KEY'})`));
}
