-- UAT Navigator Seed Script
-- Creates a Silo H test navigator account + one seeded packet in
-- "Submitted for Review" status against that account.
--
-- Prerequisites (do these in the Supabase dashboard BEFORE running this script):
--   1. Auth: Authentication → Users → "Add user" → create the test navigator.
--      Use email: uat-navigator@civica-staging.internal  (or any staging email)
--      Copy the UUID Supabase assigns — paste it into :navigator_auth_uid below.
--
-- Usage (replace the UUID):
--   psql $DATABASE_URL \
--     -v navigator_auth_uid="'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'" \
--     -f scripts/seed-uat-navigator.sql
--
-- Or from the Supabase SQL editor: replace the DO $$ block's :navigator_auth_uid
-- literal with the actual UUID string before running.
--
-- Idempotent: wrapped in a transaction; rolls back cleanly on any error.
-- Re-running inserts a second packet (different packet_id) — that's fine for UAT.

begin;

do $$
declare
  -- ── CONFIGURE THESE ──────────────────────────────────────────────────────
  v_auth_uid        uuid   := '00000000-0000-0000-0000-000000000000'; -- ← paste navigator UUID here
  v_navigator_email text   := 'uat-navigator@civica-staging.internal';
  v_navigator_name  text   := 'UAT Navigator (Silo H)';
  -- ─────────────────────────────────────────────────────────────────────────

  v_org_id          uuid;
  v_role_id         uuid;
  v_staff_id        uuid;
  v_applicant_id    uuid;
  v_packet_id       uuid;
begin

  -- ── 1. Ensure a UAT staff org exists ────────────────────────────────────
  select org_id into v_org_id
    from snap_enrollment.staff_orgs
   where org_name = 'Silo H (UAT)';

  if v_org_id is null then
    insert into snap_enrollment.staff_orgs (org_name, org_type)
    values ('Silo H (UAT)', 'nonprofit')
    returning org_id into v_org_id;
  end if;

  -- ── 2. Ensure a navigator role exists in that org ───────────────────────
  select role_id into v_role_id
    from snap_enrollment.staff_roles
   where org_id = v_org_id
     and role_kind = 'navigator';

  if v_role_id is null then
    insert into snap_enrollment.staff_roles (org_id, role_kind, role_label)
    values (v_org_id, 'navigator', 'Navigator')
    returning role_id into v_role_id;
  end if;

  -- ── 3. Upsert the staff_user row linked to the Supabase auth UID ────────
  select staff_id into v_staff_id
    from snap_enrollment.staff_users
   where auth_uid = v_auth_uid;

  if v_staff_id is null then
    insert into snap_enrollment.staff_users
      (auth_uid, org_id, role_id, display_name, email)
    values
      (v_auth_uid, v_org_id, v_role_id, v_navigator_name, v_navigator_email)
    returning staff_id into v_staff_id;
  else
    -- Re-running: ensure role is still navigator in case it drifted
    update snap_enrollment.staff_users
       set role_id = v_role_id, deleted_at = null
     where staff_id = v_staff_id;
  end if;

  -- ── 4. Create a test applicant ──────────────────────────────────────────
  insert into snap_enrollment.applicants
    (state_code, language_preference)
  values
    ('CA', 'en')
  returning applicant_id into v_applicant_id;

  -- ── 5. Create a packet in "Submitted for Review" ────────────────────────
  insert into snap_enrollment.snap_packets
    (applicant_id, status, state_code, submitted_at)
  values
    (v_applicant_id, 'Submitted for Review', 'CA', now())
  returning packet_id into v_packet_id;

  -- ── 6. Seed representative packet answers (CA household, 2 adults) ──────
  insert into snap_enrollment.packet_answers
    (packet_id, question_key, applicant_answer, answer_source)
  values
    (v_packet_id, 'household_size',          '2',          'applicant_input'),
    (v_packet_id, 'state_code',              'CA',         'applicant_input'),
    (v_packet_id, 'monthly_gross_income',    '1850',       'applicant_input'),
    (v_packet_id, 'monthly_rent',            '1100',       'applicant_input'),
    (v_packet_id, 'pays_utilities',          'true',       'applicant_input'),
    (v_packet_id, 'elderly_or_disabled',     'false',      'applicant_input'),
    (v_packet_id, 'has_minor_in_household',  'false',      'applicant_input');

  -- ── 7. Add a missing-item request so Scenario 4 has something to resolve
  insert into snap_enrollment.missing_item_requests
    (packet_id, requested_by_staff_id, item_label, item_description, status)
  values
    (v_packet_id, v_staff_id,
     'Recent paystub',
     'Please provide a paystub from the last 30 days for all wage earners in your household.',
     'pending');

  -- ── 8. Assign the packet to the UAT navigator ───────────────────────────
  insert into snap_enrollment.packet_assignments
    (packet_id, staff_id, assigned_by_staff_id)
  values
    (v_packet_id, v_staff_id, v_staff_id);

  raise notice '────────────────────────────────────────────────────────────';
  raise notice 'UAT seed complete.';
  raise notice '  staff_id:     %', v_staff_id;
  raise notice '  applicant_id: %', v_applicant_id;
  raise notice '  packet_id:    %', v_packet_id;
  raise notice '';
  raise notice 'Send Silo H:';
  raise notice '  Dashboard: https://dashboard.staging.civica.app';
  raise notice '  Email:     %', v_navigator_email;
  raise notice '  Packet ID: %  (pre-seeded, Submitted for Review)', v_packet_id;
  raise notice '────────────────────────────────────────────────────────────';

end $$;

commit;
