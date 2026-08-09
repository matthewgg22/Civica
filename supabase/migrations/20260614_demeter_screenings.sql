-- The CBO screening tool's data model (mockup frames 02-07).
--
-- Distinct from the public chat's mae_query_log: a screening is a CASE, not
-- a single Q&A turn — it accumulates structured facts across many turns,
-- carries a status, and is the thing a caseworker exports as a PDF.
--
-- Same lockdown as every other Demeter table: service_role only, nothing
-- faces anon PostgREST. Guest sessions have no auth.uid() to key RLS off of,
-- so access control for BOTH org members and guests is enforced by the
-- Next.js API routes (which check org membership or a guest_token match),
-- not by Postgres RLS policies keyed to auth.uid(). This mirrors how every
-- other Demeter table in this schema already works.
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`).

CREATE TABLE IF NOT EXISTS snap_enrollment.demeter_orgs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  -- Used to auto-suggest an org at sign-up and to label the case file
  -- ("Franklin County Food Alliance"). NOT a security boundary by itself —
  -- membership is what grants access, this is display/routing convenience.
  work_email_domain  text,
  state_code         text NOT NULL,
  -- Short prefix for human-readable case labels, e.g. "FCFA" → "FCFA-4127".
  case_label_prefix  text NOT NULL CHECK (case_label_prefix ~ '^[A-Z]{2,8}$'),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snap_enrollment.demeter_org_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES snap_enrollment.demeter_orgs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL, -- auth.users.id; no FK across schemas by convention here
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- A per-user sequence for human-readable case labels ("FCFA-4127"), scoped
-- to the org so two orgs' counters don't collide or leak volume to each other.
CREATE TABLE IF NOT EXISTS snap_enrollment.demeter_case_sequences (
  org_id  uuid PRIMARY KEY REFERENCES snap_enrollment.demeter_orgs(id) ON DELETE CASCADE,
  next_n  integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS snap_enrollment.demeter_screenings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-readable label ("FCFA-4127") for org screenings; guest screenings
  -- are never labelled with an org prefix since none exists yet.
  case_label    text,
  org_id        uuid REFERENCES snap_enrollment.demeter_orgs(id) ON DELETE SET NULL,
  created_by    uuid, -- auth.users.id; null for guest sessions
  -- Opaque per-browser token (a signed cookie value) for GUEST sessions only.
  -- Never set alongside org_id — a screening is either an org case or a
  -- guest session, never both.
  guest_token   text,
  state_code    text NOT NULL,
  -- Accumulated PartialFacts (packages/demeter-engine/src/screening/) — the
  -- worksheet's live state, patched turn by turn.
  facts         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Redacted transcript, same PII-redaction discipline as the public chat's
  -- audit sink applies before anything is ever persisted.
  messages      jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Denormalized from the last classification, for fast case listing
  -- without recomputing. The live worksheet is the source of truth; this is
  -- a read cache.
  outcome       text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exported')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (org_id IS NULL OR guest_token IS NULL)
);

CREATE INDEX IF NOT EXISTS demeter_screenings_org_idx
  ON snap_enrollment.demeter_screenings (org_id, created_at DESC)
  WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS demeter_screenings_guest_idx
  ON snap_enrollment.demeter_screenings (guest_token, created_at DESC)
  WHERE guest_token IS NOT NULL;

ALTER TABLE snap_enrollment.demeter_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.demeter_org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.demeter_case_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.demeter_screenings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON snap_enrollment.demeter_orgs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON snap_enrollment.demeter_org_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON snap_enrollment.demeter_case_sequences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON snap_enrollment.demeter_screenings FROM PUBLIC, anon, authenticated;
GRANT ALL ON snap_enrollment.demeter_orgs TO service_role;
GRANT ALL ON snap_enrollment.demeter_org_members TO service_role;
GRANT ALL ON snap_enrollment.demeter_case_sequences TO service_role;
GRANT ALL ON snap_enrollment.demeter_screenings TO service_role;

/**
 * Atomically issue the next case label for an org ("FCFA-4127").
 * Upsert-and-increment, same atomicity pattern as demeter_increment_and_check
 * (20260610) — concurrent screenings started in the same org never collide.
 */
CREATE OR REPLACE FUNCTION snap_enrollment.demeter_next_case_label(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_temp
AS $$
DECLARE
  v_prefix text;
  v_n integer;
BEGIN
  SELECT case_label_prefix INTO v_prefix FROM snap_enrollment.demeter_orgs WHERE id = p_org_id;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'unknown org %', p_org_id;
  END IF;

  INSERT INTO snap_enrollment.demeter_case_sequences (org_id, next_n)
  VALUES (p_org_id, 2)
  ON CONFLICT (org_id) DO UPDATE SET next_n = snap_enrollment.demeter_case_sequences.next_n + 1
  RETURNING next_n - 1 INTO v_n;

  RETURN v_prefix || '-' || v_n;
END;
$$;

REVOKE ALL ON FUNCTION snap_enrollment.demeter_next_case_label(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION snap_enrollment.demeter_next_case_label(uuid) TO service_role;

/**
 * How many screenings a guest token has already STARTED, ever — the guest
 * cap (mockup: 5) is a lifetime count, not a rolling window, and continuing
 * an existing screening never counts again against it (only creation does;
 * the caller only invokes this when about to INSERT a new row).
 */
CREATE OR REPLACE FUNCTION snap_enrollment.demeter_guest_screening_count(p_guest_token text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_temp
AS $$
  SELECT count(*)::integer
  FROM snap_enrollment.demeter_screenings
  WHERE guest_token = p_guest_token;
$$;

REVOKE ALL ON FUNCTION snap_enrollment.demeter_guest_screening_count(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION snap_enrollment.demeter_guest_screening_count(text) TO service_role;

COMMENT ON TABLE snap_enrollment.demeter_screenings IS
  'CBO caseworker screening tool case files (mockup frames 02-07). Guest OR org, never both — see the org_id/guest_token CHECK.';
