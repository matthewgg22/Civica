-- Partner offers catalog (T1 from ceo-plans/2026-05-25-ebt-monetization-dashboard.md)
--
-- Source of truth for partner offers displayed on the iOS EBT tracker.
-- Powers /ops/placements (Panel 2 on /ops dashboard — "planned placements" view
-- until iOS click-event instrumentation lands).
--
-- Each offer is configured to show in a set of counties (county_fips_list). The
-- expected_revenue_cents and expected_savings_cents fields are catalog-level
-- estimates used by the impressions-only P&L panel in v1.

SET search_path TO snap_enrollment, public;

CREATE TABLE IF NOT EXISTS snap_enrollment.partner_offers (
  offer_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  partner_name             TEXT NOT NULL,
  category                 TEXT NOT NULL,                    -- 'groceries' | 'mobile' | 'utilities' | 'healthcare' | etc.
  description              TEXT,

  -- Counties where this offer is configured to display. Empty array means
  -- statewide. FIPS codes are 5 chars; California county codes are 06xxx.
  county_fips_list         CHAR(5)[] NOT NULL DEFAULT ARRAY[]::CHAR(5)[],

  -- Catalog-level economic estimates. Per-impression-revenue and per-impression-savings
  -- are negotiated with the partner. v1 uses these to compute Panel 6 P&L.
  expected_revenue_cents   INTEGER NOT NULL DEFAULT 0 CHECK (expected_revenue_cents >= 0),
  expected_savings_cents   INTEGER NOT NULL DEFAULT 0 CHECK (expected_savings_cents >= 0),

  active                   BOOLEAN NOT NULL DEFAULT true,
  start_at                 TIMESTAMPTZ,
  end_at                   TIMESTAMPTZ,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_partner_offers_active_category
  ON snap_enrollment.partner_offers (active, category) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_partner_offers_counties
  ON snap_enrollment.partner_offers USING gin (county_fips_list);

DROP TRIGGER IF EXISTS partner_offers_updated_at ON snap_enrollment.partner_offers;
CREATE TRIGGER partner_offers_updated_at
  BEFORE UPDATE ON snap_enrollment.partner_offers
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

-- RLS: service-role only for read/write. Applicants do NOT read the catalog
-- directly — iOS fetches sanitized offers via apps/enrollment-api routes that
-- filter to the applicant's county before returning.
ALTER TABLE snap_enrollment.partner_offers ENABLE ROW LEVEL SECURITY;

-- No policies = no anon/auth access. Service role bypasses RLS.

COMMENT ON TABLE snap_enrollment.partner_offers IS
  'Partner offer catalog. Service-role only. Powers /ops/placements and the iOS EBT tracker offer surface.';
