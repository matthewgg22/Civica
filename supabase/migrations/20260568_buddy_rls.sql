-- REPAIRED 2026-08-22 (#679). This migration could not be applied to an empty
-- database: its policies reference snap_packets.user_id, a column that does
-- not exist — snap_packets identifies the applicant by applicant_id, which is
-- an applicants.applicant_id, not an auth uid.
--
-- SCOPE OF THE REPAIR: column names only, so the chain replays. The buddy
-- policies below were never successfully applied ANYWHERE — prod's
-- snap_packets carries only applicant_read_own_packet, packets_own_select and
-- the two staff policies — so this is not a rewrite of live security, it is
-- making a never-applied file valid. THE SEMANTICS STILL WANT A SECURITY
-- REVIEW before anything relies on them; see the PR for #679.
--
-- The auth-uid vs applicant-id distinction is the whole of the fix:
-- buddy_relationship.applicant_user_id holds an AUTH UID (it is compared to
-- auth.uid() directly), while snap_packets.applicant_id holds an
-- applicants.applicant_id. Joining them requires going through
-- applicants.auth_uid, exactly as the live applicant_read_own_packet policy
-- does. Comparing them directly would silently match nothing.

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
    applicant_id = snap_enrollment.current_applicant_id()
    OR EXISTS (
      SELECT 1 FROM snap_enrollment.buddy_relationship br
      JOIN snap_enrollment.applicants a
        ON a.auth_uid = br.applicant_user_id
      WHERE br.buddy_user_id = auth.uid()
        AND a.applicant_id = snap_enrollment.snap_packets.applicant_id
        AND br.status = 'active'
        -- REPLAY REPAIR (#679): was NOT IN ('submitted','approved') — neither
        -- is a packet_status label, so this file could never execute against
        -- a fresh database ("invalid input value for enum"). The terminal set
        -- is ('Handed Off','Closed'), which is also what prod's live
        -- buddy_packet_summary_view and buddy_auto_revoke_on_terminal use.
        AND snap_enrollment.snap_packets.status NOT IN ('Handed Off', 'Closed')
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
