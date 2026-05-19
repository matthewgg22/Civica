-- snap_enrollment — Migration: canvas_connections table (T-DR3-9)
--
-- Stores encrypted Canvas OAuth tokens per applicant. The enrollment API's
-- Canvas OAuth proxy writes here on code exchange; GET /oauth/canvas/schedule
-- reads and decrypts the access token to call the Canvas calendar API.
-- Token encryption uses AES-GCM with SNAP_FERNET_KEY as key material.

CREATE TABLE snap_enrollment.canvas_connections (
  connection_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id        UUID        NOT NULL UNIQUE,
  packet_id           UUID        REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE SET NULL,

  -- Encrypted tokens (AES-GCM, base64-encoded iv+ciphertext)
  access_token_enc    TEXT        NOT NULL,
  refresh_token_enc   TEXT        NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,

  -- Which Canvas instance this connection is for
  canvas_instance_url TEXT        NOT NULL,

  -- Lifecycle
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at          TIMESTAMPTZ,                      -- set on DELETE /oauth/canvas

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.canvas_connections (applicant_id)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS canvas_connections_updated_at ON snap_enrollment.canvas_connections;
CREATE TRIGGER canvas_connections_updated_at
  BEFORE UPDATE ON snap_enrollment.canvas_connections
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

ALTER TABLE snap_enrollment.canvas_connections ENABLE ROW LEVEL SECURITY;

-- Applicants can read their own connection status (not the encrypted token)
CREATE POLICY "applicant can read own canvas connection status"
  ON snap_enrollment.canvas_connections FOR SELECT
  USING (applicant_id = auth.uid());

-- Service role reads/writes (token exchange, schedule fetch, revocation)
-- Encrypted tokens are only decrypted inside the Workers runtime — never
-- returned raw to any client.
GRANT SELECT, INSERT, UPDATE ON snap_enrollment.canvas_connections TO service_role;
