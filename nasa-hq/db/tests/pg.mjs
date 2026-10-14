// Starts a REAL PostgreSQL (embedded-postgres binaries) in a temp dir on a unix socket, so tests exercise genuine
// roles, RLS and concurrent connections. Runs as a non-root user when invoked as root (initdb refuses root).
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, chownSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const native = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'node_modules', '@embedded-postgres', `${process.platform}-${process.arch}`, 'native', 'bin');
const asRoot = process.getuid?.() === 0;
const user = process.env.PGTEST_USER ?? 'pgtest';


export async function startPostgres() {
  const dir = mkdtempSync(join(tmpdir(), 'nasa-hq-pg-'));
  let ids = {};
  if (asRoot) {
    try { execFileSync('id', [user]); } catch { execFileSync('useradd', ['-m', user]); }
    ids = { uid: Number(execFileSync('id', ['-u', user]).toString()), gid: Number(execFileSync('id', ['-g', user]).toString()) };
    chownSync(dir, ids.uid, ids.gid);
  }
  const data = join(dir, 'data'); const sock = join(dir, 'sock');
  execFileSync(join(native, 'initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8'], { stdio: 'pipe', ...ids });
  execFileSync('mkdir', ['-p', sock], ids);
  const proc = spawn(join(native, 'postgres'), ['-D', data, '-c', 'listen_addresses=', '-c', `unix_socket_directories=${sock}`, '-c', 'fsync=off', '-c', 'max_connections=60'], { stdio: 'ignore', ...ids });
  const conn = { host: sock, port: 5432, user: 'postgres', database: 'postgres' };
  for (let i = 0; i < 80; i++) {
    try { const t = new pg.Client(conn); await t.connect(); await t.end(); break; } catch { await new Promise((r) => setTimeout(r, 150)); }
    if (i === 79) throw new Error('postgres did not start');
  }
  const version = (await (async () => { const t = new pg.Client(conn); await t.connect(); const r = await t.query('show server_version'); await t.end(); return r.rows[0].server_version; })());
  return { conn, version, async stop() { proc.kill('SIGINT'); await new Promise((r) => proc.once('exit', r)); rmSync(dir, { recursive: true, force: true }); } };
}
export const connect = async (conn) => { const c = new pg.Client(conn); await c.connect(); return c; };
