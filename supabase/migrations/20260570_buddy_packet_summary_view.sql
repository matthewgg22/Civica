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
-- Applicants retain direct snap_packets access via user_id = auth.uid().
--
-- Surfaced by: /plan-eng-review 2026-05-22 (T3, P2).
-- Closes: TODO-19, rls-row-vs-column-restriction pitfall.

-- 1. Replace the policy so buddies no longer read snap_packets rows directly.
--    Applicants keep their own-row SELECT. Buddies now go through the view.
DROP POLICY IF EXISTS "buddy_read_active_packet" ON snap_enrollment.snap_packets;

CREATE POLICY "applicant_read_own_packet" ON snap_enrollment.snap_packets
  FOR SELECT USING (
    user_id = auth.uid()
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
  current_section    TEXT,
  updated_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_catalog
AS $$
  SELECT
    p.packet_id,
    p.user_id          AS applicant_user_id,
    p.status,
    p.state_code,
    p.current_section,
    p.updated_at,
    p.created_at
  FROM snap_enrollment.snap_packets p
  WHERE EXISTS (
    SELECT 1
    FROM snap_enrollment.buddy_relationship br
    WHERE br.buddy_user_id     = auth.uid()
      AND br.applicant_user_id = p.user_id
      AND br.status            = 'active'
  )
  AND p.status NOT IN ('submitted', 'approved', 'denied', 'withdrawn')
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
