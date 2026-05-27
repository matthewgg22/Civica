-- Fix qc_outcomes RLS: the original policy matched created_by = auth.uid()::text,
-- but created_by stores staff_id (not auth_uid), so no navigator could ever read
-- their own org's outcomes. Replace with is_navigator_in_org(org_id) consistent
-- with packet_answers, uploaded_documents, and other navigator-readable tables.

DROP POLICY IF EXISTS "navigator can manage own org qc outcomes" ON snap_enrollment.qc_outcomes;

CREATE POLICY "navigator can manage own org qc outcomes"
  ON snap_enrollment.qc_outcomes FOR ALL
  USING  (snap_enrollment.is_navigator_in_org(org_id))
  WITH CHECK (snap_enrollment.is_navigator_in_org(org_id));
