-- regops — Source-adapter append-only audit log (E3).
--
-- Source design: docs/designs/regops-engine.md §Architectural Decisions D4
-- (eng review 2026-05-27). The plan's Liability Posture #2 ("chain of
-- custody is in git") was tightened during the eng review — git history
-- of overwriting working snapshots is the wrong place for a regulator's
-- "what did you fetch on date X" question. This table is the right
-- place: append-only, immutable, queryable.
--
-- Every SourceAdapter.fetch() call writes one row here, regardless of
-- outcome (Success, NoChange, TransientFailure, StructuralFailure,
-- SourceWedged). The result_kind column mirrors the FetchResult typed
-- union from packages/regops-engine/src/sources/types.ts. The body of
-- the fetched payload (which can be large — a COLA memo PDF, an ACL
-- HTML page) is NOT stored inline; body_ref points to a cheap blob
-- store (R2, S3, or Supabase Storage) where the raw bytes live.
--
-- Immutability is enforced by trigger, not just RLS, because service_role
-- bypasses RLS but does NOT bypass triggers. A regulator asking "did you
-- alter your audit log" deserves a real "no, the database prevents it"
-- answer, not "we promise we didn't run an admin UPDATE."
--
-- RLS posture for v1: service_role only. Counsel read access lands in
-- E4 (counsel role + RLS policies). Until then, the audit log is
-- engineer-visible via dashboard impersonating service_role.

create schema if not exists regops;

comment on schema regops is
  'RegOps Engine — regulatory-change detection + LLM-assisted drafting '
  'pipeline. See docs/designs/regops-engine.md and docs/regops/runbook.md.';

-- ---------------------------------------------------------------------------
-- 1. source_audit_log — append-only fetch record per SourceAdapter call
-- ---------------------------------------------------------------------------

create table if not exists regops.source_audit_log (
  log_id            uuid        primary key default snap_enrollment.gen_uuidv7(),

  -- Source adapter identifier. Matches the `id` field on the SourceAdapter
  -- interface. Examples: 'usda-fns-cola', 'ca-cdss-acl', 'ftc-actions'.
  -- Not a foreign key; the adapter registry lives in code, not the db.
  source_id         text        not null
    check (source_id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),

  -- Wall-clock time the fetch attempt completed (success or failure).
  -- Always UTC. Use clock_timestamp() not now() so concurrent inserts in
  -- the same transaction get distinct timestamps.
  fetched_at        timestamptz not null default clock_timestamp(),

  -- The URL fetched. Includes query string if present. Length cap is a
  -- defense against absurd inputs; real-world source URLs are well under
  -- this limit.
  url               text        not null
    check (length(url) between 8 and 2048),

  -- Content hash of the fetched payload (SHA-256 of the response body
  -- bytes). Empty string is permitted for failure variants where no body
  -- was received. Consumers dedupe by (source_id, url_hash) to detect
  -- "same content as last fetch" without re-parsing.
  url_hash          text        not null
    check (length(url_hash) between 0 and 128),

  -- HTTP status code. NULL when no response was received (DNS error,
  -- timeout, connection refused). Failure variants typically have a code
  -- in 4xx/5xx; success has 2xx.
  http_status       int
    check (http_status is null or http_status between 100 and 599),

  -- Discriminant matching FetchResult.kind from
  -- packages/regops-engine/src/sources/types.ts. Constrained to the
  -- five known variants; the SourceAdapter base class is the only writer
  -- and emits only these values. New variants in the typed union require
  -- a migration to extend this check.
  result_kind       text        not null
    check (result_kind in (
      'Success', 'NoChange', 'TransientFailure',
      'StructuralFailure', 'SourceWedged'
    )),

  -- Response headers as a JSON object. Lower-cased keys by convention.
  -- Stored verbatim so a regulator can verify Cache-Control / Last-Modified
  -- / Etag claims. NULL if no response was received.
  response_headers  jsonb,

  -- Pointer to the stored body (e.g. 'r2://regops-raw/usda/2026-08-15.pdf'
  -- or 'sb-storage://regops-raw/cdss/acl-25-42.html'). NULL when no body
  -- was fetched (network failure) or when the body was empty (NoChange
  -- with cached urlHash match — body re-fetch skipped).
  body_ref          text
    check (body_ref is null or length(body_ref) between 4 and 512),

  -- Human-readable error string for failure variants. NULL on Success /
  -- NoChange. The Sentry alert that fires on regops.source.* reads this
  -- field for the alert subject.
  error             text
    check (error is null or length(error) between 1 and 4096),

  -- Adapter-specific extra metadata (e.g. parsed page count, doc title,
  -- detected supersession edges). Free-form JSON; each adapter documents
  -- its own shape. Kept separate from response_headers so audit-log
  -- consumers can filter cheaply.
  metadata          jsonb       not null default '{}'::jsonb,

  -- Defense: every successful fetch must have a hash; every failure must
  -- name an error.
  constraint source_audit_log_success_has_hash
    check (result_kind not in ('Success', 'NoChange') or length(url_hash) > 0),
  constraint source_audit_log_failure_has_error
    check (
      result_kind not in ('TransientFailure', 'StructuralFailure', 'SourceWedged')
      or (error is not null and length(error) > 0)
    )
);

comment on table regops.source_audit_log is
  'Append-only audit log of every SourceAdapter.fetch() call. Immutable '
  'via trigger (not just RLS) so service_role cannot alter history. '
  'Liability Posture #2 — citation chain-of-custody. See docs/designs/'
  'regops-engine.md §D4 and docs/regops/runbook.md.';

comment on column regops.source_audit_log.result_kind is
  'Mirrors FetchResult.kind discriminant in packages/regops-engine/src/'
  'sources/types.ts. New variants require both code + check-constraint '
  'migration.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary query pattern: "most recent N fetches for source X."
create index source_audit_log_source_fetched_idx
  on regops.source_audit_log (source_id, fetched_at desc);

-- Secondary: filter by result_kind across all sources for ops dashboards.
create index source_audit_log_result_kind_idx
  on regops.source_audit_log (result_kind, fetched_at desc);

-- url_hash lookup for "have we already fetched this content?" dedupe.
create index source_audit_log_url_hash_idx
  on regops.source_audit_log (source_id, url_hash)
  where (url_hash <> '');

-- ---------------------------------------------------------------------------
-- Immutability — trigger denies UPDATE and DELETE for ALL roles
-- ---------------------------------------------------------------------------

-- service_role bypasses RLS but does NOT bypass triggers. Combined with
-- the RLS posture below, this gives us a true append-only table that
-- even the service role cannot alter through normal SQL.
--
-- The deliberate exception is direct postgres-superuser action (a DBA
-- with cluster access can disable the trigger). That is the same level
-- of trust required to drop the table entirely, so it's outside the
-- threat model this trigger defends against.

create or replace function regops.source_audit_log_block_mutation()
  returns trigger
  language plpgsql
  as $$
begin
  raise exception
    'regops.source_audit_log is append-only. % is not permitted. '
    'If you genuinely need to alter audit history (e.g., redact PII '
    'under legal obligation), do so via a documented operational '
    'procedure that drops and recreates this trigger.',
    tg_op;
end;
$$;

create trigger source_audit_log_block_update
  before update on regops.source_audit_log
  for each row execute function regops.source_audit_log_block_mutation();

create trigger source_audit_log_block_delete
  before delete on regops.source_audit_log
  for each row execute function regops.source_audit_log_block_mutation();

-- TRUNCATE bypasses row-level triggers; block it with a statement trigger.
create trigger source_audit_log_block_truncate
  before truncate on regops.source_audit_log
  for each statement execute function regops.source_audit_log_block_mutation();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- v1: service_role can INSERT and SELECT. No other role has access.
-- Counsel SELECT (domain-scoped) lands in E4 alongside the counsel role.
-- Dashboard/admin SELECT lands when an admin role is added; until then,
-- queries go through the enrollment-api gateway impersonating service_role.

alter table regops.source_audit_log enable row level security;

create policy source_audit_log_service_role_all
  on regops.source_audit_log
  for all to service_role using (true) with check (true);
