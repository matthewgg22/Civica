-- T10: Analytical tier foundation — civica-analytics bucket.
--
-- Per docs/data-architecture.md: one private Supabase Storage bucket holds
-- Tier 3 analytical data (USDA PER, OBBBA scenarios, CFR-273 mirror, FOIA
-- responses, Civica-emit QC evaluation exports). Written via service role
-- by data-ops sync scripts. Read by the @civica/analytics-engine package
-- (server runtimes) and by DuckDB CLI for ad-hoc queries.
--
-- MVP read model: service-role only. The future `analytics_reader` role
-- (for non-service authenticated dashboard access) is intentionally
-- deferred — promote the policy below when DuckDB-WASM / signed-URL
-- delivery is built out and analyst seats exist.

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'civica-analytics',
  'civica-analytics',
  false,
  -- 1 GiB ceiling per object; large QC microdata Parquet files can approach
  -- a few hundred MB. Tighten if it becomes a footgun.
  1073741824
)
on conflict (id) do nothing;

-- Service-role bypasses RLS by design, so no INSERT/UPDATE/DELETE policy
-- is needed for the sync script (scripts/sync-to-supabase-storage.ts).
-- We add an explicit deny for the `authenticated` role to make the
-- bucket's "service-role only" posture unmistakable in the policy editor.

create policy "civica-analytics: no authenticated read (MVP)"
  on storage.objects for select
  to authenticated
  using (bucket_id <> 'civica-analytics');

create policy "civica-analytics: no authenticated write (MVP)"
  on storage.objects for insert
  to authenticated
  with check (bucket_id <> 'civica-analytics');

-- When `analytics_reader` is introduced, replace the SELECT policy with:
--   create policy "civica-analytics: analytics_reader read"
--     on storage.objects for select
--     to authenticated
--     using (
--       bucket_id = 'civica-analytics'
--       and exists (
--         select 1 from snap_enrollment.users u
--         where u.auth_uid = auth.uid()
--           and 'analytics_reader' = any(u.roles)
--       )
--     );
