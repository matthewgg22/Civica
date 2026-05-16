-- snap_enrollment — Migration 02: core packet tables
--
-- Tables created here:
--   staff_orgs, staff_roles, staff_users
--   applicants
--   snap_packets, packet_status_history
--   packet_answers
--
-- All PKs are UUID v7 via snap_enrollment.gen_uuidv7().
-- PII columns are marked COMMENT 'PII'; application layer applies Fernet.
-- Soft-delete via deleted_at on staff rows. Applicants are hard-deleted
-- (ON DELETE CASCADE from applicants) on consent withdrawal.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS throughout.

-- ---------------------------------------------------------------------------
-- staff_orgs: navigator organisations (agencies, nonprofits, etc.)
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.staff_orgs (
  org_id        uuid        primary key default snap_enrollment.gen_uuidv7(),
  name          text        not null,
  state_code    snap_enrollment.launch_state not null,
  website       text,
  created_at    timestamptz not null default clock_timestamp(),
  updated_at    timestamptz not null default clock_timestamp(),
  deleted_at    timestamptz
);

drop trigger if exists staff_orgs_updated_at on snap_enrollment.staff_orgs;
create trigger staff_orgs_updated_at
  before update on snap_enrollment.staff_orgs
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- staff_roles: role definitions per org (navigator, supervisor, admin, auditor)
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.staff_roles (
  role_id       uuid        primary key default snap_enrollment.gen_uuidv7(),
  org_id        uuid        not null references snap_enrollment.staff_orgs(org_id) on delete cascade,
  role_kind     snap_enrollment.staff_role_kind not null,
  label         text        not null,  -- org-specific display name e.g. "Case Manager"
  can_view_pii  boolean     not null default true,
  can_export    boolean     not null default false,
  can_override_status boolean not null default false,
  created_at    timestamptz not null default clock_timestamp(),
  unique (org_id, role_kind)
);

-- ---------------------------------------------------------------------------
-- staff_users: navigators, supervisors, admins
--
-- auth_uid references auth.users(id) — the Supabase auth identity.
-- One staff member belongs to exactly one org.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.staff_users (
  staff_id      uuid        primary key default snap_enrollment.gen_uuidv7(),
  auth_uid      uuid        not null unique references auth.users(id) on delete cascade,
  org_id        uuid        not null references snap_enrollment.staff_orgs(org_id) on delete restrict,
  role_id       uuid        not null references snap_enrollment.staff_roles(role_id) on delete restrict,
  display_name  text        not null,  -- COMMENT 'PII'
  email         text        not null,  -- COMMENT 'PII'
  created_at    timestamptz not null default clock_timestamp(),
  updated_at    timestamptz not null default clock_timestamp(),
  deleted_at    timestamptz
);

comment on column snap_enrollment.staff_users.display_name is 'PII';
comment on column snap_enrollment.staff_users.email        is 'PII';

create index if not exists staff_users_org_idx
  on snap_enrollment.staff_users(org_id, deleted_at);
create index if not exists staff_users_auth_uid_idx
  on snap_enrollment.staff_users(auth_uid);

drop trigger if exists staff_users_updated_at on snap_enrollment.staff_users;
create trigger staff_users_updated_at
  before update on snap_enrollment.staff_users
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- applicants: one row per person who starts a packet
--
-- Hard-delete on consent withdrawal: ON DELETE CASCADE propagates to
-- snap_packets, which cascades further. The audit log is intentionally
-- NOT cascaded — it survives deletion for compliance review.
--
-- auth_uid is nullable: an applicant may exist before Supabase auth sign-up
-- (e.g. anonymous session started on the web app).
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.applicants (
  applicant_id  uuid        primary key default snap_enrollment.gen_uuidv7(),
  auth_uid      uuid        unique references auth.users(id) on delete set null,
  state_code    snap_enrollment.launch_state not null,
  -- PII — Fernet-encrypted at application layer (snap_v1:: prefix)
  full_name_ciphertext    text,  -- COMMENT 'PII'
  email_ciphertext        text,  -- COMMENT 'PII'
  phone_ciphertext        text,  -- COMMENT 'PII'
  date_of_birth_ciphertext text, -- COMMENT 'PII'
  address_ciphertext      text,  -- COMMENT 'PII'
  preferred_language text  not null default 'en',
  created_at    timestamptz not null default clock_timestamp(),
  updated_at    timestamptz not null default clock_timestamp()
  -- No deleted_at: hard-delete only (via consent withdrawal).
);

comment on column snap_enrollment.applicants.full_name_ciphertext    is 'PII';
comment on column snap_enrollment.applicants.email_ciphertext        is 'PII';
comment on column snap_enrollment.applicants.phone_ciphertext        is 'PII';
comment on column snap_enrollment.applicants.date_of_birth_ciphertext is 'PII';
comment on column snap_enrollment.applicants.address_ciphertext      is 'PII';

create index if not exists applicants_auth_uid_idx
  on snap_enrollment.applicants(auth_uid) where auth_uid is not null;
create index if not exists applicants_state_idx
  on snap_enrollment.applicants(state_code, created_at desc);

drop trigger if exists applicants_updated_at on snap_enrollment.applicants;
create trigger applicants_updated_at
  before update on snap_enrollment.applicants
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- snap_packets: one enrollment-readiness packet per applicant attempt
--
-- A single applicant may have multiple packets (e.g. re-application after
-- 'Closed'). The status column drives the entire lifecycle.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.snap_packets (
  packet_id     uuid        primary key default snap_enrollment.gen_uuidv7(),
  applicant_id  uuid        not null references snap_enrollment.applicants(applicant_id) on delete cascade,
  state_code    snap_enrollment.launch_state not null,
  status        snap_enrollment.packet_status not null default 'Draft',
  org_id        uuid        references snap_enrollment.staff_orgs(org_id) on delete set null,
  county        text,
  county_fips   char(5),    -- FIPS code for county-level routing
  notes_for_applicant text, -- populated by navigator; shown to applicant
  created_at    timestamptz not null default clock_timestamp(),
  updated_at    timestamptz not null default clock_timestamp(),
  deleted_at    timestamptz,
  submitted_at  timestamptz,
  handed_off_at timestamptz,
  closed_at     timestamptz
);

create index if not exists snap_packets_applicant_idx
  on snap_enrollment.snap_packets(applicant_id, created_at desc);
create index if not exists snap_packets_status_idx
  on snap_enrollment.snap_packets(status, updated_at desc) where deleted_at is null;
create index if not exists snap_packets_org_idx
  on snap_enrollment.snap_packets(org_id, status) where deleted_at is null;

drop trigger if exists snap_packets_updated_at on snap_enrollment.snap_packets;
create trigger snap_packets_updated_at
  before update on snap_enrollment.snap_packets
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- packet_status_history: append-only log of every status transition
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.packet_status_history (
  history_id    uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id     uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  from_status   snap_enrollment.packet_status,  -- null on initial Draft insert
  to_status     snap_enrollment.packet_status not null,
  changed_by_staff_id uuid references snap_enrollment.staff_users(staff_id) on delete set null,
  changed_by_applicant_id uuid references snap_enrollment.applicants(applicant_id) on delete set null,
  reason        text,
  occurred_at   timestamptz not null default clock_timestamp()
);

create index if not exists packet_status_history_packet_idx
  on snap_enrollment.packet_status_history(packet_id, occurred_at desc);

-- Prevent mutation after insert (status history is immutable).
create or replace function snap_enrollment.block_status_history_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'packet_status_history is append-only; % is not permitted', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists status_history_no_update on snap_enrollment.packet_status_history;
create trigger status_history_no_update
  before update on snap_enrollment.packet_status_history
  for each row execute function snap_enrollment.block_status_history_mutation();

drop trigger if exists status_history_no_delete on snap_enrollment.packet_status_history;
create trigger status_history_no_delete
  before delete on snap_enrollment.packet_status_history
  for each row execute function snap_enrollment.block_status_history_mutation();

-- ---------------------------------------------------------------------------
-- packet_answers: structured Q&A per packet
--
-- Hard invariant (enforced by trigger in migration 07):
--   applicant_answer and original_ocr_value are WRITE-ONCE after initial
--   insert. Only navigator_confirmed_value is mutable.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.packet_answers (
  answer_id     uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id     uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  question_key  text        not null,   -- canonical key e.g. 'household_size', 'monthly_income'
  question_label text       not null,   -- human-readable; stored at write time so it survives key renames
  -- Three-value columns (invariant 1)
  applicant_answer          text,  -- COMMENT 'PII' — raw input from applicant; write-once
  original_ocr_value        text,  -- COMMENT 'PII' — raw OCR output if sourced from doc; write-once
  navigator_confirmed_value text,  -- COMMENT 'PII' — navigator's confirmed/corrected value; mutable
  -- Provenance
  answer_source text not null
    check (answer_source in ('applicant_input', 'ocr_extraction', 'navigator_entry', 'prefilled')),
  -- Review state
  reviewed_by_staff_id uuid references snap_enrollment.staff_users(staff_id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  -- Timestamps
  created_at    timestamptz not null default clock_timestamp(),
  updated_at    timestamptz not null default clock_timestamp(),
  unique (packet_id, question_key)
);

comment on column snap_enrollment.packet_answers.applicant_answer          is 'PII';
comment on column snap_enrollment.packet_answers.original_ocr_value        is 'PII';
comment on column snap_enrollment.packet_answers.navigator_confirmed_value is 'PII';

create index if not exists packet_answers_packet_idx
  on snap_enrollment.packet_answers(packet_id, question_key);

drop trigger if exists packet_answers_updated_at on snap_enrollment.packet_answers;
create trigger packet_answers_updated_at
  before update on snap_enrollment.packet_answers
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- packet_assignments: which navigator is working a given packet
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.packet_assignments (
  assignment_id uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id     uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  staff_id      uuid        not null references snap_enrollment.staff_users(staff_id) on delete cascade,
  assigned_by_staff_id uuid references snap_enrollment.staff_users(staff_id) on delete set null,
  assigned_at   timestamptz not null default clock_timestamp(),
  unassigned_at timestamptz,
  unassign_reason text,
  is_current    boolean     not null default true,
  unique (packet_id, staff_id, is_current)
);

create index if not exists packet_assignments_packet_idx
  on snap_enrollment.packet_assignments(packet_id, is_current);
create index if not exists packet_assignments_staff_idx
  on snap_enrollment.packet_assignments(staff_id, is_current);
