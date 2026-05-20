-- Seed navigator@civica.test for local dev + UAT.
--
-- Companion to the T5 audience-role accounts (county@civica.test /
-- cdss@civica.test / cbo@civica.test). Those three are audience-restricted
-- (one route each per apps/dashboard/lib/roleRouting.ts); this account fills
-- the missing operational role and lands on /packets with full staff access.
--
-- Pattern: direct insert into auth.users, mirroring supabase/seed/
-- snap_enrollment_demo.sql. We stamp app_metadata.role = 'navigator' so the
-- dashboard middleware (STAFF_ROLES check in roleRouting.ts) recognizes the
-- account immediately — no follow-up `select civica_set_role(...)` call needed.
--
-- Idempotent via fixed UUID + ON CONFLICT.
--
-- Credentials (also tracked in user memory project_uat_credentials.md):
--   email:    navigator@civica.test
--   password: civica
--   role:     navigator
--   home:     /packets
--
-- This account is seed data only — never provisioned to real environments.
-- Auth.users.encrypted_password uses bcrypt via pgcrypto's crypt(); Supabase
-- GoTrue accepts bcrypt hashes for password sign-in.

create extension if not exists pgcrypto;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '018f4e10-0000-7000-8000-0000000000aa',
  'authenticated',
  'authenticated',
  'navigator@civica.test',
  crypt('civica', gen_salt('bf')),
  now(),
  '{"role":"navigator","provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do update
  set raw_app_meta_data = excluded.raw_app_meta_data,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at);

-- Belt-and-suspenders: if an account with this email exists under a different
-- id (e.g. someone manually created it via the Supabase dashboard before this
-- migration ran), make sure its app_metadata.role is set to 'navigator'. The
-- civica_set_role() helper from 20260548_uat_roles.sql is the canonical path.
do $$
begin
  if exists (
    select 1 from auth.users
    where email = 'navigator@civica.test'
      and (raw_app_meta_data ->> 'role') is distinct from 'navigator'
  ) then
    perform public.civica_set_role('navigator@civica.test', 'navigator');
  end if;
end $$;
