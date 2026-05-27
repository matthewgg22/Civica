-- Atomic redemption recorder — INSERT user_redemptions + UPSERT
-- user_savings_tally in a single transaction.
--
-- Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md
--   (B-T5 + A4 outside-voice fix: concurrent redemptions must not lose
--    updates against the per-user tally).
--
-- The route layer (POST /me/redemptions) calls this via
--   await db.rpc('record_redemption', { ... })
-- and gets back the new redemption_id + the post-write tally total.
--
-- Anti-inflation cap (per plan Long-term trajectory): the route validates
-- p_savings_cents <= offer.expected_savings_cents before calling. The
-- function itself enforces savings_cents >= 0 via the table CHECK.

SET search_path TO snap_enrollment, public;

CREATE OR REPLACE FUNCTION snap_enrollment.record_redemption(
  p_user_id        UUID,
  p_offer_id       UUID,
  p_method         snap_enrollment.redemption_method,
  p_savings_cents  INTEGER
)
RETURNS TABLE (
  redemption_id        UUID,
  total_savings_cents  INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = snap_enrollment, public
AS $$
DECLARE
  v_redemption_id  UUID;
  v_total          INTEGER;
BEGIN
  -- Defense in depth: reject negative or null savings even though the
  -- table CHECK would catch it. Keeps the error message friendly.
  IF p_savings_cents IS NULL OR p_savings_cents < 0 THEN
    RAISE EXCEPTION 'savings_cents must be a non-negative integer';
  END IF;

  -- Single transaction: both writes commit together or roll back together.
  INSERT INTO snap_enrollment.user_redemptions (user_id, offer_id, method, savings_cents)
  VALUES (p_user_id, p_offer_id, p_method, p_savings_cents)
  RETURNING snap_enrollment.user_redemptions.redemption_id INTO v_redemption_id;

  INSERT INTO snap_enrollment.user_savings_tally AS t (user_id, total_savings_cents, last_updated_at)
  VALUES (p_user_id, p_savings_cents, clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE
    SET total_savings_cents = t.total_savings_cents + EXCLUDED.total_savings_cents,
        last_updated_at     = clock_timestamp()
  RETURNING t.total_savings_cents INTO v_total;

  RETURN QUERY SELECT v_redemption_id, v_total;
END;
$$;

-- Service-role only. The route has already validated requireAuthenticated +
-- distress + offer-active before this call, so granting EXECUTE to a wider
-- audience would add no value and break the privacy posture.
REVOKE ALL ON FUNCTION snap_enrollment.record_redemption FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snap_enrollment.record_redemption TO service_role;

COMMENT ON FUNCTION snap_enrollment.record_redemption IS
  'Atomic INSERT user_redemptions + UPSERT user_savings_tally. Service-role only. Caller validates anti-inflation cap before invoking. Source: 2026-05-26-ebt-offer-moment-platform.md (B-T5/A4).';
