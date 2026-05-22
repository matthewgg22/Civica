-- Buddy Add: auto-revoke trigger
-- When a packet reaches a terminal state (approved / denied / withdrawn),
-- all active BuddyRelationship rows for that applicant are set to 'completed'.
-- NOTE: this trigger cannot call the Supabase Admin API to clear
-- app_metadata.role='buddy' on the auth user. That gap is tracked as TODO-18
-- and handled by the PR3 stall-checker cron.

CREATE OR REPLACE FUNCTION snap_enrollment.buddy_auto_revoke_on_terminal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('approved', 'denied', 'withdrawn') AND
     (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE snap_enrollment.buddy_relationship
    SET    status     = 'completed',
           updated_at = now()
    WHERE  applicant_user_id = NEW.user_id
      AND  status            = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS buddy_auto_revoke ON snap_enrollment.snap_packets;

CREATE TRIGGER buddy_auto_revoke
  AFTER UPDATE ON snap_enrollment.snap_packets
  FOR EACH ROW
  EXECUTE FUNCTION snap_enrollment.buddy_auto_revoke_on_terminal();
