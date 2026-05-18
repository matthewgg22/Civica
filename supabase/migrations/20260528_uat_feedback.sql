-- UAT feedback table — lightweight collector for navigator UAT participants.
-- Lives in public schema (not snap_enrollment) since it is tooling, not applicant data.

CREATE TABLE IF NOT EXISTS public.uat_feedback (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  navigator_email text       NOT NULL,
  page_path      text        NOT NULL,
  message        text        NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.uat_feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated navigator may insert their own feedback.
CREATE POLICY "authenticated_insert_uat_feedback"
  ON public.uat_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only the service role (admin tooling / Supabase dashboard) may read rows.
CREATE POLICY "service_role_read_uat_feedback"
  ON public.uat_feedback
  FOR SELECT
  TO service_role
  USING (true);
