-- snap_enrollment — Migration: applicant SELECT on recertifications
--
-- The recertifications table previously had only navigator policies (PR T11).
-- The applicant-facing practice flow needs to fetch the user's own active
-- recert. Add a SELECT policy that joins through packets → applicants.

DROP POLICY IF EXISTS "applicant can view own recertifications" ON snap_enrollment.recertifications;
CREATE POLICY "applicant can view own recertifications"
  ON snap_enrollment.recertifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.snap_packets p
      WHERE p.packet_id = recertifications.packet_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

-- Same gap on recert_practice_sessions: PR #215 opened the route to
-- applicants but no applicant SELECT/INSERT/UPDATE policies were added.
-- RLS would silently 404 those calls in production. Add them now.

DROP POLICY IF EXISTS "applicant can view own practice sessions" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "applicant can view own practice sessions"
  ON snap_enrollment.recert_practice_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recertifications r
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE r.recert_id = recert_practice_sessions.recert_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can insert own practice sessions" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "applicant can insert own practice sessions"
  ON snap_enrollment.recert_practice_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recertifications r
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE r.recert_id = recert_practice_sessions.recert_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can update own practice sessions" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "applicant can update own practice sessions"
  ON snap_enrollment.recert_practice_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recertifications r
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE r.recert_id = recert_practice_sessions.recert_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recertifications r
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE r.recert_id = recert_practice_sessions.recert_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );
