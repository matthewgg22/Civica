-- snap_enrollment — Migration: argyle_connections table (T-DR3-8)
--
-- Maps an applicant to their Argyle user ID. The Argyle webhook uses this
-- table to resolve which packet/applicant a paycheck.added event belongs to.
-- One row per applicant; upserted when the iOS Argyle SDK completes link.

CREATE TABLE snap_enrollment.argyle_connections (
  connection_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id      UUID        NOT NULL,
  packet_id         UUID        REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE SET NULL,

  argyle_user_id    TEXT        NOT NULL UNIQUE,        -- opaque Argyle user ID

  -- Linked accounts (multiple employers possible; stored as JSONB array)
  linked_accounts   JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Lifecycle
  linked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,                        -- set when user disconnects Argyle

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.argyle_connections (applicant_id);
CREATE UNIQUE INDEX ON snap_enrollment.argyle_connections (argyle_user_id)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS argyle_connections_updated_at ON snap_enrollment.argyle_connections;
CREATE TRIGGER argyle_connections_updated_at
  BEFORE UPDATE ON snap_enrollment.argyle_connections
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

ALTER TABLE snap_enrollment.argyle_connections ENABLE ROW LEVEL SECURITY;

-- Applicants can read their own connection status
CREATE POLICY "applicant can read own argyle connection"
  ON snap_enrollment.argyle_connections FOR SELECT
  USING (applicant_id = auth.uid());

-- Service role writes (Argyle SDK completion webhook, revocation)
GRANT SELECT, INSERT, UPDATE ON snap_enrollment.argyle_connections TO service_role;
