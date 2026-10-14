// Runs every automated suite and records counts with the environment. REPORTED by the author; not independently run.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const run = (name, args) => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 600000 });
  const n = (k) => Number((r.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm')) ?? [])[1] ?? NaN);
  const pgv = (r.stdout.match(/^# postgres ([\d.]+)/m) ?? [])[1];
  return { suite: name, tests: n('tests'), pass: n('pass'), fail: n('fail'), exit: r.status, ...(pgv ? { postgres: pgv } : {}) };
};
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const hash = (f) => { try { return createHash('sha256').update(readFileSync(f)).digest('hex'); } catch { return null; } };
const suites = [
  run('core + tools + controller + server (node:test)', ['--test', '--test-force-exit', 'tests/core.test.ts', 'tests/controller.test.ts', 'tests/server.test.mjs']),
  (() => { const r = spawnSync(process.execPath, ['scripts/hook-tests.mjs'], { encoding: 'utf8', timeout: 600000 }); const pass = (r.stdout.match(/^✓/gm) ?? []).length, fail = (r.stdout.match(/^✗/gm) ?? []).length; return { suite: 'useKast hook under React StrictMode with a fake SDK (Chromium)', tests: pass + fail, pass, fail, exit: r.status }; })(),
  run('backend candidate SQL on real PostgreSQL', ['--test', '--test-force-exit', '--test-timeout=90000', 'db/tests/backend.test.mjs']),
];
const out = {
  ranAt: new Date().toISOString(), kind: 'REPORTED by the author; not independently run; no live provider, Supabase or Drive involved',
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, packages: Object.fromEntries(['@elevenlabs/client', 'react', 'three', 'embedded-postgres', 'pg', 'playwright-core', 'typescript', 'esbuild'].map((k) => [k, lock.packages[`node_modules/${k}`]?.version ?? pkg.dependencies?.[k] ?? pkg.devDependencies?.[k]])) },
  suites,
  postgres: spawnSync(`node_modules/@embedded-postgres/${process.platform}-${process.arch}/native/bin/postgres`, ['--version'], { encoding: 'utf8' }).stdout?.trim() ?? null,
  artifacts: { 'dist/app.js': hash('dist/app.js'), 'dist/artifact.html': hash('dist/artifact.html'), 'package-lock.json': hash('package-lock.json'), 'db/migrations/0001_nasa_hq_backend.up.sql': hash('db/migrations/0001_nasa_hq_backend.up.sql'), 'db/migrations/0002_candidate_access_grants.NOT_FOR_ACTIVATION.sql': hash('db/migrations/0002_candidate_access_grants.NOT_FOR_ACTIVATION.sql') },
};
writeFileSync('docs/test-receipts.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ suites, artifacts: out.artifacts }, null, 2));
if (suites.some((s) => s.exit !== 0 || s.fail !== 0)) process.exit(1);
