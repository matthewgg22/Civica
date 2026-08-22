-- REPAIRED 2026-08-22 (#679). This migration could not be applied to an empty
-- database: it referenced an object that exists nowhere, so `supabase start`
-- aborted here and nobody could stand up a Postgres from this repo.
--
-- Editing an applied migration is normally wrong. It is right here because
-- Supabase tracks applied migrations BY VERSION, so this file will never
-- re-run against prod — and leaving it broken means the chain can never
-- replay, which is what let prod and the repo drift apart unseen in the first
-- place. Prod's own convergence is handled by a forward migration
-- (20260822_repair_hour_log_navigator_policy.sql), not by this edit.

-- ---------------------------------------------------------------------------
-- Work requirement hour logs — OBBBA §10102 / 7 CFR 273.24
--
-- Per-session hours log for SNAP recipients subject to the 80-hour/month
-- work requirement. Applicant-writable (RLS allows own rows). Monthly
-- rollup is SUM(hours) WHERE work_date IN current month.
--
-- Compliance citations:
--   7 CFR 273.24   — time limit + hours documentation requirement
--   7 CFR 273.12(c) — 10-day change reporting (alert computed from rollup)
--   7 CFR 273.7(g)  — written notice (surfaced at subject determination)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS snap_enrollment.work_requirement_hour_logs (
  log_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wr_status_id    UUID        NOT NULL
                              REFERENCES snap_enrollment.work_requirement_statuses(wr_status_id)
                              ON DELETE CASCADE,
  packet_id       UUID        NOT NULL
                              REFERENCES snap_enrollment.snap_packets(packet_id)
                              ON DELETE CASCADE,
  applicant_id    UUID        NOT NULL,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  work_date       DATE        NOT NULL,
  hours           NUMERIC(4,1) NOT NULL
                              CHECK (hours > 0 AND hours <= 24),
  activity_type   TEXT        NOT NULL
                              CHECK (activity_type IN (
                                'work', 'training', 'volunteering', 'job_search'
                              )),
  employer_name   TEXT,
  -- Nullable FK to uploaded_documents — attached pay stub / employer letter.
  -- The applicant logs hours first; doc can be attached immediately or later.
  document_id     UUID
                              REFERENCES snap_enrollment.uploaded_documents(document_id)
                              ON DELETE SET NULL,
  notes           TEXT        CHECK (char_length(notes) <= 2000)
);

-- Fast monthly rollup: SUM(hours) WHERE packet_id = X AND work_date >= first_of_month
CREATE INDEX work_requirement_hour_logs_packet_month
  ON snap_enrollment.work_requirement_hour_logs (packet_id, work_date DESC);

-- ---------------------------------------------------------------------------
-- RLS — applicants can insert + select their own rows only.
--       Navigators (staff role) can select all rows for packets in their org.
-- ---------------------------------------------------------------------------
ALTER TABLE snap_enrollment.work_requirement_hour_logs ENABLE ROW LEVEL SECURITY;

-- Applicant: full access to own rows
CREATE POLICY "applicant_own_hour_logs"
  ON snap_enrollment.work_requirement_hour_logs
  FOR ALL
  USING (applicant_id = auth.uid())
  WITH CHECK (applicant_id = auth.uid());

-- Navigator / staff: read all logs for packets in their org
CREATE POLICY "navigator_read_hour_logs"
  ON snap_enrollment.work_requirement_hour_logs
  FOR SELECT
  USING (
    EXISTS (
      -- was: JOIN snap_enrollment.org_members om ON om.org_id = p.org_id
      --      AND om.user_id = auth.uid()
      -- org_members is created by no migration and exists in no database.
      -- is_navigator_in_org() (20260522002) is what every other staff policy
      -- in this schema uses, and it resolves staff_users -> staff_roles.
      SELECT 1
      FROM snap_enrollment.snap_packets p
      WHERE p.packet_id = work_requirement_hour_logs.packet_id
        AND snap_enrollment.is_navigator_in_org(p.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Helper view: monthly rollup per packet
-- Used by the API's monthly_summary response and navigator dashboard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW snap_enrollment.work_requirement_monthly_summary AS
SELECT
  packet_id,
  wr_status_id,
  applicant_id,
  date_trunc('month', work_date)::date                    AS month_start,
  to_char(work_date, 'YYYY-MM')                           AS month,
  COALESCE(SUM(hours), 0)                                 AS total_hours,
  80.0                                                    AS target_hours,
  COUNT(*)                                                AS entries_count,
  COUNT(*) FILTER (WHERE document_id IS NOT NULL) > 0     AS has_documentation
FROM snap_enrollment.work_requirement_hour_logs
GROUP BY packet_id, wr_status_id, applicant_id, date_trunc('month', work_date), to_char(work_date, 'YYYY-MM');
