-- snap_enrollment — Migration: work_requirement_events table (T12)
--
-- Append-only audit log for every work-requirement status change or
-- navigator action on a packet. References work_requirement_statuses.

CREATE TABLE snap_enrollment.work_requirement_events (
  event_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wr_status_id    UUID        NOT NULL REFERENCES snap_enrollment.work_requirement_statuses(wr_status_id) ON DELETE CASCADE,
  org_id          UUID        NOT NULL,
  actor_id        UUID        NOT NULL,                 -- navigator staff_id
  event_type      TEXT        NOT NULL CHECK (event_type IN (
    'subject_determination', 'exemption_granted', 'exemption_revoked',
    'compliance_verified', 'hours_updated', 'time_limit_incremented',
    'time_limit_reset', 'navigator_note'
  )),
  payload         JSONB       NOT NULL,                 -- event-specific data
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for joining from work_requirement_statuses
CREATE INDEX ON snap_enrollment.work_requirement_events (wr_status_id);

-- RLS
ALTER TABLE snap_enrollment.work_requirement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "navigator can view own org work requirement events" ON snap_enrollment.work_requirement_events;
CREATE POLICY "navigator can view own org work requirement events"
  ON snap_enrollment.work_requirement_events
  FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

DROP POLICY IF EXISTS "navigator can insert work requirement events for own org" ON snap_enrollment.work_requirement_events;
CREATE POLICY "navigator can insert work requirement events for own org"
  ON snap_enrollment.work_requirement_events
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);
