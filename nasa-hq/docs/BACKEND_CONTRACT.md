# Backend contract: candidate SQL and reconciliation status (NOTHING APPLIED)

## Ownership and status
- **Karsa owns the single backend.** This directory's `0001_nasa_hq_backend.up.sql` is a **candidate input** to ONE reconciled migration. It must not be applied, and it must not run alongside the prepared `nasa_private` foundation.
- **The `nasa_private` foundation (11 tables) was not available to this author.** I could not diff against it, so I have not claimed a mapping. The checklist below says what the merge has to settle; the merging author needs both files side by side.
- Supabase `uczhbodqmsxcxymybonn`: not inspected, not connected, no grants changed. Drive: not connected, no ingestion run.
- Grants are **narrower** than the first draft: `service_role` has no table privileges at all (only `EXECUTE` on three functions); `authenticated` has `SELECT` through RLS and `EXECUTE` on user functions; `anon` has nothing.

## Review findings and what changed
| # | Finding | Fix in the candidate | Regression test (real PostgreSQL) |
|---|---|---|---|
| 1 | NULL-ancestry bypass: `= ANY` over `{NULL}` yields NULL, CHECK passes NULL | `ancestry_ok()` never returns NULL: non-null, non-empty, no NULL element, root positively present. Used by both CHECKs and the indexer (`invalid_ancestry` vs `outside_root`). Same for shortcut targets | `NULL / empty / NULL-element / rootless ancestry…`, `table CHECKs are a second wall…` |
| 2 | Stale visibility after revocation | Visibility is computed at read time by `file_visible()` from the current root `enabled`, file `status`, `access_class` and grants. The indexer marks an existing row `revoked` when it moves outside the root, the root is disabled, ancestry is invalid or a shortcut target leaves the root | `a file that moves outside the root is revoked…`, `disabling a root hides its files immediately…` |
| 3 | No per-resource ACL intersection | `access_class` defaults to `private_review` (invisible to clients). `project` = project viewers. `restricted` = viewers **and** an explicit `source_file_grants` row. Mapping Drive ACLs to grants is still a backend task | `observed metadata is private by default; restricted files need an explicit grant…` |
| 4 | Conversation spoofing | `save_context` requires the conversation to exist, be owned by the caller and belong to the same project (or both global). `create_conversation` added | `conversation ownership…` |
| 5 | NULL expected version bypass | NULL or negative `p_expected` is `invalid`; same for `update_handoff` | `NULL / negative expected version…`, `handoffs: NULL/stale…` |
| 6 | Concurrent revision overwrite | Per-file advisory lock + `FOR UPDATE`; newer revision only; first-insert race handled; context writers serialized on a `context_scopes` row lock | `CONCURRENT savers…`, `CONCURRENT ingestion of revisions in shuffled order…`, `CONCURRENT ingestion of one file for two projects…` |
| 7 | In-place overwrite, stale metadata | Immutable `source_revisions` (one row per revision, gap-free); updates now set `mime_type` and shortcut target | shuffled-order test checks gap-free history |
| 8 | Broad service path / forgeable root | No table grants for `service_role`; composite FK `(root_id, root_drive_id)` | `grants were not expanded…`, `table CHECKs…` (forged root) |
| 9 | Incomplete audit | Every refusal path writes a receipt (unauthenticated, invalid, forbidden, duplicate, invalidation, rejected ingestion). Functions return `jsonb` instead of raising, so receipts are not rolled back | `every function writes a receipt on every refusal path…`, `handoffs…` |
| 10 | Former editor can invalidate context | Authority is checked against **current** membership | `a removed editor can no longer save or invalidate…` |
| 11 | Unsafe down migration | Down refuses when any context, source, handoff, conversation or audit row exists, unless `nasa_hq.confirm_destructive_down = 'yes_drop_fixture'`. It is a fixture reset, not a production rollback | `down refuses to drop populated data…` |
| 12 | Retention / provenance | `synthetic`, `consent_basis`, bounded `retain_until` on conversations and contexts; audit has its own retention; `purge_expired()` is service-only and the only path that can delete audit rows; version numbers survive purges; sources carry `account_id`, `ingest_run_id`, `access_class` and revisions | `retention: purge removes only expired rows…`, `audit receipts are append-only…` |

How the tests were checked: 8 deliberate mutants of the SQL (naive ancestry, no NULL check, no conversation check, stale-authority invalidate, ignoring root state, no revoke, no advisory lock, deletable audit) each make at least one test fail. Mutant 1 is caught by the CHECK-constraint test rather than the indexer test, because the indexer has its own explicit check as well.

## Reconciliation checklist (for the single migration)
1. One canonical model for **projects, sources, conversations, handoffs**. Pick the foundation's deterministic source ids and revision history; port the fixes above onto them.
2. Keep `ancestry_ok`, the composite root FK, `file_visible`, `access_class`, the context scope counter, and the audit guard + retention.
3. Decide `ENABLE` vs `FORCE ROW LEVEL SECURITY`. The candidate uses `ENABLE` because its `SECURITY DEFINER` functions own the tables; with `FORCE` they would need explicit policies.
4. `SECURITY DEFINER` functions must keep explicit membership checks and a fixed `search_path`.
5. Bootstrap `source_roots` and canonical project mappings only from verified IDs; a migration does not inventory Drive.
6. The browser should talk to a typed server API returning view models, not to these tables directly.
7. Apply to a Supabase branch database first and re-run `npm run test:db` against it.

## Not proven
Supabase Auth JWTs (the tests shim `auth.uid()` from a setting), Realtime, storage, the live schema, Karsa's foundation, Drive listing and ancestry resolution, mapping Drive ACLs to members.

## Running the tests
`npm run test:db` starts a throwaway PostgreSQL 17 (embedded-postgres binaries, non-root user) on a unix socket. Several tests use separate connections to create real concurrency. Version and environment are recorded in `docs/test-receipts.json`.
