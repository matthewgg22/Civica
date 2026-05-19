-- snap_enrollment — Migration: recertification outreach log + opt-out tables
--
-- T14: Twilio adapter backing tables.
--   recert_outreach_log     — per-message audit trail (one row per SMS sent)
--   recert_outreach_optouts — TCPA opt-out registry (hashed phone, cross-org)
--
-- FK to recertifications (T11 table) will be added once T11 migration lands.

-- ---------------------------------------------------------------------------
-- Outreach log
-- ---------------------------------------------------------------------------

CREATE TABLE snap_enrollment.recert_outreach_log (
  log_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recert_id           UUID        NOT NULL,   -- FK to recertifications once T11 migration lands; add FK then
  org_id              UUID        NOT NULL,
  outreach_type       TEXT        NOT NULL CHECK (outreach_type IN (
                        'sms_reminder_30d', 'sms_reminder_7d', 'sms_reminder_0d',
                        'sms_custom', 'call_prep')),
  to_phone            TEXT        NOT NULL,   -- E.164
  body_preview        TEXT,                  -- first 80 chars of message body (not full PII)
  twilio_message_sid  TEXT,
  status              TEXT        NOT NULL DEFAULT 'queued' CHECK (status IN (
                        'queued', 'sent', 'delivered', 'failed', 'opted_out')),
  error_message       TEXT,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.recert_outreach_log (recert_id);
CREATE INDEX ON snap_enrollment.recert_outreach_log (org_id, created_at DESC);

-- RLS: same org_id session-var pattern as other enrollment tables.
-- Service role (Hono API) bypasses RLS; authenticated dashboard/iOS users only
-- see rows belonging to their org.

ALTER TABLE snap_enrollment.recert_outreach_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "navigator can view own org outreach log" ON snap_enrollment.recert_outreach_log;
CREATE POLICY "navigator can view own org outreach log"
  ON snap_enrollment.recert_outreach_log
  FOR SELECT
  USING (snap_enrollment.is_navigator_in_org(org_id));

DROP POLICY IF EXISTS "navigator can insert outreach log for own org" ON snap_enrollment.recert_outreach_log;
CREATE POLICY "navigator can insert outreach log for own org"
  ON snap_enrollment.recert_outreach_log
  FOR INSERT
  WITH CHECK (snap_enrollment.is_navigator_in_org(org_id));

DROP POLICY IF EXISTS "navigator can update outreach log for own org" ON snap_enrollment.recert_outreach_log;
CREATE POLICY "navigator can update outreach log for own org"
  ON snap_enrollment.recert_outreach_log
  FOR UPDATE
  USING (snap_enrollment.is_navigator_in_org(org_id))
  WITH CHECK (snap_enrollment.is_navigator_in_org(org_id));

-- ---------------------------------------------------------------------------
-- Opt-out registry (TCPA — cross-org, no RLS needed)
-- ---------------------------------------------------------------------------

CREATE TABLE snap_enrollment.recert_outreach_optouts (
  optout_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash   TEXT        NOT NULL UNIQUE,  -- SHA-256 of E.164; never store raw phone here
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opted_in_at  TIMESTAMPTZ                  -- set when they opt back in via STOP→START
);

-- No RLS: opt-outs must be honoured globally across orgs (TCPA compliance).
