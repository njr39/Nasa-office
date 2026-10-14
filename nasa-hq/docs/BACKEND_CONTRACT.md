# Backend contract: candidate SQL and reconciliation status (NOTHING APPLIED)

## Ownership and status
- **Karsa owns the single backend.** `0001_nasa_hq_backend.up.sql` here is a **candidate input** to the ONE canonical prepared package (`NASA_HQ_PREPARED_BACKEND_v01/reconciled_nasa_hq.sql`, schema `nasa_hq`, deny-default, FORCE RLS, no privileges for anon/authenticated/service_role). That canonical file was **not available to this author as a file**; its properties above come from the review notes. **This candidate is not the canonical package, must not be applied beside it and must not replace it.** The earlier `nasa_private` draft is superseded and is not used.
- **Grants are not part of the migration.** `0001` creates objects, enables RLS and *revokes* everything. `0002_candidate_access_grants.NOT_FOR_ACTIVATION.sql` exists only so the tests can exercise the functions and policies. It must not be applied or imported. Access activation is a separate, specifically approved step.
- Supabase `uczhbodqmsxcxymybonn`: **no inspection was attempted in this revision**: this session has no Supabase tool or credential. Nothing applied, no grants or credentials created. Drive: not connected, no ingestion run.

## Delta review items (BACKEND_DELTA.md) and what changed
| Item | Resolution in the candidate | Regression test (real PostgreSQL) |
|---|---|---|
| **A.** A stale refresh could restore revoked access and disguise its content timestamp | Content freshness (`modified_time`) and authorization freshness (`authz_observed_at`) are separate. An observation older than the recorded authorization state is refused whole; a same-instant observation cannot restore a revoked file; only a strictly newer, valid observation does, as an access event (no content revision). Revocation advances the clock. | `A. STALE SNAPSHOT after revocation…`, `CONCURRENT revocation racing a restoring snapshot…` |
| **B.** Access-class changes ignored; grants had no freshness | The indexer writes `access_class`. Tightening applies at once (even at the same instant, with same or newer content time); loosening needs a strictly newer observation; stale ACL observations never reopen. Grants are observed, expiring (≤ 30 days), revocable and stale-proof. | `B. ACCESS-CLASS TRANSITIONS…`, `grants are observed, expiring and revocable…` |
| **C.** Removed member still read their conversation; expired conversation could seed context; classification not inherited | Conversation read needs the owner to still be a project viewer, and unexpired. `save_context` refuses an expired conversation, **inherits** `synthetic`/`consent_basis`, and cannot outlive the conversation. `synthetic` has no default; non-synthetic needs a consent basis; no conversation means the caller must classify. | `C. a removed member cannot read…`, `C. an expired conversation cannot seed a context…` |
| **D.** Grants are an activation decision | Moved to a separate not-for-activation file; the migration is deny-default. | `DENY-DEFAULT: the migration alone grants nothing…` |
| NULL `p_access_class`, empty file ids, NULL root-enabled reaching constraint exceptions | Validated explicitly; return JSON with an audit receipt | `explicit argument validation…` |
| `source_revisions` had no immutability, no shortcut/access history | Immutable trigger; shortcut target in each revision; separate immutable `source_access_history` | `source history is immutable…` |
| `review_status` dropped | Restored as its own column, distinct from `access_class` and `status` | `observed metadata is private by default…` |
| Retention values are policy | Labelled **candidate values**, not an approved policy. `purge_expired()` must not be scheduled. | `retention: purge removes only…` |

## Earlier review findings (still covered)
NULL-ancestry bypass, stale visibility after revocation or root disable, conversation ownership, NULL expected version, concurrent revision and context writers, incomplete audit, former editor invalidation, unsafe down migration, retention. See the test names in `db/tests/backend.test.mjs` and the mutation receipts in `docs/mutation-receipts.json`.

## Still open (do not claim done)
1. **Reconcile into the one canonical package**: this candidate has 12 tables vs the prepared 9. The canonical package is the base; port the fixes and tests, not the schema.
2. **Field and parameter mapping**: `account_ref → account_id`, `source_file_revisions → source_revisions`, `is_synthetic → synthetic`, `retention_expires_at/expires_at → retain_until`, and a changed indexer parameter order. Importer, API and view models need an explicit map.
3. **ENABLE vs FORCE RLS** and function owner / BYPASSRLS behaviour: must be settled against the actual database before choosing the final design.
4. **Trusted observations**: Drive ancestry and ACL observations must come from a verified adapter; the SQL only enforces that they are positive, fresh and monotonic.
5. Canonical project/source ID mapping, workspace strategy, and a data-preserving recovery plan before any migration.
6. Applying anything, activating privileges, ingesting, and scheduling retention each need their own decision.

## Not proven
Supabase Auth JWTs (tests shim `auth.uid()` from a setting), Realtime, storage, the live schema, the canonical package, Drive listing and ancestry resolution, mapping Drive ACLs to members.

## Running the tests
`npm run test:db` starts a throwaway PostgreSQL 17 (embedded-postgres binaries, non-root user) on a unix socket. Several tests use separate connections for real concurrency. Version and environment: `docs/test-receipts.json`.
