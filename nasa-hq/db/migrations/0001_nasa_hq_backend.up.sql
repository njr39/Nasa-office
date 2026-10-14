-- NASA HQ backend contract. DRAFT FOR RECONCILIATION. NOT APPLIED ANYWHERE.
-- Target: Supabase project uczhbodqmsxcxymybonn. Karsa's current tables/ingestion were NOT inspected
-- (no Supabase access in the authoring session). Everything lives in its own schema `nasa_hq` so it
-- cannot collide with existing objects; rename or merge only after reconciling with the live schema.
-- Reversible: 0001_nasa_hq_backend.down.sql drops only this schema.
-- Assumes Supabase's auth.uid() and the roles anon, authenticated, service_role.

create schema nasa_hq;

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

-- ---------- authorized Drive roots and indexed files ----------
create table nasa_hq.source_roots (
  id uuid primary key default gen_random_uuid(),
  drive_root_id text not null unique,
  label text not null,
  enabled boolean not null default true
);
create table nasa_hq.source_files (
  id uuid primary key default gen_random_uuid(),
  root_id uuid not null references nasa_hq.source_roots(id),
  root_drive_id text not null,
  project_id uuid not null references nasa_hq.projects(id) on delete restrict,
  drive_file_id text not null,
  name text not null,
  mime_type text not null,
  ancestor_ids text[] not null,
  shortcut_target_ancestor_ids text[],
  source_url text not null,
  md5 text,
  modified_time timestamptz not null,
  indexed_at timestamptz not null default now(),
  status text not null default 'indexed' check (status in ('indexed', 'revoked')),
  -- Preserve the original: we store metadata and the source link, never a rewritten copy.
  constraint inside_authorized_root check (root_drive_id = any (ancestor_ids)),
  constraint shortcut_inside_root check (
    mime_type <> 'application/vnd.google-apps.shortcut'
    or (shortcut_target_ancestor_ids is not null and root_drive_id = any (shortcut_target_ancestor_ids))),
  -- Duplicate prevention: one row per Drive file per root, however many ingestion jobs run.
  unique (root_id, drive_file_id)
);
create index on nasa_hq.source_files (project_id);

-- ---------- conversations, versioned approved context ----------
create table nasa_hq.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  project_id uuid references nasa_hq.projects(id) on delete set null,
  line text not null default 'KAST / Main line',
  external_id text,                       -- ElevenLabs conversation id, when real
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index on nasa_hq.conversations (external_id) where external_id is not null;

create table nasa_hq.context_versions (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null,                -- project uuid, or 'user:<uuid>' for personal context
  project_id uuid references nasa_hq.projects(id) on delete cascade,
  owner_id uuid not null,
  version integer not null check (version >= 1),
  body text not null check (length(btrim(body)) between 1 and 1200),
  status text not null default 'approved' check (status in ('approved', 'superseded', 'invalid')),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  conversation_id uuid references nasa_hq.conversations(id) on delete set null,
  unique (scope_key, version)             -- two writers cannot both create the same version
);

-- ---------- handoffs ----------
create table nasa_hq.handoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references nasa_hq.projects(id) on delete cascade,
  from_agent text not null,
  to_agent text not null,
  title text not null check (length(title) between 1 and 200),
  body text not null default '',
  status text not null default 'open' check (status in ('open', 'accepted', 'done', 'cancelled')),
  version integer not null default 1,
  idempotency_key text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

-- ---------- audit receipts (append-only) ----------
create table nasa_hq.audit_receipts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  project_id uuid,
  entity text not null,
  entity_id text,
  ok boolean not null,
  detail jsonb not null default '{}'::jsonb
);
create function nasa_hq.audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_receipts is append-only' using errcode = '42501'; end $$;
create trigger audit_no_update before update or delete on nasa_hq.audit_receipts
  for each row execute function nasa_hq.audit_immutable();
create trigger audit_no_truncate before truncate on nasa_hq.audit_receipts
  for each statement execute function nasa_hq.audit_immutable();

-- ---------- permission helper ----------
create function nasa_hq.has_role(p_project uuid, p_min text) returns boolean
language sql stable security definer set search_path = nasa_hq, pg_temp as $$
  select exists (
    select 1 from nasa_hq.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
      and (case m.role when 'owner' then 3 when 'editor' then 2 else 1 end)
        >= (case p_min when 'owner' then 3 when 'editor' then 2 else 1 end));
$$;

create function nasa_hq.audit(p_actor uuid, p_action text, p_project uuid, p_entity text, p_entity_id text, p_ok boolean, p_detail jsonb)
returns void language sql security definer set search_path = nasa_hq, pg_temp as $$
  insert into nasa_hq.audit_receipts (actor, action, project_id, entity, entity_id, ok, detail)
  values (p_actor, p_action, p_project, p_entity, p_entity_id, p_ok, coalesce(p_detail, '{}'::jsonb));
$$;

-- ---------- backend-only: index a Drive file (the single ingestion write path) ----------
create function nasa_hq.index_source_file(
  p_root_drive_id text, p_project uuid, p_drive_file_id text, p_name text, p_mime text,
  p_ancestor_ids text[], p_modified timestamptz, p_md5 text, p_source_url text,
  p_shortcut_target_ancestor_ids text[] default null
) returns jsonb language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare r nasa_hq.source_roots; ex nasa_hq.source_files; res text; new_id uuid; reason text;
begin
  select * into r from nasa_hq.source_roots where drive_root_id = p_root_drive_id and enabled;
  if not found then reason := 'root_not_authorized';
  elsif not (p_root_drive_id = any (p_ancestor_ids)) then reason := 'outside_root';
  elsif p_mime = 'application/vnd.google-apps.shortcut'
    and (p_shortcut_target_ancestor_ids is null or not (p_root_drive_id = any (p_shortcut_target_ancestor_ids)))
    then reason := 'shortcut_outside_root';
  elsif not exists (select 1 from nasa_hq.projects where id = p_project) then reason := 'unknown_project';
  end if;
  if reason is not null then
    perform nasa_hq.audit(null, 'index_source_file', p_project, 'source_file', p_drive_file_id, false, jsonb_build_object('reason', reason));
    return jsonb_build_object('status', 'rejected', 'reason', reason);
  end if;

  select * into ex from nasa_hq.source_files where root_id = r.id and drive_file_id = p_drive_file_id;
  if found and ex.project_id <> p_project then
    perform nasa_hq.audit(null, 'index_source_file', p_project, 'source_file', p_drive_file_id, false, jsonb_build_object('reason', 'belongs_to_other_project'));
    return jsonb_build_object('status', 'rejected', 'reason', 'belongs_to_other_project');
  end if;

  if not found then
    insert into nasa_hq.source_files (root_id, root_drive_id, project_id, drive_file_id, name, mime_type, ancestor_ids, shortcut_target_ancestor_ids, source_url, md5, modified_time)
    values (r.id, p_root_drive_id, p_project, p_drive_file_id, p_name, p_mime, p_ancestor_ids, p_shortcut_target_ancestor_ids, p_source_url, p_md5, p_modified)
    on conflict (root_id, drive_file_id) do nothing returning id into new_id;
    res := case when new_id is null then 'unchanged' else 'created' end;   -- null: a racing job inserted first
  elsif ex.modified_time < p_modified then
    update nasa_hq.source_files set name = p_name, ancestor_ids = p_ancestor_ids, md5 = p_md5, modified_time = p_modified, source_url = p_source_url, indexed_at = now(), status = 'indexed'
    where id = ex.id;
    res := 'updated';
  else res := 'unchanged';
  end if;
  perform nasa_hq.audit(null, 'index_source_file', p_project, 'source_file', p_drive_file_id, true, jsonb_build_object('status', res));
  return jsonb_build_object('status', res);
end $$;

-- ---------- user path: save approved context with optimistic versioning ----------
create function nasa_hq.save_context(p_project uuid, p_body text, p_expected integer, p_conversation uuid default null)
returns jsonb language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare me uuid := auth.uid(); sk text; cur integer; nv integer;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if p_project is not null and not nasa_hq.has_role(p_project, 'editor') then
    perform nasa_hq.audit(me, 'save_context', p_project, 'context', null, false, jsonb_build_object('reason', 'forbidden'));
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_body is null or length(btrim(p_body)) = 0 or length(p_body) > 1200 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  sk := coalesce(p_project::text, 'user:' || me::text);
  perform pg_advisory_xact_lock(hashtext(sk));
  select coalesce(max(version), 0) into cur from nasa_hq.context_versions where scope_key = sk;
  if cur <> p_expected then
    perform nasa_hq.audit(me, 'save_context', p_project, 'context', sk, false, jsonb_build_object('reason', 'version_conflict', 'expected', p_expected, 'current', cur));
    return jsonb_build_object('ok', false, 'error', 'version_conflict', 'current', cur);
  end if;
  nv := cur + 1;
  update nasa_hq.context_versions set status = 'superseded' where scope_key = sk and status = 'approved';
  insert into nasa_hq.context_versions (scope_key, project_id, owner_id, version, body, approved_by, conversation_id)
  values (sk, p_project, me, nv, btrim(p_body), me, p_conversation);
  perform nasa_hq.audit(me, 'save_context', p_project, 'context', sk, true, jsonb_build_object('version', nv));
  return jsonb_build_object('ok', true, 'version', nv);
end $$;

-- Latest VALID context: highest version in scope that is not invalid (approved, or superseded when
-- the newer one was invalidated). Runs as the caller, so RLS applies.
create function nasa_hq.latest_context(p_project uuid default null)
returns table (version integer, body text, approved_at timestamptz) language sql stable security invoker set search_path = nasa_hq, pg_temp as $$
  select c.version, c.body, c.approved_at from nasa_hq.context_versions c
  where c.scope_key = coalesce(p_project::text, 'user:' || auth.uid()::text) and c.status <> 'invalid'
  order by c.version desc limit 1;
$$;

create function nasa_hq.invalidate_context(p_id uuid) returns jsonb
language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare c nasa_hq.context_versions; me uuid := auth.uid();
begin
  select * into c from nasa_hq.context_versions where id = p_id;
  if not found or me is null or not (c.owner_id = me or (c.project_id is not null and nasa_hq.has_role(c.project_id, 'owner'))) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update nasa_hq.context_versions set status = 'invalid' where id = p_id;
  perform nasa_hq.audit(me, 'invalidate_context', c.project_id, 'context', p_id::text, true, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- handoffs: idempotent create, versioned update ----------
create function nasa_hq.create_handoff(p_project uuid, p_from text, p_to text, p_title text, p_body text, p_key text)
returns jsonb language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare me uuid := auth.uid(); h nasa_hq.handoffs;
begin
  if me is null or not nasa_hq.has_role(p_project, 'editor') then
    perform nasa_hq.audit(me, 'create_handoff', p_project, 'handoff', null, false, jsonb_build_object('reason', 'forbidden'));
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  insert into nasa_hq.handoffs (project_id, from_agent, to_agent, title, body, idempotency_key, created_by)
  values (p_project, p_from, p_to, p_title, coalesce(p_body, ''), p_key, me)
  on conflict (project_id, idempotency_key) do nothing returning * into h;
  if h.id is null then
    select * into h from nasa_hq.handoffs where project_id = p_project and idempotency_key = p_key;
    return jsonb_build_object('ok', true, 'id', h.id, 'duplicate', true);
  end if;
  perform nasa_hq.audit(me, 'create_handoff', p_project, 'handoff', h.id::text, true, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'id', h.id, 'duplicate', false);
end $$;

create function nasa_hq.update_handoff(p_id uuid, p_expected integer, p_status text) returns jsonb
language plpgsql security definer set search_path = nasa_hq, pg_temp as $$
declare me uuid := auth.uid(); h nasa_hq.handoffs; n integer;
begin
  select * into h from nasa_hq.handoffs where id = p_id;
  if not found or me is null or not nasa_hq.has_role(h.project_id, 'editor') then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_status not in ('open', 'accepted', 'done', 'cancelled') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  update nasa_hq.handoffs set status = p_status, version = version + 1 where id = p_id and version = p_expected;
  get diagnostics n = row_count;
  if n = 0 then
    perform nasa_hq.audit(me, 'update_handoff', h.project_id, 'handoff', p_id::text, false, jsonb_build_object('reason', 'version_conflict'));
    return jsonb_build_object('ok', false, 'error', 'version_conflict', 'current', h.version);
  end if;
  perform nasa_hq.audit(me, 'update_handoff', h.project_id, 'handoff', p_id::text, true, jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true, 'version', p_expected + 1);
end $$;

-- ---------- row level security ----------
alter table nasa_hq.projects enable row level security;
alter table nasa_hq.project_members enable row level security;
alter table nasa_hq.source_roots enable row level security;
alter table nasa_hq.source_files enable row level security;
alter table nasa_hq.conversations enable row level security;
alter table nasa_hq.context_versions enable row level security;
alter table nasa_hq.handoffs enable row level security;
alter table nasa_hq.audit_receipts enable row level security;

create policy projects_read on nasa_hq.projects for select to authenticated using (nasa_hq.has_role(id, 'viewer'));
create policy members_read on nasa_hq.project_members for select to authenticated using (user_id = auth.uid() or nasa_hq.has_role(project_id, 'owner'));
create policy files_read on nasa_hq.source_files for select to authenticated using (status = 'indexed' and nasa_hq.has_role(project_id, 'viewer'));
create policy conv_read on nasa_hq.conversations for select to authenticated using (owner_id = auth.uid() or (project_id is not null and nasa_hq.has_role(project_id, 'owner')));
create policy ctx_read on nasa_hq.context_versions for select to authenticated using (
  (project_id is not null and nasa_hq.has_role(project_id, 'viewer')) or (project_id is null and owner_id = auth.uid()));
create policy handoffs_read on nasa_hq.handoffs for select to authenticated using (nasa_hq.has_role(project_id, 'viewer'));
create policy audit_read on nasa_hq.audit_receipts for select to authenticated using (actor = auth.uid() or (project_id is not null and nasa_hq.has_role(project_id, 'owner')));

-- ---------- grants: clients read through RLS; every write goes through a function ----------
revoke all on all tables in schema nasa_hq from public, anon, authenticated;
revoke all on all functions in schema nasa_hq from public, anon, authenticated;
grant usage on schema nasa_hq to authenticated, service_role;
grant select on nasa_hq.projects, nasa_hq.project_members, nasa_hq.source_files, nasa_hq.conversations,
  nasa_hq.context_versions, nasa_hq.handoffs, nasa_hq.audit_receipts to authenticated;
grant execute on function nasa_hq.has_role(uuid, text), nasa_hq.save_context(uuid, text, integer, uuid), nasa_hq.latest_context(uuid),
  nasa_hq.invalidate_context(uuid), nasa_hq.create_handoff(uuid, text, text, text, text, text), nasa_hq.update_handoff(uuid, integer, text) to authenticated;
grant all on all tables in schema nasa_hq to service_role;
grant execute on function nasa_hq.index_source_file(text, uuid, text, text, text, text[], timestamptz, text, text, text[]) to service_role;
