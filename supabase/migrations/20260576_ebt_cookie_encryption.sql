-- EBT Tracker — pgsodium cookie encryption (T3 of /plan-eng-review).
--
-- Background
-- ----------
-- 20260574_ebt_phase1.sql created ebt_cards.session_cookie_encrypted as a
-- TEXT column, *intending* Supabase Vault to encrypt it at rest. In practice
-- Vault was never wired and the gateway has been storing plaintext session
-- cookies. A read-only DB breach therefore yields live ebt.ca.gov session
-- cookies (~30min TTL) that an attacker could replay against the portal to
-- impersonate the recipient.
--
-- What this migration does
-- ------------------------
-- 1. Enables pgsodium (Supabase ships it; ` CREATE EXTENSION IF NOT EXISTS`
--    is a no-op when it's already on).
-- 2. Creates a dedicated AEAD key for EBT session-cookie ciphertext and
--    persists the key UUID in a small lookup table so future migrations
--    (and the Fly scraper's decrypt-on-machine path) can re-resolve it
--    without hard-coding.
-- 3. Defines two SECURITY DEFINER RPCs:
--      snap_enrollment.encrypt_session_cookie(plaintext TEXT) -> TEXT
--      snap_enrollment.decrypt_session_cookie(ciphertext TEXT) -> TEXT
--    Both visible only to `service_role` — the Workers gateway uses these
--    via supabase-js .rpc(). Output of encrypt_*/input of decrypt_* is the
--    raw pgsodium ciphertext (bytea) wrapped as base64 so it round-trips
--    through JSON cleanly.
-- 4. Backfills any rows that are still plaintext (cookies inserted before
--    this migration landed). Detection: try to base64-decode + pgsodium-
--    decrypt; on failure, treat the column as plaintext and encrypt it.
--    Logs a NOTICE per row backfilled so the operator can see the count
--    in the Supabase SQL editor output.
--
-- Why two RPCs instead of pgsodium column-level masking (TCE)
-- ----------------------------------------------------------
-- TCE auto-decrypts in SELECT and is brilliant for the dashboard use case,
-- but the gateway routes that need the plaintext run as `service_role` (not
-- `authenticator`), and we want a *single* explicit decrypt site so the
-- audit trail is grep-able (search for `decrypt_session_cookie` in the
-- gateway tree -> exactly two call sites). It also keeps the existing
-- column type stable (TEXT) so 20260574's index + RLS policies don't need
-- to be rewritten.

SET search_path TO snap_enrollment, public;

CREATE EXTENSION IF NOT EXISTS pgsodium;

-- ─── Key registry ────────────────────────────────────────────────────────

-- A tiny named-key lookup. We don't want to scatter raw UUIDs through
-- migrations and SECURITY DEFINER bodies; a one-row-per-purpose table is
-- a fixed, queryable home.
CREATE TABLE IF NOT EXISTS snap_enrollment.pgsodium_key_registry (
  purpose      TEXT PRIMARY KEY,
  key_id       UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Restrict reads to service_role — even the key UUID is not something we
-- want bouncing through anon/authenticated clients.
REVOKE ALL ON snap_enrollment.pgsodium_key_registry FROM PUBLIC;
GRANT SELECT ON snap_enrollment.pgsodium_key_registry TO service_role;

-- Create (or reuse) the EBT session-cookie key. pgsodium.create_key() is
-- idempotent in spirit but not implementation; guard via the registry.
DO $$
DECLARE
  v_key_id UUID;
BEGIN
  SELECT key_id INTO v_key_id
    FROM snap_enrollment.pgsodium_key_registry
   WHERE purpose = 'ebt_session_cookie';

  IF v_key_id IS NULL THEN
    v_key_id := pgsodium.create_key(
      key_type := 'aead-det',
      name     := 'ebt_session_cookie_v1'
    )::uuid;
    INSERT INTO snap_enrollment.pgsodium_key_registry (purpose, key_id)
    VALUES ('ebt_session_cookie', v_key_id);
  END IF;
END $$;

-- ─── encrypt_session_cookie / decrypt_session_cookie ────────────────────

-- Empty-string plaintext is invalid in our domain (the gateway rejects it
-- via zod min(1)) — but we still need to guard against NULL so the RPC
-- can be safely .rpc()'d with a missing arg.

CREATE OR REPLACE FUNCTION snap_enrollment.encrypt_session_cookie(plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = snap_enrollment, public, pgsodium
AS $$
DECLARE
  v_key_id  UUID;
  v_cipher  BYTEA;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT key_id INTO v_key_id
    FROM snap_enrollment.pgsodium_key_registry
   WHERE purpose = 'ebt_session_cookie';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'pgsodium key for ebt_session_cookie not registered';
  END IF;

  v_cipher := pgsodium.crypto_aead_det_encrypt(
    convert_to(plaintext, 'utf8'),
    convert_to('ebt_session_cookie', 'utf8'),  -- AAD ties ciphertext to purpose
    v_key_id
  );
  RETURN 'pgs1:' || encode(v_cipher, 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION snap_enrollment.decrypt_session_cookie(ciphertext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = snap_enrollment, public, pgsodium
AS $$
DECLARE
  v_key_id  UUID;
  v_plain   BYTEA;
  v_raw     BYTEA;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  IF ciphertext NOT LIKE 'pgs1:%' THEN
    -- Not in our ciphertext format — treat as already-plaintext. This is
    -- the safety net for the (small) plaintext-backfill window between
    -- this migration applying and the gateway code path catching up to
    -- always-encrypt. After the gateway change ships, no new rows will
    -- ever hit this branch.
    RETURN ciphertext;
  END IF;

  SELECT key_id INTO v_key_id
    FROM snap_enrollment.pgsodium_key_registry
   WHERE purpose = 'ebt_session_cookie';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'pgsodium key for ebt_session_cookie not registered';
  END IF;

  v_raw   := decode(substring(ciphertext from 6), 'base64');
  v_plain := pgsodium.crypto_aead_det_decrypt(
    v_raw,
    convert_to('ebt_session_cookie', 'utf8'),
    v_key_id
  );
  RETURN convert_from(v_plain, 'utf8');
END;
$$;

-- Lock the RPCs down. SECURITY DEFINER + service_role-only EXECUTE means
-- only the gateway (which already has the service-role JWT) can call them.
REVOKE ALL ON FUNCTION snap_enrollment.encrypt_session_cookie(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION snap_enrollment.decrypt_session_cookie(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snap_enrollment.encrypt_session_cookie(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION snap_enrollment.decrypt_session_cookie(TEXT) TO service_role;

-- ─── Backfill existing plaintext rows ────────────────────────────────────
--
-- Pre-migration rows have session_cookie_encrypted = the raw JSON string
-- the iOS app POSTed. After this DO block runs, every row is in 'pgs1:...'
-- form. Idempotent: rows that already start with 'pgs1:' are skipped.

DO $$
DECLARE
  v_count_session  INTEGER := 0;
  v_count_remember INTEGER := 0;
BEGIN
  UPDATE snap_enrollment.ebt_cards
     SET session_cookie_encrypted =
           snap_enrollment.encrypt_session_cookie(session_cookie_encrypted)
   WHERE session_cookie_encrypted IS NOT NULL
     AND session_cookie_encrypted NOT LIKE 'pgs1:%';
  GET DIAGNOSTICS v_count_session = ROW_COUNT;

  UPDATE snap_enrollment.ebt_cards
     SET remember_cookie_encrypted =
           snap_enrollment.encrypt_session_cookie(remember_cookie_encrypted)
   WHERE remember_cookie_encrypted IS NOT NULL
     AND remember_cookie_encrypted NOT LIKE 'pgs1:%';
  GET DIAGNOSTICS v_count_remember = ROW_COUNT;

  IF v_count_session > 0 OR v_count_remember > 0 THEN
    RAISE NOTICE 'ebt_cards backfill: encrypted % session_cookie row(s), % remember_cookie row(s)',
      v_count_session, v_count_remember;
  END IF;
END $$;
