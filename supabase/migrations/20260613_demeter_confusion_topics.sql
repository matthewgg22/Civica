-- Where people get stuck on the SNAP application.
--
-- The engine classifies each question against the federally-required
-- application questions (packages/demeter-engine/src/form-questions.ts) and
-- records the TOPIC — "utility_costs", "household_composition" — never the
-- text. Aggregating topics tells a CBO where its clients stall, tells the
-- state which form questions drive error, and gives a funder demand evidence,
-- all without retaining anything a person typed.
--
-- This is strictly less identifying than what is already stored: question
-- text lives 7 days (30 flagged), the topic is a fixed enum with no free text.
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`).

ALTER TABLE snap_enrollment.mae_query_log
  ADD COLUMN IF NOT EXISTS question_topic text;

COMMENT ON COLUMN snap_enrollment.mae_query_log.question_topic IS
  'Application-form topic the user was stuck on (enum from form-questions.ts). NULL when unrecognized — never guessed.';

CREATE INDEX IF NOT EXISTS mae_query_log_topic_idx
  ON snap_enrollment.mae_query_log (created_at DESC, question_topic)
  WHERE question_topic IS NOT NULL;

/**
 * Top confusion points over a rolling window.
 *
 * Returns nothing when the window is empty — callers must render "not yet
 * measured" rather than an empty chart implying nobody is confused.
 *
 * `min_count` suppresses long-tail topics: a topic seen once or twice is
 * noise, and publishing it invites over-reading a sample of two.
 */
CREATE OR REPLACE FUNCTION snap_enrollment.demeter_confusion_stats(
  p_days      integer DEFAULT 30,
  p_min_count integer DEFAULT 3
)
RETURNS TABLE (
  topic            text,
  question_count   bigint,
  share_pct        numeric,
  uncertain_count  bigint,
  states_seen      bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_temp
AS $$
  WITH win AS (
    SELECT question_topic, certainty, scope_state
    FROM snap_enrollment.mae_query_log
    WHERE question_topic IS NOT NULL
      AND created_at >= now() - (p_days || ' days')::interval
  ), total AS (SELECT count(*)::numeric AS n FROM win)
  SELECT
    w.question_topic,
    count(*)::bigint,
    round(100.0 * count(*) / NULLIF((SELECT n FROM total), 0), 1),
    count(*) FILTER (WHERE w.certainty = 'uncertain')::bigint,
    count(DISTINCT w.scope_state)::bigint
  FROM win w
  GROUP BY w.question_topic
  HAVING count(*) >= p_min_count
  ORDER BY count(*) DESC;
$$;

REVOKE ALL ON FUNCTION snap_enrollment.demeter_confusion_stats(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_confusion_stats(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_confusion_stats(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION snap_enrollment.demeter_confusion_stats(integer, integer) TO service_role;
