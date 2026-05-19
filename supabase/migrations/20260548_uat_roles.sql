-- UAT role provisioning: seed the three T5 audience roles needed for
-- dashboard UAT — state_deputy (CDSS), county_director (County DPSS),
-- and cbo_preview (prospective licensee CBO).
--
-- This migration does NOT create Supabase Auth users (those require the
-- Admin API or the Supabase dashboard). Instead it:
--   1. Creates a helper function `civica_set_role(email, role)` that an
--      admin can call to stamp app_metadata.role on an existing user.
--   2. Logs that seeding is expected so the CI smoke test can verify the
--      function exists.
--
-- To provision a UAT user after running this migration:
--   1. Create the user in Supabase Auth dashboard (or Auth Admin API).
--   2. Call: select civica_set_role('<email>', '<role>');
--      Valid roles: admin, navigator, county_director, state_deputy,
--                   cbo_preview, applicant.
--
-- The function uses auth.users (service_role only) — never exposed to anon.

create or replace function public.civica_set_role(
  p_email text,
  p_role  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_roles text[] := array[
    'admin', 'navigator', 'county_director',
    'state_deputy', 'cbo_preview', 'applicant'
  ];
  v_user_id uuid;
begin
  if not (p_role = any(v_valid_roles)) then
    raise exception 'Invalid role "%". Valid roles: %', p_role, array_to_string(v_valid_roles, ', ');
  end if;

  select id into v_user_id
  from auth.users
  where email = p_email
  limit 1;

  if v_user_id is null then
    raise exception 'No auth user found with email "%"', p_email;
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role)
  where id = v_user_id;
end;
$$;

-- Revoke public/anon access — only service_role (via Supabase admin context)
-- and authenticated admin users should call this function.
revoke execute on function public.civica_set_role(text, text) from public, anon;
grant execute on function public.civica_set_role(text, text) to service_role;

comment on function public.civica_set_role(text, text) is
  'Stamps app_metadata.role on an existing Supabase auth user. '
  'Call via service_role only. Valid roles: admin, navigator, '
  'county_director, state_deputy, cbo_preview, applicant.';
