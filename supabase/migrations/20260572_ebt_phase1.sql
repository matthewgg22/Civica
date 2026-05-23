-- EBT Tracker — Phase 1 (Lane A T3)
-- Per docs/plans/ebt-tracker-propel-parity.md §4.6
--
-- Tables created:
--   ebt_cards               — linked EBT cards (NO PIN, per D4)
--   ebt_transactions        — paginated transaction history
--   ebt_deposits            — scheduled + posted issuance events
--   ebt_device_tokens       — APNs registration (Lane D consumes)
--   ebt_notification_prefs  — per-user notification toggles
--
-- Per D4: PIN is never persisted on Civica infrastructure. Only the session
-- cookie (encrypted via Supabase Vault) lives here, and only the Fly scraper
-- decrypts it inside the scraper machine.
--
-- Per D14: balance is cached as a column on ebt_cards (balance_cents,
-- balance_at) — single Supabase read, strong consistency. Migrate to CF KV
-- only if metrics show > 1000 RPS on GET /ebt/balance.
--
-- Per D5: ebt_transactions.state_code_match enables the anomaly detector
-- (Phase 2) to flag cross-state usage from merchant-name regex.
--
-- Per D5: ebt_notification_prefs.travel_mute_until lets the recipient
-- temporarily silence anomaly false-positives during legitimate travel.
--
-- RLS: every row scoped to auth.uid(); service_role bypasses RLS for the
-- Fly scraper webhook + APNs sender.

SET search_path TO snap_enrollment, public;

-- ── Enums ────────────────────────────────────────────────────────────────────

-- Processor enum: the back-end pulling balance/transactions for this card.
-- ebt_ca   — California Client Web Portal scrape (Phase 1)
-- plaid_ca — Plaid EBT once CA support lands (Tier 2 migration)
-- fis_direct — FIS direct integration (long-term B2G path)
DO $$ BEGIN
  CREATE TYPE snap_enrollment.ebt_processor AS ENUM ('ebt_ca', 'plaid_ca', 'fis_direct');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Device platform: iOS only at Phase 1. Android intentionally omitted.
DO $$ BEGIN
  CREATE TYPE snap_enrollment.ebt_device_platform AS ENUM ('ios');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Coarse category for transactions. Mirrors the existing iOS
-- EBTTransactionCategory enum (groceries, farmers_market, restaurant,
-- atm_withdrawal, refund, adjustment, other).
DO $$ BEGIN
  CREATE TYPE snap_enrollment.ebt_transaction_category AS ENUM (
    'groceries',
    'farmers_market',
    'restaurant',
    'atm_withdrawal',
    'refund',
    'adjustment',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── ebt_cards ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS snap_enrollment.ebt_cards (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- card_id_hash is SHA-256 of the 16-digit card number, never the card itself.
  -- Allows duplicate-link detection without storing the PAN.
  card_id_hash                  TEXT NOT NULL,

  processor                     snap_enrollment.ebt_processor NOT NULL,

  -- D4: session cookie encrypted via Supabase Vault. Decrypted only inside
  -- the Fly scraper machine (key held in Fly secret, not in code).
  -- NO PIN COLUMN — PIN never leaves the iOS device.
  session_cookie_encrypted      TEXT NOT NULL,
  session_cookie_expires_at     TIMESTAMPTZ NOT NULL,

  -- Optional "remember me" cookie for longer-lived re-link windows.
  remember_cookie_encrypted     TEXT,

  -- Bookkeeping: when did the scraper last refresh this card?
  last_synced_at                TIMESTAMPTZ,

  -- D14: balance cache. Single-query read for GET /ebt/balance; stale if
  -- age(balance_at) > 30min — route returns stale=true and dispatches refresh.
  balance_cents                 BIGINT,
  balance_at                    TIMESTAMPTZ,

  -- lock_state is JSONB so individual states (CA: unsupported; future: enabled
  -- categories, geo bounds) can evolve without migrations.
  lock_state                    JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A user may link the same physical card more than once across time
  -- (e.g. re-link after cookie expiry), but only one row may be "active" per
  -- (user, card_hash). We model "active" as session_cookie_expires_at > now()
  -- and rely on a partial unique index rather than a status enum.
  UNIQUE (user_id, card_id_hash)
);

CREATE INDEX IF NOT EXISTS idx_ebt_cards_user_id
  ON snap_enrollment.ebt_cards (user_id);

CREATE INDEX IF NOT EXISTS idx_ebt_cards_session_expires
  ON snap_enrollment.ebt_cards (session_cookie_expires_at);

DROP TRIGGER IF EXISTS ebt_cards_updated_at ON snap_enrollment.ebt_cards;
CREATE TRIGGER ebt_cards_updated_at
  BEFORE UPDATE ON snap_enrollment.ebt_cards
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

-- ── ebt_transactions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS snap_enrollment.ebt_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id             UUID NOT NULL REFERENCES snap_enrollment.ebt_cards(id) ON DELETE CASCADE,

  posted_at           TIMESTAMPTZ NOT NULL,

  -- Signed: positive = credit/refund/deposit, negative = purchase/withdrawal.
  -- Stored in cents to dodge floating-point drift.
  amount_cents        BIGINT NOT NULL,

  merchant            TEXT NOT NULL DEFAULT '',
  category            snap_enrollment.ebt_transaction_category NOT NULL DEFAULT 'other',

  -- Raw description as returned by the processor — kept for debugging +
  -- categorization rule iteration. NEVER surface this in the UI raw.
  raw_description     TEXT NOT NULL DEFAULT '',

  -- D5: two-letter state code extracted from merchant name when it matches
  -- the "{CITY} {ST}" trailing-state-code pattern (e.g. "WALMART RENO NV").
  -- NULL when no match. Anomaly detector (Phase 2) flags rows where this
  -- diverges from the cardholder's home state without travel_mute_until set.
  state_code_match    TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ebt_transactions_card_posted_at
  ON snap_enrollment.ebt_transactions (card_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ebt_transactions_state_code_match
  ON snap_enrollment.ebt_transactions (card_id, state_code_match)
  WHERE state_code_match IS NOT NULL;

-- ── ebt_deposits ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS snap_enrollment.ebt_deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         UUID NOT NULL REFERENCES snap_enrollment.ebt_cards(id) ON DELETE CASCADE,

  -- The CA issuance calendar (case-suffix → day-of-month 1-10) tells us
  -- when the deposit is *supposed* to land. We pre-create rows on link
  -- and clear posted_at until the scraper confirms.
  scheduled_for   DATE NOT NULL,
  posted_at       TIMESTAMPTZ,
  amount_cents    BIGINT NOT NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ebt_deposits_card_scheduled
  ON snap_enrollment.ebt_deposits (card_id, scheduled_for DESC);

CREATE INDEX IF NOT EXISTS idx_ebt_deposits_pending
  ON snap_enrollment.ebt_deposits (scheduled_for)
  WHERE posted_at IS NULL;

-- ── ebt_device_tokens ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS snap_enrollment.ebt_device_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- APNs device token, unique across the table. If the same token shows up
  -- under a new user_id (device handoff), we want the insert to conflict so
  -- the registration route can re-assign cleanly.
  apns_token      TEXT NOT NULL UNIQUE,
  platform        snap_enrollment.ebt_device_platform NOT NULL DEFAULT 'ios',
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ebt_device_tokens_user_id
  ON snap_enrollment.ebt_device_tokens (user_id);

-- ── ebt_notification_prefs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS snap_enrollment.ebt_notification_prefs (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- D7 / §4.4: default-on for everything; recipient one-taps any toggle off.
  deposit_on          BOOLEAN NOT NULL DEFAULT true,
  low_balance_on      BOOLEAN NOT NULL DEFAULT true,
  perks_on            BOOLEAN NOT NULL DEFAULT true,
  recert_on           BOOLEAN NOT NULL DEFAULT true,

  -- Quiet hours stored as recipient-local TIME values (no zone), interpreted
  -- against the device-local clock in the push send helper. Defaults match
  -- §4.4: 9pm–8am.
  quiet_start         TIME NOT NULL DEFAULT '21:00',
  quiet_end           TIME NOT NULL DEFAULT '08:00',

  -- D5: anomaly false-positive escape. When set in the future, anomaly
  -- pushes are suppressed even if travel-trigger conditions match.
  travel_mute_until   TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS ebt_notification_prefs_updated_at ON snap_enrollment.ebt_notification_prefs;
CREATE TRIGGER ebt_notification_prefs_updated_at
  BEFORE UPDATE ON snap_enrollment.ebt_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

-- ── RLS — every table scoped to auth.uid() ───────────────────────────────────

ALTER TABLE snap_enrollment.ebt_cards               ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.ebt_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.ebt_deposits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.ebt_device_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.ebt_notification_prefs  ENABLE ROW LEVEL SECURITY;

-- ebt_cards: users see and manage only their own cards. Service role bypasses
-- RLS for scraper + webhook writes.
CREATE POLICY "ebt_cards_owner_select" ON snap_enrollment.ebt_cards
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ebt_cards_owner_insert" ON snap_enrollment.ebt_cards
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ebt_cards_owner_update" ON snap_enrollment.ebt_cards
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ebt_cards_owner_delete" ON snap_enrollment.ebt_cards
  FOR DELETE USING (user_id = auth.uid());

-- ebt_transactions: ownership via parent card's user_id. SELECT only — clients
-- never write transactions; the Fly scraper webhook (service_role) does.
CREATE POLICY "ebt_transactions_owner_select" ON snap_enrollment.ebt_transactions
  FOR SELECT USING (
    card_id IN (
      SELECT id FROM snap_enrollment.ebt_cards WHERE user_id = auth.uid()
    )
  );

-- ebt_deposits: same ownership chain.
CREATE POLICY "ebt_deposits_owner_select" ON snap_enrollment.ebt_deposits
  FOR SELECT USING (
    card_id IN (
      SELECT id FROM snap_enrollment.ebt_cards WHERE user_id = auth.uid()
    )
  );

-- ebt_device_tokens: users register and revoke their own tokens.
CREATE POLICY "ebt_device_tokens_owner_select" ON snap_enrollment.ebt_device_tokens
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ebt_device_tokens_owner_insert" ON snap_enrollment.ebt_device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ebt_device_tokens_owner_delete" ON snap_enrollment.ebt_device_tokens
  FOR DELETE USING (user_id = auth.uid());

-- ebt_notification_prefs: row-per-user; full CRUD by owner. Upsert covers
-- "create on first read" — INSERT + UPDATE policies both required.
CREATE POLICY "ebt_notification_prefs_owner_select" ON snap_enrollment.ebt_notification_prefs
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ebt_notification_prefs_owner_insert" ON snap_enrollment.ebt_notification_prefs
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ebt_notification_prefs_owner_update" ON snap_enrollment.ebt_notification_prefs
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ebt_notification_prefs_owner_delete" ON snap_enrollment.ebt_notification_prefs
  FOR DELETE USING (user_id = auth.uid());

-- Service role: full access to all EBT tables for scraper webhook + APNs sender.
GRANT SELECT, INSERT, UPDATE, DELETE ON snap_enrollment.ebt_cards              TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON snap_enrollment.ebt_transactions       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON snap_enrollment.ebt_deposits           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON snap_enrollment.ebt_device_tokens      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON snap_enrollment.ebt_notification_prefs TO service_role;

-- Authenticated users get SELECT (RLS narrows to their own rows) plus INSERT/
-- UPDATE/DELETE on ebt_cards, ebt_device_tokens, ebt_notification_prefs.
GRANT SELECT                                          ON snap_enrollment.ebt_cards              TO authenticated;
GRANT INSERT, UPDATE, DELETE                          ON snap_enrollment.ebt_cards              TO authenticated;
GRANT SELECT                                          ON snap_enrollment.ebt_transactions       TO authenticated;
GRANT SELECT                                          ON snap_enrollment.ebt_deposits           TO authenticated;
GRANT SELECT, INSERT, DELETE                          ON snap_enrollment.ebt_device_tokens      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE                  ON snap_enrollment.ebt_notification_prefs TO authenticated;
