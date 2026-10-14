// REAL PostgreSQL, SYNTHETIC rows. Proves SQL logic, RLS, grants and concurrent-writer behaviour for the CANDIDATE migration.
// Does NOT prove: Supabase Auth JWTs, the live schema, Karsa's foundation, or Drive. auth.uid() is shimmed from a GUC.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startPostgres, connect } from './pg.mjs';

const up = await readFile(process.env.MIGRATION_UP ?? new URL('../migrations/0001_nasa_hq_backend.up.sql', import.meta.url), 'utf8');
const down = await readFile(new URL('../migrations/0001_nasa_hq_backend.down.sql', import.meta.url), 'utf8');
const U = { tarek: '00000000-0000-0000-0000-00000000000a', editor: '00000000-0000-0000-0000-00000000000b', viewer: '00000000-0000-0000-0000-00000000000c', stranger: '00000000-0000-0000-0000-00000000000d', editor2: '00000000-0000-0000-0000-00000000000e' };
const ROOT = 'ROOT_HQ', ACCT = 'acct-1', SC = 'application/vnd.google-apps.shortcut';
let server, su, P1, P2;

before(async () => {
  server = await startPostgres();
  su = await connect(server.conn);
  await su.query(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;
    create table public.karsa_existing (id int); insert into public.karsa_existing values (1);`);
  console.log(`# postgres ${server.version} (embedded, real)`);
});
after(async () => { await su?.end(); await server?.stop(); });
beforeEach(async () => {
  await su.query('reset role; drop schema if exists nasa_hq cascade;');
  await su.query(up);
  P1 = (await su.query(`insert into nasa_hq.projects (slug, title) values ('seven', 'SEVEN') returning id`)).rows[0].id;
  P2 = (await su.query(`insert into nasa_hq.projects (slug, title) values ('yah', 'Young & Human') returning id`)).rows[0].id;
  await su.query(`
    insert into nasa_hq.project_members values ('${P1}', '${U.tarek}', 'owner'), ('${P1}', '${U.editor}', 'editor'), ('${P1}', '${U.editor2}', 'editor'), ('${P1}', '${U.viewer}', 'viewer'), ('${P2}', '${U.tarek}', 'owner');
    insert into nasa_hq.source_roots (drive_root_id, account_id, label) values ('${ROOT}', '${ACCT}', 'NOJARA HQ');`);
});

async function as(client, role, uid) { await client.query('reset role'); await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']); await client.query(`set role ${role}`); return client; }
const one = async (c, sql, p) => (await c.query(sql, p)).rows[0];
const rows = async (c, sql, p) => (await c.query(sql, p)).rows;
const J = async (c, sql, p) => Object.values(await one(c, sql, p))[0];
const idx = (c, o = {}) => J(c, `select nasa_hq.index_source_file($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11::text[],null,$12)`, [
  o.root ?? ROOT, o.acct ?? ACCT, o.project ?? P1, o.file ?? 'F1', 'Brief.pdf', o.mime ?? 'application/pdf', 'anc' in o ? o.anc : [ROOT, 'SUB'],
  o.mod ?? '2026-10-10T00:00:00Z', 'abc', 'https://drive.example/' + (o.file ?? 'F1'), o.target ?? null, o.cls ?? 'project']);
const svc = async () => as(await connect(server.conn), 'service_role');
const audits = async (action, ok) => (await rows(su, `select * from nasa_hq.audit_receipts where action = $1 ${ok === undefined ? '' : 'and ok = ' + ok}`, [action])).length;

// ---------------- reported fixes: NULL ancestry ----------------
test('NULL / empty / NULL-element / rootless ancestry is rejected by the indexer, never indexed', async () => {
  const c = await svc();
  for (const anc of [null, [], [null], [null, null], ['OTHER'], [ROOT.toLowerCase()]]) {
    const r = await idx(c, { anc, file: 'N' + JSON.stringify(anc) });
    assert.equal(r.status, 'rejected', JSON.stringify(anc)); assert.match(r.reason, /invalid_ancestry|outside_root/);
  }
  assert.equal((await rows(su, 'select * from nasa_hq.source_files')).length, 0);
  assert.equal(await audits('index_source_file', false), 6);
  await c.end();
});
test('table CHECKs are a second wall: raw rows with NULL ancestry or NULL shortcut target are refused', async () => {
  const rid = (await one(su, 'select id from nasa_hq.source_roots')).id;
  const ins = (anc, mime = 'application/pdf', tgt = null) => su.query(`insert into nasa_hq.source_files (root_id, root_drive_id, account_id, project_id, drive_file_id, name, mime_type, ancestor_ids, shortcut_target_ancestor_ids, source_url, modified_time)
    values ($1, $2, $3, $4, 'RAW' || md5(random()::text), 'n', $5, $6::text[], $7::text[], 'u', now())`, [rid, ROOT, ACCT, P1, mime, anc, tgt]);
  await assert.rejects(ins([null]), /inside_authorized_root/);
  await assert.rejects(ins([]), /inside_authorized_root/);
  await assert.rejects(ins(['X']), /inside_authorized_root/);
  await assert.rejects(ins([ROOT], SC, [null]), /shortcut_inside_root/);
  await assert.rejects(ins([ROOT], SC, null), /shortcut_inside_root/);
  await ins([ROOT, 'a']);                                   // positive control: a real subtree file is accepted
  await assert.rejects(su.query(`insert into nasa_hq.source_files (root_id, root_drive_id, account_id, project_id, drive_file_id, name, mime_type, ancestor_ids, source_url, modified_time)
    values ($1, 'FORGED', $2, $3, 'forge', 'n', 'application/pdf', array['FORGED'], 'u', now())`, [rid, ACCT, P1]), /foreign key|violates/);   // root_id/root_drive_id tied together
});

// ---------------- reported fixes: revocation and visibility ----------------
test('a file that moves outside the root is revoked and disappears from clients at once', async () => {
  const c = await svc();
  assert.equal((await idx(c)).status, 'created');
  const v = await as(await connect(server.conn), 'authenticated', U.viewer);
  assert.equal((await rows(v, 'select * from nasa_hq.source_files')).length, 1);
  assert.equal((await idx(c, { anc: ['SOMEWHERE_ELSE'], mod: '2026-10-11T00:00:00Z' })).reason, 'outside_root');
  assert.equal((await one(su, 'select status from nasa_hq.source_files')).status, 'revoked');
  assert.equal((await rows(v, 'select * from nasa_hq.source_files')).length, 0);
  assert.equal((await idx(c, { mod: '2026-10-12T00:00:00Z' })).status, 'reinstated');      // returns inside the root: visible again, revision 2
  assert.equal((await rows(v, 'select * from nasa_hq.source_files')).length, 1);
  assert.equal((await rows(su, 'select revision from nasa_hq.source_revisions order by revision')).map((r) => r.revision).join(), '1,2');
  await v.end(); await c.end();
});
test('disabling a root hides its files immediately and re-enabling restores them; shortcut target moves revoke', async () => {
  const c = await svc(); await idx(c); await idx(c, { file: 'S', mime: SC, target: [ROOT, 'T'] });
  const v = await as(await connect(server.conn), 'authenticated', U.viewer);
  assert.equal((await rows(v, 'select * from nasa_hq.source_files')).length, 2);
  await J(c, `select nasa_hq.set_root_enabled($1, false)`, [ROOT]);
  assert.equal((await rows(v, 'select * from nasa_hq.source_files')).length, 0);
  assert.equal((await idx(c, { mod: '2026-10-13T00:00:00Z' })).reason, 'root_disabled');
  await J(c, `select nasa_hq.set_root_enabled($1, true)`, [ROOT]);
  assert.equal((await rows(v, 'select drive_file_id from nasa_hq.source_files where drive_file_id = $1', ['F1'])).length, 0);   // revoked by the disabled-root rejection
  assert.equal((await idx(c, { file: 'S', mime: SC, target: ['ELSEWHERE'], mod: '2026-10-14T00:00:00Z' })).reason, 'shortcut_outside_root');
  assert.equal((await rows(v, 'select * from nasa_hq.source_files where drive_file_id = $1', ['S'])).length, 0);
  await v.end(); await c.end();
});
test('observed metadata is private by default; restricted files need an explicit grant; strangers see nothing', async () => {
  const c = await svc();
  await idx(c, { file: 'PRIV', cls: 'private_review' }); await idx(c, { file: 'PROJ', cls: 'project' }); await idx(c, { file: 'RESTR', cls: 'restricted' });
  const seen = async (uid) => { const x = await as(await connect(server.conn), 'authenticated', uid); const r = (await rows(x, 'select drive_file_id from nasa_hq.source_files order by 1')).map((q) => q.drive_file_id); await x.end(); return r.join(); };
  assert.equal(await seen(U.viewer), 'PROJ'); assert.equal(await seen(U.tarek), 'PROJ'); assert.equal(await seen(U.stranger), '');
  await su.query(`insert into nasa_hq.source_file_grants select id, '${U.viewer}' from nasa_hq.source_files where drive_file_id = 'RESTR'`);
  assert.equal(await seen(U.viewer), 'PROJ,RESTR'); assert.equal(await seen(U.editor), 'PROJ');
  await c.end();
});

// ---------------- reported fixes: save_context boundaries ----------------
test('NULL / negative expected version is invalid and audited; no version is created', async () => {
  const c = await as(await connect(server.conn), 'authenticated', U.editor);
  for (const e of [null, -1]) assert.equal((await J(c, `select nasa_hq.save_context($1, 'x', $2::int)`, [P1, e])).error, 'invalid');
  assert.equal((await rows(su, 'select * from nasa_hq.context_versions')).length, 0);
  assert.equal(await audits('save_context', false), 2);
  assert.equal((await J(c, `select nasa_hq.save_context($1, 'ok', 0)`, [P1])).version, 1);
  await c.end();
});
test('conversation ownership: another user\'s or another project\'s conversation cannot be attached', async () => {
  const a = await as(await connect(server.conn), 'authenticated', U.editor);
  const b = await as(await connect(server.conn), 'authenticated', U.editor2);
  const t = await as(await connect(server.conn), 'authenticated', U.tarek);
  const mine = (await J(a, `select nasa_hq.create_conversation($1)`, [P1])).id;
  const other = (await J(b, `select nasa_hq.create_conversation($1)`, [P1])).id;
  const p2conv = (await J(t, `select nasa_hq.create_conversation($1)`, [P2])).id;
  assert.equal((await J(a, `select nasa_hq.save_context($1, 'x', 0, $2)`, [P1, other])).error, 'forbidden');
  assert.equal((await J(t, `select nasa_hq.save_context($1, 'x', 0, $2)`, [P1, p2conv])).error, 'forbidden');
  assert.equal((await J(a, `select nasa_hq.save_context($1, 'x', 0, $2)`, [P1, '11111111-1111-1111-1111-111111111111'])).error, 'forbidden');
  assert.equal((await J(a, `select nasa_hq.save_context($1, 'x', 0, $2)`, [P1, mine])).ok, true);
  assert.equal((await rows(su, 'select * from nasa_hq.context_versions')).length, 1);
  assert.equal(await audits('save_context', false), 3);
  await a.end(); await b.end(); await t.end();
});
test('a removed editor can no longer save or invalidate context; a current owner can', async () => {
  const e = await as(await connect(server.conn), 'authenticated', U.editor);
  await J(e, `select nasa_hq.save_context($1, 'v1', 0)`, [P1]);
  const id = (await one(su, 'select id from nasa_hq.context_versions')).id;
  await su.query(`delete from nasa_hq.project_members where user_id = '${U.editor}' and project_id = '${P1}'`);
  assert.equal((await J(e, `select nasa_hq.invalidate_context($1)`, [id])).error, 'forbidden');
  assert.equal((await J(e, `select nasa_hq.save_context($1, 'v2', 1)`, [P1])).error, 'forbidden');
  assert.equal((await one(su, 'select status from nasa_hq.context_versions')).status, 'approved');
  const t = await as(await connect(server.conn), 'authenticated', U.tarek);
  assert.equal((await J(t, `select nasa_hq.invalidate_context($1)`, [id])).ok, true);
  assert.equal(await audits('invalidate_context', false), 1);
  await e.end(); await t.end();
});
test('version conflict, latest-valid retrieval by a fresh reader, invalidation fallback, stranger isolation', async () => {
  const e = await as(await connect(server.conn), 'authenticated', U.editor); const t = await as(await connect(server.conn), 'authenticated', U.tarek);
  await J(e, `select nasa_hq.save_context($1, 'A wrote v1', 0)`, [P1]);
  assert.deepEqual(await J(t, `select nasa_hq.save_context($1, 'B stale', 0)`, [P1]), { ok: false, error: 'version_conflict', current: 1 });
  assert.equal((await J(t, `select nasa_hq.save_context($1, 'B retried', 1)`, [P1])).version, 2);
  const v = await as(await connect(server.conn), 'authenticated', U.viewer);
  assert.equal((await one(v, 'select * from nasa_hq.latest_context($1)', [P1])).body, 'B retried');
  const s = await as(await connect(server.conn), 'authenticated', U.stranger);
  assert.equal(await one(s, 'select * from nasa_hq.latest_context($1)', [P1]), undefined);
  const v2 = (await one(su, 'select id from nasa_hq.context_versions where version = 2')).id;
  await J(t, `select nasa_hq.invalidate_context($1)`, [v2]);
  assert.equal((await one(v, 'select * from nasa_hq.latest_context($1)', [P1])).body, 'A wrote v1');
  for (const x of [e, t, v, s]) await x.end();
});

// ---------------- reported fixes: true concurrency (separate connections) ----------------
test('CONCURRENT savers with the same expected version: exactly one wins, the rest get version_conflict', async () => {
  const cs = []; for (let i = 0; i < 8; i++) cs.push(await as(await connect(server.conn), 'authenticated', i % 2 ? U.editor : U.editor2));
  const res = await Promise.all(cs.map((c, i) => J(c, `select nasa_hq.save_context($1, $2, 0)`, [P1, 'writer ' + i])));
  assert.equal(res.filter((r) => r.ok).length, 1); assert.equal(res.filter((r) => r.error === 'version_conflict').length, 7);
  assert.equal((await rows(su, 'select * from nasa_hq.context_versions')).length, 1);
  assert.equal((await one(su, 'select last_version from nasa_hq.context_scopes')).last_version, 1);
  for (const c of cs) await c.end();
});
test('CONCURRENT ingestion of revisions in shuffled order: newest wins, history is complete and gap-free, no duplicate rows', async () => {
  const mods = Array.from({ length: 12 }, (_, i) => `2026-10-${String(10 + i).padStart(2, '0')}T00:00:00Z`).sort(() => Math.random() - 0.5);
  const cs = []; for (let i = 0; i < mods.length; i++) cs.push(await svc());
  await Promise.all(cs.map((c, i) => idx(c, { mod: mods[i] })));
  const f = await rows(su, 'select * from nasa_hq.source_files'); assert.equal(f.length, 1);
  assert.equal(new Date(f[0].modified_time).toISOString(), '2026-10-21T00:00:00.000Z');
  const revs = (await rows(su, 'select revision, modified_time from nasa_hq.source_revisions order by revision'));
  assert.deepEqual(revs.map((r) => r.revision), revs.map((_, i) => i + 1));                         // no gaps
  assert.equal(f[0].revision, revs.length);
  const mt = revs.map((r) => +new Date(r.modified_time)); assert.deepEqual(mt, [...mt].sort((a, b) => a - b)); // each recorded revision is newer than the last
  for (const c of cs) await c.end();
});
test('CONCURRENT ingestion of one file for two projects: exactly one project owns it; duplicate handoff keys collapse', async () => {
  const cs = []; for (let i = 0; i < 6; i++) cs.push(await svc());
  const res = await Promise.all(cs.map((c, i) => idx(c, { project: i % 2 ? P1 : P2, file: 'SHARED' })));
  assert.equal(res.filter((r) => r.status === 'created').length, 1);
  assert.ok(res.every((r) => r.status === 'created' || r.reason === 'belongs_to_other_project' || r.status === 'unchanged'));
  assert.equal((await rows(su, `select * from nasa_hq.source_files where drive_file_id = 'SHARED'`)).length, 1);
  const es = []; for (let i = 0; i < 6; i++) es.push(await as(await connect(server.conn), 'authenticated', U.editor));
  const hs = await Promise.all(es.map((c) => J(c, `select nasa_hq.create_handoff($1, 'katib', 'musa', 'Copy', 'b', 'same-key')`, [P1])));
  assert.equal(hs.filter((h) => h.duplicate === false).length, 1); assert.equal((await rows(su, 'select * from nasa_hq.handoffs')).length, 1);
  for (const c of [...cs, ...es]) await c.end();
});

// ---------------- handoffs, audit, retention, grants, reversibility ----------------
test('handoffs: NULL/stale/unauthorised paths all refused and audited; viewers cannot write', async () => {
  const v = await as(await connect(server.conn), 'authenticated', U.viewer); const e = await as(await connect(server.conn), 'authenticated', U.editor);
  assert.equal((await J(v, `select nasa_hq.create_handoff($1, 'a', 'b', 't', 'b', 'k')`, [P1])).error, 'forbidden');
  const h = await J(e, `select nasa_hq.create_handoff($1, 'katib', 'musa', 'Copy', 'b', 'k1')`, [P1]);
  assert.equal((await J(e, `select nasa_hq.create_handoff($1, 'katib', 'musa', 'Copy', 'b', 'k1')`, [P1])).duplicate, true);
  assert.equal((await J(e, `select nasa_hq.update_handoff($1, null::int, 'done')`, [h.id])).error, 'invalid');
  assert.equal((await J(e, `select nasa_hq.update_handoff($1, 1, 'bogus')`, [h.id])).error, 'invalid');
  assert.equal((await J(v, `select nasa_hq.update_handoff($1, 1, 'done')`, [h.id])).error, 'forbidden');
  assert.equal((await J(e, `select nasa_hq.update_handoff($1, 1, 'accepted')`, [h.id])).version, 2);
  assert.equal((await J(e, `select nasa_hq.update_handoff($1, 1, 'done')`, [h.id])).error, 'version_conflict');
  assert.equal(await audits('create_handoff'), 3); assert.equal(await audits('update_handoff'), 5);
  await v.end(); await e.end();
});
test('every function writes a receipt on every refusal path, including unauthenticated callers', async () => {
  const anon = await as(await connect(server.conn), 'authenticated', '');
  assert.equal((await J(anon, `select nasa_hq.save_context($1, 'x', 0)`, [P1])).error, 'unauthenticated');
  assert.equal((await J(anon, `select nasa_hq.invalidate_context('11111111-1111-1111-1111-111111111111')`)).error, 'unauthenticated');
  assert.equal((await J(anon, `select nasa_hq.create_conversation($1)`, [P1])).error, 'unauthenticated');
  assert.equal(await audits('save_context', false), 1); assert.equal(await audits('invalidate_context', false), 1); assert.equal(await audits('create_conversation', false), 1);
  await anon.end();
});
test('audit receipts are append-only, with owner/actor-scoped reads', async () => {
  const e = await as(await connect(server.conn), 'authenticated', U.editor); await J(e, `select nasa_hq.save_context($1, 'x', 0)`, [P1]);
  const v = await as(await connect(server.conn), 'authenticated', U.viewer); const t = await as(await connect(server.conn), 'authenticated', U.tarek);
  assert.equal((await rows(v, 'select * from nasa_hq.audit_receipts')).length, 0); assert.equal((await rows(t, 'select * from nasa_hq.audit_receipts')).length, 1);
  for (const sql of ['update nasa_hq.audit_receipts set ok = false', 'delete from nasa_hq.audit_receipts', 'truncate nasa_hq.audit_receipts'])
    await assert.rejects(su.query(sql), /append-only/);
  for (const c of [e, v, t]) await c.end();
});
test('retention: purge removes only expired rows; a purged version number is never reused; unexpired audit survives', async () => {
  const e = await as(await connect(server.conn), 'authenticated', U.editor); await J(e, `select nasa_hq.save_context($1, 'v1', 0)`, [P1]);
  await su.query(`update nasa_hq.context_versions set retain_until = now() - interval '1 day'`);
  assert.equal(await one(e, 'select * from nasa_hq.latest_context($1)', [P1]), undefined);               // expired data is not served even before purge
  const s = await svc(); const p = await J(s, 'select nasa_hq.purge_expired()');
  assert.equal(p.contexts, 1); assert.equal(p.audit, 0);
  assert.equal((await J(e, `select nasa_hq.save_context($1, 'again', 0)`, [P1])).error, 'version_conflict');  // counter survived the purge
  assert.equal((await J(e, `select nasa_hq.save_context($1, 'again', 1)`, [P1])).version, 2);
  await su.query(`update nasa_hq.audit_receipts set retain_until = now() - interval '1 day'` ).catch(() => {});  // updates are blocked: expected to fail
  await su.query(`alter table nasa_hq.audit_receipts disable trigger audit_guard_row; update nasa_hq.audit_receipts set retain_until = now() - interval '1 day' where id = (select min(id) from nasa_hq.audit_receipts); alter table nasa_hq.audit_receipts enable trigger audit_guard_row;`);
  const before = (await rows(su, 'select * from nasa_hq.audit_receipts')).length;
  assert.equal((await J(s, 'select nasa_hq.purge_expired()')).audit, 1);
  assert.equal((await rows(su, 'select * from nasa_hq.audit_receipts')).length, before - 1 + 1);            // one purged, one purge receipt written
  await assert.rejects(su.query('delete from nasa_hq.audit_receipts'), /append-only/);                        // outside purge_expired nothing deletes
  await e.end(); await s.end();
});
test('grants were not expanded: anon has nothing, clients cannot write tables or call service functions, service has no table access', async () => {
  const a = await as(await connect(server.conn), 'anon', U.tarek);
  await assert.rejects(a.query('select * from nasa_hq.projects'), /permission denied/);
  const t = await as(await connect(server.conn), 'authenticated', U.tarek);
  await assert.rejects(t.query(`insert into nasa_hq.project_members values ('${P1}', '${U.stranger}', 'owner')`), /permission denied/);
  await assert.rejects(t.query(`insert into nasa_hq.context_versions (scope_key, owner_id, version, body, approved_by) values ('x', '${U.tarek}', 1, 'hi', '${U.tarek}')`), /permission denied/);
  await assert.rejects(t.query(`select nasa_hq.index_source_file('${ROOT}', '${ACCT}', '${P1}', 'Z', 'n', 'application/pdf', array['${ROOT}'], now(), null, 'u')`), /permission denied/);
  await assert.rejects(t.query('select nasa_hq.purge_expired()'), /permission denied/);
  await assert.rejects(t.query('select * from nasa_hq.source_roots'), /permission denied/);
  const s = await svc();
  for (const sql of ['select * from nasa_hq.source_files', 'insert into nasa_hq.source_files (root_id) values (null)', 'delete from nasa_hq.audit_receipts', 'select * from nasa_hq.context_versions'])
    await assert.rejects(s.query(sql), /permission denied/, sql);
  for (const c of [a, t, s]) await c.end();
});
test('down refuses to drop populated data unless explicitly overridden; empty fixture drops cleanly; Karsa-owned tables untouched; up re-applies', async () => {
  await su.query('reset role');
  const c = await svc(); await idx(c); await c.end();
  await assert.rejects(su.query(down), /refusing destructive down/);
  assert.equal((await rows(su, `select 1 from information_schema.schemata where schema_name = 'nasa_hq'`)).length, 1);
  await su.query(`set nasa_hq.confirm_destructive_down = 'yes_drop_fixture'`); await su.query(down); await su.query(`reset nasa_hq.confirm_destructive_down`);
  assert.equal((await rows(su, `select 1 from information_schema.schemata where schema_name = 'nasa_hq'`)).length, 0);
  assert.equal((await one(su, 'select count(*)::int as n from public.karsa_existing')).n, 1);
  await su.query(up); await su.query(down);                                                                   // empty: no override needed
  await su.query(up);
  assert.equal((await rows(su, `select 1 from information_schema.tables where table_schema = 'nasa_hq'`)).length, 11);
});
