-- snap_enrollment — Public feedback on a Demeter answer.
--
-- EXTENDS snap_enrollment.mae_feedback rather than adding a second table, so
-- there is ONE triage queue. A thumbs-down from an applicant and one from a
-- caseworker are the same signal — a candidate regression case for the answer
-- eval — and splitting them across two tables would mean two queries, two
-- dashboards, and one of them quietly going unread.
--
-- staff_user_id was already nullable, so an anonymous row fits with no change
-- to the existing columns. `source` is what tells them apart.
--
-- The public columns exist because triage needs them: a wrong answer is almost
-- always wrong FOR A STATE and IN A LANGUAGE, and `certainty` says whether the
-- pipeline already knew it was on thin ice (a thumbs-down on an answer we
-- marked CERTAIN is a much louder signal than one on an UNCERTAIN answer).
--
-- PRIVACY INVARIANT, unchanged and now more load-bearing: note and
-- question_redacted are PII-scrubbed by the route before insert. The public
-- surface is anonymous — someone may type their income or address into a note,
-- and raw PII must never land here.
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`).

ALTER TABLE snap_enrollment.mae_feedback
  ADD COLUMN IF NOT EXISTS source      TEXT NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS scope_state TEXT,
  ADD COLUMN IF NOT EXISTS lang        TEXT,
  ADD COLUMN IF NOT EXISTS certainty   TEXT;

-- Existing rows predate the public surface, so the 'staff' default is correct
-- for them. Constraint added separately so the ALTER above stays idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mae_feedback_source_check'
  ) THEN
    ALTER TABLE snap_enrollment.mae_feedback
      ADD CONSTRAINT mae_feedback_source_check CHECK (source IN ('staff', 'public'));
  END IF;
END $$;

COMMENT ON COLUMN snap_enrollment.mae_feedback.source IS
  'staff = dashboard caseworker; public = anonymous applicant on apps/web.';
COMMENT ON COLUMN snap_enrollment.mae_feedback.certainty IS
  'The certainty verdict the answer carried. A thumbs-down on a CERTAIN answer is the loudest signal in this table.';

-- The public triage queue: the rows most worth reading first are public
-- thumbs-downs on answers the pipeline believed were solid.
CREATE INDEX IF NOT EXISTS mae_feedback_public_down_idx
  ON snap_enrollment.mae_feedback (created_at DESC)
  WHERE rating = 'down' AND source = 'public';

/**
 * Triage rollup for the public surface. service_role only, like the rest of
 * this surface — these rows are a quality signal for the operator, not a
 * public statistic.
 *
 * Returns nothing when the window is empty; callers must render "not yet
 * measured" rather than an empty table implying a clean bill of health.
 */
CREATE OR REPLACE FUNCTION snap_enrollment.demeter_feedback_stats(
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  reason         text,
  scope_state    text,
  lang           text,
  certainty      text,
  down_count     bigint,
  up_count       bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_temp
AS $$
  SELECT
    f.reason,
    f.scope_state,
    f.lang,
    f.certainty,
    count(*) FILTER (WHERE f.rating = 'down')::bigint,
    count(*) FILTER (WHERE f.rating = 'up')::bigint
  FROM snap_enrollment.mae_feedback f
  WHERE f.source = 'public'
    AND f.created_at >= now() - (p_days || ' days')::interval
  GROUP BY f.reason, f.scope_state, f.lang, f.certainty
  ORDER BY count(*) FILTER (WHERE f.rating = 'down') DESC;
$$;

REVOKE ALL ON FUNCTION snap_enrollment.demeter_feedback_stats(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_feedback_stats(integer) FROM anon;
REVOKE ALL ON FUNCTION snap_enrollment.demeter_feedback_stats(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION snap_enrollment.demeter_feedback_stats(integer) TO service_role;
