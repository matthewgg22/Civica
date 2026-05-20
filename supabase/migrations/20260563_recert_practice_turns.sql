-- snap_enrollment — Migration: recert_practice_turns table
--
-- Per-turn transcript persistence for the practice chatbot. Each row stores
-- one caseworker question + (optional) applicant response + coaching tip.
--
-- Why: the score endpoint previously read the transcript from the in-memory
-- orchestrator (packages/recert-engine). If the Cloudflare Worker that
-- handled `respond` (setting done=true) was different from the Worker that
-- handled `score`, the in-memory state was gone and the score endpoint
-- returned 410 "transcript lost". Persisting each turn to this child table
-- makes scoring resilient to Worker restarts.

CREATE TABLE snap_enrollment.recert_practice_turns (
  turn_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID        NOT NULL REFERENCES snap_enrollment.recert_practice_sessions(session_id) ON DELETE CASCADE,
  turn_index           SMALLINT    NOT NULL CHECK (turn_index >= 0),
  caseworker_question  TEXT        NOT NULL,
  applicant_response   TEXT,        -- nullable: the very first turn has no response yet
  coaching             JSONB,       -- nullable: only present after the first user response
  audio_bytes_duration INT4,        -- nullable; optional voice-input signal
  asked_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at         TIMESTAMPTZ, -- nullable until applicant responds
  UNIQUE (session_id, turn_index)
);

CREATE INDEX idx_recert_practice_turns_session
  ON snap_enrollment.recert_practice_turns(session_id, turn_index);

ALTER TABLE snap_enrollment.recert_practice_turns ENABLE ROW LEVEL SECURITY;

-- Navigator policies — mirror recert_practice_sessions (org-gated via is_navigator_in_org).
-- Join through sessions → recertifications to resolve org_id.
DROP POLICY IF EXISTS "navigator can view own org practice turns" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "navigator can view own org practice turns"
  ON snap_enrollment.recert_practice_turns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_turns.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

DROP POLICY IF EXISTS "navigator can insert practice turns for own org" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "navigator can insert practice turns for own org"
  ON snap_enrollment.recert_practice_turns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_turns.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

DROP POLICY IF EXISTS "navigator can update practice turns for own org" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "navigator can update practice turns for own org"
  ON snap_enrollment.recert_practice_turns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_turns.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_turns.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

-- Applicant policies — practice is applicant-facing; the applicant owns the
-- turns for their own session. Ownership flows session → recert → packet
-- → applicant.auth_uid (mirrors the score / session policies).
DROP POLICY IF EXISTS "applicant can view own practice turns" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "applicant can view own practice turns"
  ON snap_enrollment.recert_practice_turns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_turns.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can insert own practice turns" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "applicant can insert own practice turns"
  ON snap_enrollment.recert_practice_turns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_turns.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can update own practice turns" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "applicant can update own practice turns"
  ON snap_enrollment.recert_practice_turns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_turns.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_turns.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );
