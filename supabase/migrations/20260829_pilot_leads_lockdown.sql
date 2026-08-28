-- #1053: pilot_leads was open to the browser anon key.
--
-- The 20260547 policy was created without TO service_role, so it applied to
-- EVERY role (polroles = PUBLIC, USING (true)) — and the table carried full
-- anon/authenticated grants down to TRUNCATE, verified at the ACL level in
-- prod on 2026-08-28. The anon key ships in every visitor's bundle, so this
-- was readable, writable, and deletable lead contact data. Zero rows existed
-- at the time; nothing leaked.
--
-- Idempotent: safe to paste twice.
drop policy if exists "service_role_all" on public.pilot_leads;
create policy "service_role_all" on public.pilot_leads
  for all to service_role using (true) with check (true);

revoke all on public.pilot_leads from anon, authenticated;

-- While in here: the single RLS-off table in snap_enrollment (no grants
-- reach it today, but it was one careless GRANT away from exposure).
alter table snap_enrollment.recert_outreach_optouts enable row level security;
