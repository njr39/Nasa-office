-- FIXTURE RESET ONLY. Refuses to run when any approved record, source file or audit receipt exists.
-- To drop a populated fixture database deliberately: set nasa_hq.confirm_destructive_down = 'yes_drop_fixture' first.
-- A production rollback needs a data-preserving plan agreed with the backend owner; this is not it.
do $$
begin
  if to_regclass('nasa_hq.audit_receipts') is not null
     and coalesce(current_setting('nasa_hq.confirm_destructive_down', true), '') <> 'yes_drop_fixture'
     and (exists (select 1 from nasa_hq.audit_receipts) or exists (select 1 from nasa_hq.context_versions)
          or exists (select 1 from nasa_hq.source_files) or exists (select 1 from nasa_hq.handoffs) or exists (select 1 from nasa_hq.conversations)) then
    raise exception 'nasa_hq contains data; refusing destructive down migration';
  end if;
end $$;
drop schema if exists nasa_hq cascade;
