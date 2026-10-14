-- CANDIDATE ACCESS GRANTS. DO NOT APPLY. DO NOT IMPORT INTO THE RECONCILED FOUNDATION.
-- The canonical prepared package grants nothing to anon/authenticated/service_role. This file only lets the tests
-- exercise the candidate functions and RLS policies. Whether any role gets any privilege is a separate, specifically
-- approved activation decision for the single backend owner, made after the schema, role and owner/BYPASSRLS
-- behaviour of the live database have been inspected.
grant usage on schema nasa_hq to authenticated, service_role;
grant select on nasa_hq.projects, nasa_hq.project_members, nasa_hq.source_files, nasa_hq.conversations,
  nasa_hq.context_versions, nasa_hq.handoffs, nasa_hq.audit_receipts to authenticated;
grant execute on function nasa_hq.has_role(uuid, text), nasa_hq.file_visible(uuid),
  nasa_hq.create_conversation(uuid, boolean, text, integer, text, text),
  nasa_hq.save_context(uuid, text, integer, uuid, boolean, text), nasa_hq.latest_context(uuid), nasa_hq.invalidate_context(uuid),
  nasa_hq.create_handoff(uuid, text, text, text, text, text), nasa_hq.update_handoff(uuid, integer, text) to authenticated;
-- service_role: ingestion and retention functions only. No table privileges, so no side door around the checks.
grant execute on function
  nasa_hq.index_source_file(text, text, uuid, text, text, text, text[], timestamptz, timestamptz, text, text, text[], uuid, text),
  nasa_hq.grant_restricted_access(text, text, uuid, timestamptz, timestamptz), nasa_hq.revoke_restricted_access(text, text, uuid, timestamptz),
  nasa_hq.set_root_enabled(text, boolean), nasa_hq.purge_expired() to service_role;
