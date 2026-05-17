-- Navigator workflow tables for the SNAP API gateway.
--
-- Additive only — does not modify the existing FastAPI-owned tables
-- except for adding navigator_status to snap_sessions (nullable, null
-- means session has not yet entered the navigator queue).
--
-- Table creation order: staff_roles → staff_users → everything else.

-- ===========================================================================
-- staff_roles: lookup table for the three navigator-side roles.
-- ===========================================================================

create table if not exists public.staff_roles (
  role_id text primary key
    check (role_id in ('navigator', 'supervisor', 'admin')),
  display_name text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into public.staff_roles (role_id, display_name, description) values
  ('navigator',   'Navigator',   'Reviews sessions, requests missing items, sends handoffs'),
  ('supervisor',  'Supervisor',  'Manages navigators and overrides assignment decisions'),
  ('admin',       'Admin',       'Full access including staff management')
on conflict (role_id) do nothing;

-- ===========================================================================
-- staff_users: one row per staff employee.
-- staff_user_id mirrors auth.users.id — keep them in sync via Supabase
-- Auth triggers or the admin API; do not diverge.
-- ===========================================================================

create table if not exists public.staff_users (
  staff_user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role_id text not null references public.staff_roles(role_id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_users_role_idx on public.staff_users(role_id);
create index if not exists staff_users_active_idx on public.staff_users(is_active) where is_active;

drop trigger if exists staff_users_set_updated_at on public.staff_users;
create trigger staff_users_set_updated_at
  before update on public.staff_users
  for each row execute function public.snap_set_updated_at();

-- ===========================================================================
-- Extend snap_sessions with a nullable navigator_status column.
-- NULL = session has not entered the navigator workflow.
-- The existing `status` column is FastAPI-managed and must not be touched here.
-- ===========================================================================

alter table public.snap_sessions
  add column if not exists navigator_status text
    check (navigator_status in (
      'awaiting_navigator',
      'in_review',
      'ready_for_handoff',
      'handed_off'
    ));

create index if not exists snap_sessions_navigator_status_idx
  on public.snap_sessions(navigator_status, updated_at desc)
  where navigator_status is not null;

-- ===========================================================================
-- snap_session_status_history: append-only log of navigator_status
-- transitions. Hono writes a row here inside the same transaction as
-- every PATCH /navigator/sessions/:id/status call.
-- ===========================================================================

create table if not exists public.snap_session_status_history (
  history_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  from_status text
    check (from_status in ('awaiting_navigator', 'in_review', 'ready_for_handoff', 'handed_off')),
  to_status text not null
    check (to_status in ('awaiting_navigator', 'in_review', 'ready_for_handoff', 'handed_off')),
  changed_by uuid not null references public.staff_users(staff_user_id),
  reason text,
  occurred_at timestamptz not null default now()
);

create index if not exists snap_session_status_history_session_idx
  on public.snap_session_status_history(session_id, occurred_at desc);

-- ===========================================================================
-- snap_session_assignments: tracks which navigator owns a session.
-- The partial unique index ensures at most one active assignment per session.
-- ===========================================================================

create table if not exists public.snap_session_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  navigator_id uuid not null references public.staff_users(staff_user_id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.staff_users(staff_user_id),
  unassigned_at timestamptz,
  check (
    unassigned_at is null or unassigned_at > assigned_at
  )
);

-- One active (unassigned_at = null) assignment per session at a time.
create unique index if not exists snap_session_assignments_active_idx
  on public.snap_session_assignments(session_id)
  where unassigned_at is null;

create index if not exists snap_session_assignments_navigator_idx
  on public.snap_session_assignments(navigator_id, assigned_at desc)
  where unassigned_at is null;

-- ===========================================================================
-- snap_navigator_notes: staff notes on a session. Stored as plaintext —
-- these are staff-authored observations, not applicant-provided PII.
-- Protected by RLS (staff-only) and Postgres at-rest encryption.
-- ===========================================================================

create table if not exists public.snap_navigator_notes (
  note_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  author_id uuid not null references public.staff_users(staff_user_id),
  body text not null check (length(body) between 1 and 10000),
  created_at timestamptz not null default now()
  -- Notes are immutable. No updated_at; implement edits as soft-delete + new row.
);

create index if not exists snap_navigator_notes_session_idx
  on public.snap_navigator_notes(session_id, created_at desc);

-- ===========================================================================
-- snap_missing_item_requests: navigator requests for documents or
-- clarifications. A request is resolved by the applicant re-uploading
-- or by a supervisor marking it waived.
-- ===========================================================================

create table if not exists public.snap_missing_item_requests (
  request_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  requested_by uuid not null references public.staff_users(staff_user_id),
  item_type text not null,       -- e.g. 'paystub', 'photo_id', 'proof_of_residency'
  item_description text,         -- free text for non-standard items
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.staff_users(staff_user_id),
  resolution_note text,
  check (
    (resolved_at is null and resolved_by is null) or
    (resolved_at is not null and resolved_by is not null)
  )
);

create index if not exists snap_missing_item_requests_session_idx
  on public.snap_missing_item_requests(session_id, requested_at desc);
create index if not exists snap_missing_item_requests_unresolved_idx
  on public.snap_missing_item_requests(session_id)
  where resolved_at is null;

-- ===========================================================================
-- snap_handoff_exports: one row per exported application package.
-- pdf_storage_path and json_storage_path point to Supabase Storage blobs.
-- signature_hash is a SHA-256 of the PDF bytes, stored for integrity checks.
-- ===========================================================================

create table if not exists public.snap_handoff_exports (
  export_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  exported_by uuid not null references public.staff_users(staff_user_id),
  pdf_storage_path text not null,
  json_storage_path text not null,
  signature_hash text not null,  -- SHA-256 hex of the PDF bytes
  destination text,              -- agency name or delivery address (optional)
  exported_at timestamptz not null default now()
);

create index if not exists snap_handoff_exports_session_idx
  on public.snap_handoff_exports(session_id, exported_at desc);

-- ===========================================================================
-- Row-level security
--
-- Hono gateway uses the service-role key and bypasses RLS.
-- These policies are defense-in-depth against accidental anon-key exposure.
-- Staff JWT carries app_metadata.role; policies verify it is non-null.
-- ===========================================================================

alter table public.staff_roles enable row level security;
alter table public.staff_users enable row level security;
alter table public.snap_session_status_history enable row level security;
alter table public.snap_session_assignments enable row level security;
alter table public.snap_navigator_notes enable row level security;
alter table public.snap_missing_item_requests enable row level security;
alter table public.snap_handoff_exports enable row level security;

-- Helper: returns true if the current JWT carries a valid staff role.
create or replace function public.is_staff_jwt()
returns boolean
language sql
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') in ('navigator', 'supervisor', 'admin')
$$;

-- Staff read-access policies (all tables).
drop policy if exists staff_roles_read on public.staff_roles;
create policy staff_roles_read on public.staff_roles for select to authenticated using (public.is_staff_jwt());

drop policy if exists staff_users_read on public.staff_users;
create policy staff_users_read on public.staff_users for select to authenticated using (public.is_staff_jwt());

drop policy if exists status_history_read on public.snap_session_status_history;
create policy status_history_read on public.snap_session_status_history for select to authenticated using (public.is_staff_jwt());

drop policy if exists assignments_read on public.snap_session_assignments;
create policy assignments_read on public.snap_session_assignments for select to authenticated using (public.is_staff_jwt());

drop policy if exists notes_read on public.snap_navigator_notes;
create policy notes_read on public.snap_navigator_notes for select to authenticated using (public.is_staff_jwt());

drop policy if exists missing_items_read on public.snap_missing_item_requests;
create policy missing_items_read on public.snap_missing_item_requests for select to authenticated using (public.is_staff_jwt());

drop policy if exists handoff_exports_read on public.snap_handoff_exports;
create policy handoff_exports_read on public.snap_handoff_exports for select to authenticated using (public.is_staff_jwt());
