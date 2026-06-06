-- snap_enrollment — Migration: notifications event spine (#514, engine integration E5)
--
-- The single durable record of "something happened that a human or a channel
-- should know about." This is the SPINE, not a channel: lifecycle events
-- (packet status changes, recert windows), engine events (Component R
-- recommendations, QC interrupts, income cliffs) all land here as rows, and
-- downstream channels (the navigator inbox at /outreach, APNs push, email)
-- read from it. /outreach already renders navigator-facing work from
-- navigator_outreach_queue; this table generalises that into a typed event
-- log the loop-integration phase (recommendation -> outreach task ->
-- notification) can build on without re-deriving event semantics each time.
--
-- DV-SAFETY INVARIANT: contact_safety_concern (and any safety-flag axis) must
-- NEVER be written into title/body/payload. The dispatcher (lib/notifications)
-- strips safety keys before insert; this comment is the schema-level reminder.
--
-- Inserted exclusively by service_role (enrollment-api dispatcher). Read +
-- mark-read/resolve are org-scoped to navigators, mirroring
-- navigator_outreach_queue's RLS exactly.

CREATE TABLE IF NOT EXISTS snap_enrollment.notifications (
  notification_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES snap_enrollment.staff_orgs(org_id) ON DELETE CASCADE,
  packet_id        UUID        REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  applicant_id     UUID,

  -- Open vocabulary on purpose: the spine must absorb new event kinds
  -- (recommendation_generated, recert_due, …) WITHOUT a migration. The known
  -- set is documented in lib/notifications.ts (NOTIFICATION_EVENT_TYPES).
  event_type       TEXT        NOT NULL,

  channel          TEXT        NOT NULL DEFAULT 'inbox'
    CHECK (channel IN ('inbox', 'push', 'email')),
  severity         TEXT        NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'action', 'urgent')),

  title            TEXT        NOT NULL,
  body             TEXT,
  source           TEXT        NOT NULL,                -- e.g. 'system:argyle-webhook', 'engine:recommendation'

  -- Idempotency key. Two emits of the same logical event (webhook retry,
  -- cron re-run) collapse to one row via ON CONFLICT DO NOTHING.
  dedupe_key       TEXT,

  payload          JSONB       NOT NULL DEFAULT '{}'::jsonb,

  read_at          TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_org_created_idx
  ON snap_enrollment.notifications (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_packet_idx
  ON snap_enrollment.notifications (packet_id);
-- Unread inbox feed — the hot read path for the navigator "needs attention"
-- surface. Partial so it stays small as resolved rows accumulate.
CREATE INDEX IF NOT EXISTS notifications_org_unread_idx
  ON snap_enrollment.notifications (org_id, created_at DESC)
  WHERE read_at IS NULL;
-- Idempotency: at most one row per logical event.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_idx
  ON snap_enrollment.notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

DROP TRIGGER IF EXISTS notifications_updated_at ON snap_enrollment.notifications;
CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON snap_enrollment.notifications
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

ALTER TABLE snap_enrollment.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "navigator can view own org notifications"
  ON snap_enrollment.notifications FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Mark-read / resolve only — navigators never insert notifications by hand;
-- the spine is system-authored. UPDATE is scoped to the navigator's org.
CREATE POLICY "navigator can update own org notifications"
  ON snap_enrollment.notifications FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- Service role (enrollment-api dispatcher) inserts without org context.
GRANT INSERT ON snap_enrollment.notifications TO service_role;
