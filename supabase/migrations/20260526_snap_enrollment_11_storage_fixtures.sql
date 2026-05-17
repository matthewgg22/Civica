-- Create public Storage bucket for FindHelp fixture files.
-- iOS fetches ca_retailers.json from this bucket at first launch
-- and caches it locally, removing the 14 MB file from the git bundle.
-- Files are read-only by the public (anon) role; updates are done via
-- the Supabase dashboard or service-role uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'snap-fixtures',
  'snap-fixtures',
  true,
  52428800, -- 50 MiB — room for future state datasets
  array['application/json']
)
on conflict (id) do nothing;
