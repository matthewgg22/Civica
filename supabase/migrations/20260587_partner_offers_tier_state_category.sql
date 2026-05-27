-- Extend partner_offers catalog (20260579) with the columns the offer
-- resolver needs:
--   - tier              : 'top' eligible for real-time push triggers (v1.1)
--   - state_code        : per-state filtering (CA in v1; MA layers in v1.1)
--   - category_tags     : enum array overlap-matched against the user's
--                         recent ebt_transactions.category set
--   - merchant_id       : canonical key for receipt-merchant match (v1.1 OCR)
--   - merchant_name_normalized : lowercased + punctuation-stripped for
--                         Levenshtein fallback during merchant match
--
-- Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md
--   (B-T1d + F2 taxonomy fix from outside-voice review).
--
-- F2 FIX: category_tags is typed as ebt_transaction_category[] (the existing
-- enum from 20260574_ebt_phase1.sql), NOT TEXT[]. Free-form strings would
-- silently mismatch the user's transaction-category set in the resolver's
-- category_overlap() — the database type system catches the drift at admin
-- insert time instead.

SET search_path TO snap_enrollment, public;

DO $$ BEGIN
  CREATE TYPE snap_enrollment.partner_offer_tier AS ENUM (
    'top',       -- paid placement; eligible for real-time geofence push (v1.1)
    'standard',  -- standard catalog placement; eligible for weekly digest
    'none'       -- catalog-only; never pushed
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE snap_enrollment.partner_offers
  ADD COLUMN IF NOT EXISTS tier
    snap_enrollment.partner_offer_tier NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS state_code
    CHAR(2) NOT NULL DEFAULT 'CA'
    CHECK (state_code IN ('CA','MA')),
  ADD COLUMN IF NOT EXISTS category_tags
    snap_enrollment.ebt_transaction_category[] NOT NULL
    DEFAULT ARRAY[]::snap_enrollment.ebt_transaction_category[],
  ADD COLUMN IF NOT EXISTS merchant_id
    TEXT,
  ADD COLUMN IF NOT EXISTS merchant_name_normalized
    TEXT;

-- GIN index on category_tags array for fast overlap (&&) match in the resolver.
-- Per outside-voice P1 finding: without this, every /me/offers fetch does a
-- full-table scan filtering by category.
CREATE INDEX IF NOT EXISTS idx_partner_offers_category_tags
  ON snap_enrollment.partner_offers USING gin (category_tags);

-- Composite index for the resolver's hot path: active offers in a given state,
-- ranked by tier (top first).
CREATE INDEX IF NOT EXISTS idx_partner_offers_state_active_tier
  ON snap_enrollment.partner_offers (state_code, active, tier)
  WHERE active = true;

COMMENT ON COLUMN snap_enrollment.partner_offers.tier IS
  'Placement tier. top = real-time push eligible (v1.1). standard = digest only. none = catalog only, no push.';
COMMENT ON COLUMN snap_enrollment.partner_offers.category_tags IS
  'ebt_transaction_category[] for resolver overlap match against user recent-transaction categories. Typed enum (not text) so admin tagging cannot silently miss the resolver.';
COMMENT ON COLUMN snap_enrollment.partner_offers.merchant_id IS
  'Canonical merchant key for receipt-OCR matching (v1.1). Nullable in v1 since self-attest does not need it.';
