-- snap_enrollment — make the public feedback upsert actually work.
--
-- 20260614 created the report_id uniqueness as a PARTIAL index:
--
--   CREATE UNIQUE INDEX mae_feedback_report_id_key
--     ON snap_enrollment.mae_feedback (report_id)
--     WHERE report_id IS NOT NULL;
--
-- The predicate was there to leave staff rows (report_id NULL) unconstrained.
-- It is UNNECESSARY — Postgres already treats NULLs as distinct in a unique
-- index, so any number of NULL rows coexist without it — and it BREAKS the
-- upsert the public feedback route depends on.
--
-- PostgREST emits `ON CONFLICT (report_id) DO UPDATE` with no predicate.
-- Postgres cannot infer a PARTIAL unique index from that: arbiter inference
-- requires the index predicate to be restated in the ON CONFLICT clause, which
-- PostgREST has no syntax for. Every write therefore failed with 42P10, the
-- route caught it, and — by design, so a reporter is never punished — returned
-- 202 {"ok":true,"stored":false}. Verified in production 2026-08-11: two
-- submissions, both 202, zero rows written.
--
-- Swapping the partial index for a plain unique index fixes the inference and
-- keeps the NULL behaviour identical.
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`).

DROP INDEX IF EXISTS snap_enrollment.mae_feedback_report_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS mae_feedback_report_id_key
  ON snap_enrollment.mae_feedback (report_id);

COMMENT ON INDEX snap_enrollment.mae_feedback_report_id_key IS
  'One row per public feedback REPORT. Plain (not partial) so PostgREST can infer it as an ON CONFLICT arbiter; NULLs are distinct in Postgres, so staff rows are unaffected.';
