-- Fix infinite recursion in RLS policies caused by:
--   applicants_staff_select → queries snap_packets
--   packets_own_select      → queries applicants
-- Solution: a SECURITY DEFINER helper bypasses RLS when looking up the
-- current auth user's applicant_id, breaking the cycle.

create or replace function snap_enrollment.current_applicant_id()
returns uuid
language sql
security definer
stable
set search_path = snap_enrollment
as $$
  select applicant_id from snap_enrollment.applicants
  where auth_uid = auth.uid()
  limit 1
$$;

-- Replace packets_own_select to use the definer function (no RLS on applicants)
drop policy if exists packets_own_select on snap_enrollment.snap_packets;
create policy packets_own_select on snap_enrollment.snap_packets
  for select to authenticated
  using (
    applicant_id = snap_enrollment.current_applicant_id()
  );
