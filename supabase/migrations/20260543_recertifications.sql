-- snap_enrollment — Migration: recertifications table (T11)
--
-- Tracks the recertification lifecycle for a SNAP packet:
-- schedule, interview status, practice session metadata, and outcome.

CREATE TABLE snap_enrollment.recertifications (
  recert_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id             UUID        NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  org_id                UUID        NOT NULL,
  cert_period_end       DATE        NOT NULL,
  cert_period_end_source TEXT        NOT NULL DEFAULT 'estimated'
                          CHECK (cert_period_end_source IN ('estimated', 'manual', 'agency_confirmed')),
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending',
                            'interview_scheduled',
                            'interview_complete',
                            'submitted',
                            'approved',
                            'denied',
                            'opted_out',
                            'lapsed'
                          )),
  outcome               TEXT        CHECK (outcome IN ('approved', 'denied', 'withdrawn', 'lapsed')),
  opted_out_at          TIMESTAMPTZ,
  interview_completed_at TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  reminder_30d_sent_at  TIMESTAMPTZ,
  reminder_7d_sent_at   TIMESTAMPTZ,
  reminder_0d_sent_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX ON snap_enrollment.recertifications (packet_id);
CREATE INDEX ON snap_enrollment.recertifications (org_id, cert_period_end);
CREATE INDEX ON snap_enrollment.recertifications (status);

-- updated_at trigger
DROP TRIGGER IF EXISTS recertifications_updated_at ON snap_enrollment.recertifications;
CREATE TRIGGER recertifications_updated_at
  BEFORE UPDATE ON snap_enrollment.recertifications
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

-- RLS
ALTER TABLE snap_enrollment.recertifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "navigator can view own org recertifications" ON snap_enrollment.recertifications;
CREATE POLICY "navigator can view own org recertifications"
  ON snap_enrollment.recertifications
  FOR SELECT
  USING (snap_enrollment.is_navigator_in_org(org_id));

DROP POLICY IF EXISTS "navigator can insert recertifications for own org" ON snap_enrollment.recertifications;
CREATE POLICY "navigator can insert recertifications for own org"
  ON snap_enrollment.recertifications
  FOR INSERT
  WITH CHECK (snap_enrollment.is_navigator_in_org(org_id));

DROP POLICY IF EXISTS "navigator can update recertifications for own org" ON snap_enrollment.recertifications;
CREATE POLICY "navigator can update recertifications for own org"
  ON snap_enrollment.recertifications
  FOR UPDATE
  USING (snap_enrollment.is_navigator_in_org(org_id))
  WITH CHECK (snap_enrollment.is_navigator_in_org(org_id));

-- FK from T14 outreach log: now that this table exists, add the constraint
ALTER TABLE snap_enrollment.recert_outreach_log
  ADD CONSTRAINT recert_outreach_log_recert_id_fk
  FOREIGN KEY (recert_id) REFERENCES snap_enrollment.recertifications(recert_id) ON DELETE CASCADE;
