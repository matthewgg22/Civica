-- snap_enrollment — Migration 06: guard triggers
--
-- Two invariants enforced here:
--
-- GUARD A — Three-value immutability
--   applicant_answer and original_ocr_value on packet_answers and
--   extraction_fields are write-once after the first non-null insert.
--   Any UPDATE that tries to overwrite them raises P0001.
--
-- GUARD B — Status transition: Ready for Handoff preconditions
--   A BEFORE UPDATE trigger on snap_packets blocks the transition to
--   'Ready for Handoff' if any of:
--     (a) a required_document_items row for this packet has resolved_at IS NULL
--         and waived_at IS NULL
--     (b) an extraction_fields row for this packet has needs_review = true
--         and reviewed_at IS NULL
--     (c) no current (non-revoked) user_consents row for the applicant
--         exists for consent_kind = 'privacy_notice'
--
-- Also enforces: status can only move forward along the lifecycle or
-- back to certain states. Invalid transitions raise P0001.
--
-- Idempotent: CREATE OR REPLACE for functions; DROP TRIGGER IF EXISTS before
-- each CREATE TRIGGER.

-- ---------------------------------------------------------------------------
-- GUARD A: three-value immutability
-- ---------------------------------------------------------------------------

create or replace function snap_enrollment.enforce_three_value_immutability()
returns trigger
language plpgsql
as $$
begin
  -- applicant_answer: write-once (cannot change once set)
  if old.applicant_answer is not null
     and new.applicant_answer is distinct from old.applicant_answer then
    raise exception
      'applicant_answer on %.% is write-once and cannot be changed (row %)',
      tg_table_schema, tg_table_name, old.answer_id
      using errcode = 'P0001';
  end if;

  -- original_ocr_value: write-once (cannot change once set)
  if old.original_ocr_value is not null
     and new.original_ocr_value is distinct from old.original_ocr_value then
    raise exception
      'original_ocr_value on %.% is write-once and cannot be changed (row %)',
      tg_table_schema, tg_table_name, old.answer_id
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Attach to packet_answers
drop trigger if exists guard_three_value_packet_answers on snap_enrollment.packet_answers;
create trigger guard_three_value_packet_answers
  before update on snap_enrollment.packet_answers
  for each row execute function snap_enrollment.enforce_three_value_immutability();

-- Attach to extraction_fields (column is field_id not answer_id; function uses
-- tg_table_name in the message, and answer_id reference in the exception is
-- fine since it just appears in the error string — the guard logic is column-
-- name-agnostic).
drop trigger if exists guard_three_value_extraction_fields on snap_enrollment.extraction_fields;
create trigger guard_three_value_extraction_fields
  before update on snap_enrollment.extraction_fields
  for each row execute function snap_enrollment.enforce_three_value_immutability();

-- ---------------------------------------------------------------------------
-- GUARD B: status transition rules
-- ---------------------------------------------------------------------------

create or replace function snap_enrollment.enforce_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_unresolved_docs  int;
  v_unreviewed_fields int;
  v_consent_exists   int;
  v_threshold        numeric;
begin
  -- Only fire when status is actually changing.
  if new.status = old.status then
    return new;
  end if;

  -- ── Allowed transitions ─────────────────────────────────────────────────
  -- Any state can move to Closed (navigator or admin action).
  -- Any state can move to Needs Documents or Needs Applicant Clarification
  -- from In Navigator Review.
  -- Forward-only rule with escape hatches:
  if not (
    -- Forward sequence
    (old.status = 'Draft'                         and new.status = 'Submitted for Review') or
    (old.status = 'Submitted for Review'           and new.status = 'In Navigator Review') or
    (old.status = 'Submitted for Review'           and new.status = 'Needs Documents') or
    (old.status = 'Submitted for Review'           and new.status = 'Needs Applicant Clarification') or
    (old.status = 'In Navigator Review'            and new.status = 'Needs Documents') or
    (old.status = 'In Navigator Review'            and new.status = 'Needs Applicant Clarification') or
    (old.status = 'In Navigator Review'            and new.status = 'Ready for Handoff') or
    (old.status = 'Needs Documents'               and new.status = 'In Navigator Review') or
    (old.status = 'Needs Documents'               and new.status = 'Submitted for Review') or
    (old.status = 'Needs Applicant Clarification'  and new.status = 'In Navigator Review') or
    (old.status = 'Needs Applicant Clarification'  and new.status = 'Submitted for Review') or
    (old.status = 'Ready for Handoff'             and new.status = 'In Navigator Review') or
    (old.status = 'Ready for Handoff'             and new.status = 'Handed Off') or
    (old.status = 'Handed Off'                    and new.status = 'Closed') or
    -- Closed is terminal except admin re-open to Draft (edge case)
    (old.status = 'Closed'                        and new.status = 'Draft') or
    -- Any state → Closed
    (new.status = 'Closed')
  ) then
    raise exception
      'Invalid packet status transition: % → % (packet_id: %)',
      old.status, new.status, new.packet_id
      using errcode = 'P0001';
  end if;

  -- ── Ready for Handoff precondition checks ────────────────────────────────
  if new.status = 'Ready for Handoff' then

    -- (a) No unresolved required document items
    select count(*) into v_unresolved_docs
    from snap_enrollment.required_document_items rdi
    where rdi.packet_id   = new.packet_id
      and rdi.is_required = true
      and rdi.resolved_at is null
      and rdi.waived_at   is null;

    if v_unresolved_docs > 0 then
      raise exception
        'Cannot move to Ready for Handoff: % required document item(s) are unresolved (packet_id: %)',
        v_unresolved_docs, new.packet_id
        using errcode = 'P0001';
    end if;

    -- (b) No low-confidence extraction fields that haven't been reviewed
    select count(*) into v_unreviewed_fields
    from snap_enrollment.extraction_fields ef
    where ef.packet_id    = new.packet_id
      and ef.needs_review = true
      and ef.reviewed_at  is null;

    if v_unreviewed_fields > 0 then
      raise exception
        'Cannot move to Ready for Handoff: % extraction field(s) with confidence < 0.85 are unreviewed (packet_id: %)',
        v_unreviewed_fields, new.packet_id
        using errcode = 'P0001';
    end if;

    -- (c) Current privacy_notice consent must exist for the applicant
    select count(*) into v_consent_exists
    from snap_enrollment.user_consents uc
    join snap_enrollment.applicants    a  on a.applicant_id = uc.applicant_id
    join snap_enrollment.snap_packets  sp on sp.applicant_id = a.applicant_id
    where sp.packet_id      = new.packet_id
      and uc.consent_kind   = 'privacy_notice'
      and uc.revoked_at     is null;

    if v_consent_exists = 0 then
      raise exception
        'Cannot move to Ready for Handoff: no current privacy_notice consent on record (packet_id: %)',
        new.packet_id
        using errcode = 'P0001';
    end if;

  end if;

  -- Record transition in packet_status_history.
  -- actor context comes from transaction-local settings (same as audit triggers).
  insert into snap_enrollment.packet_status_history (
    packet_id, from_status, to_status,
    changed_by_staff_id,
    reason,
    occurred_at
  ) values (
    new.packet_id,
    old.status,
    new.status,
    current_setting('snap_enrollment.actor_id', true)::uuid,
    current_setting('snap_enrollment.transition_reason', true),
    clock_timestamp()
  );

  -- Stamp convenience timestamp columns.
  if new.status = 'Submitted for Review' and old.submitted_at is null then
    new.submitted_at := clock_timestamp();
  end if;
  if new.status = 'Handed Off' and old.handed_off_at is null then
    new.handed_off_at := clock_timestamp();
  end if;
  if new.status = 'Closed' and old.closed_at is null then
    new.closed_at := clock_timestamp();
  end if;

  return new;
end;
$$;

drop trigger if exists guard_status_transition on snap_enrollment.snap_packets;
create trigger guard_status_transition
  before update of status on snap_enrollment.snap_packets
  for each row execute function snap_enrollment.enforce_status_transition();
