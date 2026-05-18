-- Create private Storage bucket for applicant-uploaded documents.
-- Files are written via enrollment-api presigned URLs and read via signed download URLs.
-- No direct authenticated INSERT policy is needed: the enrollment-api generates upload
-- tokens via the service role (which bypasses RLS), so applicants use the signed URL
-- rather than authenticating against Storage directly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Applicants may read their own documents (path prefix = applicant_id).
create policy "applicant read own documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from snap_enrollment.applicants a
      where a.auth_uid = auth.uid()
        and a.applicant_id::text = (storage.foldername(name))[1]
    )
  );

-- Staff navigators may read documents for packets in their org.
-- Path convention: documents/{applicant_id}/{packet_id}/{filename}
create policy "staff read org documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from snap_enrollment.staff_users su
      join snap_enrollment.snap_packets sp on sp.org_id = su.org_id
      where su.auth_uid = auth.uid()
        and sp.packet_id::text = (storage.foldername(name))[2]
        and sp.deleted_at is null
    )
  );
