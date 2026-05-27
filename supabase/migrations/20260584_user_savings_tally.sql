-- Per-user lifetime savings tally — the "Saved by Civica" counter.
--
-- Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (E1 + D5).
-- Surface: top of EBT Balance dashboard, calm white card with amber numerals
-- and "Self-reported" qualifier co-present per DESIGN.md §10.2.
--
-- Privacy posture (per plan D12, counsel sign-off WAIVED 2026-05-26 — internal
-- review only): per-user retention with RLS owner-only; ON DELETE CASCADE on
-- auth.users for DSR compliance; explicit disclosure in onboarding (X-T1).
--
-- Atomicity: writes go through gateway's POST /me/redemptions which uses
-- INSERT … ON CONFLICT (user_id) DO UPDATE SET total = total + EXCLUDED.total
-- inside the redemption transaction. See A4 fix in plan body.

SET search_path TO snap_enrollment, public;

CREATE TABLE IF NOT EXISTS snap_enrollment.user_savings_tally (
  user_id              UUID PRIMARY KEY
                       REFERENCES auth.users(id) ON DELETE CASCADE,
  total_savings_cents  INTEGER NOT NULL DEFAULT 0
                       CHECK (total_savings_cents >= 0),
  last_updated_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- RLS: owner-only read; service-role write.
ALTER TABLE snap_enrollment.user_savings_tally ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_savings_tally_owner_select
  ON snap_enrollment.user_savings_tally
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated role = service-role only writes.

COMMENT ON TABLE snap_enrollment.user_savings_tally IS
  'Per-user lifetime savings tally in cents. Owner-only read RLS. Writes via gateway POST /me/redemptions only (atomic UPSERT). Source: 2026-05-26-ebt-offer-moment-platform.md (E1/D5).';
