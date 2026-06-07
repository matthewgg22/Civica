-- snap_enrollment — Migration: Mae caseworker-assistant audit log
--
-- A durable, PII-scrubbed record of every "Ask Mae" query, for accountability,
-- error analysis, dispute resolution, and drift detection. Written exclusively
-- by the service role from the dashboard route (apps/dashboard/lib/mae/audit.ts);
-- the caseworker cannot suppress their own audit trail.
--
-- PRIVACY INVARIANT: question_redacted is the question AFTER structured PII
-- (SSN/phone/email/DOB/account numbers) has been scrubbed by lib/mae/pii.ts.
-- Raw applicant PII must never be written here. pii_redactions records how many
-- spans were scrubbed from the input (a signal that a caseworker pasted PII).
--
-- Read access is admin/supervisor/operator only (audit review); inserts are
-- service-role and bypass RLS.

CREATE TABLE IF NOT EXISTS snap_enrollment.mae_query_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_user_id       UUID,                 -- the navigator/caseworker who asked
  question_redacted   TEXT        NOT NULL, -- PII already scrubbed
  answer              TEXT,
  citations           JSONB       NOT NULL DEFAULT '[]'::jsonb, -- [{citation,status}]
  unrecognized_count  INTEGER     NOT NULL DEFAULT 0,           -- flagged (possibly hallucinated) cites
  pii_redactions      INTEGER     NOT NULL DEFAULT 0,           -- PII spans scrubbed from input
  model               TEXT,
  corpus_date         TEXT                                       -- eCFR snapshot the answer was grounded on
);

CREATE INDEX IF NOT EXISTS mae_query_log_created_at_idx
  ON snap_enrollment.mae_query_log (created_at DESC);

-- Surface answers that cited something unrecognized — the review queue for
-- possible hallucinated citations.
CREATE INDEX IF NOT EXISTS mae_query_log_unrecognized_idx
  ON snap_enrollment.mae_query_log (unrecognized_count)
  WHERE unrecognized_count > 0;

ALTER TABLE snap_enrollment.mae_query_log ENABLE ROW LEVEL SECURITY;

-- Read-only for audit reviewers. Inserts come from the service role, which
-- bypasses RLS, so no INSERT policy is needed.
DROP POLICY IF EXISTS mae_query_log_admin_read ON snap_enrollment.mae_query_log;
CREATE POLICY mae_query_log_admin_read
  ON snap_enrollment.mae_query_log
  FOR SELECT
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'supervisor', 'operator')
  );
