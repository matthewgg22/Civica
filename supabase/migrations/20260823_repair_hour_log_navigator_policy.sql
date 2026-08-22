-- Backfill the navigator policy 20260565 could not create (#679).
--
-- 20260565 was pasted into prod and PARTIALLY applied: the statements around
-- navigator_read_hour_logs committed, and that policy alone errored on
-- snap_enrollment.org_members — a table created by no migration and present in
-- no database. Prod has carried work_requirement_hour_logs with RLS enabled
-- and exactly one policy ever since, so navigators and staff cannot read hour
-- logs at all.
--
-- It fails CLOSED (no data leaked, a feature simply absent), which is why it
-- went unnoticed for months: nothing errors afterward, it just quietly does
-- not work.
--
-- 20260565 itself is repaired in place so the chain replays; this exists so
-- PROD converges, since Supabase tracks migrations by version and will never
-- re-run that file.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'snap_enrollment'
      AND tablename  = 'work_requirement_hour_logs'
      AND policyname = 'navigator_read_hour_logs'
  ) THEN
    -- is_navigator_in_org() resolves staff_users -> staff_roles and is what
    -- every other staff policy in this schema uses.
    CREATE POLICY navigator_read_hour_logs
      ON snap_enrollment.work_requirement_hour_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM snap_enrollment.snap_packets p
          WHERE p.packet_id = work_requirement_hour_logs.packet_id
            AND snap_enrollment.is_navigator_in_org(p.org_id)
        )
      );
  END IF;
END $$;
