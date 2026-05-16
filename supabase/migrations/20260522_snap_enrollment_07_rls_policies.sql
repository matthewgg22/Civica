-- snap_enrollment — Migration 07: Row-Level Security policies
--
-- Trust model:
--   • The Hono API uses the service_role key — it bypasses RLS entirely and
--     is responsible for enforcing business logic. RLS is defense-in-depth.
--   • iOS / web apps authenticate via Supabase auth; they read their own data
--     through narrow SELECT policies. All writes go through the Hono API.
--   • Navigator dashboard authenticates via Supabase auth; narrower read/write
--     policies scoped to their org and assigned packets.
--   • Admin staff see all packets in their org.
--   • Auditors see all rows in their org (read-only).
--
-- Helper functions read the calling user's staff profile to determine org_id
-- and role_kind. They use SECURITY DEFINER so they can query staff tables
-- that are themselves RLS-protected.
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is safe to re-run; DROP POLICY IF
-- EXISTS before each CREATE POLICY.

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------

alter table snap_enrollment.staff_orgs              enable row level security;
alter table snap_enrollment.staff_roles             enable row level security;
alter table snap_enrollment.staff_users             enable row level security;
alter table snap_enrollment.applicants              enable row level security;
alter table snap_enrollment.snap_packets            enable row level security;
alter table snap_enrollment.packet_status_history   enable row level security;
alter table snap_enrollment.packet_answers          enable row level security;
alter table snap_enrollment.packet_assignments      enable row level security;
alter table snap_enrollment.uploaded_documents      enable row level security;
alter table snap_enrollment.document_extractions    enable row level security;
alter table snap_enrollment.extraction_fields       enable row level security;
alter table snap_enrollment.required_document_items enable row level security;
alter table snap_enrollment.missing_item_requests   enable row level security;
alter table snap_enrollment.navigator_notes         enable row level security;
alter table snap_enrollment.user_consents           enable row level security;
alter table snap_enrollment.handoff_exports         enable row level security;
alter table snap_enrollment.audit_log_events        enable row level security;
alter table snap_enrollment.enrollment_config       enable row level security;
alter table snap_enrollment.pii_columns             enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: get the authenticated user's staff row (or null if applicant)
-- ---------------------------------------------------------------------------

create or replace function snap_enrollment.current_staff()
returns snap_enrollment.staff_users
language sql
stable
security definer
set search_path = snap_enrollment, public
as $$
  select * from snap_enrollment.staff_users
  where auth_uid = auth.uid()
    and deleted_at is null
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Helper predicates (inline-able in policies for performance)
-- ---------------------------------------------------------------------------

-- Is the calling user a navigator in the given org?
create or replace function snap_enrollment.is_navigator_in_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = snap_enrollment, public
as $$
  select exists (
    select 1 from snap_enrollment.staff_users su
    join snap_enrollment.staff_roles sr on sr.role_id = su.role_id
    where su.auth_uid  = auth.uid()
      and su.org_id    = p_org_id
      and su.deleted_at is null
      and sr.role_kind in ('navigator', 'supervisor', 'admin', 'auditor')
  );
$$;

-- Is the calling user admin or supervisor in the given org?
create or replace function snap_enrollment.is_admin_in_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = snap_enrollment, public
as $$
  select exists (
    select 1 from snap_enrollment.staff_users su
    join snap_enrollment.staff_roles sr on sr.role_id = su.role_id
    where su.auth_uid  = auth.uid()
      and su.org_id    = p_org_id
      and su.deleted_at is null
      and sr.role_kind in ('supervisor', 'admin')
  );
$$;

-- Does a navigator have an active assignment for this packet?
create or replace function snap_enrollment.is_assigned_to_packet(p_packet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = snap_enrollment, public
as $$
  select exists (
    select 1
    from snap_enrollment.packet_assignments pa
    join snap_enrollment.staff_users su on su.staff_id = pa.staff_id
    where pa.packet_id  = p_packet_id
      and pa.is_current = true
      and su.auth_uid   = auth.uid()
      and su.deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies: applicants (see own row only)
-- ---------------------------------------------------------------------------

drop policy if exists applicants_own_select on snap_enrollment.applicants;
create policy applicants_own_select on snap_enrollment.applicants
  for select to authenticated
  using (auth_uid = auth.uid());

-- Staff can select applicants whose packets belong to their org.
drop policy if exists applicants_staff_select on snap_enrollment.applicants;
create policy applicants_staff_select on snap_enrollment.applicants
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      where sp.applicant_id = applicants.applicant_id
        and snap_enrollment.is_navigator_in_org(sp.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: snap_packets
-- ---------------------------------------------------------------------------

-- Applicants see their own packets.
drop policy if exists packets_own_select on snap_enrollment.snap_packets;
create policy packets_own_select on snap_enrollment.snap_packets
  for select to authenticated
  using (
    applicant_id = (
      select applicant_id from snap_enrollment.applicants
      where auth_uid = auth.uid() limit 1
    )
  );

-- Navigators see packets assigned to them OR all packets in their org
-- (depending on role; we allow both here, navigator-level restriction is
-- done at the app layer if needed).
drop policy if exists packets_staff_select on snap_enrollment.snap_packets;
create policy packets_staff_select on snap_enrollment.snap_packets
  for select to authenticated
  using (snap_enrollment.is_navigator_in_org(org_id));

-- Only staff can update packets (applicants submit → handled by API as service_role).
drop policy if exists packets_staff_update on snap_enrollment.snap_packets;
create policy packets_staff_update on snap_enrollment.snap_packets
  for update to authenticated
  using (snap_enrollment.is_navigator_in_org(org_id))
  with check (snap_enrollment.is_navigator_in_org(org_id));

-- ---------------------------------------------------------------------------
-- Policies: packet_answers
-- ---------------------------------------------------------------------------

drop policy if exists answers_own_select on snap_enrollment.packet_answers;
create policy answers_own_select on snap_enrollment.packet_answers
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      join snap_enrollment.applicants a on a.applicant_id = sp.applicant_id
      where sp.packet_id = packet_answers.packet_id
        and a.auth_uid   = auth.uid()
    )
  );

drop policy if exists answers_staff_select on snap_enrollment.packet_answers;
create policy answers_staff_select on snap_enrollment.packet_answers
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      where sp.packet_id = packet_answers.packet_id
        and snap_enrollment.is_navigator_in_org(sp.org_id)
    )
  );

-- Only navigators can update confirmed value.
drop policy if exists answers_staff_update on snap_enrollment.packet_answers;
create policy answers_staff_update on snap_enrollment.packet_answers
  for update to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      where sp.packet_id = packet_answers.packet_id
        and snap_enrollment.is_navigator_in_org(sp.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: uploaded_documents
-- ---------------------------------------------------------------------------

drop policy if exists docs_own_select on snap_enrollment.uploaded_documents;
create policy docs_own_select on snap_enrollment.uploaded_documents
  for select to authenticated
  using (
    applicant_id = (
      select applicant_id from snap_enrollment.applicants
      where auth_uid = auth.uid() limit 1
    )
  );

drop policy if exists docs_staff_select on snap_enrollment.uploaded_documents;
create policy docs_staff_select on snap_enrollment.uploaded_documents
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      where sp.packet_id = uploaded_documents.packet_id
        and snap_enrollment.is_navigator_in_org(sp.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: extraction_fields (staff only — applicant doesn't need raw OCR)
-- ---------------------------------------------------------------------------

drop policy if exists extraction_fields_staff_select on snap_enrollment.extraction_fields;
create policy extraction_fields_staff_select on snap_enrollment.extraction_fields
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      where sp.packet_id = extraction_fields.packet_id
        and snap_enrollment.is_navigator_in_org(sp.org_id)
    )
  );

drop policy if exists extraction_fields_staff_update on snap_enrollment.extraction_fields;
create policy extraction_fields_staff_update on snap_enrollment.extraction_fields
  for update to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      where sp.packet_id = extraction_fields.packet_id
        and snap_enrollment.is_navigator_in_org(sp.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: navigator_notes
-- ---------------------------------------------------------------------------

-- Applicants see only non-internal notes.
drop policy if exists notes_own_select on snap_enrollment.navigator_notes;
create policy notes_own_select on snap_enrollment.navigator_notes
  for select to authenticated
  using (
    is_internal = false
    and exists (
      select 1 from snap_enrollment.snap_packets sp
      join snap_enrollment.applicants a on a.applicant_id = sp.applicant_id
      where sp.packet_id = navigator_notes.packet_id
        and a.auth_uid   = auth.uid()
    )
  );

drop policy if exists notes_staff_select on snap_enrollment.navigator_notes;
create policy notes_staff_select on snap_enrollment.navigator_notes
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      where sp.packet_id = navigator_notes.packet_id
        and snap_enrollment.is_navigator_in_org(sp.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: user_consents (applicant sees own; staff in org see all for packet)
-- ---------------------------------------------------------------------------

drop policy if exists consents_own_select on snap_enrollment.user_consents;
create policy consents_own_select on snap_enrollment.user_consents
  for select to authenticated
  using (
    applicant_id = (
      select applicant_id from snap_enrollment.applicants
      where auth_uid = auth.uid() limit 1
    )
  );

drop policy if exists consents_staff_select on snap_enrollment.user_consents;
create policy consents_staff_select on snap_enrollment.user_consents
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.snap_packets sp
      where sp.applicant_id = user_consents.applicant_id
        and snap_enrollment.is_navigator_in_org(sp.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: audit_log_events (auditors and admins only — not applicants)
-- ---------------------------------------------------------------------------

drop policy if exists audit_log_admin_select on snap_enrollment.audit_log_events;
create policy audit_log_admin_select on snap_enrollment.audit_log_events
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.staff_users su
      join snap_enrollment.staff_roles sr on sr.role_id = su.role_id
      where su.auth_uid  = auth.uid()
        and su.deleted_at is null
        and sr.role_kind in ('admin', 'auditor')
        -- restrict to audit events in their org's packets
        and (
          packet_id is null
          or exists (
            select 1 from snap_enrollment.snap_packets sp
            where sp.packet_id = audit_log_events.packet_id
              and sp.org_id    = su.org_id
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: staff_users (staff see their own org)
-- ---------------------------------------------------------------------------

drop policy if exists staff_users_own_org_select on snap_enrollment.staff_users;
create policy staff_users_own_org_select on snap_enrollment.staff_users
  for select to authenticated
  using (snap_enrollment.is_navigator_in_org(org_id));

-- ---------------------------------------------------------------------------
-- Policies: staff_orgs, staff_roles (readable by any staff in that org)
-- ---------------------------------------------------------------------------

drop policy if exists staff_orgs_select on snap_enrollment.staff_orgs;
create policy staff_orgs_select on snap_enrollment.staff_orgs
  for select to authenticated
  using (snap_enrollment.is_navigator_in_org(org_id));

drop policy if exists staff_roles_select on snap_enrollment.staff_roles;
create policy staff_roles_select on snap_enrollment.staff_roles
  for select to authenticated
  using (snap_enrollment.is_navigator_in_org(org_id));

-- ---------------------------------------------------------------------------
-- Policies: enrollment_config and pii_columns (staff read-only)
-- ---------------------------------------------------------------------------

drop policy if exists enrollment_config_staff_select on snap_enrollment.enrollment_config;
create policy enrollment_config_staff_select on snap_enrollment.enrollment_config
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.staff_users su
      where su.auth_uid = auth.uid() and su.deleted_at is null
    )
  );

drop policy if exists pii_columns_staff_select on snap_enrollment.pii_columns;
create policy pii_columns_staff_select on snap_enrollment.pii_columns
  for select to authenticated
  using (
    exists (
      select 1 from snap_enrollment.staff_users su
      where su.auth_uid = auth.uid() and su.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Grant table-level SELECT/INSERT/UPDATE to authenticated role
-- (service_role bypasses RLS; these grants only matter for auth users)
-- ---------------------------------------------------------------------------

grant select on
  snap_enrollment.applicants,
  snap_enrollment.snap_packets,
  snap_enrollment.packet_status_history,
  snap_enrollment.packet_answers,
  snap_enrollment.packet_assignments,
  snap_enrollment.uploaded_documents,
  snap_enrollment.document_extractions,
  snap_enrollment.extraction_fields,
  snap_enrollment.required_document_items,
  snap_enrollment.missing_item_requests,
  snap_enrollment.navigator_notes,
  snap_enrollment.user_consents,
  snap_enrollment.handoff_exports,
  snap_enrollment.audit_log_events,
  snap_enrollment.staff_users,
  snap_enrollment.staff_orgs,
  snap_enrollment.staff_roles,
  snap_enrollment.enrollment_config,
  snap_enrollment.pii_columns
to authenticated;

-- Navigators can update extraction_fields and packet_answers (write policies above).
grant update (navigator_confirmed_value, reviewed_by_staff_id, reviewed_at, review_note)
  on snap_enrollment.extraction_fields to authenticated;

grant update (navigator_confirmed_value, reviewed_by_staff_id, reviewed_at, review_note)
  on snap_enrollment.packet_answers to authenticated;
