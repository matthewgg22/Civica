-- snap_enrollment — Migration: recert_practice_scores table
--
-- End-of-session scoring for AI-assisted practice interviews. One row per
-- completed practice session (UNIQUE on session_id makes generation
-- idempotent — repeat POST .../score returns the existing row).
--
-- Score generation is driven by Claude Haiku via packages/recert-engine
-- scorer.ts. The applicant sees the result in iOS ReviewSummaryView.

CREATE TABLE snap_enrollment.recert_practice_scores (
  score_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL UNIQUE REFERENCES snap_enrollment.recert_practice_sessions(session_id) ON DELETE CASCADE,
  overall_score   SMALLINT    NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  strengths       JSONB       NOT NULL,
  improvements    JSONB       NOT NULL,
  summary_en      TEXT        NOT NULL,
  summary_es      TEXT        NOT NULL,
  engine_version  TEXT        NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recert_practice_scores_session ON snap_enrollment.recert_practice_scores(session_id);

ALTER TABLE snap_enrollment.recert_practice_scores ENABLE ROW LEVEL SECURITY;

-- Navigator policies — mirror recert_practice_sessions.
-- Join through sessions → recertifications → packets for org gate.
DROP POLICY IF EXISTS "navigator can view own org practice scores" ON snap_enrollment.recert_practice_scores;
CREATE POLICY "navigator can view own org practice scores"
  ON snap_enrollment.recert_practice_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_scores.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

DROP POLICY IF EXISTS "navigator can insert practice scores for own org" ON snap_enrollment.recert_practice_scores;
CREATE POLICY "navigator can insert practice scores for own org"
  ON snap_enrollment.recert_practice_scores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_scores.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

-- Applicant policies — practice is applicant-facing; an applicant must be
-- able to read + insert the score for their own session. Ownership flows
-- session → recertification → packet → applicant.auth_uid.
DROP POLICY IF EXISTS "applicant can view own practice scores" ON snap_enrollment.recert_practice_scores;
CREATE POLICY "applicant can view own practice scores"
  ON snap_enrollment.recert_practice_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_scores.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can insert own practice scores" ON snap_enrollment.recert_practice_scores;
CREATE POLICY "applicant can insert own practice scores"
  ON snap_enrollment.recert_practice_scores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_scores.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );
