-- Create private Storage bucket for handoff export files.
-- Files are written by the enrollment-api service role and read by staff navigators.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'handoffs',
  'handoffs',
  false,
  10485760, -- 10 MiB
  array['application/json', 'text/csv', 'application/xml', 'application/pdf']
)
on conflict (id) do nothing;

-- Staff navigators may download their own org's exports.
-- The enrollment-api (service role) bypasses RLS when uploading.
create policy "staff read own org handoffs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'handoffs'
    and exists (
      select 1 from snap_enrollment.staff_users su
      where su.auth_uid = auth.uid()
        and su.org_id::text = (storage.foldername(name))[1]
    )
  );
