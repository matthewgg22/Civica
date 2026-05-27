-- Per-user push notification audit log — enforces the 24h cadence floor.
--
-- Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md
--   (B-T6 + F12 race-safety fix).
--
-- Design contract: at most ONE `perk_offer` push per user per calendar day
-- (local UTC). The unique partial index below makes this a DB-enforced
-- invariant, not an app-layer best-effort. Concurrent fan-out (digest cron
-- + deposit-landed webhook racing) collapses to ON CONFLICT DO NOTHING.
--
-- Other categories (deposit_landed, low_balance, re_link, anomaly) have
-- their own cadence rules enforced in app code (no partial index here).
-- The 24h floor is `perk_offer`-specific because that's the channel-burnout
-- risk per plan §Operational Risks Surfaced by Outside Voice.
--
-- TTL: rows >30d old are purged by a daily cron (X-T5). 30d window is
-- enough to satisfy the 24h floor check + ops debugging without unbounded
-- growth.
--
-- Privacy: per-user, service-role only — applicants never query this. RLS
-- enabled with no SELECT policy = no authenticated access path. DSR via
-- ON DELETE CASCADE.

SET search_path TO snap_enrollment, public;

CREATE TABLE IF NOT EXISTS snap_enrollment.user_push_log (
  push_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL
             REFERENCES auth.users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,        -- 'perk_offer', 'deposit_landed', 'low_balance', etc.
  offer_id   UUID                  -- nullable; only set for perk_offer
             REFERENCES snap_enrollment.partner_offers(offer_id),
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- IMMUTABLE wrapper required: TIMESTAMPTZ::date is STABLE (timezone-dependent)
-- so Postgres rejects it in index expressions. Wrapping in an IMMUTABLE function
-- is the standard pattern; 'UTC' is a compile-time constant so the result is
-- truly deterministic for a given input value.
CREATE OR REPLACE FUNCTION snap_enrollment.utc_date(ts TIMESTAMPTZ)
RETURNS DATE LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
  SELECT (ts AT TIME ZONE 'UTC')::date
$$;

-- 24h floor enforcement for perk_offer: at most one per user per UTC day.
-- Gateway uses INSERT … ON CONFLICT DO NOTHING; collision = suppressed push.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_log_perk_offer_daily
  ON snap_enrollment.user_push_log (user_id, snap_enrollment.utc_date(sent_at))
  WHERE category = 'perk_offer';

-- Batch SELECT support for digest cron's 24h-window count per shard.
CREATE INDEX IF NOT EXISTS idx_user_push_log_user_sent
  ON snap_enrollment.user_push_log (user_id, sent_at DESC);

-- RLS: service-role only. No applicant access.
ALTER TABLE snap_enrollment.user_push_log ENABLE ROW LEVEL SECURITY;
-- Intentionally no SELECT/INSERT/UPDATE/DELETE policies for authenticated role.

COMMENT ON TABLE snap_enrollment.user_push_log IS
  'Per-user push notification audit log. Service-role only. perk_offer category has DB-enforced 24h floor via unique partial index. 30d TTL via X-T5 cron. Source: 2026-05-26-ebt-offer-moment-platform.md (B-T6/F12).';
