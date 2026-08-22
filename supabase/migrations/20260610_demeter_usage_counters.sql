-- Demeter public-chat usage counters (eng review T2/E4, decisions 2A + T-B).
--
-- ONE bucket-keyed table backs both controls:
--   spend:<YYYY-MM>            — monthly LLM spend, US dollars (numeric)
--   ip:<sha256/16>:<window>    — per-IP request counts per 60s window
--
-- Semantics (T-B, "lagging counter"): routes CHECK the current month's total
-- before answering and SETTLE actual cost after the stream finishes (via
-- Next's after(), never fire-and-forget). The counter can therefore lag by
-- in-flight requests — the Anthropic Console workspace spend cap ($200) is
-- the hard physics-level backstop; this table is the graceful one.
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`) —
-- see docs/runbooks + reference_supabase_migration_apply.

CREATE TABLE IF NOT EXISTS snap_enrollment.demeter_usage (
  bucket      text PRIMARY KEY,
  count       numeric NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Service-role only; the table never faces PostgREST anon access.
ALTER TABLE snap_enrollment.demeter_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON snap_enrollment.demeter_usage FROM PUBLIC;
REVOKE ALL ON snap_enrollment.demeter_usage FROM anon;
REVOKE ALL ON snap_enrollment.demeter_usage FROM authenticated;
GRANT ALL ON snap_enrollment.demeter_usage TO service_role;

-- Atomic increment-and-read. Check+increment as ONE statement kills the
-- read-modify-write race two parallel requests would hit at the ceiling
-- (the concurrency spec asserts exactly this).
CREATE OR REPLACE FUNCTION snap_enrollment.demeter_increment_and_check(
  p_bucket  text,
  p_amount  numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = snap_enrollment
AS $$
DECLARE
  v_total numeric;
BEGIN
  INSERT INTO snap_enrollment.demeter_usage AS u (bucket, count, updated_at)
  VALUES (p_bucket, p_amount, now())
  ON CONFLICT (bucket)
  DO UPDATE SET count = u.count + EXCLUDED.count, updated_at = now()
  RETURNING count INTO v_total;

  -- Opportunistic cleanup of expired ip windows (~1% of calls) so the table
  -- can't grow unboundedly. Spend buckets are one row per month — kept.
  IF random() < 0.01 THEN
    DELETE FROM snap_enrollment.demeter_usage
    WHERE bucket LIKE 'ip:%' AND updated_at < now() - interval '1 day';
  END IF;

  RETURN v_total;
END;
$$;

-- The counter-spin DoS closure (outside voice #5c): SECURITY DEFINER without
-- a grant lockdown would let anyone with PostgREST access spin the counter to
-- the ceiling for free. Repo precedent: 20260571_set_actor_context_function.
REVOKE ALL ON FUNCTION snap_enrollment.demeter_increment_and_check(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_increment_and_check(text, numeric) FROM anon;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_increment_and_check(text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION snap_enrollment.demeter_increment_and_check(text, numeric) TO service_role;

COMMENT ON TABLE snap_enrollment.demeter_usage IS
  'Demeter public-chat durable counters: monthly LLM spend (spend:YYYY-MM, dollars) + per-IP rate windows (ip:<hash>:<window>, requests). Lagging-counter semantics; Anthropic Console cap is the hard backstop. Eng review 2026-08-07 decisions 2A/T-B.';
COMMENT ON FUNCTION snap_enrollment.demeter_increment_and_check(text, numeric) IS
  'Atomic upsert-increment returning the new total. Service-role only (REVOKE PUBLIC — closes the anonymous counter-spin DoS).';
