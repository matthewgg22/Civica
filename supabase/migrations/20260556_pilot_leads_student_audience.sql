-- Loosen pilot_leads to serve both CBO-shaped leads (name+organization required)
-- and student-shaped leads (email+campus required) under different source tags.

ALTER TABLE public.pilot_leads
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN organization DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS campus text;

-- Source-conditional shape: enforce the right fields per audience.
-- CBO leads need name+organization; student leads need email+campus.
ALTER TABLE public.pilot_leads
  ADD CONSTRAINT pilot_leads_audience_shape
  CHECK (
    (source = 'student-lpie-web' AND email IS NOT NULL AND campus IS NOT NULL)
    OR
    (source != 'student-lpie-web' AND name IS NOT NULL AND organization IS NOT NULL)
  );

COMMENT ON COLUMN public.pilot_leads.phone IS 'Optional. Used by student-audience leads. Do NOT use qc_process for phone numbers — that column is for CBO QC workflow state.';
COMMENT ON COLUMN public.pilot_leads.campus IS 'Optional. Campus name (CCC / CSU / UC) for student-audience leads.';
