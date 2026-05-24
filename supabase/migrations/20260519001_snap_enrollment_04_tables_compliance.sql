-- snap_enrollment — Migration 04: compliance tables
--
-- Tables created here:
--   navigator_notes
--   user_consents
--   handoff_exports
--   audit_log_events
--
-- Idempotent: CREATE TABLE IF NOT EXISTS throughout.

-- ---------------------------------------------------------------------------
-- navigator_notes: free-form case notes attached to a packet
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.navigator_notes (
  note_id         uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id       uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  author_staff_id uuid        not null references snap_enrollment.staff_users(staff_id) on delete restrict,
  body_ciphertext text        not null,  -- COMMENT 'PII' — Fernet-encrypted
  is_internal     boolean     not null default true,   -- false = visible to applicant
  created_at      timestamptz not null default clock_timestamp(),
  updated_at      timestamptz not null default clock_timestamp(),
  deleted_at      timestamptz
);

comment on column snap_enrollment.navigator_notes.body_ciphertext is 'PII';

create index if not exists navigator_notes_packet_idx
  on snap_enrollment.navigator_notes(packet_id, created_at desc) where deleted_at is null;

drop trigger if exists navigator_notes_updated_at on snap_enrollment.navigator_notes;
create trigger navigator_notes_updated_at
  before update on snap_enrollment.navigator_notes
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_consents: versioned, per-kind consent records
--
-- One active row per (applicant_id, consent_kind). Revoking creates a new
-- row with revoked_at set — the old row is NOT updated (append-only).
-- The status transition guard checks for a current (non-revoked) row.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.user_consents (
  consent_id      uuid        primary key default snap_enrollment.gen_uuidv7(),
  applicant_id    uuid        not null references snap_enrollment.applicants(applicant_id) on delete cascade,
  consent_kind    snap_enrollment.consent_kind not null,
  policy_version  text        not null,   -- e.g. '2026-05-01'
  consented_at    timestamptz not null default clock_timestamp(),
  consent_method  text        not null
    check (consent_method in ('ios_checkbox', 'web_checkbox', 'paper_form', 'navigator_proxy')),
  ip_address      text,                   -- COMMENT 'PII'
  revoked_at      timestamptz,
  revoke_reason   text
);

comment on column snap_enrollment.user_consents.ip_address is 'PII';

create index if not exists user_consents_applicant_active_idx
  on snap_enrollment.user_consents(applicant_id, consent_kind, revoked_at)
  where revoked_at is null;

-- Prevent UPDATE/DELETE — consent rows are immutable after insert.
create or replace function snap_enrollment.block_consent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'user_consents is append-only; % is not permitted', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists user_consents_no_update on snap_enrollment.user_consents;
create trigger user_consents_no_update
  before update on snap_enrollment.user_consents
  for each row execute function snap_enrollment.block_consent_mutation();

drop trigger if exists user_consents_no_delete on snap_enrollment.user_consents;
create trigger user_consents_no_delete
  before delete on snap_enrollment.user_consents
  for each row execute function snap_enrollment.block_consent_mutation();

-- ---------------------------------------------------------------------------
-- handoff_exports: immutable record of every packet export to a state agency
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.handoff_exports (
  export_id       uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id       uuid        not null references snap_enrollment.snap_packets(packet_id) on delete restrict,
  exported_by_staff_id uuid   not null references snap_enrollment.staff_users(staff_id) on delete restrict,
  format          snap_enrollment.handoff_format not null,
  storage_path    text,                   -- Supabase Storage path of the export artifact
  checksum_sha256 text,                   -- hex SHA-256 of the export file
  agency_reference text,                  -- confirmation number / intake reference from agency
  exported_at     timestamptz not null default clock_timestamp()
);

create index if not exists handoff_exports_packet_idx
  on snap_enrollment.handoff_exports(packet_id, exported_at desc);

-- Exports are immutable after creation.
create or replace function snap_enrollment.block_export_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'handoff_exports is append-only; % is not permitted', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists handoff_exports_no_update on snap_enrollment.handoff_exports;
create trigger handoff_exports_no_update
  before update on snap_enrollment.handoff_exports
  for each row execute function snap_enrollment.block_export_mutation();

drop trigger if exists handoff_exports_no_delete on snap_enrollment.handoff_exports;
create trigger handoff_exports_no_delete
  before delete on snap_enrollment.handoff_exports
  for each row execute function snap_enrollment.block_export_mutation();

-- ---------------------------------------------------------------------------
-- audit_log_events: append-only audit trail
--
-- Every mutation of a packet, answer, document, extraction, or status MUST
-- insert a row here IN THE SAME TRANSACTION (enforced by triggers in
-- migration 06). The audit log intentionally does NOT cascade-delete when
-- an applicant is hard-deleted — it must survive for compliance review.
--
-- packet_id and applicant_id are denormalised (not FK) precisely so the
-- audit record outlives the referenced rows.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.audit_log_events (
  audit_id        uuid        primary key default snap_enrollment.gen_uuidv7(),
  -- Denormalised identifiers (no FK — must survive hard deletes)
  packet_id       uuid,
  applicant_id    uuid,
  -- Actor
  actor_kind      snap_enrollment.audit_actor_kind not null,
  actor_id        text,       -- staff_id, applicant_id, or system job name
  -- Event
  table_name      text        not null,
  row_id          uuid        not null,
  operation       text        not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  changed_columns text[],     -- column names that changed (UPDATE only)
  old_values      jsonb,      -- previous values for changed columns (redacted for PII columns)
  new_values      jsonb,      -- new values (redacted for PII columns — store '[REDACTED]')
  -- Request context
  request_id      text,
  ip_address      text,       -- COMMENT 'PII'
  user_agent      text,
  occurred_at     timestamptz not null default clock_timestamp()
);

comment on column snap_enrollment.audit_log_events.ip_address is 'PII';

create index if not exists audit_log_packet_idx
  on snap_enrollment.audit_log_events(packet_id, occurred_at desc)
  where packet_id is not null;
create index if not exists audit_log_actor_idx
  on snap_enrollment.audit_log_events(actor_id, occurred_at desc);
create index if not exists audit_log_occurred_idx
  on snap_enrollment.audit_log_events(occurred_at desc);

-- Append-only enforcement.
create or replace function snap_enrollment.block_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log_events is append-only; % is not permitted', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists audit_log_no_update on snap_enrollment.audit_log_events;
create trigger audit_log_no_update
  before update on snap_enrollment.audit_log_events
  for each row execute function snap_enrollment.block_audit_mutation();

drop trigger if exists audit_log_no_delete on snap_enrollment.audit_log_events;
create trigger audit_log_no_delete
  before delete on snap_enrollment.audit_log_events
  for each row execute function snap_enrollment.block_audit_mutation();
