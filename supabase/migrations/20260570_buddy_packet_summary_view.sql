-- REPAIRED 2026-08-22 (#679) — SYNCED TO PROD, not rewritten from scratch.
--
-- This file could not apply to an empty database: it referenced
-- snap_packets.user_id (the column is applicant_id) and selected
-- p.current_section, a column that exists in no migration and no database.
--
-- Prod HAS a working buddy_packet_summary_view and
-- buddy_packet_summary_rows() — someone applied a corrected version by hand
-- and the repo kept the broken one. So the repair is not invention: the
-- function body, the view columns and the applicant_read_own_packet predicate
-- below are taken verbatim from the live definitions
-- (pg_get_functiondef / pg_policies, read 2026-08-22). Prod's version also
-- drops current_section and gates on status NOT IN ('Handed Off','Closed')
-- rather than the four lowercase statuses this file used to name.
--
-- That divergence IS the drift #679 is about: the repo stopped describing the
-- database, and nothing noticed because the chain could not be replayed to
-- find out.

-- Buddy Add: column-level PII restriction via summary view.
--
-- Why: the existing buddy_read_active_packet policy in 20260568_buddy_rls.sql
-- grants SELECT on the entire snap_packets row (SSN ciphertext, income, household
-- composition, citizenship status) to a buddy-authenticated query. The API layer
-- in buddy.ts narrows to a safe summary, but any new buddy-scoped route that
-- queries snap_packets directly would inherit full PII access by default.
--
-- This migration moves the buddy access path to a view (buddy_packet_summary_view)
-- that exposes only the columns a buddy should see, and removes the buddy branch
-- from the snap_packets RLS policy so direct queries no longer leak.
--
-- Applicants retain direct snap_packets access via applicants.auth_uid.
--
-- Surfaced by: /plan-eng-review 2026-05-22 (T3, P2).
-- Closes: TODO-19, rls-row-vs-column-restriction pitfall.

-- 1. Replace the policy so buddies no longer read snap_packets rows directly.
--    Applicants keep their own-row SELECT. Buddies now go through the view.
DROP POLICY IF EXISTS "buddy_read_active_packet" ON snap_enrollment.snap_packets;

CREATE POLICY "applicant_read_own_packet" ON snap_enrollment.snap_packets
  FOR SELECT USING (
    -- was: user_id = auth.uid(). snap_packets has no user_id; the applicant is
    -- an applicants.applicant_id, resolved through applicants.auth_uid. This
    -- is verbatim the predicate prod's live policy carries.
    applicant_id IN (
      SELECT a.applicant_id
      FROM snap_enrollment.applicants a
      WHERE a.auth_uid = auth.uid()
    )
  );

-- 2. Buddy summary view — only the columns a buddy needs.
--    SECURITY INVOKER (default in Postgres 15+) means the view runs as the
--    calling role, but we predicate-check inside the view body. Combined with
--    the policy above, buddies cannot bypass column restriction by querying
--    the base table.
--
--    NOTE: SECURITY INVOKER respects RLS on the underlying table. Since the
--    new policy only lets the applicant read their own snap_packets row, a
--    buddy-as-invoker would see zero rows through the view too. We work around
--    this with security_definer + a SECURITY DEFINER function call so the view
--    can resolve the applicant's row for the buddy, but the view body still
--    enforces the buddy_relationship predicate.
CREATE OR REPLACE FUNCTION snap_enrollment.buddy_packet_summary_rows()
RETURNS TABLE (
  packet_id          UUID,
  applicant_user_id  UUID,
  status             TEXT,
  state_code         TEXT,
  updated_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_catalog
AS $$
  SELECT
    p.packet_id,
    a.auth_uid          AS applicant_user_id,
    p.status::TEXT,
    p.state_code::TEXT,
    p.updated_at,
    p.created_at
  FROM snap_enrollment.snap_packets p
  JOIN snap_enrollment.applicants a ON a.applicant_id = p.applicant_id
  WHERE EXISTS (
    SELECT 1
    FROM snap_enrollment.buddy_relationship br
    WHERE br.buddy_user_id     = auth.uid()
      AND br.applicant_user_id = a.auth_uid
      AND br.status            = 'active'
  )
  AND p.status NOT IN ('Handed Off', 'Closed')
  AND p.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION snap_enrollment.buddy_packet_summary_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snap_enrollment.buddy_packet_summary_rows() TO authenticated;

CREATE OR REPLACE VIEW snap_enrollment.buddy_packet_summary_view AS
  SELECT * FROM snap_enrollment.buddy_packet_summary_rows();

REVOKE ALL ON snap_enrollment.buddy_packet_summary_view FROM PUBLIC;
GRANT SELECT ON snap_enrollment.buddy_packet_summary_view TO authenticated;

COMMENT ON VIEW snap_enrollment.buddy_packet_summary_view IS
  'Column-restricted buddy access to snap_packets. Buddies cannot read the base table directly (see policy applicant_read_own_packet); they must query this view. The underlying function is SECURITY DEFINER + STABLE so the auth.uid() check happens against the calling buddy.';
