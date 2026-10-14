// REAL PostgreSQL, SYNTHETIC rows. Proves SQL logic, RLS and concurrent-writer behaviour for the CANDIDATE migration.
// Does NOT prove: Supabase Auth JWTs, the live schema, the canonical prepared nasa_hq package, owner/BYPASSRLS behaviour of the
// real database, or Drive. auth.uid() is shimmed from a setting. The grants file is test scaffolding, not an activation decision.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startPostgres, connect } from './pg.mjs';

const read = (f) => readFile(new URL(`../migrations/${f}`, import.meta.url), 'utf8');
const up = await (process.env.MIGRATION_UP ? readFile(process.env.MIGRATION_UP, 'utf8') : read('0001_nasa_hq_backend.up.sql'));
const grants = await read('0002_candidate_access_grants.NOT_FOR_ACTIVATION.sql');
const down = await read('0001_nasa_hq_backend.down.sql');
const U = { tarek: '00000000-0000-0000-0000-00000000000a', editor: '00000000-0000-0000-0000-00000000000b', viewer: '00000000-0000-0000-0000-00000000000c', stranger: '00000000-0000-0000-0000-00000000000d', editor2: '00000000-0000-0000-0000-00000000000e' };
const ROOT = 'ROOT_HQ', ACCT = 'acct-1', SC = 'application/vnd.google-apps.shortcut';
const T = (n) => `2026-09-${String(10 + n).padStart(2, '0')}T00:00:00Z`;   // T(0) < T(1) < ...
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

async function fresh({ withGrants = true } = {}) {
  await su.query('reset role; drop schema if exists nasa_hq cascade;');
  await su.query(up); if (withGrants) await su.query(grants);
  P1 = (await su.query(`insert into nasa_hq.projects (slug, title) values ('seven', 'SEVEN') returning id`)).rows[0].id;
  P2 = (await su.query(`insert into nasa_hq.projects (slug, title) values ('yah', 'Young & Human') returning id`)).rows[0].id;
  await su.query(`
    insert into nasa_hq.project_members values ('${P1}', '${U.tarek}', 'owner'), ('${P1}', '${U.editor}', 'editor'), ('${P1}', '${U.editor2}', 'editor'), ('${P1}', '${U.viewer}', 'viewer'), ('${P2}', '${U.tarek}', 'owner');
    insert into nasa_hq.source_roots (drive_root_id, account_id, label) values ('${ROOT}', '${ACCT}', 'NOJARA HQ');`);
}
beforeEach(() => fresh());

async function as(client, role, uid) { await client.query('reset role'); await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']); await client.query(`set role ${role}`); return client; }
const one = async (c, sql, p) => (await c.query(sql, p)).rows[0];
const rows = async (c, sql, p) => (await c.query(sql, p)).rows;
const J = async (c, sql, p) => Object.values(await one(c, sql, p))[0];
/** index one observation. modified/observed default to T(0). */
const idx = (c, o = {}) => J(c, `select nasa_hq.index_source_file($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11,$12::text[],null,$13)`, [
  o.root ?? ROOT, o.acct ?? ACCT, 'project' in o ? o.project : P1, 'file' in o ? o.file : 'F1', 'Brief.pdf', o.mime ?? 'application/pdf', 'anc' in o ? o.anc : [ROOT, 'SUB'],
  o.mod ?? T(0), 'obs' in o ? o.obs : (o.mod ?? T(0)), 'abc', 'https://drive.example/' + (o.file ?? 'F1'), o.target ?? null, 'cls' in o ? o.cls : 'project']);
const svc = async () => as(await connect(server.conn), 'service_role');
const authed = (uid) => connect(server.conn).then((c) => as(c, 'authenticated', uid));
const seen = async (uid) => { const x = await authed(uid); const r = (await rows(x, 'select drive_file_id from nasa_hq.source_files order by 1')).map((q) => q.drive_file_id); await x.end(); return r.join(); };
const save = (c, project, body, exp, conv = null, synth = undefined, consent = null) => J(c, `select nasa_hq.save_context($1, $2, $3::int, $4::uuid, $5::boolean, $6)`, [project, body, exp, conv, synth ?? (conv ? null : true), consent]);
const mkConv = (c, project, synth = true, consent = null, days = 30) => J(c, `select nasa_hq.create_conversation($1, $2::boolean, $3, $4::int)`, [project, synth, consent, days]);
const audits = async (action, ok) => (await rows(su, `select * from nasa_hq.audit_receipts where action = $1 ${ok === undefined ? '' : 'and ok = ' + ok}`, [action])).length;
const fileRow = () => one(su, 'select * from nasa_hq.source_files');

// ================= NULL ancestry =================
test('NULL / empty / NULL-element / rootless ancestry is rejected by the indexer, never indexed', async () => {
  const c = await svc();
  for (const anc of [null, [], [null], [null, null], ['OTHER'], [ROOT.toLowerCase()]]) {
    const r = await idx(c, { anc, file: 'N' + JSON.stringify(anc) });
    assert.equal(r.status, 'rejected', JSON.stringify(anc)); assert.match(r.reason, /invalid_ancestry|outside_root/);
  }
  assert.equal((await rows(su, 'select * from nasa_hq.source_files')).length, 0); assert.equal(await audits('index_source_file', false), 6);
  await c.end();
});
test('table CHECKs are a second wall: raw rows with NULL ancestry or NULL shortcut target are refused; forged root is refused', async () => {
  const rid = (await one(su, 'select id from nasa_hq.source_roots')).id;
  const ins = (anc, mime = 'application/pdf', tgt = null) => su.query(`insert into nasa_hq.source_files (root_id, root_drive_id, account_id, project_id, drive_file_id, name, mime_type, ancestor_ids, shortcut_target_ancestor_ids, source_url, modified_time, authz_observed_at)
    values ($1, $2, $3, $4, 'RAW' || md5(random()::text), 'n', $5, $6::text[], $7::text[], 'u', now(), now())`, [rid, ROOT, ACCT, P1, mime, anc, tgt]);
  await assert.rejects(ins([null]), /inside_authorized_root/); await assert.rejects(ins([]), /inside_authorized_root/); await assert.rejects(ins(['X']), /inside_authorized_root/);
  await assert.rejects(ins([ROOT], SC, [null]), /shortcut_inside_root/); await assert.rejects(ins([ROOT], SC, null), /shortcut_inside_root/);
  await ins([ROOT, 'a']);
  await assert.rejects(su.query(`insert into nasa_hq.source_files (root_id, root_drive_id, account_id, project_id, drive_file_id, name, mime_type, ancestor_ids, source_url, modified_time, authz_observed_at)
    values ($1, 'FORGED', $2, $3, 'forge', 'n', 'application/pdf', array['FORGED'], 'u', now(), now())`, [rid, ACCT, P1]), /foreign key|violates/);
});
test('explicit argument validation: NULL access class, empty or NULL ids, NULL observation time and NULL root-enabled return JSON and leave receipts (no exception, no rollback)', async () => {
  const c = await svc();
  assert.equal((await idx(c, { cls: null })).reason, 'invalid_access_class');
  assert.equal((await idx(c, { file: '' })).reason, 'invalid_arguments'); assert.equal((await idx(c, { file: null })).reason, 'invalid_arguments');
  assert.equal((await idx(c, { obs: null })).reason, 'invalid_arguments'); assert.equal((await idx(c, { project: null })).reason, 'unknown_project');
  assert.equal((await J(c, `select nasa_hq.set_root_enabled($1, null::boolean)`, [ROOT])).error, 'invalid');
  assert.equal((await rows(su, 'select * from nasa_hq.source_files')).length, 0); assert.equal(await audits('index_source_file', false), 5); assert.equal(await audits('set_root_enabled', false), 1);
  assert.equal((await one(su, 'select enabled from nasa_hq.source_roots')).enabled, true);
  await c.end();
});

// ================= revocation, stale snapshots, access transitions =================
test('a file that moves outside the root is revoked and disappears from clients at once; a strictly newer observation reinstates it', async () => {
  const c = await svc(); assert.equal((await idx(c, { mod: T(0), obs: T(1) })).status, 'created');
  assert.equal(await seen(U.viewer), 'F1');
  assert.equal((await idx(c, { anc: ['SOMEWHERE_ELSE'], mod: T(0), obs: T(2) })).reason, 'outside_root');
  assert.equal((await fileRow()).status, 'revoked'); assert.equal(await seen(U.viewer), '');
  assert.equal((await idx(c, { mod: T(0), obs: T(3) })).status, 'reinstated'); assert.equal(await seen(U.viewer), 'F1');
  assert.deepEqual((await rows(su, 'select status, reason from nasa_hq.source_access_history order by id')).map((r) => `${r.status}:${r.reason}`), ['indexed:created', 'revoked:outside_root', 'indexed:reinstated']);
  await c.end();
});
test('A. STALE SNAPSHOT after revocation can never restore access or rewrite content freshness', async () => {
  const c = await svc();
  await idx(c, { mod: T(5), obs: T(5) });                                            // newest content, project-visible
  await idx(c, { anc: ['MOVED_AWAY'], mod: T(5), obs: T(7) });                       // revoked by an observation at T7
  assert.equal(await seen(U.viewer), '');
  const before = await fileRow();
  for (const [mod, obs] of [[T(1), T(1)], [T(5), T(6)], [T(9), T(6)], [T(0), T(2)]]) {   // queued PRE-revocation snapshots, even with newer content
    const r = await idx(c, { mod, obs }); assert.equal(r.reason, 'stale_observation', `${mod}/${obs}`);
  }
  assert.equal((await idx(c, { mod: T(9), obs: T(7) })).reason, 'not_newer_than_revocation');   // same instant is not newer
  const after = await fileRow();
  assert.equal(after.status, 'revoked'); assert.equal(await seen(U.viewer), '');
  assert.equal(+after.modified_time, +before.modified_time, 'content freshness was not rewritten by a stale snapshot'); assert.equal(after.revision, before.revision);
  assert.equal((await idx(c, { mod: T(5), obs: T(8) })).status, 'reinstated');              // a separately verified, strictly newer observation restores
  assert.equal(await seen(U.viewer), 'F1'); assert.equal((await fileRow()).revision, 1, 'reinstatement is an access event, not a content revision');
  await c.end();
});
test('B. ACCESS-CLASS TRANSITIONS: tightening applies at once (same or newer content time); loosening needs a strictly newer observation; stale ACL never reopens', async () => {
  const c = await svc();
  for (const [name, mod] of [['same content time', T(1)], ['newer content time', T(3)]]) {
    await fresh(); const c2 = await svc();
    await idx(c2, { mod: T(1), obs: T(2), cls: 'project' }); assert.equal(await seen(U.viewer), 'F1', name);
    for (const tighter of ['restricted', 'private_review']) {
      await fresh(); const c3 = await svc(); await idx(c3, { mod: T(1), obs: T(2), cls: 'project' });
      const r = await idx(c3, { mod, obs: T(2), cls: tighter });                           // SAME observation instant: restriction still applies
      assert.ok(['access_changed', 'updated'].includes(r.status), `${name}/${tighter}: ${JSON.stringify(r)}`);
      assert.equal((await fileRow()).access_class, tighter); assert.equal(await seen(U.viewer), '', `${name}/${tighter}`);
      assert.equal((await idx(c3, { mod, obs: T(1), cls: 'project' })).reason, 'stale_observation');      // stale ACL: still closed
      assert.equal(await seen(U.viewer), ''); await idx(c3, { mod, obs: T(2), cls: 'project' });           // same instant loosening: still closed
      assert.equal((await fileRow()).access_class, tighter); assert.equal(await seen(U.viewer), '');
      assert.equal((await idx(c3, { mod, obs: T(4), cls: 'project' })).status, 'access_changed');          // strictly newer: reopens
      assert.equal(await seen(U.viewer), 'F1'); await c3.end();
    }
    await c2.end();
  }
  await c.end();
});
test('grants are observed, expiring and revocable: expired and revoked grants see nothing; a stale grant observation cannot reopen', async () => {
  const c = await svc(); await idx(c, { mod: T(1), obs: T(2), cls: 'restricted' });
  const g = (user, obs, exp) => J(c, `select nasa_hq.grant_restricted_access($1, 'F1', $2, $3, $4)`, [ROOT, user, obs, exp]);
  const soon = new Date(Date.now() + 86400e3).toISOString();
  assert.equal(await seen(U.viewer), '');
  assert.equal((await g(U.viewer, T(3), soon)).ok, true); assert.equal(await seen(U.viewer), 'F1'); assert.equal(await seen(U.editor), '');
  assert.equal((await g(U.viewer, T(1), soon)).error, 'stale_observation');                        // older than the file's authorization clock
  await su.query(`update nasa_hq.source_file_grants set expires_at = observed_at + interval '1 second'`);   // lapsed long ago
  assert.equal(await seen(U.viewer), '', 'expired');
  await J(c, `select nasa_hq.revoke_restricted_access($1, 'F1', $2, $3)`, [ROOT, U.viewer, T(6)]);
  assert.equal((await g(U.viewer, T(5), soon)).error, 'stale_observation');                        // granted-at-T5 snapshot arrives after the T6 revocation
  assert.equal(await seen(U.viewer), ''); assert.equal((await g(U.viewer, T(8), soon)).ok, true); assert.equal(await seen(U.viewer), 'F1');
  assert.equal((await g(U.viewer, T(9), new Date(Date.now() + 90 * 86400e3).toISOString())).error, 'invalid');   // bounded lifetime
  await c.end();
});
test('disabling a root hides its files immediately; observed metadata is private by default; shortcut targets that leave the root revoke', async () => {
  const c = await svc();
  await idx(c, { file: 'PRIV', cls: 'private_review' }); await idx(c, { file: 'PROJ', cls: 'project' }); await idx(c, { file: 'S', mime: SC, target: [ROOT, 'T'], cls: 'project' });
  assert.equal(await seen(U.viewer), 'PROJ,S'); assert.equal(await seen(U.tarek), 'PROJ,S'); assert.equal(await seen(U.stranger), '');
  assert.equal((await one(su, `select review_status, access_class, status from nasa_hq.source_files where drive_file_id = 'PRIV'`)).review_status, 'needs_review');   // review, access and status are separate facts
  await J(c, `select nasa_hq.set_root_enabled($1, false)`, [ROOT]); assert.equal(await seen(U.viewer), '');
  await J(c, `select nasa_hq.set_root_enabled($1, true)`, [ROOT]); assert.equal(await seen(U.viewer), 'PROJ,S');
  assert.equal((await idx(c, { file: 'S', mime: SC, target: ['ELSEWHERE'], mod: T(1), obs: T(1) })).reason, 'shortcut_outside_root');
  assert.equal(await seen(U.viewer), 'PROJ');
  await c.end();
});
test('source history is immutable at the database level (revisions and access history)', async () => {
  const c = await svc(); await idx(c); await c.end();
  for (const sql of ['update nasa_hq.source_revisions set name = $$x$$', 'delete from nasa_hq.source_revisions', 'update nasa_hq.source_access_history set status = $$x$$', 'delete from nasa_hq.source_access_history'])
    await assert.rejects(su.query(sql), /append-only/, sql);
});

// ================= context, conversations =================
test('NULL / negative expected version is invalid and audited; no version is created', async () => {
  const c = await authed(U.editor);
  for (const e of [null, -1]) assert.equal((await save(c, P1, 'x', e)).error, 'invalid');
  assert.equal((await rows(su, 'select * from nasa_hq.context_versions')).length, 0); assert.equal(await audits('save_context', false), 2);
  assert.equal((await save(c, P1, 'ok', 0)).version, 1); await c.end();
});
test('conversation ownership: another user\'s, another project\'s or a missing conversation cannot be attached', async () => {
  const a = await authed(U.editor), b = await authed(U.editor2), t = await authed(U.tarek);
  const mine = (await mkConv(a, P1)).id, other = (await mkConv(b, P1)).id, p2conv = (await mkConv(t, P2)).id;
  assert.equal((await save(a, P1, 'x', 0, other)).error, 'forbidden'); assert.equal((await save(t, P1, 'x', 0, p2conv)).error, 'forbidden');
  assert.equal((await save(a, P1, 'x', 0, '11111111-1111-1111-1111-111111111111')).error, 'forbidden');
  assert.equal((await save(a, P1, 'x', 0, mine)).ok, true); assert.equal(await audits('save_context', false), 3);
  for (const x of [a, b, t]) await x.end();
});
test('C. a removed member cannot read their own project conversation; the project owner still can; expired conversations are unreadable', async () => {
  const e = await authed(U.editor); const id = (await mkConv(e, P1)).id; const pers = (await mkConv(e, null)).id;
  assert.deepEqual((await rows(e, 'select id from nasa_hq.conversations order by 1')).map((r) => r.id).sort(), [id, pers].sort());
  await su.query(`delete from nasa_hq.project_members where user_id = '${U.editor}' and project_id = '${P1}'`);
  assert.deepEqual((await rows(e, 'select id from nasa_hq.conversations')).map((r) => r.id), [pers], 'project conversation hidden, personal one remains');
  const t = await authed(U.tarek); assert.deepEqual((await rows(t, 'select id from nasa_hq.conversations')).map((r) => r.id), [id]);
  await su.query(`update nasa_hq.conversations set retain_until = now() - interval '1 hour'`); assert.equal((await rows(t, 'select * from nasa_hq.conversations')).length, 0);
  await e.end(); await t.end();
});
test('C. an expired conversation cannot seed a context; classification and the retention boundary are inherited; real data is never labelled synthetic by default', async () => {
  const e = await authed(U.editor);
  assert.equal((await mkConv(e, P1, false, null)).error, 'invalid');                       // non-synthetic requires a consent basis
  assert.equal((await mkConv(e, P1, null, null)).error, 'invalid');                        // classification must be explicit
  assert.equal((await mkConv(e, P1, true, null, 400)).error, 'invalid');                   // bounded retention
  const real = (await mkConv(e, P1, false, 'owner-approved review session', 5)).id;
  const r = await save(e, P1, 'real note', 0, real); assert.equal(r.ok, true);
  const ctx = await one(su, 'select * from nasa_hq.context_versions'); const conv = await one(su, 'select * from nasa_hq.conversations where id = $1', [real]);
  assert.equal(ctx.synthetic, false); assert.equal(ctx.consent_basis, 'owner-approved review session'); assert.ok(+ctx.retain_until <= +conv.retain_until, 'context cannot outlive its conversation');
  assert.equal((await save(e, P1, 'lie', 1, real, true)).error, 'classification_mismatch');
  assert.equal((await save(e, P1, 'unclassified', 1)).ok, true);                          // synthetic=true passed explicitly by the helper
  assert.equal((await J(e, `select nasa_hq.save_context($1, 'no classification', 2)`, [P1])).error, 'invalid');
  assert.equal((await save(e, P1, 'real w/o consent', 2, null, false, null)).error, 'invalid');
  await su.query(`update nasa_hq.conversations set retain_until = now() - interval '1 second' where id = '${real}'`);
  assert.equal((await save(e, P1, 'late', 2, real)).error, 'conversation_expired');
  assert.equal((await rows(su, 'select * from nasa_hq.context_versions')).length, 2); await e.end();
});
test('a removed editor can no longer save or invalidate context; a current owner can', async () => {
  const e = await authed(U.editor); await save(e, P1, 'v1', 0); const id = (await one(su, 'select id from nasa_hq.context_versions')).id;
  await su.query(`delete from nasa_hq.project_members where user_id = '${U.editor}' and project_id = '${P1}'`);
  assert.equal((await J(e, `select nasa_hq.invalidate_context($1)`, [id])).error, 'forbidden'); assert.equal((await save(e, P1, 'v2', 1)).error, 'forbidden');
  assert.equal((await one(su, 'select status from nasa_hq.context_versions')).status, 'approved');
  const t = await authed(U.tarek); assert.equal((await J(t, `select nasa_hq.invalidate_context($1)`, [id])).ok, true); assert.equal(await audits('invalidate_context', false), 1);
  await e.end(); await t.end();
});
test('version conflict, latest-valid retrieval by a fresh reader, invalidation fallback, stranger isolation', async () => {
  const e = await authed(U.editor), t = await authed(U.tarek); await save(e, P1, 'A wrote v1', 0);
  assert.deepEqual(await save(t, P1, 'B stale', 0), { ok: false, error: 'version_conflict', current: 1 });
  assert.equal((await save(t, P1, 'B retried', 1)).version, 2);
  const v = await authed(U.viewer); assert.equal((await one(v, 'select * from nasa_hq.latest_context($1)', [P1])).body, 'B retried');
  const s = await authed(U.stranger); assert.equal(await one(s, 'select * from nasa_hq.latest_context($1)', [P1]), undefined);
  const v2 = (await one(su, 'select id from nasa_hq.context_versions where version = 2')).id; await J(t, `select nasa_hq.invalidate_context($1)`, [v2]);
  assert.equal((await one(v, 'select * from nasa_hq.latest_context($1)', [P1])).body, 'A wrote v1'); for (const x of [e, t, v, s]) await x.end();
});

// ================= true concurrency =================
test('CONCURRENT savers with the same expected version: exactly one wins, the rest get version_conflict', async () => {
  const cs = []; for (let i = 0; i < 8; i++) cs.push(await authed(i % 2 ? U.editor : U.editor2));
  const res = await Promise.all(cs.map((c, i) => save(c, P1, 'writer ' + i, 0)));
  assert.equal(res.filter((r) => r.ok).length, 1); assert.equal(res.filter((r) => r.error === 'version_conflict').length, 7);
  assert.equal((await rows(su, 'select * from nasa_hq.context_versions')).length, 1); assert.equal((await one(su, 'select last_version from nasa_hq.context_scopes')).last_version, 1);
  for (const c of cs) await c.end();
});
test('CONCURRENT ingestion of observations in shuffled order: newest wins, history complete and gap-free, nothing stale applied, no duplicates', async () => {
  const ns = Array.from({ length: 12 }, (_, i) => i).sort(() => Math.random() - 0.5); const cs = []; for (let i = 0; i < ns.length; i++) cs.push(await svc());
  const res = await Promise.all(cs.map((c, i) => idx(c, { mod: T(ns[i]), obs: T(ns[i]) })));
  const f = await rows(su, 'select * from nasa_hq.source_files'); assert.equal(f.length, 1); assert.equal(new Date(f[0].modified_time).toISOString(), '2026-09-21T00:00:00.000Z');
  const revs = await rows(su, 'select revision, modified_time from nasa_hq.source_revisions order by revision');
  assert.deepEqual(revs.map((r) => r.revision), revs.map((_, i) => i + 1)); assert.equal(f[0].revision, revs.length);
  const mt = revs.map((r) => +new Date(r.modified_time)); assert.deepEqual(mt, [...mt].sort((a, b) => a - b));
  assert.ok(res.every((r) => ['created', 'updated', 'unchanged'].includes(r.status) || r.reason === 'stale_observation'), JSON.stringify(res.map((r) => r.status ?? r.reason)));
  for (const c of cs) await c.end();
});
test('CONCURRENT revocation racing a restoring snapshot: a revoked file never ends up visible from a snapshot older than the revocation', async () => {
  const c0 = await svc(); await idx(c0, { mod: T(1), obs: T(1) }); await c0.end();
  const cs = []; for (let i = 0; i < 10; i++) cs.push(await svc());
  await Promise.all(cs.map((c, i) => (i === 5 ? idx(c, { anc: ['GONE'], mod: T(1), obs: T(8) }) : idx(c, { mod: T(1 + (i % 4)), obs: T(2 + (i % 5)) }))));   // observations T2..T6 all predate the T8 revocation
  assert.equal((await fileRow()).status, 'revoked'); assert.equal(await seen(U.viewer), '');
  for (const c of cs) await c.end();
});
test('CONCURRENT ingestion of one file for two projects: exactly one project owns it; duplicate handoff keys collapse', async () => {
  const cs = []; for (let i = 0; i < 6; i++) cs.push(await svc());
  const res = await Promise.all(cs.map((c, i) => idx(c, { project: i % 2 ? P1 : P2, file: 'SHARED' })));
  assert.equal(res.filter((r) => r.status === 'created').length, 1); assert.ok(res.every((r) => r.status === 'created' || r.reason === 'belongs_to_other_project' || r.status === 'unchanged'));
  assert.equal((await rows(su, `select * from nasa_hq.source_files where drive_file_id = 'SHARED'`)).length, 1);
  const es = []; for (let i = 0; i < 6; i++) es.push(await authed(U.editor));
  const hs = await Promise.all(es.map((c) => J(c, `select nasa_hq.create_handoff($1, 'katib', 'musa', 'Copy', 'b', 'same-key')`, [P1])));
  assert.equal(hs.filter((h) => h.duplicate === false).length, 1); assert.equal((await rows(su, 'select * from nasa_hq.handoffs')).length, 1);
  for (const c of [...cs, ...es]) await c.end();
});

// ================= handoffs, audit, retention, grants, reversibility =================
test('handoffs: NULL/stale/unauthorised paths all refused and audited; viewers cannot write', async () => {
  const v = await authed(U.viewer), e = await authed(U.editor);
  assert.equal((await J(v, `select nasa_hq.create_handoff($1, 'a', 'b', 't', 'b', 'k')`, [P1])).error, 'forbidden');
  const h = await J(e, `select nasa_hq.create_handoff($1, 'katib', 'musa', 'Copy', 'b', 'k1')`, [P1]);
  assert.equal((await J(e, `select nasa_hq.create_handoff($1, 'katib', 'musa', 'Copy', 'b', 'k1')`, [P1])).duplicate, true);
  assert.equal((await J(e, `select nasa_hq.update_handoff($1, null::int, 'done')`, [h.id])).error, 'invalid'); assert.equal((await J(e, `select nasa_hq.update_handoff($1, 1, 'bogus')`, [h.id])).error, 'invalid');
  assert.equal((await J(v, `select nasa_hq.update_handoff($1, 1, 'done')`, [h.id])).error, 'forbidden'); assert.equal((await J(e, `select nasa_hq.update_handoff($1, 1, 'accepted')`, [h.id])).version, 2);
  assert.equal((await J(e, `select nasa_hq.update_handoff($1, 1, 'done')`, [h.id])).error, 'version_conflict');
  assert.equal(await audits('create_handoff'), 3); assert.equal(await audits('update_handoff'), 5); await v.end(); await e.end();
});
test('every function writes a receipt on every refusal path, including unauthenticated callers', async () => {
  const anon = await authed('');
  assert.equal((await save(anon, P1, 'x', 0)).error, 'unauthenticated'); assert.equal((await J(anon, `select nasa_hq.invalidate_context('11111111-1111-1111-1111-111111111111')`)).error, 'unauthenticated');
  assert.equal((await mkConv(anon, P1)).error, 'unauthenticated');
  assert.equal(await audits('save_context', false), 1); assert.equal(await audits('invalidate_context', false), 1); assert.equal(await audits('create_conversation', false), 1); await anon.end();
});
test('audit receipts are append-only, with owner/actor-scoped reads', async () => {
  const e = await authed(U.editor); await save(e, P1, 'x', 0); const v = await authed(U.viewer), t = await authed(U.tarek);
  assert.equal((await rows(v, 'select * from nasa_hq.audit_receipts')).length, 0); assert.equal((await rows(t, 'select * from nasa_hq.audit_receipts')).length, 1);
  for (const sql of ['update nasa_hq.audit_receipts set ok = false', 'delete from nasa_hq.audit_receipts', 'truncate nasa_hq.audit_receipts']) await assert.rejects(su.query(sql), /append-only/);
  for (const c of [e, v, t]) await c.end();
});
test('retention: purge removes only expired rows; a purged version number is never reused; unexpired audit survives; only purge can delete audit', async () => {
  const e = await authed(U.editor); await save(e, P1, 'v1', 0);
  await su.query(`update nasa_hq.context_versions set retain_until = now() - interval '1 day'`);
  assert.equal(await one(e, 'select * from nasa_hq.latest_context($1)', [P1]), undefined);
  const s = await svc(); const p = await J(s, 'select nasa_hq.purge_expired()'); assert.equal(p.contexts, 1); assert.equal(p.audit, 0);
  assert.equal((await save(e, P1, 'again', 0)).error, 'version_conflict'); assert.equal((await save(e, P1, 'again', 1)).version, 2);
  await su.query(`alter table nasa_hq.audit_receipts disable trigger audit_guard_row; update nasa_hq.audit_receipts set retain_until = now() - interval '1 day' where id = (select min(id) from nasa_hq.audit_receipts); alter table nasa_hq.audit_receipts enable trigger audit_guard_row;`);
  const before = (await rows(su, 'select * from nasa_hq.audit_receipts')).length;
  assert.equal((await J(s, 'select nasa_hq.purge_expired()')).audit, 1); assert.equal((await rows(su, 'select * from nasa_hq.audit_receipts')).length, before);   // one purged, one purge receipt written
  await assert.rejects(su.query('delete from nasa_hq.audit_receipts'), /append-only/); await e.end(); await s.end();
});
test('DENY-DEFAULT: the migration alone grants nothing to anon, authenticated or service_role; grants are a separate scaffold file', async () => {
  await fresh({ withGrants: false });
  const a = await as(await connect(server.conn), 'anon', U.tarek); const t = await authed(U.tarek); const s = await svc();
  await assert.rejects(a.query('select * from nasa_hq.projects'), /permission denied/);
  await assert.rejects(t.query('select * from nasa_hq.projects'), /permission denied/);
  await assert.rejects(t.query(`select nasa_hq.save_context($1, 'x', 0, null, true, null)`, [P1]), /permission denied/);
  await assert.rejects(s.query(`select nasa_hq.purge_expired()`), /permission denied/);
  await assert.rejects(s.query('select * from nasa_hq.source_roots'), /permission denied/);
  for (const c of [a, t, s]) await c.end();
});
test('grants scaffold was not expanded: clients cannot write tables or call service functions; service has no table access', async () => {
  const a = await as(await connect(server.conn), 'anon', U.tarek); await assert.rejects(a.query('select * from nasa_hq.projects'), /permission denied/);
  const t = await authed(U.tarek);
  await assert.rejects(t.query(`insert into nasa_hq.project_members values ('${P1}', '${U.stranger}', 'owner')`), /permission denied/);
  await assert.rejects(t.query(`insert into nasa_hq.context_versions (scope_key, owner_id, version, body, approved_by, synthetic, retain_until) values ('x', '${U.tarek}', 1, 'hi', '${U.tarek}', true, now())`), /permission denied/);
  await assert.rejects(t.query(`select nasa_hq.index_source_file('${ROOT}', '${ACCT}', '${P1}', 'Z', 'n', 'application/pdf', array['${ROOT}'], now(), now(), null, 'u')`), /permission denied/);
  await assert.rejects(t.query('select nasa_hq.purge_expired()'), /permission denied/); await assert.rejects(t.query('select * from nasa_hq.source_roots'), /permission denied/);
  await assert.rejects(t.query('select * from nasa_hq.source_access_history'), /permission denied/);
  const s = await svc();
  for (const sql of ['select * from nasa_hq.source_files', 'insert into nasa_hq.source_files (root_id) values (null)', 'delete from nasa_hq.audit_receipts', 'select * from nasa_hq.context_versions']) await assert.rejects(s.query(sql), /permission denied/, sql);
  for (const c of [a, t, s]) await c.end();
});
test('down refuses to drop populated data unless explicitly overridden; empty fixture drops cleanly; pre-existing tables untouched; up re-applies', async () => {
  await su.query('reset role'); const c = await svc(); await idx(c); await c.end();
  await assert.rejects(su.query(down), /refusing destructive down/); assert.equal((await rows(su, `select 1 from information_schema.schemata where schema_name = 'nasa_hq'`)).length, 1);
  await su.query(`set nasa_hq.confirm_destructive_down = 'yes_drop_fixture'`); await su.query(down); await su.query(`reset nasa_hq.confirm_destructive_down`);
  assert.equal((await rows(su, `select 1 from information_schema.schemata where schema_name = 'nasa_hq'`)).length, 0); assert.equal((await one(su, 'select count(*)::int as n from public.karsa_existing')).n, 1);
  await su.query(up); await su.query(down); await su.query(up);
  assert.equal((await rows(su, `select 1 from information_schema.tables where table_schema = 'nasa_hq'`)).length, 12);
});
