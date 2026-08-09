-- Demeter certainty evidence loop.
--
-- The engine now decides CERTAIN / UNCERTAIN per answer and says why
-- (packages/demeter-engine/src/certainty.ts). Until now none of that was
-- persisted, so the "97% of answers are grounded" claim could only ever be
-- asserted. These columns + the aggregate below make it MEASURED, from real
-- traffic, with no way to launder a bad week into a good number.
--
-- Deliberately NOT storing anything new about the person: certainty and its
-- code are properties of the ANSWER. Question text retention is unchanged
-- (7 days scrubbed, 30 for flagged rows).
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`).

ALTER TABLE snap_enrollment.mae_query_log
  ADD COLUMN IF NOT EXISTS certainty        text,
  ADD COLUMN IF NOT EXISTS certainty_code   text,
  ADD COLUMN IF NOT EXISTS verifier_outcome text,
  ADD COLUMN IF NOT EXISTS retrieval_mode   text;

COMMENT ON COLUMN snap_enrollment.mae_query_log.certainty IS
  'certain | uncertain — the verdict shown to the reader.';
COMMENT ON COLUMN snap_enrollment.mae_query_log.certainty_code IS
  'grounded | unrecognized_citation | degraded_to_sources | authority_not_retrieved | state_not_verified';
COMMENT ON COLUMN snap_enrollment.mae_query_log.verifier_outcome IS
  'clean | recomposed | degraded. degraded counts as a FAILURE for the grounded-rate metric.';

-- Rolling-window index: every read of this table for metrics is time-bounded.
CREATE INDEX IF NOT EXISTS mae_query_log_certainty_idx
  ON snap_enrollment.mae_query_log (created_at DESC, certainty);

/**
 * Aggregate the grounded rate over a rolling window.
 *
 * Returns NULL for the rate when there are no answers in the window — callers
 * must render "not yet measured" rather than 0%. A percentage computed from
 * zero observations is a lie with a number attached.
 *
 * Counts only rows where certainty was recorded, so answers served before this
 * migration don't silently dilute the denominator.
 */
CREATE OR REPLACE FUNCTION snap_enrollment.demeter_certainty_stats(p_days integer DEFAULT 30)
RETURNS TABLE (
  window_days     integer,
  total_answers   bigint,
  certain_answers bigint,
  grounded_rate   numeric,
  degraded        bigint,
  recomposed      bigint,
  top_reason      text,
  first_answer_at timestamptz,
  last_answer_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_temp
AS $$
  WITH win AS (
    SELECT *
    FROM snap_enrollment.mae_query_log
    WHERE certainty IS NOT NULL
      AND created_at >= now() - (p_days || ' days')::interval
  )
  SELECT
    p_days,
    count(*)::bigint,
    count(*) FILTER (WHERE certainty = 'certain')::bigint,
    CASE WHEN count(*) = 0 THEN NULL
         ELSE round(100.0 * count(*) FILTER (WHERE certainty = 'certain') / count(*), 1)
    END,
    count(*) FILTER (WHERE verifier_outcome = 'degraded')::bigint,
    count(*) FILTER (WHERE verifier_outcome = 'recomposed')::bigint,
    (SELECT certainty_code FROM win WHERE certainty = 'uncertain'
      GROUP BY certainty_code ORDER BY count(*) DESC LIMIT 1),
    min(created_at),
    max(created_at)
  FROM win;
$$;

-- Same lockdown as the rest of the Demeter surface: the server reads this with
-- the service role; nothing faces anon PostgREST.
REVOKE ALL ON FUNCTION snap_enrollment.demeter_certainty_stats(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_certainty_stats(integer) FROM anon;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_certainty_stats(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION snap_enrollment.demeter_certainty_stats(integer) TO service_role;
