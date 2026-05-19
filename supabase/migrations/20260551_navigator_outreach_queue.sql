-- snap_enrollment — Migration: navigator_outreach_queue table (T-DR3-7)
--
-- Holds navigator contact tasks created when a student's confirmed income
-- crosses the SNAP benefit cliff. Navigators must make first contact within
-- sla_hours (default 24). Created by POST /navigator/outreach or the Argyle
-- paycheck webhook (reason = 'cliff_event').

CREATE TABLE snap_enrollment.navigator_outreach_queue (
  outreach_task_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id         UUID        NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  org_id            UUID        NOT NULL REFERENCES snap_enrollment.staff_orgs(org_id) ON DELETE CASCADE,
  applicant_id      UUID        NOT NULL,

  reason            TEXT        NOT NULL
    CHECK (reason IN ('cliff_event', 'manual')),
  income_usd        INTEGER,                            -- confirmed monthly income at cliff detection (USD)
  sla_hours         INTEGER     NOT NULL DEFAULT 24
    CHECK (sla_hours BETWEEN 1 AND 168),
  due_at            TIMESTAMPTZ NOT NULL,

  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'resolved', 'cancelled')),
  contacted_at      TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  resolution_notes  TEXT,

  created_by        TEXT        NOT NULL,               -- staff_id UUID or 'system:argyle-webhook'
  assigned_to       UUID        REFERENCES snap_enrollment.staff_users(staff_id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.navigator_outreach_queue (packet_id);
CREATE INDEX ON snap_enrollment.navigator_outreach_queue (org_id, status);
CREATE INDEX ON snap_enrollment.navigator_outreach_queue (due_at)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS navigator_outreach_queue_updated_at ON snap_enrollment.navigator_outreach_queue;
CREATE TRIGGER navigator_outreach_queue_updated_at
  BEFORE UPDATE ON snap_enrollment.navigator_outreach_queue
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

ALTER TABLE snap_enrollment.navigator_outreach_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "navigator can view own org outreach tasks"
  ON snap_enrollment.navigator_outreach_queue FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "navigator can insert outreach tasks for own org"
  ON snap_enrollment.navigator_outreach_queue FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "navigator can update outreach tasks for own org"
  ON snap_enrollment.navigator_outreach_queue FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- Service role can insert without org context (Argyle webhook, system)
GRANT INSERT ON snap_enrollment.navigator_outreach_queue TO service_role;
