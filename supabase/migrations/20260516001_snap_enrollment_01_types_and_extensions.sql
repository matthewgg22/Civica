-- snap_enrollment — Migration 01: schema, extensions, enums, uuid-v7 helper
--
-- Decisions baked in:
--   • All enrollment tables live in the `snap_enrollment` schema to avoid
--     collision with the existing eligibility-screener tables in `public`.
--   • UUID v7 is implemented via gen_uuidv7() PL/pgSQL helper (no pg_uuidv7
--     extension required; RFC 9562 compliant, ms-precision, sortable).
--   • PII columns carry both a COMMENT 'PII' marker (grep-able) and are
--     encrypted at the application layer with Fernet (snap_v1:: prefix) for
--     consistency with the existing screener posture.
--   • Confidence threshold for the ready-for-handoff guard = 0.85.
--
-- Idempotent: every statement uses CREATE IF NOT EXISTS / OR REPLACE so
-- re-running against a live DB is safe.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;  -- gen_random_bytes(), gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

create schema if not exists snap_enrollment;

-- Allow the authenticated role and service_role to use this schema.
-- Specific table-level grants are added in the RLS migration.
grant usage on schema snap_enrollment to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- UUID v7 helper (RFC 9562)
--
-- Layout (128 bits):
--   bytes 0-5  : 48-bit unix millisecond timestamp (big-endian)
--   byte  6    : 0x7_ — high nibble = version 7
--   byte  7    : random (rand_a continuation)
--   byte  8    : 0x8_–0xb_ — top 2 bits = 0b10 (RFC 4122 variant)
--   bytes 9-15 : random (rand_b)
-- ---------------------------------------------------------------------------

create or replace function snap_enrollment.gen_uuidv7()
returns uuid
language plpgsql
parallel safe
as $$
declare
  v_ms  bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_b   bytea  := gen_random_bytes(16);
begin
  v_b := set_byte(v_b, 0, ((v_ms >> 40) & 255)::int);
  v_b := set_byte(v_b, 1, ((v_ms >> 32) & 255)::int);
  v_b := set_byte(v_b, 2, ((v_ms >> 24) & 255)::int);
  v_b := set_byte(v_b, 3, ((v_ms >> 16) & 255)::int);
  v_b := set_byte(v_b, 4, ((v_ms >>  8) & 255)::int);
  v_b := set_byte(v_b, 5, ( v_ms        & 255)::int);
  v_b := set_byte(v_b, 6, (get_byte(v_b, 6) & 15) | x'70'::int);  -- version = 7
  v_b := set_byte(v_b, 8, (get_byte(v_b, 8) & 63) | x'80'::int);  -- variant = 10xxxxxx
  return encode(v_b, 'hex')::uuid;
end;
$$;

-- Convenience alias in public so callers don't need schema-qualify when the
-- search_path is the default (public).
create or replace function public.gen_uuidv7_enrollment()
returns uuid
language sql
parallel safe
as $$ select snap_enrollment.gen_uuidv7(); $$;

-- ---------------------------------------------------------------------------
-- Enum: packet status
--
-- Hard invariant: EXACTLY these 8 values; no outcome vocabulary allowed.
-- Do NOT add Approved / Denied / Eligible / Ineligible / Accepted.
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.packet_status as enum (
    'Draft',
    'Submitted for Review',
    'Needs Documents',
    'Needs Applicant Clarification',
    'In Navigator Review',
    'Ready for Handoff',
    'Handed Off',
    'Closed'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Enum: launch states
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.launch_state as enum ('CA', 'MA');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Enum: staff role kind
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.staff_role_kind as enum (
    'navigator',   -- front-line case worker: view + note + request docs
    'supervisor',  -- can override status, view all in org
    'admin',       -- full org admin: manage staff, view all
    'auditor'      -- read-only across org; cannot write
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Enum: consent kind
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.consent_kind as enum (
    'privacy_notice',       -- Civica privacy policy
    'data_sharing',         -- sharing with navigator org
    'terms_of_service'      -- Civica ToS
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Enum: document kind
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.document_kind as enum (
    'paystub',
    'photo_id',
    'lease',
    'utility_bill',
    'bank_statement',
    'tax_return',
    'benefit_letter',
    'other'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Enum: audit actor kind
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.audit_actor_kind as enum (
    'applicant',       -- action taken by the applicant via iOS or web app
    'navigator',       -- action taken by a staff navigator
    'admin',           -- action taken by an org admin
    'system',          -- background job or trigger
    'api_key'          -- external integration (e.g. handoff export webhook)
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Enum: missing item request status
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.missing_item_status as enum (
    'pending',        -- request sent; applicant has not responded
    'uploaded',       -- applicant uploaded something; needs review
    'resolved',       -- navigator confirmed the item is satisfied
    'waived'          -- navigator waived the requirement with a note
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Enum: handoff export format
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.handoff_format as enum (
    'pdf_packet',      -- full PDF bundle
    'xml_ecs',         -- SNAP ECS XML (state agency interchange)
    'csv_summary',     -- CSV summary row (navigator org internal)
    'json_api'         -- API push to navigator org system
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger function (schema-scoped)
-- ---------------------------------------------------------------------------

create or replace function snap_enrollment.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Confidence threshold constant (used by guard triggers in migration 07)
-- ---------------------------------------------------------------------------

-- Stored as a single-row config table so triggers can read it without
-- hard-coding the 0.85 value everywhere.
create table if not exists snap_enrollment.enrollment_config (
  key   text primary key,
  value text not null,
  note  text
);

insert into snap_enrollment.enrollment_config (key, value, note)
values (
  'extraction_confidence_review_threshold',
  '0.85',
  'Extraction fields with confidence below this value must be reviewed before a packet can move to Ready for Handoff.'
)
on conflict (key) do update
  set value = excluded.value,
      note  = excluded.note;
