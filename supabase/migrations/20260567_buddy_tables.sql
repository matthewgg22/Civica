-- Buddy Add: core tables
-- Depends on 20260566_buddy_actorkind.sql (enum must exist before use).

SET search_path TO snap_enrollment, public;

-- BuddyOrg: labor union / employer org that sponsors buddy relationships
CREATE TABLE IF NOT EXISTS snap_enrollment.buddy_org (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  org_code              TEXT NOT NULL UNIQUE,
  org_code_expires_at   TIMESTAMPTZ NOT NULL,
  created_by            UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BuddyInvite: single-use signed token, hashed for storage
CREATE TABLE IF NOT EXISTS snap_enrollment.buddy_invite (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id     UUID NOT NULL,
  token_hash            TEXT NOT NULL UNIQUE,
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BuddyRelationship: live link between a buddy and an applicant
CREATE TABLE IF NOT EXISTS snap_enrollment.buddy_relationship (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id                 UUID NOT NULL,
  buddy_user_id                     UUID NOT NULL,
  org_id                            UUID REFERENCES snap_enrollment.buddy_org(id) ON DELETE SET NULL,
  status                            TEXT NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'pending', 'completed', 'revoked')),
  notifications_enabled             BOOLEAN NOT NULL DEFAULT true,
  -- stall-checker dedup: updated after each notification send (TODO-18 / PR3)
  last_stall_notification_sent_at   TIMESTAMPTZ,
  -- app_metadata cleanup tracking (TODO-18 / PR3 cron)
  app_metadata_cleared_at           TIMESTAMPTZ,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_user_id, buddy_user_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_buddy_relationship_buddy_user_id
  ON snap_enrollment.buddy_relationship (buddy_user_id);

CREATE INDEX IF NOT EXISTS idx_buddy_relationship_applicant_user_id
  ON snap_enrollment.buddy_relationship (applicant_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buddy_invite_token_hash
  ON snap_enrollment.buddy_invite (token_hash);

-- Partial index used by the stall-checker cron (PR3) to efficiently find
-- active relationships without scanning completed/revoked rows.
CREATE INDEX IF NOT EXISTS idx_buddy_relationship_active
  ON snap_enrollment.buddy_relationship (applicant_user_id)
  WHERE status = 'active';
