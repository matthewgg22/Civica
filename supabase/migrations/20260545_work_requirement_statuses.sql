-- snap_enrollment — Migration: work_requirement_statuses table (T12)
--
-- Tracks OBBBA §10102 work-requirement status per enrollment packet.
-- Determination is either computed by the rules engine or overridden by a navigator.

CREATE TABLE snap_enrollment.work_requirement_statuses (
  wr_status_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id         UUID        NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  org_id            UUID        NOT NULL REFERENCES snap_enrollment.staff_orgs(org_id) ON DELETE CASCADE,
  applicant_id      UUID        NOT NULL,               -- denorm for fast lookup

  -- Subject determination
  is_subject        BOOLEAN     NOT NULL,               -- true if household member(s) meet §10102 criteria
  subject_member_ids UUID[]     NOT NULL DEFAULT '{}',  -- which household members are subject
  determination_basis TEXT      NOT NULL
    CHECK (determination_basis IN ('rules_engine', 'navigator_override')),
  determined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exemption (if not subject or exempt)
  exemption_type    TEXT        CHECK (exemption_type IN (
    'disability', 'pregnancy', 'caretaker_under_6', 'qualifying_program',
    'waiver_county', 'ssdi_ssi', 'none'
  )),
  exemption_documented_at TIMESTAMPTZ,
  exemption_expires_at    TIMESTAMPTZ,                  -- for temporary exemptions (pregnancy, etc.)
  exemption_notes         TEXT,

  -- Compliance tracking (for subject, non-exempt households)
  compliance_status TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (compliance_status IN ('unknown', 'compliant', 'at_risk', 'non_compliant')),
  hours_reported_per_week NUMERIC(4,1),                 -- self-reported or documented
  compliance_verified_at  TIMESTAMPTZ,
  compliance_notes        TEXT,

  -- Time limit clock
  months_used_in_window   INT  NOT NULL DEFAULT 0,      -- 0–3 in the 36-month window
  window_start_date       DATE,
  time_limit_reached_at   TIMESTAMPTZ,

  -- Navigator tracking
  last_reviewed_by  UUID,                               -- navigator staff_id
  last_reviewed_at  TIMESTAMPTZ,
  next_review_due   DATE,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON snap_enrollment.work_requirement_statuses (packet_id);
CREATE INDEX ON snap_enrollment.work_requirement_statuses (org_id, compliance_status);
CREATE INDEX ON snap_enrollment.work_requirement_statuses (next_review_due)
  WHERE compliance_status IN ('unknown', 'at_risk');

-- updated_at trigger
DROP TRIGGER IF EXISTS work_requirement_statuses_updated_at ON snap_enrollment.work_requirement_statuses;
CREATE TRIGGER work_requirement_statuses_updated_at
  BEFORE UPDATE ON snap_enrollment.work_requirement_statuses
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

-- RLS
ALTER TABLE snap_enrollment.work_requirement_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "navigator can view own org work requirement statuses" ON snap_enrollment.work_requirement_statuses;
CREATE POLICY "navigator can view own org work requirement statuses"
  ON snap_enrollment.work_requirement_statuses
  FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

DROP POLICY IF EXISTS "navigator can insert work requirement statuses for own org" ON snap_enrollment.work_requirement_statuses;
CREATE POLICY "navigator can insert work requirement statuses for own org"
  ON snap_enrollment.work_requirement_statuses
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

DROP POLICY IF EXISTS "navigator can update work requirement statuses for own org" ON snap_enrollment.work_requirement_statuses;
CREATE POLICY "navigator can update work requirement statuses for own org"
  ON snap_enrollment.work_requirement_statuses
  FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);
