-- snap_enrollment — Migration: recert_practice_sessions table (T11)
--
-- Tracks AI-assisted practice interview sessions for recertification.
-- Each session is associated with a recertification record and stores
-- turn count, accumulated flags, and completion status.

CREATE TABLE snap_enrollment.recert_practice_sessions (
  session_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recert_id    UUID        NOT NULL REFERENCES snap_enrollment.recertifications(recert_id) ON DELETE CASCADE,
  org_id       UUID        NOT NULL,
  state_code   TEXT        NOT NULL CHECK (state_code IN ('CA', 'MA')),
  turn_count   INTEGER     NOT NULL DEFAULT 0,
  flags        JSONB       NOT NULL DEFAULT '[]',
  done         BOOLEAN     NOT NULL DEFAULT FALSE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on recert_id for session lookups by recertification
CREATE INDEX ON snap_enrollment.recert_practice_sessions (recert_id);
CREATE INDEX ON snap_enrollment.recert_practice_sessions (org_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS recert_practice_sessions_updated_at ON snap_enrollment.recert_practice_sessions;
CREATE TRIGGER recert_practice_sessions_updated_at
  BEFORE UPDATE ON snap_enrollment.recert_practice_sessions
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

-- RLS
ALTER TABLE snap_enrollment.recert_practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "navigator can view own org practice sessions" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "navigator can view own org practice sessions"
  ON snap_enrollment.recert_practice_sessions
  FOR SELECT
  USING (snap_enrollment.is_navigator_in_org(org_id));

DROP POLICY IF EXISTS "navigator can insert practice sessions for own org" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "navigator can insert practice sessions for own org"
  ON snap_enrollment.recert_practice_sessions
  FOR INSERT
  WITH CHECK (snap_enrollment.is_navigator_in_org(org_id));

DROP POLICY IF EXISTS "navigator can update practice sessions for own org" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "navigator can update practice sessions for own org"
  ON snap_enrollment.recert_practice_sessions
  FOR UPDATE
  USING (snap_enrollment.is_navigator_in_org(org_id))
  WITH CHECK (snap_enrollment.is_navigator_in_org(org_id));
