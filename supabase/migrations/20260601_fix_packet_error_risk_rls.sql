-- snap_enrollment — Migration: fix packet_error_risk applicant SELECT RLS.
--
-- Fixes #407. The original policy in 20260555_error_rate_engine.sql compared
-- snap_packets.applicant_id directly against the auth user id, but
-- snap_packets.applicant_id is an FK to applicants.applicant_id (a gen_uuidv7
-- PK) — NOT the auth user id. The auth user maps to applicants.auth_uid.
-- Result: the policy could essentially never match, so authenticated
-- applicants couldn't read their own error-risk rows via RLS.
--
-- Canonical pattern is packets_own_select in
-- 20260522002_snap_enrollment_07_rls_policies.sql (and now packet_outcomes in
-- 20260600): join through applicants.auth_uid.
--
-- Forward-only: drops the broken policy by name, recreates with the join. Safe
-- to re-apply (DROP POLICY IF EXISTS). Service-role writes are unaffected.

DROP POLICY IF EXISTS "applicant can read own packet risk score"
  ON snap_enrollment.packet_error_risk;

CREATE POLICY "applicant can read own packet risk score"
  ON snap_enrollment.packet_error_risk FOR SELECT TO authenticated
  USING (
    packet_id IN (
      SELECT p.packet_id FROM snap_enrollment.snap_packets p
      WHERE p.applicant_id = (
        SELECT applicant_id FROM snap_enrollment.applicants
        WHERE auth_uid = auth.uid() LIMIT 1
      )
    )
  );
