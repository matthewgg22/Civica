-- snap_enrollment — Migration: marketplace_paychecks table (T-DR3-8)
--
-- Records Argyle-confirmed paychecks for students in the marketplace flow.
-- Each row is one paycheck.added event from Argyle. Used to drive
-- PostPlacementView (Screen 5) and cliff-event navigator outreach.

CREATE TABLE snap_enrollment.marketplace_paychecks (
  marketplace_paycheck_id UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id            UUID    NOT NULL,
  packet_id               UUID    REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE SET NULL,
  org_id                  UUID    REFERENCES snap_enrollment.staff_orgs(org_id) ON DELETE SET NULL,

  -- Argyle source
  argyle_paycheck_id      TEXT    NOT NULL UNIQUE,      -- Argyle's paycheck ID (dedup guard)
  employer_name           TEXT    NOT NULL DEFAULT '',

  -- Income
  monthly_amount_usd      INTEGER NOT NULL CHECK (monthly_amount_usd >= 0),

  -- Computed at receipt time (denorm to avoid re-running engine on read)
  projected_benefit_usd   INTEGER NOT NULL CHECK (projected_benefit_usd >= 0),
  is_cliff_event          BOOLEAN NOT NULL DEFAULT false,

  -- Payroll timing
  pay_date                DATE    NOT NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.marketplace_paychecks (applicant_id);
CREATE INDEX ON snap_enrollment.marketplace_paychecks (packet_id);
CREATE INDEX ON snap_enrollment.marketplace_paychecks (is_cliff_event, created_at DESC)
  WHERE is_cliff_event = true;

ALTER TABLE snap_enrollment.marketplace_paychecks ENABLE ROW LEVEL SECURITY;

-- Applicants can read their own paycheck records
CREATE POLICY "applicant can read own paychecks"
  ON snap_enrollment.marketplace_paychecks FOR SELECT
  USING (applicant_id = auth.uid());

-- Navigators can read paychecks for their org's packets
CREATE POLICY "navigator can read paychecks for own org"
  ON snap_enrollment.marketplace_paychecks FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Service role writes (Argyle webhook inserts)
GRANT SELECT, INSERT ON snap_enrollment.marketplace_paychecks TO service_role;
