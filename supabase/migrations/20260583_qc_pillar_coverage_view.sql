-- T9 (eng review 2026-05-25, P2): SQL view that aggregates per-pillar
-- engagement coverage for /qc.
--
-- Why: today's /qc page (app/qc/page.tsx) fetches up to 5000 snap_packets +
-- 5000 argyle_connections + 10000 packet_answers + 10000 uploaded_documents
-- on every request, then computes pillar coverage in JS. This view does the
-- aggregation server-side so the dashboard can call ONE row instead of 6
-- multi-thousand-row scans.
--
-- The view does NOT compute the formula itself — that lives in
-- packages/snap-qc-engine (single source of truth per eng review Step 0
-- scope reduction). The view returns the raw coverage rates the engine
-- functions need; the dashboard imports + calls computeEngagementImpliedPER
-- with those rates.
--
-- v1 returns a single row aggregating across all non-deleted packets. v2
-- could add period filtering (30d / 90d / FY24) by adding a SECURITY DEFINER
-- function that takes a period_start param.
--
-- Promotion path from JS-derived: dashboard reads the view if available,
-- falls back to existing query block otherwise. Wire-up is page-side
-- (separate from this migration).
--
-- Surfaced by: docs/plans/qc-error-rate-intelligence-redesign.md §4 + T9.

CREATE OR REPLACE VIEW snap_enrollment.v_qc_pillar_coverage AS
WITH packets AS (
  SELECT packet_id
  FROM snap_enrollment.snap_packets
  WHERE deleted_at IS NULL
),
argyle AS (
  SELECT DISTINCT packet_id
  FROM snap_enrollment.argyle_connections
  WHERE connected_at IS NOT NULL
),
shelter_docs AS (
  SELECT DISTINCT packet_id
  FROM snap_enrollment.uploaded_documents
  WHERE document_kind = 'lease'
    AND processing_status = 'confirmed'
    AND deleted_at IS NULL
),
sua_engaged AS (
  -- A packet is SUA-engaged when at least one of the 3 utility questions has
  -- a non-null answer.
  SELECT DISTINCT packet_id
  FROM snap_enrollment.packet_answers
  WHERE question_key IN ('has_heating_costs', 'has_electric_or_gas', 'has_phone')
    AND applicant_answer IS NOT NULL
)
SELECT
  (SELECT count(*) FROM packets)         AS total_packets,
  (SELECT count(*) FROM packets p WHERE p.packet_id IN (SELECT packet_id FROM argyle))         AS argyle_connected_packets,
  (SELECT count(*) FROM packets p WHERE p.packet_id IN (SELECT packet_id FROM shelter_docs))   AS shelter_doc_packets,
  (SELECT count(*) FROM packets p WHERE p.packet_id IN (SELECT packet_id FROM sua_engaged))    AS sua_answered_packets,
  -- Pre-computed coverage rates as floats in [0, 1]. Dashboard can read these
  -- directly into engine's PillarCoverage struct. NULLIF guards 0/0 → NULL,
  -- which the engine's clamp01 coerces to 0.
  CASE
    WHEN (SELECT count(*) FROM packets) > 0
    THEN (SELECT count(*) FROM packets p WHERE p.packet_id IN (SELECT packet_id FROM argyle))::float
         / NULLIF((SELECT count(*) FROM packets), 0)::float
    ELSE 0
  END AS gig_income_coverage,
  CASE
    WHEN (SELECT count(*) FROM packets) > 0
    THEN LEAST(
      (SELECT count(*) FROM packets p WHERE p.packet_id IN (SELECT packet_id FROM shelter_docs))::float,
      (SELECT count(*) FROM packets p WHERE p.packet_id IN (SELECT packet_id FROM sua_engaged))::float
    ) / NULLIF((SELECT count(*) FROM packets), 0)::float
    ELSE 0
  END AS utility_sua_coverage,
  -- Phase 2 pillars: 0 today, populate when classifier UI ships.
  0::float AS shared_lease_coverage,
  0::float AS assets_coverage,
  1.0::float AS benefit_impact_coverage;

-- Grants: navigator role + dashboard service role need SELECT.
GRANT SELECT ON snap_enrollment.v_qc_pillar_coverage TO authenticated, service_role;

-- Sanity: view should return exactly one row (or zero if no packets exist).
-- We can't enforce this at migration-time without a CHECK constraint, but the
-- aggregation guarantees it: total/connected/shelter/sua are all scalar
-- subqueries from a single packets CTE.

COMMENT ON VIEW snap_enrollment.v_qc_pillar_coverage IS
  'T9 (qc-error-rate-intelligence-redesign §4): server-side aggregation of '
  '/qc pillar coverage rates. Dashboard imports gig_income_coverage, '
  'utility_sua_coverage (and other pillar coverages) into '
  '@civica/snap-qc-engine computeEngagementImpliedPER. Promotes the per-'
  'request JS aggregation in app/qc/page.tsx to a single SELECT.';
