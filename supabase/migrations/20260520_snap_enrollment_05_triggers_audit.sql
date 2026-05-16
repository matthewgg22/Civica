-- snap_enrollment — Migration 05: audit triggers
--
-- A generic function audit_row_change() is attached as AFTER INSERT/UPDATE/
-- DELETE FOR EACH ROW on every mutable table. It writes one row to
-- audit_log_events in the same transaction as the originating statement.
--
-- PII columns are redacted to '[REDACTED]' in old_values/new_values so the
-- audit log itself doesn't become a secondary PII store. The redaction list
-- is maintained in snap_enrollment.pii_columns.
--
-- Idempotent: CREATE OR REPLACE for functions; DROP TRIGGER IF EXISTS before
-- each CREATE TRIGGER.

-- ---------------------------------------------------------------------------
-- PII column registry used by the audit function to redact values
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.pii_columns (
  table_schema text not null,
  table_name   text not null,
  column_name  text not null,
  primary key (table_schema, table_name, column_name)
);

-- Populate from the COMMENT 'PII' markers we set in migrations 02-04.
-- Idempotent inserts:
insert into snap_enrollment.pii_columns (table_schema, table_name, column_name)
values
  ('snap_enrollment', 'applicants',              'full_name_ciphertext'),
  ('snap_enrollment', 'applicants',              'email_ciphertext'),
  ('snap_enrollment', 'applicants',              'phone_ciphertext'),
  ('snap_enrollment', 'applicants',              'date_of_birth_ciphertext'),
  ('snap_enrollment', 'applicants',              'address_ciphertext'),
  ('snap_enrollment', 'staff_users',             'display_name'),
  ('snap_enrollment', 'staff_users',             'email'),
  ('snap_enrollment', 'packet_answers',          'applicant_answer'),
  ('snap_enrollment', 'packet_answers',          'original_ocr_value'),
  ('snap_enrollment', 'packet_answers',          'navigator_confirmed_value'),
  ('snap_enrollment', 'uploaded_documents',      'original_filename'),
  ('snap_enrollment', 'document_extractions',    'raw_ocr_ciphertext'),
  ('snap_enrollment', 'extraction_fields',       'applicant_answer'),
  ('snap_enrollment', 'extraction_fields',       'original_ocr_value'),
  ('snap_enrollment', 'extraction_fields',       'navigator_confirmed_value'),
  ('snap_enrollment', 'navigator_notes',         'body_ciphertext'),
  ('snap_enrollment', 'missing_item_requests',   'message_ciphertext'),
  ('snap_enrollment', 'user_consents',           'ip_address'),
  ('snap_enrollment', 'audit_log_events',        'ip_address')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Helper: redact PII keys from a JSONB object
-- ---------------------------------------------------------------------------

create or replace function snap_enrollment.redact_pii_json(
  p_schema text,
  p_table  text,
  p_json   jsonb
)
returns jsonb
language sql
stable
as $$
  select jsonb_object_agg(
    key,
    case
      when exists (
        select 1 from snap_enrollment.pii_columns pc
        where pc.table_schema = p_schema
          and pc.table_name   = p_table
          and pc.column_name  = key
      ) then to_jsonb('[REDACTED]'::text)
      else value
    end
  )
  from jsonb_each(p_json);
$$;

-- ---------------------------------------------------------------------------
-- Generic audit row change function
--
-- Reads actor context from transaction-local settings:
--   SET LOCAL snap_enrollment.actor_kind = 'navigator';
--   SET LOCAL snap_enrollment.actor_id   = '<staff_id>';
--   SET LOCAL snap_enrollment.request_id = '<uuid>';
-- The Hono API sets these at the start of each request transaction.
-- ---------------------------------------------------------------------------

create or replace function snap_enrollment.audit_row_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_actor_kind  text := coalesce(
    current_setting('snap_enrollment.actor_kind', true),
    'system'
  );
  v_actor_id    text := current_setting('snap_enrollment.actor_id', true);
  v_request_id  text := current_setting('snap_enrollment.request_id', true);
  v_packet_id   uuid;
  v_applicant_id uuid;
  v_old_json    jsonb;
  v_new_json    jsonb;
  v_changed     text[];
  v_op          text := tg_op;
  v_row_id      uuid;
begin
  -- Extract packet_id / applicant_id from the row if the column exists.
  -- Graceful: not every audited table has both.
  begin
    if v_op in ('INSERT', 'UPDATE') then
      v_packet_id    := (row_to_json(new) ->> 'packet_id')::uuid;
      v_applicant_id := (row_to_json(new) ->> 'applicant_id')::uuid;
      v_row_id       := (row_to_json(new) ->> (tg_argv[0]))::uuid;
      v_new_json     := snap_enrollment.redact_pii_json(tg_table_schema, tg_table_name, to_jsonb(new));
    end if;
    if v_op in ('UPDATE', 'DELETE') then
      v_packet_id    := coalesce(v_packet_id, (row_to_json(old) ->> 'packet_id')::uuid);
      v_applicant_id := coalesce(v_applicant_id, (row_to_json(old) ->> 'applicant_id')::uuid);
      v_row_id       := coalesce(v_row_id, (row_to_json(old) ->> (tg_argv[0]))::uuid);
      v_old_json     := snap_enrollment.redact_pii_json(tg_table_schema, tg_table_name, to_jsonb(old));
    end if;
  exception when others then
    -- Never let audit failure abort the originating transaction.
    -- Log to postgres log and continue.
    raise warning 'audit_row_change: failed to capture row for %.%: %', tg_table_schema, tg_table_name, sqlerrm;
    return coalesce(new, old);
  end;

  -- Build changed_columns list for UPDATE.
  if v_op = 'UPDATE' then
    select array_agg(key order by key)
    into v_changed
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n using (key)
    where o.value is distinct from n.value;
  end if;

  insert into snap_enrollment.audit_log_events (
    packet_id, applicant_id,
    actor_kind, actor_id,
    table_name, row_id, operation,
    changed_columns, old_values, new_values,
    request_id, occurred_at
  ) values (
    v_packet_id, v_applicant_id,
    v_actor_kind::snap_enrollment.audit_actor_kind, v_actor_id,
    tg_table_schema || '.' || tg_table_name, v_row_id, v_op,
    v_changed, v_old_json, v_new_json,
    v_request_id, clock_timestamp()
  );

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Attach audit triggers to every mutable table
-- (audit_log_events, user_consents, handoff_exports, packet_status_history
--  are append-only and do not need a separate audit trigger — their
--  block-mutation triggers serve as the guard.)
-- ---------------------------------------------------------------------------

-- Helper macro: create AFTER INSERT/UPDATE/DELETE trigger with PK column arg.
-- Idempotent: DROP IF EXISTS before each CREATE.

-- applicants
drop trigger if exists audit_applicants on snap_enrollment.applicants;
create trigger audit_applicants
  after insert or update or delete on snap_enrollment.applicants
  for each row execute function snap_enrollment.audit_row_change('applicant_id');

-- snap_packets
drop trigger if exists audit_snap_packets on snap_enrollment.snap_packets;
create trigger audit_snap_packets
  after insert or update or delete on snap_enrollment.snap_packets
  for each row execute function snap_enrollment.audit_row_change('packet_id');

-- packet_answers
drop trigger if exists audit_packet_answers on snap_enrollment.packet_answers;
create trigger audit_packet_answers
  after insert or update or delete on snap_enrollment.packet_answers
  for each row execute function snap_enrollment.audit_row_change('answer_id');

-- packet_assignments
drop trigger if exists audit_packet_assignments on snap_enrollment.packet_assignments;
create trigger audit_packet_assignments
  after insert or update or delete on snap_enrollment.packet_assignments
  for each row execute function snap_enrollment.audit_row_change('assignment_id');

-- uploaded_documents
drop trigger if exists audit_uploaded_documents on snap_enrollment.uploaded_documents;
create trigger audit_uploaded_documents
  after insert or update or delete on snap_enrollment.uploaded_documents
  for each row execute function snap_enrollment.audit_row_change('document_id');

-- document_extractions
drop trigger if exists audit_document_extractions on snap_enrollment.document_extractions;
create trigger audit_document_extractions
  after insert or update or delete on snap_enrollment.document_extractions
  for each row execute function snap_enrollment.audit_row_change('extraction_id');

-- extraction_fields
drop trigger if exists audit_extraction_fields on snap_enrollment.extraction_fields;
create trigger audit_extraction_fields
  after insert or update or delete on snap_enrollment.extraction_fields
  for each row execute function snap_enrollment.audit_row_change('field_id');

-- required_document_items
drop trigger if exists audit_required_document_items on snap_enrollment.required_document_items;
create trigger audit_required_document_items
  after insert or update or delete on snap_enrollment.required_document_items
  for each row execute function snap_enrollment.audit_row_change('item_id');

-- missing_item_requests
drop trigger if exists audit_missing_item_requests on snap_enrollment.missing_item_requests;
create trigger audit_missing_item_requests
  after insert or update or delete on snap_enrollment.missing_item_requests
  for each row execute function snap_enrollment.audit_row_change('request_id');

-- navigator_notes
drop trigger if exists audit_navigator_notes on snap_enrollment.navigator_notes;
create trigger audit_navigator_notes
  after insert or update or delete on snap_enrollment.navigator_notes
  for each row execute function snap_enrollment.audit_row_change('note_id');

-- staff_users
drop trigger if exists audit_staff_users on snap_enrollment.staff_users;
create trigger audit_staff_users
  after insert or update or delete on snap_enrollment.staff_users
  for each row execute function snap_enrollment.audit_row_change('staff_id');
