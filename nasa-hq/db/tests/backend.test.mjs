// Runs the DRAFT migration in an in-process Postgres (PGlite) with SYNTHETIC records only.
// This proves the SQL logic (RLS, dedupe, versions, audit, reversibility). It does NOT prove anything
// about Supabase Auth, the live schema or Karsa's work.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const up = await readFile(new URL('../migrations/0001_nasa_hq_backend.up.sql', import.meta.url), 'utf8');
const down = await readFile(new URL('../migrations/0001_nasa_hq_backend.down.sql', import.meta.url), 'utf8');
const U = { tarek: '00000000-0000-0000-0000-00000000000a', editor: '00000000-0000-0000-0000-00000000000b', viewer: '00000000-0000-0000-0000-00000000000c', stranger: '00000000-0000-0000-0000-00000000000d' };
const ROOT = 'ROOT_HQ'; let P1, P2; let db;

async function as(role, uid) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const idx = (over = {}) => one(`select nasa_hq.index_source_file($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as r`, [
  over.root ?? ROOT, over.project ?? P1, over.file ?? 'F1', 'Brief.pdf', over.mime ?? 'application/pdf', over.anc ?? [ROOT, 'SUB'],
  over.mod ?? '2026-10-10T00:00:00Z', 'abc', 'https://drive.example/F1', over.target ?? null]).then((x) => x.r);

before(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;
    create table public.karsa_existing (id int);  -- stands in for pre-existing backend work
    insert into public.karsa_existing values (1);`);
});
beforeEach(async () => {
  await db.exec('reset role; drop schema if exists nasa_hq cascade;');
  await db.exec(up);
  P1 = (await one(`insert into nasa_hq.projects (slug, title) values ('seven', 'SEVEN') returning id`)).id;
  P2 = (await one(`insert into nasa_hq.projects (slug, title) values ('yah', 'Young & Human') returning id`)).id;
  await db.exec(`
    insert into nasa_hq.project_members values ('${P1}', '${U.tarek}', 'owner'), ('${P1}', '${U.editor}', 'editor'), ('${P1}', '${U.viewer}', 'viewer'),
      ('${P2}', '${U.tarek}', 'owner');
    insert into nasa_hq.source_roots (drive_root_id, label) values ('${ROOT}', 'NOJARA HQ');`);
});

test('non-members see nothing; viewers see project data; project scoping holds', async () => {
  await as('service_role');
  await idx({ file: 'A', project: P1 }); await idx({ file: 'B', project: P2 });
  await as('authenticated', U.stranger);
  assert.equal((await rows('select * from nasa_hq.source_files')).length, 0);
  assert.equal((await rows('select * from nasa_hq.projects')).length, 0);
  await as('authenticated', U.viewer);
  assert.deepEqual((await rows('select drive_file_id from nasa_hq.source_files')).map((r) => r.drive_file_id), ['A']);
  await as('authenticated', U.tarek);
  assert.equal((await rows('select * from nasa_hq.source_files')).length, 2);
});

test('clients cannot write tables directly or call the backend-only indexer', async () => {
  await as('authenticated', U.tarek);
  await assert.rejects(db.query(`insert into nasa_hq.context_versions (scope_key, owner_id, version, body, approved_by) values ('x', '${U.tarek}', 1, 'hi', '${U.tarek}')`), /permission denied/);
  await assert.rejects(db.query(`insert into nasa_hq.project_members values ('${P1}', '${U.stranger}', 'owner')`), /permission denied/);
  await assert.rejects(db.query(`select nasa_hq.index_source_file('${ROOT}', '${P1}', 'Z', 'n', 'application/pdf', array['${ROOT}'], now(), null, 'u')`), /permission denied/);
  await assert.rejects(db.query(`select * from nasa_hq.source_roots`), /permission denied/);
});

test('indexer: idempotent, dedupes, updates only when newer, rejects other project', async () => {
  await as('service_role');
  assert.equal((await idx()).status, 'created');
  assert.equal((await idx()).status, 'unchanged');                       // duplicate job run
  assert.equal((await idx({ mod: '2026-10-09T00:00:00Z' })).status, 'unchanged'); // older revision never overwrites
  assert.equal((await idx({ mod: '2026-10-12T00:00:00Z' })).status, 'updated');
  assert.equal((await idx({ project: P2 })).reason, 'belongs_to_other_project');
  assert.equal((await rows('select * from nasa_hq.source_files')).length, 1);
});

test('indexer rejects outside-root files, unauthorized roots and outside shortcuts; each rejection is audited', async () => {
  await as('service_role');
  assert.equal((await idx({ anc: ['OTHER_ROOT', 'X'] })).reason, 'outside_root');
  assert.equal((await idx({ root: 'UNKNOWN' })).reason, 'root_not_authorized');
  const sc = 'application/vnd.google-apps.shortcut';
  assert.equal((await idx({ file: 'S1', mime: sc, target: ['ELSEWHERE'] })).reason, 'shortcut_outside_root');
  assert.equal((await idx({ file: 'S2', mime: sc })).reason, 'shortcut_outside_root');
  assert.equal((await idx({ file: 'S3', mime: sc, target: [ROOT, 'SUB'] })).status, 'created'); // shortcut INTO the subtree is fine
  const bad = await rows(`select reason from (select detail->>'reason' as reason, ok from nasa_hq.audit_receipts) a where ok = false`);
  assert.equal(bad.length, 4);
  // table constraint is a second wall: even the backend role cannot bypass it with raw SQL
  await assert.rejects(db.query(`insert into nasa_hq.source_files (root_id, root_drive_id, project_id, drive_file_id, name, mime_type, ancestor_ids, source_url, modified_time)
    select id, drive_root_id, '${P1}', 'RAW', 'n', 'application/pdf', array['OTHER'], 'u', now() from nasa_hq.source_roots`), /inside_authorized_root/);
});

test('save_context: editors save, viewers/strangers refused, versions strictly increase', async () => {
  await as('authenticated', U.viewer);
  assert.equal((await one(`select nasa_hq.save_context('${P1}', 'v?', 0) as r`)).r.error, 'forbidden');
  await as('authenticated', U.stranger);
  assert.equal((await one(`select nasa_hq.save_context('${P1}', 'v?', 0) as r`)).r.error, 'forbidden');
  await as('authenticated', U.editor);
  assert.deepEqual((await one(`select nasa_hq.save_context('${P1}', 'first', 0) as r`)).r, { ok: true, version: 1 });
  assert.deepEqual((await one(`select nasa_hq.save_context('${P1}', 'second', 1) as r`)).r, { ok: true, version: 2 });
  assert.equal((await one(`select nasa_hq.save_context('${P1}', '   ', 2) as r`)).r.error, 'invalid');
  assert.equal((await one(`select nasa_hq.save_context('${P1}', '${'x'.repeat(1201)}', 2) as r`)).r.error, 'invalid');
});

test('version conflict: stale writer refused, nothing overwritten; latest valid context retrieved by a fresh reader', async () => {
  await as('authenticated', U.editor);
  await one(`select nasa_hq.save_context('${P1}', 'A wrote v1', 0)`);
  await as('authenticated', U.tarek);
  const stale = (await one(`select nasa_hq.save_context('${P1}', 'B stale', 0) as r`)).r;
  assert.deepEqual(stale, { ok: false, error: 'version_conflict', current: 1 });
  assert.deepEqual((await one(`select nasa_hq.save_context('${P1}', 'B retried', 1) as r`)).r, { ok: true, version: 2 });
  await as('authenticated', U.viewer);                                   // fresh session, read-only member
  const latest = await one(`select * from nasa_hq.latest_context('${P1}')`);
  assert.equal(latest.version, 2); assert.equal(latest.body, 'B retried');
  await as('authenticated', U.stranger);
  assert.equal(await one(`select * from nasa_hq.latest_context('${P1}')`), undefined);   // RLS: strangers get nothing
  // invalidating the newest falls back to the previous VALID version
  await as('authenticated', U.tarek);
  const v2 = await one(`select id from nasa_hq.context_versions where version = 2`);
  assert.equal((await one(`select nasa_hq.invalidate_context('${v2.id}') as r`)).r.ok, true);
  assert.equal((await one(`select * from nasa_hq.latest_context('${P1}')`)).body, 'A wrote v1'); // falls back to v1
});

test('handoffs: editors create idempotently, duplicates return the same row, stale updates refused, viewers cannot write', async () => {
  await as('authenticated', U.viewer);
  assert.equal((await one(`select nasa_hq.create_handoff('${P1}', 'katib', 'musa', 't', 'b', 'k1') as r`)).r.error, 'forbidden');
  await as('authenticated', U.editor);
  const a = (await one(`select nasa_hq.create_handoff('${P1}', 'katib', 'musa', 'Copy to imagery', 'b', 'k1') as r`)).r;
  const b = (await one(`select nasa_hq.create_handoff('${P1}', 'katib', 'musa', 'Copy to imagery', 'b', 'k1') as r`)).r;
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true); assert.equal(a.id, b.id);
  assert.equal((await rows('select * from nasa_hq.handoffs')).length, 1);
  assert.deepEqual((await one(`select nasa_hq.update_handoff('${a.id}', 1, 'accepted') as r`)).r, { ok: true, version: 2 });
  assert.equal((await one(`select nasa_hq.update_handoff('${a.id}', 1, 'done') as r`)).r.error, 'version_conflict');
  assert.equal((await one(`select status from nasa_hq.handoffs`)).status, 'accepted');
});

test('audit receipts are append-only for everyone, and readable only by actor or project owner', async () => {
  await as('authenticated', U.editor);
  await one(`select nasa_hq.save_context('${P1}', 'x', 0)`);
  assert.equal((await rows('select * from nasa_hq.audit_receipts')).length, 1);
  await as('authenticated', U.viewer);
  assert.equal((await rows('select * from nasa_hq.audit_receipts')).length, 0);
  await as('authenticated', U.tarek);
  assert.equal((await rows('select * from nasa_hq.audit_receipts')).length, 1);   // owner of the project sees the editor's receipt
  await as('service_role');
  await assert.rejects(db.query('update nasa_hq.audit_receipts set ok = false'), /append-only/);
  await assert.rejects(db.query('delete from nasa_hq.audit_receipts'), /append-only/);
  await assert.rejects(db.query('truncate nasa_hq.audit_receipts'), /append-only/);
});

test('reversible: down removes only nasa_hq, pre-existing tables untouched, up re-applies cleanly', async () => {
  await db.exec('reset role;');
  await db.exec(down);
  assert.equal((await rows(`select 1 from information_schema.schemata where schema_name = 'nasa_hq'`)).length, 0);
  assert.equal((await one('select count(*)::int as n from public.karsa_existing')).n, 1);
  await db.exec(up);
  assert.equal((await rows(`select 1 from information_schema.tables where table_schema = 'nasa_hq'`)).length, 8);
});
