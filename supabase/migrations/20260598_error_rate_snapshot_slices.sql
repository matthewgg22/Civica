-- snap_enrollment — Migration: deepen error_rate_snapshot with slice dimensions.
--
-- Surfaced by docs/findings/2026-05-29-error-rate-truth-point.md (depth pass).
--
-- WHY: the v1 snapshot held four top-line metrics, so /insight could only ever
-- produce a one-liner. This adds per-slice depth so the snapshot carries real
-- analysis: WHICH pillar drives the reduction, the income-group PER cohorts
-- (the TAM story), and where errors actually live by USDA element. All of these
-- are AGGREGATE / published figures (engine constants + the live coverage the
-- refresh already reads) — no per-individual data, so no re-identification risk.
-- Per-slice MEASURED rates (county/language, which CAN re-identify at low N)
-- remain deferred until min-N suppression is built.
--
-- The table is empty until the first refresh, so every ALTER here is instant
-- (no backfill).

-- New slice dimensions. NULL for the four top-line metrics.
ALTER TABLE snap_enrollment.error_rate_snapshot
  ADD COLUMN slice_dim   TEXT,   -- 'pillar' | 'income_group' | 'element' (NULL for top-line)
  ADD COLUMN slice_value TEXT;   -- e.g. 'utility_sua' | 'wage_only' | '363' (NULL for top-line)

-- Allow the new metric values (keep the original four).
ALTER TABLE snap_enrollment.error_rate_snapshot
  DROP CONSTRAINT IF EXISTS error_rate_snapshot_metric_check;
ALTER TABLE snap_enrollment.error_rate_snapshot
  ADD CONSTRAINT error_rate_snapshot_metric_check CHECK (metric IN (
    'baseline_ca',
    'projected_full_engagement',
    'engagement_implied',
    'measured_overall',
    'pillar_contribution',
    'income_group_per',
    'element_attribution'
  ));

-- Allow the new provenance sources.
ALTER TABLE snap_enrollment.error_rate_snapshot
  DROP CONSTRAINT IF EXISTS error_rate_snapshot_source_check;
ALTER TABLE snap_enrollment.error_rate_snapshot
  ADD CONSTRAINT error_rate_snapshot_source_check CHECK (source IN (
    'usda_fns_published',
    'engine_projection',
    'engine_engagement_implied',
    'measured_qc_sample',
    'engine_pillar_attribution',
    'usda_income_group',
    'usda_element_share'
  ));

-- Run-uniqueness now keys on slice_value too (many slices per metric per run).
-- NULLS NOT DISTINCT so the top-line metrics (slice_value IS NULL) still cannot
-- duplicate within a single run.
ALTER TABLE snap_enrollment.error_rate_snapshot
  DROP CONSTRAINT IF EXISTS uq_error_rate_snapshot_run_metric;
ALTER TABLE snap_enrollment.error_rate_snapshot
  ADD CONSTRAINT uq_error_rate_snapshot_run_metric_slice
    UNIQUE NULLS NOT DISTINCT (computed_at, metric, slice_value);

-- Per-slice lookups + per-slice trend across runs.
CREATE INDEX IF NOT EXISTS idx_error_rate_snapshot_slice
  ON snap_enrollment.error_rate_snapshot (slice_dim, slice_value, computed_at DESC);

-- Expose the new columns on the canonical view. CREATE OR REPLACE only allows
-- APPENDING columns (no reorder), so slice_dim/slice_value go at the end —
-- consumers select by name, so position does not matter.
CREATE OR REPLACE VIEW snap_enrollment.v_error_rate_current AS
SELECT
  snapshot_id,
  computed_at,
  engine_version,
  metric,
  per_pct,
  ci_low,
  ci_high,
  n,
  fiscal_year,
  source,
  meta,
  slice_dim,
  slice_value
FROM snap_enrollment.error_rate_snapshot s
WHERE s.computed_at = (
  SELECT max(computed_at) FROM snap_enrollment.error_rate_snapshot
);

GRANT SELECT ON snap_enrollment.v_error_rate_current TO authenticated, service_role;

COMMENT ON COLUMN snap_enrollment.error_rate_snapshot.slice_dim IS
  'Breakdown dimension for sub-metrics: pillar | income_group | element. NULL for top-line metrics.';
COMMENT ON COLUMN snap_enrollment.error_rate_snapshot.slice_value IS
  'Value within slice_dim (e.g. utility_sua, wage_only, 363). NULL for top-line metrics.';
