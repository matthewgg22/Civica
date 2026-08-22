-- snap_enrollment — Session grouping on the query log, so drop-off is derivable.
--
-- The log already records a lot ABOUT each answer (certainty, verifier outcome,
-- confusion topic, distress, state) but nothing tying two questions together,
-- so the one thing a chat product most needs to know — do people ask once and
-- leave, or stay and get somewhere — was unanswerable. Two columns fix that
-- without a second table or an events pipeline.
--
-- PRIVACY: session_id is a RANDOM id generated in the browser tab, not derived
-- from anything about the person. It dies with the tab, is never sent to the
-- model, and links nothing across visits or devices — the anonymous-first
-- posture is intact. It is a grouping key for "these turns were one
-- conversation", and nothing more. Question text keeps its existing 7-day
-- scrubbed retention; this column does not extend it.
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`).

ALTER TABLE snap_enrollment.mae_query_log
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS turn_index INTEGER;

COMMENT ON COLUMN snap_enrollment.mae_query_log.session_id IS
  'Random per-tab id. Groups turns into one conversation; not an identity, not stable across visits.';
COMMENT ON COLUMN snap_enrollment.mae_query_log.turn_index IS
  '1-based question number within the session. turn_index = 1 with no successor is a one-question drop-off.';

CREATE INDEX IF NOT EXISTS mae_query_log_session_idx
  ON snap_enrollment.mae_query_log (session_id, turn_index)
  WHERE session_id IS NOT NULL;

/**
 * The drop-off curve: how many sessions reached exactly N questions.
 *
 * `sessions_at_least` is the survival number — sessions that reached N turns
 * OR MORE — because the interesting figure is "how many made it this far",
 * not how many stopped precisely here.
 *
 * Deliberately reports NOTHING about who; only depth, and only in aggregate.
 * service_role only, like the rest of this surface.
 *
 * KNOWN LIMIT, stated here so nobody reads more into the number than it holds:
 * this measures drop-off AMONG PEOPLE WHO ASKED AT LEAST ONE QUESTION. Someone
 * who landed on the page and never typed leaves no row at all, so the largest
 * drop in any funnel — arrival to first question — is invisible to this. That
 * needs a page-view beacon, which is a separate decision.
 */
CREATE OR REPLACE FUNCTION snap_enrollment.demeter_funnel_stats(
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  turn              integer,
  sessions_at_least bigint,
  share_of_sessions numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_temp
AS $$
  WITH depth AS (
    SELECT session_id, max(turn_index) AS max_turn
    FROM snap_enrollment.mae_query_log
    WHERE session_id IS NOT NULL
      AND created_at >= now() - (p_days || ' days')::interval
    GROUP BY session_id
  ), total AS (SELECT count(*)::numeric AS n FROM depth)
  SELECT
    g.turn,
    count(*) FILTER (WHERE d.max_turn >= g.turn)::bigint,
    round(100.0 * count(*) FILTER (WHERE d.max_turn >= g.turn)
          / NULLIF((SELECT n FROM total), 0), 1)
  FROM generate_series(1, 10) AS g(turn)
  CROSS JOIN depth d
  GROUP BY g.turn
  HAVING count(*) FILTER (WHERE d.max_turn >= g.turn) > 0
  ORDER BY g.turn;
$$;

REVOKE ALL ON FUNCTION snap_enrollment.demeter_funnel_stats(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_funnel_stats(integer) FROM anon;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_funnel_stats(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION snap_enrollment.demeter_funnel_stats(integer) TO service_role;
