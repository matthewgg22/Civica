-- snap_enrollment — Migration: Mae caseworker feedback
--
-- Caseworker-initiated quality signal on a Mae answer: thumbs up/down, an
-- optional reason (citation_wrong / incorrect / unclear / other), and an
-- optional note. This is the human-in-the-loop loop the review called for —
-- thumbs-down + "citation wrong" rows become regression cases for the answer
-- eval (lib/mae/eval), and the signal surfaces drift the automatic checks miss.
--
-- PRIVACY INVARIANT: note/question_redacted/answer are PII-scrubbed by
-- lib/mae/pii.ts in the feedback route before insert (a caseworker might paste
-- applicant detail into a note). Raw PII must never land here.
--
-- Written by the service role from the feedback route; read access is
-- admin/supervisor/operator only.

CREATE TABLE IF NOT EXISTS snap_enrollment.mae_feedback (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_user_id      UUID,
  rating             TEXT        NOT NULL CHECK (rating IN ('up', 'down')),
  reason             TEXT        CHECK (reason IN ('citation_wrong', 'incorrect', 'unclear', 'other')),
  note               TEXT,                  -- optional free text, PII-scrubbed
  question_redacted  TEXT,                  -- snapshot for triage, PII-scrubbed
  answer             TEXT                   -- the answer being rated
);

CREATE INDEX IF NOT EXISTS mae_feedback_created_at_idx
  ON snap_enrollment.mae_feedback (created_at DESC);

-- The triage queue: every thumbs-down (esp. citation_wrong) is a candidate
-- regression case for the answer eval.
CREATE INDEX IF NOT EXISTS mae_feedback_down_idx
  ON snap_enrollment.mae_feedback (created_at DESC)
  WHERE rating = 'down';

ALTER TABLE snap_enrollment.mae_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mae_feedback_admin_read ON snap_enrollment.mae_feedback;
CREATE POLICY mae_feedback_admin_read
  ON snap_enrollment.mae_feedback
  FOR SELECT
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'supervisor', 'operator')
  );
