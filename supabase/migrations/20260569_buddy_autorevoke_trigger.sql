-- Buddy Add: auto-revoke trigger
-- When a packet reaches a terminal state (Handed Off / Closed),
-- all active BuddyRelationship rows for that applicant are set to 'completed'.
-- NOTE: this trigger cannot call the Supabase Admin API to clear
-- app_metadata.role='buddy' on the auth user. That gap is tracked as TODO-18
-- and handled by the PR3 stall-checker cron.

CREATE OR REPLACE FUNCTION snap_enrollment.buddy_auto_revoke_on_terminal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- REPLAY REPAIR (#679): synced VERBATIM to prod's live function body.
  -- The original compared NEW.status to ('approved','denied','withdrawn') and
  -- read NEW.user_id — no such enum labels, no such column. plpgsql bodies are
  -- not name-resolved at CREATE time, so this file applied cleanly and then
  -- raised on every UPDATE of snap_packets. Whoever pasted it into prod fixed
  -- both by hand and the repo never learned; this closes that gap.
  IF NEW.status IN ('Handed Off', 'Closed') AND
     (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE snap_enrollment.buddy_relationship
    SET    status     = 'completed',
           updated_at = now()
    WHERE  applicant_user_id IN (
             SELECT a.auth_uid FROM snap_enrollment.applicants a
             WHERE a.applicant_id = NEW.applicant_id
           )
      AND  status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS buddy_auto_revoke ON snap_enrollment.snap_packets;

CREATE TRIGGER buddy_auto_revoke
  AFTER UPDATE ON snap_enrollment.snap_packets
  FOR EACH ROW
  EXECUTE FUNCTION snap_enrollment.buddy_auto_revoke_on_terminal();
