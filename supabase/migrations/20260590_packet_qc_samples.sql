-- snap_enrollment — Migration: prospective QC sampling stream.
--
-- Per docs/plans/error-rate-engine-falsification.md (Lane B: Sampler
-- Infrastructure):
--   - T4   ENG-D1: single packet_qc_samples table with a `sample_stage`
--                  enum so creation- and submission-stage samples live in
--                  one shape. Partial constraint replaces the dual-table
--                  sample-bias guard (T7).
--   - T4   ENG-D7: composite indexes upfront so the T5 dashboard queue and
--                  D6 applicant-restart lookup both hit O(log n) plans.
--   - T4b  D6:     applicant-restart closure trigger — when an applicant
--                  starts a new packet, all of their prior open sample
--                  rows close with closed_reason = 'applicant_restart'.
--   - T7   ENG-D2: sampler uniqueness index — `(packet_id, sample_stage)`
--                  so duplicate cron ticks ON CONFLICT DO NOTHING instead
--                  of double-flagging.
--
-- RLS shape (per ENG-D5):
--   - Navigators SELECT samples for their own org (via is_navigator_in_org).
--   - All other authenticated roles (applicant, buddy, anon) read nothing.
--   - Writes are service-role only (RLS allows service-role bypass by
--     default; no INSERT policy is granted to `authenticated`).
--
-- Naming: timestamp 20260590 follows the next-available slot after
-- 20260589_distress_flags.sql. The plan references "20260584" but that
-- slot is already occupied by user_savings_tally; the file name is
-- documentation, not a contract.

-- ---------------------------------------------------------------------------
-- packet_qc_samples
-- ---------------------------------------------------------------------------

CREATE TABLE snap_enrollment.packet_qc_samples (
  sample_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id      uuid        NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  applicant_id   uuid        NOT NULL,
  org_id         uuid        NOT NULL,
  sample_stage   text        NOT NULL CHECK (sample_stage IN ('creation', 'submission')),
  sampled_at     timestamptz NOT NULL DEFAULT now(),
  -- Snapshot of snap_packets.submitted_at at the moment the sample was
  -- recorded — used by the partial constraint below to enforce that
  -- submission-stage samples are flagged BEFORE the applicant submits.
  -- Otherwise navigators could selectively QC packets that already look
  -- risky, biasing the measured PER upward.
  submitted_at   timestamptz,
  completed_at   timestamptz,
  closed_reason  text,        -- e.g. 'applicant_restart'; NULL while open
  CONSTRAINT submission_sample_pre_submit
    CHECK (
      sample_stage <> 'submission'
      OR submitted_at IS NULL
      OR sampled_at < submitted_at
    )
);

-- ENG-D7 composite indexes ----------------------------------------------------
-- T5 dashboard queue: "show me pending QC samples in my org, FIFO" —
-- WHERE org_id = $1 AND sample_stage = $2 AND completed_at IS NULL ORDER BY sampled_at.
CREATE INDEX idx_packet_qc_samples_queue
  ON snap_enrollment.packet_qc_samples (org_id, sample_stage, completed_at);

-- D6 applicant-restart trigger: lookup by applicant_id, filter to still-open.
CREATE INDEX idx_packet_qc_samples_applicant
  ON snap_enrollment.packet_qc_samples (applicant_id, closed_reason);

-- T7 (absorbed) sampler idempotency: ON CONFLICT (packet_id, sample_stage)
-- relies on this unique index. A single packet may have BOTH a creation-
-- stage AND a submission-stage row (distinct funnel signals), but never
-- two of the same stage.
CREATE UNIQUE INDEX uq_packet_qc_samples_packet_stage
  ON snap_enrollment.packet_qc_samples (packet_id, sample_stage);

-- ---------------------------------------------------------------------------
-- RLS (per ENG-D5)
-- ---------------------------------------------------------------------------

ALTER TABLE snap_enrollment.packet_qc_samples ENABLE ROW LEVEL SECURITY;

-- Navigator reads own-org samples only. Mirrors qc_outcomes RLS shape
-- (20260557001_fix_qc_outcomes_rls.sql).
CREATE POLICY "navigator can read own org qc samples"
  ON snap_enrollment.packet_qc_samples
  FOR SELECT
  USING (snap_enrollment.is_navigator_in_org(org_id));

-- No INSERT/UPDATE/DELETE policy is granted to authenticated users.
-- The cron sampler (src/cron/internal-qc-sampler.ts) writes via
-- service_role, which bypasses RLS. Navigators "complete" a sample
-- indirectly via POST /navigator/packets/:id/qc-outcome (existing route)
-- which writes to qc_outcomes, not this table.

GRANT SELECT ON snap_enrollment.packet_qc_samples TO authenticated;
GRANT SELECT, INSERT, UPDATE ON snap_enrollment.packet_qc_samples TO service_role;

-- ---------------------------------------------------------------------------
-- T4b — applicant-restart closure trigger
-- ---------------------------------------------------------------------------
--
-- When the same applicant_id inserts a new snap_packets row (i.e. they
-- abandoned and restarted), close out any prior open sample rows so they
-- don't sit in the navigator queue forever. Closed rows still feed the
-- funnel-signal queries (sample_stage='creation' with closed_reason set);
-- they just stop showing up in "pending review" panels.
--
-- Per D6: no TTL-based auto-close. Restart is the only auto-close trigger.
-- Open-row count surfaced as an observability metric (qc_sample_open_count).

CREATE OR REPLACE FUNCTION snap_enrollment.close_prior_qc_samples_on_restart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_catalog
AS $$
BEGIN
  UPDATE snap_enrollment.packet_qc_samples
     SET completed_at = now(),
         closed_reason = 'applicant_restart'
   WHERE applicant_id = NEW.applicant_id
     AND completed_at IS NULL
     AND closed_reason IS NULL
     -- Don't close a row attached to the brand-new packet itself in the
     -- (impossible-today, but defensive) case that a sample row was
     -- inserted in the same transaction before this trigger fires.
     AND packet_id <> NEW.packet_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_prior_qc_samples ON snap_enrollment.snap_packets;
CREATE TRIGGER trg_close_prior_qc_samples
  AFTER INSERT ON snap_enrollment.snap_packets
  FOR EACH ROW
  EXECUTE FUNCTION snap_enrollment.close_prior_qc_samples_on_restart();

COMMENT ON TABLE snap_enrollment.packet_qc_samples IS
  'Prospective QC sampling stream (error-rate-engine-falsification §4 Stream B). '
  'One row per (packet_id, sample_stage). Service-role writes only; navigators '
  'read own-org rows via is_navigator_in_org(org_id). Completed reviews flow '
  'into snap_enrollment.qc_outcomes via /navigator/packets/:id/qc-outcome.';

COMMENT ON COLUMN snap_enrollment.packet_qc_samples.sample_stage IS
  'creation = funnel/abandonment signal; submission = validation-gate sample. '
  'BaselinePanel reads submission-stage rows with completed_at IS NOT NULL.';

COMMENT ON COLUMN snap_enrollment.packet_qc_samples.closed_reason IS
  'NULL while open. ''applicant_restart'' set by trg_close_prior_qc_samples. '
  'Future values: ''ttl_expired'' (deferred per D6).';
