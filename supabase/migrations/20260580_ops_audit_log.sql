-- Ops audit log (T2 from ceo-plans/2026-05-25-ebt-monetization-dashboard.md)
--
-- Records every /ops/* endpoint access by operator-role users. Surfaces a paper
-- trail for compliance review: who looked at corporate aggregate data, when,
-- and which endpoint.
--
-- The 'operator' role itself is set via app_metadata.role (no DB enum needed)
-- and recognized by apps/enrollment-api/src/middleware/auth.ts. This table
-- captures the audit signal for that role's access.

SET search_path TO snap_enrollment, public;

CREATE TABLE IF NOT EXISTS snap_enrollment.ops_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint          TEXT NOT NULL,                      -- e.g. '/ops/ebt-aggregates'
  method            TEXT NOT NULL DEFAULT 'GET',
  status_code       INTEGER NOT NULL,
  duration_ms       INTEGER,
  request_ip        TEXT,                               -- captured from CF-Connecting-IP if available
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_log_actor_ts
  ON snap_enrollment.ops_audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_endpoint_ts
  ON snap_enrollment.ops_audit_log (endpoint, created_at DESC);

ALTER TABLE snap_enrollment.ops_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies = no anon/auth access. Service role writes; humans query via
-- Supabase admin only.

COMMENT ON TABLE snap_enrollment.ops_audit_log IS
  'Audit trail of /ops/* dashboard access by operator-role users. Service-role write only.';
