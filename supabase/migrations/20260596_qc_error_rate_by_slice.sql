-- snap_enrollment — Migration: per-slice QC error-rate view (A1, Wilson-first).
--
-- Surfaced by docs/plans/error-attribution-ledger.md. The plan's amendments
-- (A1–A5) flagged the full Beta-Binomial event-sourced ledger as PREMATURE:
-- there is no per-rule trial population and no single canonical hierarchy yet.
-- The chosen v1 is the recorded "Considered simpler alternative" — one view of
-- per-slice error rates over the SAMPLED population, with the confidence band
-- computed by a unit-tested engine function (Wilson), not in SQL.
--
-- This closes the A1 hard prerequisite ("the per-slice denominator does not
-- exist") WITHOUT a schema change: every slice dimension is already present in
-- plaintext and JOINable from qc_outcomes —
--   qc_outcomes.packet_id  -> snap_packets.county, snap_packets.county_fips
--   snap_packets.applicant_id -> applicants.preferred_language
--   qc_outcomes.error_type (already on the row)
-- so denormalising columns onto qc_outcomes (which the plan floated) is an
-- unnecessary perf optimisation at QC volumes. No ALTER TABLE, no backfill.
-- `cohort` is intentionally omitted: it is not a stored column anywhere and
-- would have to be derived — a justified v2 add once a source is defined.
--
-- Population correctness (amendment A2): numerator AND denominator both come
-- from the SAME sampled population — completed reviews only
-- (qc_sampled = true AND error_found IS NOT NULL). No all-packets/sampled
-- population mismatch.
--
-- The interval math lives in packages/snap-qc-engine (wilsonInterval), mirroring
-- the v_qc_pillar_coverage convention: the VIEW returns raw counts (n, errors);
-- the ENGINE owns the formula so it is tested once and reused identically.

-- ---------------------------------------------------------------------------
-- v_qc_error_rate_by_slice
-- ---------------------------------------------------------------------------
--
-- security_invoker = true is LOAD-BEARING. In Postgres 15+ a plain view runs
-- with the view OWNER's privileges, which would BYPASS qc_outcomes' row-level
-- security and leak every org's QC results to any navigator. security_invoker
-- makes the view evaluate RLS as the *querying* user, so each navigator sees
-- only their own org's slices (the per-org scope chosen for v1). A cross-org
-- aggregate leaderboard is deliberately deferred: it needs a min-N suppression
-- rule (a 1-review slice with an error reads as 100% and could re-identify an
-- individual) and an explicit exposure decision.

CREATE OR REPLACE VIEW snap_enrollment.v_qc_error_rate_by_slice
WITH (security_invoker = true) AS
WITH reviewed AS (
  SELECT
    p.county,
    p.county_fips,
    a.preferred_language,
    o.error_type,
    o.error_found
  FROM snap_enrollment.qc_outcomes o
  JOIN snap_enrollment.snap_packets p ON p.packet_id = o.packet_id
  JOIN snap_enrollment.applicants   a ON a.applicant_id = p.applicant_id
  WHERE o.qc_sampled = true
    AND o.error_found IS NOT NULL   -- completed reviews only; unreviewed ≠ clean
    AND p.deleted_at IS NULL
),
sliced AS (
  SELECT 'county'::text      AS slice_dim,
         COALESCE(county, '(unknown)')                       AS slice_value,
         error_found
  FROM reviewed
  UNION ALL
  SELECT 'county_fips',
         COALESCE(county_fips, '(unknown)'),
         error_found
  FROM reviewed
  UNION ALL
  SELECT 'language',
         COALESCE(NULLIF(preferred_language, ''), 'en'),
         error_found
  FROM reviewed
  UNION ALL
  SELECT 'error_type',
         COALESCE(error_type, '(unspecified)'),
         error_found
  FROM reviewed
)
SELECT
  slice_dim,
  slice_value,
  COUNT(*)::bigint                            AS n,       -- denominator
  COUNT(*) FILTER (WHERE error_found)::bigint AS errors   -- numerator
FROM sliced
GROUP BY slice_dim, slice_value;

GRANT SELECT ON snap_enrollment.v_qc_error_rate_by_slice TO authenticated;
GRANT SELECT ON snap_enrollment.v_qc_error_rate_by_slice TO service_role;

COMMENT ON VIEW snap_enrollment.v_qc_error_rate_by_slice IS
  'Per-slice QC error counts over the SAMPLED population (completed reviews '
  'only: qc_sampled AND error_found IS NOT NULL). One row per (slice_dim, '
  'slice_value); slice_dim ∈ {county, county_fips, language, error_type}. '
  'Returns raw n + errors; the Wilson confidence band is computed by '
  'packages/snap-qc-engine wilsonInterval (math single-sourced in the engine, '
  'not SQL). security_invoker = true => per-org via qc_outcomes RLS. '
  'A1 Wilson-first v1 per docs/plans/error-attribution-ledger.md; the full '
  'Beta-Binomial ledger is the deferred v2.';
