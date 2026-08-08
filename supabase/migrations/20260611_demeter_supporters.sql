-- Demeter supporter wall (CEO D3.6 + eng F1: MODERATED — sign-ups land
-- pending; only approved rows render publicly; text-only names v1, no logo
-- uploads). Supporter definition (verbatim, used everywhere): "A Demeter
-- Supporter is a community organization that endorses free, accurate SNAP
-- guidance and shares Demeter with the people it serves."
--
-- Moderation v1: flip status in the Supabase dashboard (no admin UI this
-- phase). Founding flag marks paying CBO Founding-tier orgs (they appear on
-- the wall with the flag; the supporter count includes them).
--
-- Applies via the dashboard SQL editor (NOT `db push --linked`).

CREATE TABLE IF NOT EXISTS snap_enrollment.demeter_supporters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name     text NOT NULL CHECK (char_length(org_name) BETWEEN 2 AND 120),
  website      text,
  contact_email text NOT NULL,
  state        text,
  note         text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  founding     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  approved_at  timestamptz
);

-- Service-role only; the public wall reads via the server (service client),
-- the sign-on form writes via the server route. Nothing faces anon PostgREST.
ALTER TABLE snap_enrollment.demeter_supporters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON snap_enrollment.demeter_supporters FROM PUBLIC;
REVOKE ALL ON snap_enrollment.demeter_supporters FROM anon;
REVOKE ALL ON snap_enrollment.demeter_supporters FROM authenticated;
GRANT ALL ON snap_enrollment.demeter_supporters TO service_role;

CREATE INDEX IF NOT EXISTS demeter_supporters_status_idx
  ON snap_enrollment.demeter_supporters (status, approved_at DESC);

COMMENT ON TABLE snap_enrollment.demeter_supporters IS
  'Demeter supporter wall: moderated org endorsements (pending → approved), text-only v1. Founding = paying CBO tier. CEO review 2026-08-07 D3.6/F1.';
