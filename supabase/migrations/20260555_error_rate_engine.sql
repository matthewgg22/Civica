-- snap_enrollment — Migration: pre-submission error risk engine tables
--
-- packet_error_risk: cached scoring output from scoreErrorRisk().
--   Multiple rows per packet are expected (one per engine version).
--   Query for current score: ORDER BY created_at DESC LIMIT 1.
--
-- qc_outcomes: navigator-logged QC sampling results.
--   Only QC-sampled cases (qc_sampled = true) have error_found set.
--   Unsampled cases must have error_found = NULL — unsampled ≠ clean.
--   The Phase 2 retraining pipeline filters to qc_sampled = true only.

-- ── packet_error_risk ────────────────────────────────────────────────────────

CREATE TABLE snap_enrollment.packet_error_risk (
  risk_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id      UUID        NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  engine_version TEXT        NOT NULL,
  score          INT,
  factors        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  tier           TEXT        NOT NULL CHECK (tier IN ('high', 'medium', 'low', 'incomplete')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.packet_error_risk (packet_id, created_at DESC);

ALTER TABLE snap_enrollment.packet_error_risk ENABLE ROW LEVEL SECURITY;

-- Applicants can read their own packet's risk score
CREATE POLICY "applicant can read own packet risk score"
  ON snap_enrollment.packet_error_risk FOR SELECT
  USING (
    packet_id IN (
      SELECT packet_id FROM snap_enrollment.snap_packets WHERE applicant_id = auth.uid()
    )
  );

-- Service role writes (scoreErrorRisk cache, no direct user writes)
GRANT SELECT ON snap_enrollment.packet_error_risk TO authenticated;
GRANT SELECT, INSERT ON snap_enrollment.packet_error_risk TO service_role;

-- ── qc_outcomes ──────────────────────────────────────────────────────────────

CREATE TABLE snap_enrollment.qc_outcomes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id       UUID        NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  org_id          UUID        NOT NULL,
  qc_sampled      BOOLEAN     NOT NULL,
  -- error_found must be NULL when qc_sampled = false (not reviewed ≠ clean)
  error_found     BOOLEAN,
  error_type      TEXT,
  error_amount    NUMERIC(10, 2),
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  logged_by       UUID        REFERENCES auth.users(id)
);

ALTER TABLE snap_enrollment.qc_outcomes ADD CONSTRAINT qc_outcomes_unsampled_no_error
  CHECK (qc_sampled OR error_found IS NULL);

CREATE INDEX ON snap_enrollment.qc_outcomes (packet_id);
CREATE INDEX ON snap_enrollment.qc_outcomes (org_id, logged_at DESC);
-- Retraining pipeline query: filtered to sampled cases only
CREATE INDEX ON snap_enrollment.qc_outcomes (qc_sampled, logged_at DESC) WHERE qc_sampled = true;

ALTER TABLE snap_enrollment.qc_outcomes ENABLE ROW LEVEL SECURITY;

-- Navigators can INSERT and SELECT outcomes for their own org
CREATE POLICY "navigator can manage own org qc outcomes"
  ON snap_enrollment.qc_outcomes FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM snap_enrollment.navigator_outreach_queue
      WHERE created_by = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM snap_enrollment.navigator_outreach_queue
      WHERE created_by = auth.uid()
      LIMIT 1
    )
  );

-- Service role bypasses RLS (used by retraining pipeline)
GRANT SELECT, INSERT ON snap_enrollment.qc_outcomes TO service_role;
GRANT SELECT ON snap_enrollment.qc_outcomes TO authenticated;
