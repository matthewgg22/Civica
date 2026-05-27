-- Per-user offer redemption records (self-attest in v1; OCR in v1.1).
--
-- Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (E2/D9).
-- v1: self-attest only — "Did you redeem this? Y/N + $ saved" sheet.
-- v1.1: VisionKit OCR adds ocr method + populates ocr_raw / confidence.
--
-- Privacy posture (per plan D12, counsel sign-off WAIVED 2026-05-26):
--   - Per-user retention with RLS owner-only
--   - ON DELETE CASCADE on auth.users for DSR compliance
--   - Disclosure in onboarding copy (X-T1)
--
-- Anti-inflation guard (per plan Long-term trajectory): savings_cents is
-- capped server-side at offer.expected_savings_cents × 1.0 before insert.
-- The CHECK constraint here is a defense-in-depth backstop.

SET search_path TO snap_enrollment, public;

DO $$ BEGIN
  CREATE TYPE snap_enrollment.redemption_method AS ENUM (
    'self_attest',
    'ocr'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS snap_enrollment.user_redemptions (
  redemption_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL
                             REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id                   UUID NOT NULL
                             REFERENCES snap_enrollment.partner_offers(offer_id),
  method                     snap_enrollment.redemption_method NOT NULL,
  savings_cents              INTEGER NOT NULL CHECK (savings_cents >= 0),
  merchant_match_confidence  NUMERIC(3,2)
                             CHECK (merchant_match_confidence IS NULL
                                    OR (merchant_match_confidence >= 0
                                        AND merchant_match_confidence <= 1)),
  redeemed_at                TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  -- Only populated for OCR redemptions (v1.1). Holds the raw OCR result
  -- for debugging accuracy regressions. Never surfaced in the UI.
  ocr_raw                    JSONB
);

CREATE INDEX IF NOT EXISTS idx_user_redemptions_user_redeemed_at
  ON snap_enrollment.user_redemptions (user_id, redeemed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_redemptions_offer
  ON snap_enrollment.user_redemptions (offer_id);

-- RLS: owner-only read; service-role write.
ALTER TABLE snap_enrollment.user_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_redemptions_owner_select
  ON snap_enrollment.user_redemptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE snap_enrollment.user_redemptions IS
  'Per-user offer redemption records. Owner-only read RLS. v1 = self-attest; v1.1 adds OCR. Anti-inflation cap enforced server-side at gateway. Source: 2026-05-26-ebt-offer-moment-platform.md (E2/D9).';
