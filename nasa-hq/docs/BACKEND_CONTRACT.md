# Backend contract (DRAFT, NOT APPLIED)

Supabase project `uczhbodqmsxcxymybonn`. Karsa has verified access; **tables, Drive ingestion and recall were not inspected here** (no Supabase tool or credential in this session). Nothing was applied.

## Before applying (checklist)
1. Karsa shares the live schema and migration list; confirm nobody already created projects, members, file index, contexts, handoffs or audit tables. Merge or rename; do not create competing tables.
2. One backend writer owns ingestion. `nasa_hq.index_source_file` is the single write path and is idempotent, so a second job cannot duplicate rows, but two jobs should still not run.
3. Apply to a Supabase branch database first, re-run `db/tests` against it, then promote.

## What the draft provides (schema `nasa_hq`, isolated)
| Need | Mechanism |
|---|---|
| Project membership | `project_members` (viewer/editor/owner); `has_role()`; RLS select policies on every table |
| Source-file index | `source_files` with `unique(root_id, drive_file_id)`; originals preserved (metadata + `source_url`, no copies) |
| Authorized subtree only | `source_roots` allowlist (NOJARA HQ folder `151TXi5udU_tAWo-dyfOuzeufB1f4MBa0`); `root_drive_id = any(ancestor_ids)` CHECK; shortcuts only when their target is inside the root |
| Versioned conversations / memory | `context_versions` `unique(scope_key, version)`, advisory lock, `expected_version` → `version_conflict`; `latest_context()` returns the newest non-invalid version |
| Handoffs | `create_handoff` idempotent on `(project_id, idempotency_key)`; `update_handoff` versioned |
| Audit receipts | `audit_receipts` append-only (update/delete/truncate blocked); every function writes a receipt, including rejections |
| Client writes | none directly: tables are read-only through RLS; writes go through `SECURITY DEFINER` functions; `index_source_file` is `service_role` only |

## Tests (PGlite, synthetic rows) — `npm run test:db`
9 tests: membership isolation, no direct client writes, indexer idempotency/older-revision/other-project, outside-root + shortcut rejection with audit, role enforcement, version conflict + fresh-reader retrieval + invalidation fallback, handoff idempotency/versioning, audit immutability and visibility, down/up reversibility without touching pre-existing tables.

## Not proven
- Supabase Auth JWTs (tests shim `auth.uid()`), Realtime, storage, the live schema, true concurrent writers (the unique constraint and advisory lock are the backstop; PGlite is single-connection).
- Drive ingestion itself (listing, ancestry resolution, permissions): only the database side is specified.
- Per-project Drive permissions: modelled as `project_members`; mapping Drive ACLs to members is a backend task.
