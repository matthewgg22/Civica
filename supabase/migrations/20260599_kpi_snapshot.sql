-- snap_enrollment — Migration: canonical KPI snapshot (the pillar-tree "truth point").
--
-- Surfaced by the KPI framework design (office-hours 2026-05-30) and locked by
-- /plan-eng-review 2026-05-30 (Phase 1 = error-rate subsystem + outcome unlock).
--
-- WHY: error_rate_snapshot (20260597) proved the "engine owns the math, SQL
-- stores outputs, one row per metric per run" pattern for PER. The KPI
-- framework generalises that to the three product pillars — Get In, Stay
-- Engaged, Stay On — each with ONE leading in-app metric bound to a lagging
-- outcome. We want the same drift-resistance: a deterministic nightly job
-- computes every KPI; surfaces only read. No KPI arithmetic in chat, in
-- per-request JS, or in code constants.
--
-- SHAPE: one ROW PER (kpi_key [, element], source_kind), many rows per run. A
-- run is identified by its shared `computed_at`. v_kpi_current returns the
-- latest run — THE thing the dashboard pillar-tree reads.
--
-- LEADING vs MEASURED (the self-upgrading hybrid): each KPI exists as a
-- `leading` row (an in-app proxy we can compute today, e.g. Clean-Packet Rate
-- from at-submission scoring) and, once outcome data exists, a `measured` row
-- (the real lagging outcome, e.g. observed PER / denial / churn). The dashboard
-- shows the leading value with a "leading" badge until a measured row appears,
-- then flips. source_kind is that discriminator.
--
-- FIDELITY (premise P2 / CRITICAL): the MEASURED PER row is built ONLY from
-- authoritative outcomes (packet_outcomes.source IN (county_authoritative,
-- qc_sample)) — never from applicant self-report. That exclusion lives in the
-- builder query (cron/kpi-snapshot.ts), not here; this table stores the result.
--
-- ENGINE OWNS THE MATH: values are computed by @civica/snap-qc-engine in the
-- refresh job, mirroring error_rate_snapshot. element weights / risk scoring
-- have exactly one home (snap-qc-engine); SQL holds no formulas.
--
-- PROVENANCE: every row carries engine_version + source_kind + computed_at so a
-- reader can trace any number back to how and when it was produced.

CREATE TABLE snap_enrollment.kpi_snapshot (
  snapshot_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Run key: all rows from one refresh share this timestamp. The latest
  -- computed_at is "current truth" (see v_kpi_current).
  computed_at    TIMESTAMPTZ NOT NULL,
  -- snap-qc-engine version that produced the numbers (provenance).
  engine_version TEXT        NOT NULL,
  -- Product pillar this KPI belongs to (the steering tree).
  pillar         TEXT        NOT NULL CHECK (pillar IN (
                   'get_in',        -- Pillar 1: clean packet in, approved
                   'stay_engaged',  -- Pillar 2: active relationship
                   'stay_on'        -- Pillar 3: retained through reporting moments
                 )),
  -- The KPI. Forward-looking set covers all three pillars so Phase 2/3 KPIs
  -- need no migration; Phase 1 writes only the get_in keys + denial_rate.
  kpi_key        TEXT        NOT NULL CHECK (kpi_key IN (
                   -- Pillar 1 — Get In (leading proxies)
                   'clean_packet_rate',                  -- 1a headline CPR
                   'element_clean_rate',                 -- 1b per-QC-element (uses `element`)
                   'operational_addressable_clean_rate', -- 1c the 65/35 operational split
                   -- Pillar 1 — Get In (measured/lagging)
                   'measured_per',                       -- observed PER (authoritative only)
                   'denial_rate',                        -- denied / decided, from outcomes
                   -- Pillar 2 — Stay Engaged
                   'active_relationship_rate',           -- ARR (leading)
                   -- Pillar 3 — Stay On
                   'reporting_moment_coverage',          -- RMC (leading)
                   'churn_rate'                          -- measured/lagging
                 )),
  -- Sub-dimension within a KPI (e.g. the QC element for element_clean_rate:
  -- 'wages', 'shelter', ...). NULL for headline/scalar KPIs.
  element        TEXT,
  -- Point estimate in percentage points. NULL when not yet computable
  -- (e.g. a measured row below the min-N gate, or a deferred Phase 2/3 KPI).
  value_pct      NUMERIC(6, 3),
  -- 95% confidence band for measured rows; NULL for leading rows / pre-N-gate.
  ci_low         NUMERIC(6, 3),
  ci_high        NUMERIC(6, 3),
  -- Sample size behind this row (packets / outcomes). NULL when not applicable.
  n              INTEGER,
  -- External benchmark this KPI steers toward (e.g. published CA PER 10.98 for
  -- the get_in pillar). Lets the dashboard render the gap. NULL when none.
  baseline_ref   NUMERIC(6, 3),
  -- 'leading' = in-app proxy computable today; 'measured' = real lagging outcome.
  source_kind    TEXT        NOT NULL CHECK (source_kind IN ('leading', 'measured')),
  -- Free-form provenance/context (coverage rates, n-gate status, target tier,
  -- element weights, the §10105 tier this maps to, etc.).
  meta           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  inserted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Current truth" lookup + per-KPI history (trend over runs) + pillar-tree fetch.
CREATE INDEX ON snap_enrollment.kpi_snapshot (computed_at DESC);
CREATE INDEX ON snap_enrollment.kpi_snapshot (kpi_key, computed_at DESC);
CREATE INDEX ON snap_enrollment.kpi_snapshot (pillar, computed_at DESC);

-- One row per (run, kpi_key, element, source_kind). element is nullable, and in
-- Postgres NULL <> NULL under a UNIQUE constraint — so two element-less rows
-- would both be allowed, breaking idempotency. A unique INDEX over
-- COALESCE(element,'') closes that gap.
CREATE UNIQUE INDEX uq_kpi_snapshot_run_key
  ON snap_enrollment.kpi_snapshot (computed_at, kpi_key, COALESCE(element, ''), source_kind);

ALTER TABLE snap_enrollment.kpi_snapshot ENABLE ROW LEVEL SECURITY;

-- Global, non-PII aggregate. Any authenticated dashboard user may read all
-- rows; only the refresh job (service_role) writes. Per-element MEASURED rates
-- at low N could re-identify — the builder applies a min-N gate before writing
-- a measured value_pct (mirrors error_rate_snapshot / v_qc_error_rate_by_slice).
CREATE POLICY "authenticated can read kpi snapshot"
  ON snap_enrollment.kpi_snapshot FOR SELECT
  USING (true);

GRANT SELECT         ON snap_enrollment.kpi_snapshot TO authenticated;
GRANT SELECT, INSERT ON snap_enrollment.kpi_snapshot TO service_role;

-- ---------------------------------------------------------------------------
-- v_kpi_current — the latest snapshot run. THE pillar-tree truth point.
-- ---------------------------------------------------------------------------
-- One row per (kpi_key, element, source_kind) from the most recent refresh.
-- Readers SELECT * and get the current canonical numbers. Empty until the
-- first refresh job runs (dashboard must render "leading, n=0", never NaN).

CREATE OR REPLACE VIEW snap_enrollment.v_kpi_current AS
SELECT
  snapshot_id,
  computed_at,
  engine_version,
  pillar,
  kpi_key,
  element,
  value_pct,
  ci_low,
  ci_high,
  n,
  baseline_ref,
  source_kind,
  meta
FROM snap_enrollment.kpi_snapshot s
WHERE s.computed_at = (
  SELECT max(computed_at) FROM snap_enrollment.kpi_snapshot
);

GRANT SELECT ON snap_enrollment.v_kpi_current TO authenticated, service_role;

COMMENT ON TABLE snap_enrollment.kpi_snapshot IS
  'Canonical KPI "truth point" for the three-pillar steering tree (Get In / '
  'Stay Engaged / Stay On). One row per (kpi_key, element, source_kind) per '
  'refresh run (run key = computed_at). source_kind=leading is an in-app proxy; '
  'source_kind=measured is the real lagging outcome (PER built from authoritative '
  'outcomes ONLY). Stores OUTPUTS only; @civica/snap-qc-engine owns the math. '
  'Refreshed daily by apps/enrollment-api kpi-snapshot cron.';

COMMENT ON VIEW snap_enrollment.v_kpi_current IS
  'Latest kpi_snapshot run — the single source the dashboard pillar-tree reads '
  'for current leading/measured KPI values per pillar.';
