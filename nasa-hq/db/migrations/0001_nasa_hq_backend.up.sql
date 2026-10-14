-- NASA HQ backend: CANDIDATE input to the single reconciled migration. NOT APPLIED ANYWHERE.
-- Karsa owns the one backend. This file and the prepared `nasa_private` foundation must be merged into ONE
-- migration by that owner; this author could not see the foundation, so no mapping is claimed.
-- Isolated schema `nasa_hq`: cannot collide with existing objects. Grants are NARROWER than the first draft.
-- Assumes Supabase's auth.uid() and the roles anon, authenticated, service_role.

create schema nasa_hq;

-- ---------- helpers ----------
-- True only when the array is non-null, non-empty, has no NULL element, and positively contains the root.
-- Plain "root = ANY(arr)" yields NULL for {NULL}; CHECK treats NULL as pass. This function never returns NULL.
create function nasa_hq.ancestry_ok(p_root text, p_anc text[]) returns boolean
language sql immutable as $$
  select coalesce(
    p_root is not null and length(p_root) > 0 and p_anc is not null and cardinality(p_anc) > 0
    and not exists (select 1 from unnest(p_anc) a where a is null)
    and exists (select 1 from unnest(p_anc) a where a = p_root), false);
$$;

-- ---------- projects and membership ----------
create table nasa_hq.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  title text not null,
  created_at timestamptz not null default now()
);
create table nasa_hq.project_members (
  project_id uuid not null references nasa_hq.projects(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('viewer', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on nasa_hq.project_members (user_id);

-- ---------- authorized roots, indexed files, immutable revisions ----------
create table nasa_hq.source_roots (
  id uuid primary key default gen_random_uuid(),
  drive_root_id text not null unique check (length(drive_root_id) > 0),
  account_id text not null check (length(account_id) > 0),     -- the account identity the root was verified under
  label text not null,
  enabled boolean not null default true,
  unique (id, drive_root_id)
);
create table nasa_hq.source_files (
  id uuid primary key default gen_random_uuid(),
  root_id uuid not null,
  root_drive_id text not null,
  account_id text not null,
  project_id uuid not null references nasa_hq.projects(id) on delete restrict,
  drive_file_id text not null check (length(drive_file_id) > 0),
  name text not null,
  mime_type text not null check (length(mime_type) > 0),
  ancestor_ids text[] not null,
  shortcut_target_ancestor_ids text[],
  source_url text not null,
  md5 text,
  modified_time timestamptz not null,
  revision integer not null default 1 check (revision >= 1),
  ingest_run_id uuid,
  indexed_at timestamptz not null default now(),
  status text not null default 'indexed' check (status in ('indexed', 'revoked')),
  -- Observed metadata stays private until reviewed: nothing is client-visible by default.
  access_class text not null default 'private_review' check (access_class in ('private_review', 'project', 'restricted')),
  foreign key (root_id, root_drive_id) references nasa_hq.source_roots (id, drive_root_id),
  constraint inside_authorized_root check (nasa_hq.ancestry_ok(root_drive_id, ancestor_ids)),
  constraint shortcut_inside_root check (
    mime_type <> 'application/vnd.google-apps.shortcut' or nasa_hq.ancestry_ok(root_drive_id, shortcut_target_ancestor_ids)),
  unique (root_id, drive_file_id)
);
create index on nasa_hq.source_files (project_id);
create table nasa_hq.source_revisions (       -- history is never overwritten
  id bigint generated always as identity primary key,
  file_id uuid not null references nasa_hq.source_files(id) on delete restrict,
  revision integer not null,
  name text not null, mime_type text not null, ancestor_ids text[] not null, md5 text,
  modified_time timestamptz not null, source_url text not null, ingest_run_id uuid,
  recorded_at timestamptz not null default now(),
  unique (file_id, revision)
);
create table nasa_hq.source_file_grants (     -- per-resource entitlement for access_class = 'restricted'
  file_id uuid not null references nasa_hq.source_files(id) on delete cascade,
  user_id uuid not null,
  primary key (file_id, user_id)
);

-- ---------- conversations, versioned approved context ----------
create table nasa_hq.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  project_id uuid references nasa_hq.projects(id) on delete set null,
  line text not null default 'KAST / Main line',
  external_id text,
  synthetic boolean not null default true,
  consent_basis text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  retain_until timestamptz not null default (now() + interval '30 days'),
  constraint retention_bounded check (retain_until <= started_at + interval '366 days')
);
create unique index on nasa_hq.conversations (external_id) where external_id is not null;

create table nasa_hq.context_scopes (          -- monotonic counter: a version number is never reused, even after purge
  scope_key text primary key,
  last_version integer not null default 0 check (last_version >= 0)
);
create table nasa_hq.context_versions (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null references nasa_hq.context_scopes(scope_key),
  project_id uuid references nasa_hq.projects(id) on delete cascade,
  owner_id uuid not null,
  version integer not null check (version >= 1),
  body text not null check (length(btrim(body)) between 1 and 1200),
  status text not null default 'approved' check (status in ('approved', 'superseded', 'invalid')),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  conversation_id uuid references nasa_hq.conversations(id) on delete set null,
  synthetic boolean not null default true,
  consent_basis text,
  retain_until timestamptz not null default (now() + interval '30 days'),
  constraint ctx_retention_bounded check (retain_until <= approved_at + interval '366 days'),
  unique (scope_key, version)
);

-- ---------- handoffs ----------
create table nasa_hq.handoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references nasa_hq.projects(id) on delete cascade,
  from_agent text not null check (length(from_agent) between 1 and 40),
  to_agent text not null check (length(to_agent) between 1 and 40),
  title text not null check (length(title) between 1 and 200),
  body text not null default '',
  status text not null default 'open' check (status in ('open', 'accepted', 'done', 'cancelled')),
  version integer not null default 1,
  idempotency_key text not null check (length(idempotency_key) between 1 and 120),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

-- ---------- audit receipts: append-only, with bounded retention ----------
create table nasa_hq.audit_receipts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  project_id uuid,
  entity text not null,
  entity_id text,
  ok boolean not null,
  detail jsonb not null default '{}'::jsonb,
  retain_until timestamptz not null default (now() + interval '400 days')
);
create function nasa_hq.audit_guard() returns trigger language plpgsql as $$
begin
  -- Only purge_expired() may delete, and only rows past their own retention date. Never update, never truncate.
  if tg_op = 'DELETE' and current_setting('nasa_hq.purging', true) = 'on' and old.retain_until < now() then return old; end if;
  raise exception 'audit_receipts is append-only' using errcode = '42501';
end $$;
create trigger audit_guard_row before update or delete on nasa_hq.audit_receipts for each row execute function nasa_hq.audit_guard();
create trigger audit_guard_truncate before truncate on nasa_hq.audit_receipts for each statement execute function nasa_hq.audit_guard();

-- ---------- permission helpers ----------
create function nasa_hq.has_role(p_project uuid, p_min text) returns boolean
language sql stable security definer set search_path = nasa_hq, pg_temp as $$
  select coalesce((select exists (
    select 1 from nasa_hq.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
      and (case m.role when 'owner' then 3 when 'editor' then 2 else 1 end)
        >= (case p_min when 'owner' then 3 when 'editor' then 2 else 1 end))), false);
$$;
-- Visibility is computed at read time from the CURRENT root state, status and entitlement, so revocation hides data at once.
create function nasa_hq.file_visible(p_file uuid) returns boolean
language sql stable security definer set search_path = nasa_hq, pg_temp as $$
  select coalesce((select exists (
    select 1 from nasa_hq.source_files f join nasa_hq.source_roots r on r.id = f.root_id
    where f.id = p_file and f.status = 'indexed' and r.enabled and nasa_hq.has_role(f.project_id, 'viewer')
      and (f.access_class = 'project'
        or (f.access_class = 'restricted' and exists (select 1 from nasa_hq.source_file_grants g where g.file_id = f.id and g.user_id = auth.uid()))))), false);
$$;
create function nasa_hq.audit(p_actor uuid, p_action text, p_project uuid, p_entity text, p_entity_id text, p_ok boolean, p_detail jsonb)
returns void language sql security definer set search_path = nasa_hq, pg_temp as $$
  insert into nasa_hq.audit_receipts (actor, action, project_id, entity, entity_id, ok, detail)
  values (p_actor, p_action, p_project, p_entity, p_entity_id, p_ok, coalesce(p_detail, '{}'::jsonb));
$$;

-- ---------- backend-only ingestion: the single write path for source files ----------
create function nasa_hq.index_source_file(
  p_root_drive_id text, p_account_id text, p_project uuid, p_drive_file_id text, p_name text, p_mime text,
  p_ancestor_ids text[], p_modified timestamptz, p_md5 text, p_source_url text,
  p_shortcut_target_ancestor_ids text[] default null, p_ingest_run uuid default null, p_access_class text default 'private_review'
) returns jsonb language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare r nasa_hq.source_roots; ex nasa_hq.source_files; reason text; res text; rev integer; revoke_existing boolean := false;
begin
  if p_root_drive_id is null or p_drive_file_id is null then
    perform nasa_hq.audit(null, 'index_source_file', p_project, 'source_file', p_drive_file_id, false, jsonb_build_object('reason', 'invalid_arguments'));
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_arguments');
  end if;
  -- Serialize every writer of this file so a later-finishing older revision cannot overwrite a newer one.
  perform pg_advisory_xact_lock(hashtextextended(p_root_drive_id || ':' || p_drive_file_id, 0));

  select * into r from nasa_hq.source_roots where drive_root_id = p_root_drive_id;
  if not found then reason := 'root_not_authorized';
  elsif not r.enabled then reason := 'root_disabled'; revoke_existing := true;
  elsif r.account_id is distinct from p_account_id then reason := 'account_mismatch';
  elsif p_ancestor_ids is null or cardinality(p_ancestor_ids) = 0 or exists (select 1 from unnest(p_ancestor_ids) a where a is null) then
    reason := 'invalid_ancestry'; revoke_existing := true;
  elsif not nasa_hq.ancestry_ok(p_root_drive_id, p_ancestor_ids) then reason := 'outside_root'; revoke_existing := true;
  elsif p_mime is null or length(p_mime) = 0 or p_name is null or p_source_url is null or p_modified is null then reason := 'invalid_metadata';
  elsif p_mime = 'application/vnd.google-apps.shortcut' and not nasa_hq.ancestry_ok(p_root_drive_id, p_shortcut_target_ancestor_ids) then
    reason := 'shortcut_outside_root'; revoke_existing := true;
  elsif p_access_class not in ('private_review', 'project', 'restricted') then reason := 'invalid_access_class';
  elsif not exists (select 1 from nasa_hq.projects where id = p_project) then reason := 'unknown_project';
  end if;

  if reason is not null then
    if revoke_existing and r.id is not null then
      update nasa_hq.source_files set status = 'revoked' where root_id = r.id and drive_file_id = p_drive_file_id and status <> 'revoked';
    end if;
    perform nasa_hq.audit(null, 'index_source_file', p_project, 'source_file', p_drive_file_id, false, jsonb_build_object('reason', reason));
    return jsonb_build_object('status', 'rejected', 'reason', reason);
  end if;

  select * into ex from nasa_hq.source_files where root_id = r.id and drive_file_id = p_drive_file_id for update;
  if not found then
    insert into nasa_hq.source_files (root_id, root_drive_id, account_id, project_id, drive_file_id, name, mime_type, ancestor_ids,
      shortcut_target_ancestor_ids, source_url, md5, modified_time, ingest_run_id, access_class)
    values (r.id, r.drive_root_id, r.account_id, p_project, p_drive_file_id, p_name, p_mime, p_ancestor_ids,
      p_shortcut_target_ancestor_ids, p_source_url, p_md5, p_modified, p_ingest_run, p_access_class) returning id into ex.id;
    rev := 1; res := 'created';
  elsif ex.project_id <> p_project then
    perform nasa_hq.audit(null, 'index_source_file', p_project, 'source_file', p_drive_file_id, false, jsonb_build_object('reason', 'belongs_to_other_project'));
    return jsonb_build_object('status', 'rejected', 'reason', 'belongs_to_other_project');
  elsif ex.modified_time < p_modified or ex.status = 'revoked' then
    rev := ex.revision + 1;
    update nasa_hq.source_files set name = p_name, mime_type = p_mime, ancestor_ids = p_ancestor_ids,
      shortcut_target_ancestor_ids = p_shortcut_target_ancestor_ids, md5 = p_md5, modified_time = greatest(ex.modified_time, p_modified),
      source_url = p_source_url, ingest_run_id = p_ingest_run, indexed_at = now(), status = 'indexed', revision = rev
    where id = ex.id;
    res := case when ex.status = 'revoked' then 'reinstated' else 'updated' end;
  else
    perform nasa_hq.audit(null, 'index_source_file', p_project, 'source_file', p_drive_file_id, true, jsonb_build_object('status', 'unchanged'));
    return jsonb_build_object('status', 'unchanged', 'revision', ex.revision);
  end if;
  insert into nasa_hq.source_revisions (file_id, revision, name, mime_type, ancestor_ids, md5, modified_time, source_url, ingest_run_id)
  values (ex.id, rev, p_name, p_mime, p_ancestor_ids, p_md5, p_modified, p_source_url, p_ingest_run);
  perform nasa_hq.audit(null, 'index_source_file', p_project, 'source_file', p_drive_file_id, true, jsonb_build_object('status', res, 'revision', rev));
  return jsonb_build_object('status', res, 'revision', rev);
end $$;

create function nasa_hq.set_root_enabled(p_drive_root_id text, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare n integer;
begin
  update nasa_hq.source_roots set enabled = p_enabled where drive_root_id = p_drive_root_id;
  get diagnostics n = row_count;
  perform nasa_hq.audit(null, 'set_root_enabled', null, 'source_root', p_drive_root_id, n = 1, jsonb_build_object('enabled', p_enabled));
  return jsonb_build_object('ok', n = 1);
end $$;

-- ---------- user paths ----------
create function nasa_hq.create_conversation(p_project uuid, p_line text default 'KAST / Main line', p_external_id text default null)
returns jsonb language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare me uuid := auth.uid(); c uuid;
begin
  if me is null then perform nasa_hq.audit(null, 'create_conversation', p_project, 'conversation', null, false, jsonb_build_object('reason', 'unauthenticated')); return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if p_project is not null and not nasa_hq.has_role(p_project, 'editor') then
    perform nasa_hq.audit(me, 'create_conversation', p_project, 'conversation', null, false, jsonb_build_object('reason', 'forbidden'));
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  insert into nasa_hq.conversations (owner_id, project_id, line, external_id) values (me, p_project, coalesce(p_line, 'KAST / Main line'), p_external_id) returning id into c;
  perform nasa_hq.audit(me, 'create_conversation', p_project, 'conversation', c::text, true, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'id', c);
end $$;

create function nasa_hq.save_context(p_project uuid, p_body text, p_expected integer, p_conversation uuid default null)
returns jsonb language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare me uuid := auth.uid(); sk text; cur integer; nv integer; conv nasa_hq.conversations;
begin
  if me is null then
    perform nasa_hq.audit(null, 'save_context', p_project, 'context', null, false, jsonb_build_object('reason', 'unauthenticated'));
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  if p_expected is null or p_expected < 0 then
    perform nasa_hq.audit(me, 'save_context', p_project, 'context', null, false, jsonb_build_object('reason', 'invalid_expected_version'));
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_project is not null and not nasa_hq.has_role(p_project, 'editor') then
    perform nasa_hq.audit(me, 'save_context', p_project, 'context', null, false, jsonb_build_object('reason', 'forbidden'));
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_body is null or length(btrim(p_body)) = 0 or length(p_body) > 1200 then
    perform nasa_hq.audit(me, 'save_context', p_project, 'context', null, false, jsonb_build_object('reason', 'invalid_body'));
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_conversation is not null then
    select * into conv from nasa_hq.conversations where id = p_conversation;
    if not found or conv.owner_id <> me or conv.project_id is distinct from p_project then
      perform nasa_hq.audit(me, 'save_context', p_project, 'context', null, false, jsonb_build_object('reason', 'forbidden_conversation'));
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;
  sk := coalesce(p_project::text, 'user:' || me::text);
  insert into nasa_hq.context_scopes (scope_key) values (sk) on conflict do nothing;
  select last_version into cur from nasa_hq.context_scopes where scope_key = sk for update;   -- row lock serializes writers
  if cur <> p_expected then
    perform nasa_hq.audit(me, 'save_context', p_project, 'context', sk, false, jsonb_build_object('reason', 'version_conflict', 'expected', p_expected, 'current', cur));
    return jsonb_build_object('ok', false, 'error', 'version_conflict', 'current', cur);
  end if;
  nv := cur + 1;
  update nasa_hq.context_scopes set last_version = nv where scope_key = sk;
  update nasa_hq.context_versions set status = 'superseded' where scope_key = sk and status = 'approved';
  insert into nasa_hq.context_versions (scope_key, project_id, owner_id, version, body, approved_by, conversation_id)
  values (sk, p_project, me, nv, btrim(p_body), me, p_conversation);
  perform nasa_hq.audit(me, 'save_context', p_project, 'context', sk, true, jsonb_build_object('version', nv));
  return jsonb_build_object('ok', true, 'version', nv);
end $$;

-- Latest VALID context (not invalid, not past retention). Runs as the caller, so RLS applies.
create function nasa_hq.latest_context(p_project uuid default null)
returns table (version integer, body text, approved_at timestamptz) language sql stable security invoker set search_path = nasa_hq, pg_temp as $$
  select c.version, c.body, c.approved_at from nasa_hq.context_versions c
  where c.scope_key = coalesce(p_project::text, 'user:' || auth.uid()::text) and c.status <> 'invalid' and c.retain_until > now()
  order by c.version desc limit 1;
$$;

create function nasa_hq.invalidate_context(p_id uuid) returns jsonb
language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare c nasa_hq.context_versions; me uuid := auth.uid(); allowed boolean;
begin
  if me is null then perform nasa_hq.audit(null, 'invalidate_context', null, 'context', p_id::text, false, jsonb_build_object('reason', 'unauthenticated')); return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  select * into c from nasa_hq.context_versions where id = p_id;
  -- Authority must be CURRENT: a removed editor cannot keep invalidating the project's context.
  allowed := found and (
    (c.project_id is null and c.owner_id = me)
    or (c.project_id is not null and (nasa_hq.has_role(c.project_id, 'owner') or (c.owner_id = me and nasa_hq.has_role(c.project_id, 'editor')))));
  if not coalesce(allowed, false) then
    perform nasa_hq.audit(me, 'invalidate_context', c.project_id, 'context', p_id::text, false, jsonb_build_object('reason', 'forbidden'));
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update nasa_hq.context_versions set status = 'invalid' where id = p_id;
  perform nasa_hq.audit(me, 'invalidate_context', c.project_id, 'context', p_id::text, true, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create function nasa_hq.create_handoff(p_project uuid, p_from text, p_to text, p_title text, p_body text, p_key text)
returns jsonb language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare me uuid := auth.uid(); h nasa_hq.handoffs; new_id uuid;
begin
  if me is null or p_project is null or not nasa_hq.has_role(p_project, 'editor') then
    perform nasa_hq.audit(me, 'create_handoff', p_project, 'handoff', null, false, jsonb_build_object('reason', 'forbidden'));
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_from is null or p_to is null or p_title is null or p_key is null or length(p_from) not between 1 and 40 or length(p_to) not between 1 and 40
     or length(p_title) not between 1 and 200 or length(p_key) not between 1 and 120 then
    perform nasa_hq.audit(me, 'create_handoff', p_project, 'handoff', null, false, jsonb_build_object('reason', 'invalid'));
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  insert into nasa_hq.handoffs (project_id, from_agent, to_agent, title, body, idempotency_key, created_by)
  values (p_project, p_from, p_to, p_title, coalesce(p_body, ''), p_key, me)
  on conflict (project_id, idempotency_key) do nothing returning id into new_id;
  if new_id is null then
    select * into h from nasa_hq.handoffs where project_id = p_project and idempotency_key = p_key;
    perform nasa_hq.audit(me, 'create_handoff', p_project, 'handoff', h.id::text, true, jsonb_build_object('duplicate', true));
    return jsonb_build_object('ok', true, 'id', h.id, 'duplicate', true);
  end if;
  perform nasa_hq.audit(me, 'create_handoff', p_project, 'handoff', new_id::text, true, jsonb_build_object('duplicate', false));
  return jsonb_build_object('ok', true, 'id', new_id, 'duplicate', false);
end $$;

create function nasa_hq.update_handoff(p_id uuid, p_expected integer, p_status text) returns jsonb
language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare me uuid := auth.uid(); h nasa_hq.handoffs; n integer;
begin
  select * into h from nasa_hq.handoffs where id = p_id;
  if not found or me is null or not nasa_hq.has_role(h.project_id, 'editor') then
    perform nasa_hq.audit(me, 'update_handoff', h.project_id, 'handoff', p_id::text, false, jsonb_build_object('reason', 'forbidden'));
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_expected is null or p_expected < 1 or p_status is null or p_status not in ('open', 'accepted', 'done', 'cancelled') then
    perform nasa_hq.audit(me, 'update_handoff', h.project_id, 'handoff', p_id::text, false, jsonb_build_object('reason', 'invalid'));
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  update nasa_hq.handoffs set status = p_status, version = version + 1 where id = p_id and version = p_expected;
  get diagnostics n = row_count;
  if n = 0 then
    select version into h.version from nasa_hq.handoffs where id = p_id;
    perform nasa_hq.audit(me, 'update_handoff', h.project_id, 'handoff', p_id::text, false, jsonb_build_object('reason', 'version_conflict'));
    return jsonb_build_object('ok', false, 'error', 'version_conflict', 'current', h.version);
  end if;
  perform nasa_hq.audit(me, 'update_handoff', h.project_id, 'handoff', p_id::text, true, jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true, 'version', p_expected + 1);
end $$;

-- ---------- retention ----------
create function nasa_hq.purge_expired() returns jsonb
language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare c integer; x integer; a integer;
begin
  perform set_config('nasa_hq.purging', 'on', true);
  delete from nasa_hq.context_versions where retain_until < now(); get diagnostics x = row_count;
  delete from nasa_hq.conversations where retain_until < now(); get diagnostics c = row_count;
  delete from nasa_hq.audit_receipts where retain_until < now(); get diagnostics a = row_count;
  perform set_config('nasa_hq.purging', 'off', true);
  perform nasa_hq.audit(null, 'purge_expired', null, 'retention', null, true, jsonb_build_object('contexts', x, 'conversations', c, 'audit', a));
  return jsonb_build_object('contexts', x, 'conversations', c, 'audit', a);
end $$;

-- ---------- row level security: deny by default ----------
alter table nasa_hq.projects enable row level security;
alter table nasa_hq.project_members enable row level security;
alter table nasa_hq.source_roots enable row level security;
alter table nasa_hq.source_files enable row level security;
alter table nasa_hq.source_revisions enable row level security;
alter table nasa_hq.source_file_grants enable row level security;
alter table nasa_hq.conversations enable row level security;
alter table nasa_hq.context_scopes enable row level security;
alter table nasa_hq.context_versions enable row level security;
alter table nasa_hq.handoffs enable row level security;
alter table nasa_hq.audit_receipts enable row level security;

create policy projects_read on nasa_hq.projects for select to authenticated using (nasa_hq.has_role(id, 'viewer'));
create policy members_read on nasa_hq.project_members for select to authenticated using (user_id = auth.uid() or nasa_hq.has_role(project_id, 'owner'));
create policy files_read on nasa_hq.source_files for select to authenticated using (nasa_hq.file_visible(id));
create policy conv_read on nasa_hq.conversations for select to authenticated using (
  retain_until > now() and (owner_id = auth.uid() or (project_id is not null and nasa_hq.has_role(project_id, 'owner'))));
create policy ctx_read on nasa_hq.context_versions for select to authenticated using (
  retain_until > now() and ((project_id is not null and nasa_hq.has_role(project_id, 'viewer')) or (project_id is null and owner_id = auth.uid())));
create policy handoffs_read on nasa_hq.handoffs for select to authenticated using (nasa_hq.has_role(project_id, 'viewer'));
create policy audit_read on nasa_hq.audit_receipts for select to authenticated using (actor = auth.uid() or (project_id is not null and nasa_hq.has_role(project_id, 'owner')));

-- ---------- grants: clients read through RLS; every write goes through a function ----------
revoke all on all tables in schema nasa_hq from public, anon, authenticated, service_role;
revoke all on all functions in schema nasa_hq from public, anon, authenticated, service_role;
grant usage on schema nasa_hq to authenticated, service_role;
grant select on nasa_hq.projects, nasa_hq.project_members, nasa_hq.source_files, nasa_hq.conversations,
  nasa_hq.context_versions, nasa_hq.handoffs, nasa_hq.audit_receipts to authenticated;
grant execute on function nasa_hq.has_role(uuid, text), nasa_hq.file_visible(uuid), nasa_hq.create_conversation(uuid, text, text),
  nasa_hq.save_context(uuid, text, integer, uuid), nasa_hq.latest_context(uuid), nasa_hq.invalidate_context(uuid),
  nasa_hq.create_handoff(uuid, text, text, text, text, text), nasa_hq.update_handoff(uuid, integer, text) to authenticated;
-- service_role: ingestion and retention functions only. No table privileges, so no side door around the checks.
grant execute on function
  nasa_hq.index_source_file(text, text, uuid, text, text, text, text[], timestamptz, text, text, text[], uuid, text),
  nasa_hq.set_root_enabled(text, boolean), nasa_hq.purge_expired() to service_role;
