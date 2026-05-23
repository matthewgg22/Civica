-- Buddy Add: RLS policies
-- Depends on 20260567_buddy_tables.sql.

ALTER TABLE snap_enrollment.buddy_relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.buddy_invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.buddy_org ENABLE ROW LEVEL SECURITY;

-- BuddyInvite: service_role only — no authenticated-user reads.
-- The invite token is a secret; clients never need to list invite rows.
CREATE POLICY "buddy_invite_service_role_only" ON snap_enrollment.buddy_invite
  FOR ALL USING (false);

-- BuddyRelationship: buddy sees their own rows; applicant sees rows where
-- they are the applicant.
CREATE POLICY "buddy_relationship_read_own" ON snap_enrollment.buddy_relationship
  FOR SELECT USING (
    buddy_user_id = auth.uid() OR applicant_user_id = auth.uid()
  );

-- Packet access for buddy: buddy may SELECT the applicant's active packet
-- when an active BuddyRelationship exists.
-- NOTE: this grants the full snap_packets row to a buddy-authenticated query.
-- Column restriction (TODO-19) will add a buddy_packet_summary_view before
-- App Store launch so that future developers can't accidentally expose PII.
CREATE POLICY "buddy_read_active_packet" ON snap_enrollment.snap_packets
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM snap_enrollment.buddy_relationship br
      WHERE br.buddy_user_id = auth.uid()
        AND br.applicant_user_id = snap_enrollment.snap_packets.user_id
        AND br.status = 'active'
        AND snap_enrollment.snap_packets.status NOT IN ('submitted', 'approved')
    )
  );

-- BuddyOrg: members can read the org they belong to; admin-only writes.
CREATE POLICY "buddy_org_read_member" ON snap_enrollment.buddy_org
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM snap_enrollment.buddy_relationship br
      WHERE br.org_id = snap_enrollment.buddy_org.id
        AND br.buddy_user_id = auth.uid()
    )
  );
