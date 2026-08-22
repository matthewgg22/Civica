-- General site feedback — distinct from snap_enrollment.mae_feedback, which
-- is a rating (up/down + reason) tied to one specific chat answer. This is
-- for the visitor who wants to say something about the SITE or PRODUCT that
-- isn't a rating on a specific answer: a suggestion, a bug report, "please
-- add my state," a compliment. There was no path for that at all — the only
-- feedback mechanism on the whole product was the per-answer thumbs, buried
-- inside an active chat.
--
-- No moderation queue and no public wall (unlike demeter_supporters) — this
-- is a one-way inbox for staff to read, not content that renders publicly.
-- `status` exists so staff can mark a row read without deleting it.
--
-- Applies via the dashboard SQL editor (NOT `db push --linked`).

CREATE TABLE IF NOT EXISTS snap_enrollment.demeter_site_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text CHECK (category IN ('bug', 'suggestion', 'question', 'other')),
  message       text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 200),
  page_url      text,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Service-role only; the form writes via the server route, staff read it
-- directly in the Supabase dashboard. Nothing faces anon PostgREST.
ALTER TABLE snap_enrollment.demeter_site_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON snap_enrollment.demeter_site_feedback FROM PUBLIC;
REVOKE ALL ON snap_enrollment.demeter_site_feedback FROM anon;
REVOKE ALL ON snap_enrollment.demeter_site_feedback FROM authenticated;
GRANT ALL ON snap_enrollment.demeter_site_feedback TO service_role;

CREATE INDEX IF NOT EXISTS demeter_site_feedback_status_idx
  ON snap_enrollment.demeter_site_feedback (status, created_at DESC);

COMMENT ON TABLE snap_enrollment.demeter_site_feedback IS
  'General product/site feedback from the public /feedback form — distinct from mae_feedback''s per-answer ratings. Added 2026-08-15 on direct user feedback that no general feedback path existed.';
