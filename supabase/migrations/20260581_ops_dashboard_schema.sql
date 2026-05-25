-- Ops dashboard schema (T3 from ceo-plans/2026-05-25-ebt-monetization-dashboard.md)
--
-- Creates the analytics layer powering /ops dashboard panels:
--   1. partner_offer_events_aggregate — county-bucketed event counter
--      (NO user_id, per D13 — keeps the table outside counsel-review territory)
--   2. notification_outlay_events     — channel/category notification counts + cost
--   3. ebt_card_aggregates_v          — SQL view aggregating ebt_cards
--      for /ops/ebt-aggregates (Panel 1)
--   4. ebt_cards.county_fips column   — denormalized for /ops/placements join
--
-- Per D14 (perf): v1 ships with a plain SUM over ebt_cards via the view; if
-- /ops/ebt-aggregates p99 exceeds 200ms, a v1.1 snapshot table replaces the view.

SET search_path TO snap_enrollment, public;

-- ── 1. partner_offer_events_aggregate ───────────────────────────────────────
-- County-bucketed event counter for partner offer impressions/clicks/conversions.
-- NO user_id — privacy posture decision per D13. If per-user analytics is ever
-- needed, a separate counsel-reviewed table is added (see TODOs in plan).
CREATE TABLE IF NOT EXISTS snap_enrollment.partner_offer_events_aggregate (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id      UUID NOT NULL REFERENCES snap_enrollment.partner_offers(offer_id) ON DELETE CASCADE,
  county_fips   CHAR(5) NOT NULL,                       -- "00000" = unknown
  event_type    TEXT NOT NULL CHECK (event_type IN ('impression','click','conversion')),
  revenue_cents INTEGER NOT NULL DEFAULT 0 CHECK (revenue_cents >= 0),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_partner_offer_events_county_ts
  ON snap_enrollment.partner_offer_events_aggregate (county_fips, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_offer_events_offer_type
  ON snap_enrollment.partner_offer_events_aggregate (offer_id, event_type);

ALTER TABLE snap_enrollment.partner_offer_events_aggregate ENABLE ROW LEVEL SECURITY;
-- Service-role only. iOS emits events through enrollment-api which uses service role.

-- ── 2. notification_outlay_events ───────────────────────────────────────────
-- One row per notification sent. cost_cents derived from per-channel rate map
-- in apps/enrollment-api/src/lib/notification-cost.ts and stored at write time
-- so the read query never needs to recompute.
CREATE TABLE IF NOT EXISTS snap_enrollment.notification_outlay_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel      TEXT NOT NULL CHECK (channel IN ('push','sms','email')),
  category     TEXT NOT NULL,                           -- 'deposit_alert' | 'recert_reminder' | 'partner_offer' | etc.
  county_fips  CHAR(5),                                  -- optional county bucket; null = unbucketed
  cost_cents   INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_notification_outlay_sent_channel
  ON snap_enrollment.notification_outlay_events (sent_at DESC, channel);
CREATE INDEX IF NOT EXISTS idx_notification_outlay_category_ts
  ON snap_enrollment.notification_outlay_events (category, sent_at DESC);

ALTER TABLE snap_enrollment.notification_outlay_events ENABLE ROW LEVEL SECURITY;
-- Service-role only.

-- ── 3. ebt_cards.county_fips column ─────────────────────────────────────────
-- Denormalized from snap_packets so /ops/placements can map cards to counties
-- without a 4-table join on every request. Maintained on packet submit by
-- application code (see backfill migration 20260582).
ALTER TABLE snap_enrollment.ebt_cards
  ADD COLUMN IF NOT EXISTS county_fips CHAR(5);

CREATE INDEX IF NOT EXISTS idx_ebt_cards_county_fips
  ON snap_enrollment.ebt_cards (county_fips) WHERE county_fips IS NOT NULL;

COMMENT ON COLUMN snap_enrollment.ebt_cards.county_fips IS
  'Denormalized from snap_packets.county_fips via applicants.auth_uid. Most-recent packet wins for users with multiple packets. NULL bucketed as "00000" in /ops UI.';

-- ── 4. ebt_card_aggregates_v ────────────────────────────────────────────────
-- View powering /ops/ebt-aggregates (Panel 1). Returns total balance + active
-- tracker count. Service-role read only (the underlying ebt_cards table has
-- per-user RLS).
--
-- "Active tracker" = card with last_synced_at in past 14d AND non-expired session.
CREATE OR REPLACE VIEW snap_enrollment.ebt_card_aggregates_v AS
SELECT
  COALESCE(SUM(balance_cents), 0)::BIGINT                            AS total_balance_cents,
  COUNT(*) FILTER (
    WHERE last_synced_at > (now() - INTERVAL '14 days')
      AND session_cookie_expires_at > now()
  )::BIGINT                                                          AS active_tracker_count,
  COUNT(*)::BIGINT                                                   AS total_card_count,
  MAX(balance_at)                                                    AS latest_balance_at
FROM snap_enrollment.ebt_cards;

COMMENT ON VIEW snap_enrollment.ebt_card_aggregates_v IS
  'Corporate aggregates over ebt_cards for /ops/ebt-aggregates. Service-role read only.';
