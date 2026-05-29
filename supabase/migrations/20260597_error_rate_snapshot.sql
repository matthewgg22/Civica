-- snap_enrollment — Migration: canonical error-rate snapshot (the "truth point").
--
-- Surfaced by docs/findings/2026-05-29-error-rate-truth-point.md.
--
-- WHY: error-rate stats were only ever produced ad hoc (in code constants, in
-- the /qc page's per-request JS, or worst of all in one-off AI chats that
-- drift between sessions). There was no single, reproducible, team-visible
-- record of "what is our error rate, right now, and where did each number come
-- from." This table is that record.
--
-- SHAPE: one ROW PER METRIC, many rows per refresh run. A run is identified by
-- its shared `computed_at`. The companion view v_error_rate_current returns the
-- latest run — that view is THE thing every surface (dashboard, API, an
-- AI insight-draft step) reads, so everyone sees identical numbers.
--
-- ENGINE OWNS THE MATH: this table stores OUTPUTS only. The values are computed
-- by @civica/snap-qc-engine buildErrorRateSnapshot() in the refresh job
-- (apps/enrollment-api/src/cron/error-rate-snapshot.ts), mirroring the
-- v_qc_pillar_coverage / v_qc_error_rate_by_slice convention (SQL holds data,
-- the engine owns the formula, tested once). No PER arithmetic lives in SQL.
--
-- PROVENANCE: every row carries engine_version + source + computed_at so a
-- reader can trace any number back to how and when it was produced. The four
-- metrics compose the canonical picture:
--   baseline_ca               — published CA total PER (USDA FNS-380), the anchor
--   projected_full_engagement — engine projection at full stack engagement
--   engagement_implied        — live, from v_qc_pillar_coverage coverage today
--   measured_overall          — observed PER from qc_outcomes (n-gated >= 30)

CREATE TABLE snap_enrollment.error_rate_snapshot (
  snapshot_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Run key: all rows from one refresh share this timestamp. The latest
  -- computed_at is "current truth" (see v_error_rate_current).
  computed_at    TIMESTAMPTZ NOT NULL,
  -- snap-qc-engine version that produced the numbers (provenance).
  engine_version TEXT        NOT NULL,
  metric         TEXT        NOT NULL CHECK (metric IN (
                   'baseline_ca',
                   'projected_full_engagement',
                   'engagement_implied',
                   'measured_overall'
                 )),
  -- Point estimate in percentage points. NULL when not yet computable
  -- (e.g. measured_overall below the min-N gate).
  per_pct        NUMERIC(6, 3),
  -- 95% Wilson band for measured_overall; NULL for the others.
  ci_low         NUMERIC(6, 3),
  ci_high        NUMERIC(6, 3),
  -- Sample size for measured_overall; NULL for baseline/projected/implied.
  n              INTEGER,
  -- Fiscal year for the published baseline row; NULL otherwise.
  fiscal_year    INTEGER,
  source         TEXT        NOT NULL CHECK (source IN (
                   'usda_fns_published',
                   'engine_projection',
                   'engine_engagement_implied',
                   'measured_qc_sample'
                 )),
  -- Free-form provenance/context (coverage rates, errors count, status, etc.).
  meta           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  inserted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Current truth" lookup + per-metric history (trend over runs).
CREATE INDEX ON snap_enrollment.error_rate_snapshot (computed_at DESC);
CREATE INDEX ON snap_enrollment.error_rate_snapshot (metric, computed_at DESC);

-- One row per (run, metric): a refresh writes exactly one of each metric.
ALTER TABLE snap_enrollment.error_rate_snapshot
  ADD CONSTRAINT uq_error_rate_snapshot_run_metric UNIQUE (computed_at, metric);

ALTER TABLE snap_enrollment.error_rate_snapshot ENABLE ROW LEVEL SECURITY;

-- Global, non-PII aggregate. Any authenticated dashboard user may read all
-- rows; only the refresh job (service_role) writes. Per-slice MEASURED rates
-- (which could re-identify at low N) are deliberately NOT in this table — that
-- needs min-N suppression first, mirroring v_qc_error_rate_by_slice's deferral.
CREATE POLICY "authenticated can read error rate snapshot"
  ON snap_enrollment.error_rate_snapshot FOR SELECT
  USING (true);

GRANT SELECT         ON snap_enrollment.error_rate_snapshot TO authenticated;
GRANT SELECT, INSERT ON snap_enrollment.error_rate_snapshot TO service_role;

-- ---------------------------------------------------------------------------
-- v_error_rate_current — the latest snapshot run. THE truth point.
-- ---------------------------------------------------------------------------
-- One row per metric from the most recent refresh. Readers never have to know
-- about computed_at grouping — they SELECT * and get the current canonical
-- numbers. Empty until the first refresh job runs.

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
  meta
FROM snap_enrollment.error_rate_snapshot s
WHERE s.computed_at = (
  SELECT max(computed_at) FROM snap_enrollment.error_rate_snapshot
);

GRANT SELECT ON snap_enrollment.v_error_rate_current TO authenticated, service_role;

COMMENT ON TABLE snap_enrollment.error_rate_snapshot IS
  'Canonical error-rate "truth point" (docs/findings/2026-05-29-error-rate-truth-point.md). '
  'One row per metric per refresh run (run key = computed_at). Stores OUTPUTS only; '
  '@civica/snap-qc-engine buildErrorRateSnapshot owns the math. Refreshed daily by '
  'apps/enrollment-api error-rate-snapshot cron (piggybacks the 04:00 slot).';

COMMENT ON VIEW snap_enrollment.v_error_rate_current IS
  'Latest error_rate_snapshot run — the single source every surface reads for '
  'current CA baseline / projected / engagement-implied / measured PER.';
