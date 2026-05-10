-- civicaSNAP — initial schema for SNAP benefits enrollment vertical.
--
-- Persistence stance for this module is locked: SNAP sessions, conversation
-- turns, extracted entities, document blobs, and eligibility results are
-- persisted with RLS, application-layer Fernet encryption on PII columns,
-- and append-only audit logging. See plans/i-am-looking-to-fizzy-eagle.md
-- for the privacy decision record.
--
-- IMPORTANT before applying to production:
--   1. SNAP_FERNET_KEY must be set in the backend environment. The
--      application-layer encryption helper in
--      backend/civic_api/snap/storage/encryption.py refuses to start
--      without it.
--   2. The privacy policy and ToS rewrite must be complete (Phase A
--      blocker — see plan).
--   3. The SNAPPrivacyBoundaryTests.swift suite must be updated to
--      assert the new "encrypted-at-rest with audit" posture.

create extension if not exists pgcrypto;

-- ===========================================================================
-- snap_sessions: top-level row per applicant interaction. Anonymous at
-- creation; user_id is filled in only after magic-link recovery.
-- ===========================================================================

create table if not exists public.snap_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid,  -- null while session is anonymous; set on magic-link recovery
  state text not null check (length(state) = 2),
  language text not null default 'en',
  status text not null default 'active' check (status in ('active', 'abandoned', 'completed')),
  partner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists snap_sessions_user_idx
  on public.snap_sessions(user_id, created_at desc) where user_id is not null;
create index if not exists snap_sessions_partner_idx
  on public.snap_sessions(partner_id, created_at desc) where partner_id is not null;

-- ===========================================================================
-- snap_conversation_turns: full transcript of the eligibility-screener
-- dialogue. content_ciphertext is Fernet-encrypted at the application
-- layer (snap_v1:: prefix).
-- ===========================================================================

create table if not exists public.snap_conversation_turns (
  turn_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  role text not null check (role in ('user', 'assistant', 'system')),
  content_ciphertext text not null,  -- Fernet-encrypted (PII)
  pipeline_stage text check (pipeline_stage in ('interpreter', 'ask_selector', 'script_writer', 'background_writer')),
  model_used text,
  cost_usd numeric(10, 6),
  latency_ms integer,
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

create index if not exists snap_conversation_turns_session_idx
  on public.snap_conversation_turns(session_id, turn_index);

comment on column public.snap_conversation_turns.content_ciphertext is
  'Application-layer Fernet ciphertext (snap_v1:: prefix). Decrypt only via PIIEncryptor in the backend.';

-- ===========================================================================
-- snap_extracted_state: structured-update side. Each row records the
-- entities extracted from a single user turn so the rules engine has
-- something to consume. snapshot_ciphertext is the JSON-stringified
-- Household snapshot, Fernet-encrypted.
-- ===========================================================================

create table if not exists public.snap_extracted_state (
  state_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  derived_from_turn_id uuid not null references public.snap_conversation_turns(turn_id) on delete cascade,
  snapshot_ciphertext text not null,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists snap_extracted_state_session_idx
  on public.snap_extracted_state(session_id, created_at desc);

comment on column public.snap_extracted_state.snapshot_ciphertext is
  'Fernet-encrypted JSON of the Household model from rules/interfaces.py.';

-- ===========================================================================
-- snap_documents: encrypted blob lives in Supabase Storage; this table
-- tracks the metadata, classification, and extraction state. Extracted
-- payloads are themselves PII (income amounts, names) — encrypt at the
-- application layer.
-- ===========================================================================

create table if not exists public.snap_documents (
  document_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  storage_path text not null,
  document_type text not null default 'unknown'
    check (document_type in ('unknown', 'paystub', 'photo_id', 'lease', 'utility_bill', 'other')),
  classification_confidence numeric(4, 3) check (classification_confidence between 0 and 1),
  extracted_payload_ciphertext text,
  extraction_confidence numeric(4, 3) check (extraction_confidence between 0 and 1),
  validator_errors jsonb not null default '[]'::jsonb,
  user_confirmed boolean not null default false,
  user_corrections_ciphertext text,
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded', 'classifying', 'extracting', 'awaiting_confirmation', 'confirmed', 'rejected')),
  on_device_quality_passed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists snap_documents_session_idx
  on public.snap_documents(session_id, created_at desc);
create index if not exists snap_documents_status_idx
  on public.snap_documents(processing_status, updated_at desc);

-- ===========================================================================
-- snap_eligibility_results: persisted snapshot of every rules-engine
-- determination. Re-running the engine with the same inputs and
-- effective_date must reproduce a result with identical
-- result_ciphertext (modulo the Fernet IV).
-- ===========================================================================

create table if not exists public.snap_eligibility_results (
  result_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.snap_sessions(session_id) on delete cascade,
  rules_version text not null,
  household_snapshot_ciphertext text not null,
  result_ciphertext text not null,
  status text not null
    check (status in ('eligible', 'ineligible', 'eligible_with_conditions', 'insufficient_information')),
  monthly_benefit numeric(10, 2),
  effective_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists snap_eligibility_results_session_idx
  on public.snap_eligibility_results(session_id, created_at desc);

-- ===========================================================================
-- snap_audit_log: append-only. The trigger below blocks UPDATE and
-- DELETE so even compromised application credentials cannot rewrite
-- history. The auditor service reads via a read-only role.
-- ===========================================================================

create table if not exists public.snap_audit_log (
  audit_id uuid primary key default gen_random_uuid(),
  session_id uuid not null,  -- intentionally not FK: audit must survive cascade delete
  action text not null,
  actor_kind text not null
    check (actor_kind in ('anonymous_session', 'authenticated_user', 'partner_user', 'background_job', 'admin')),
  actor_id text,
  reason text not null,
  request_id text,
  column_or_resource text,
  occurred_at timestamptz not null default now()
);

create index if not exists snap_audit_log_session_idx
  on public.snap_audit_log(session_id, occurred_at desc);
create index if not exists snap_audit_log_action_idx
  on public.snap_audit_log(action, occurred_at desc);

create or replace function public.snap_audit_log_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'snap_audit_log is append-only; % is not permitted', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists snap_audit_log_no_update on public.snap_audit_log;
create trigger snap_audit_log_no_update
  before update on public.snap_audit_log
  for each row execute function public.snap_audit_log_block_mutation();

drop trigger if exists snap_audit_log_no_delete on public.snap_audit_log;
create trigger snap_audit_log_no_delete
  before delete on public.snap_audit_log
  for each row execute function public.snap_audit_log_block_mutation();

-- ===========================================================================
-- updated_at maintenance
-- ===========================================================================

create or replace function public.snap_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists snap_sessions_set_updated_at on public.snap_sessions;
create trigger snap_sessions_set_updated_at
  before update on public.snap_sessions
  for each row execute function public.snap_set_updated_at();

drop trigger if exists snap_documents_set_updated_at on public.snap_documents;
create trigger snap_documents_set_updated_at
  before update on public.snap_documents
  for each row execute function public.snap_set_updated_at();

-- ===========================================================================
-- Row-level security
--
-- The trust model: the FastAPI backend uses the service-role key and is
-- the sole writer. iOS clients hit FastAPI, never Supabase directly.
-- RLS is defense-in-depth: if a non-service-role token ever reaches
-- these tables (e.g. a leaked anon key), the policies must deny it.
--
-- Authenticated users can read their own data after magic-link recovery
-- has set sessions.user_id. Pre-recovery (anonymous) sessions are
-- service-role-only.
-- ===========================================================================

alter table public.snap_sessions enable row level security;
alter table public.snap_conversation_turns enable row level security;
alter table public.snap_extracted_state enable row level security;
alter table public.snap_documents enable row level security;
alter table public.snap_eligibility_results enable row level security;
alter table public.snap_audit_log enable row level security;

drop policy if exists snap_sessions_owner_read on public.snap_sessions;
create policy snap_sessions_owner_read
on public.snap_sessions
for select
to authenticated
using (user_id is not null and user_id = auth.uid());

drop policy if exists snap_conversation_turns_owner_read on public.snap_conversation_turns;
create policy snap_conversation_turns_owner_read
on public.snap_conversation_turns
for select
to authenticated
using (
  exists (
    select 1 from public.snap_sessions s
    where s.session_id = snap_conversation_turns.session_id
      and s.user_id is not null
      and s.user_id = auth.uid()
  )
);

drop policy if exists snap_extracted_state_owner_read on public.snap_extracted_state;
create policy snap_extracted_state_owner_read
on public.snap_extracted_state
for select
to authenticated
using (
  exists (
    select 1 from public.snap_sessions s
    where s.session_id = snap_extracted_state.session_id
      and s.user_id is not null
      and s.user_id = auth.uid()
  )
);

drop policy if exists snap_documents_owner_read on public.snap_documents;
create policy snap_documents_owner_read
on public.snap_documents
for select
to authenticated
using (
  exists (
    select 1 from public.snap_sessions s
    where s.session_id = snap_documents.session_id
      and s.user_id is not null
      and s.user_id = auth.uid()
  )
);

drop policy if exists snap_eligibility_results_owner_read on public.snap_eligibility_results;
create policy snap_eligibility_results_owner_read
on public.snap_eligibility_results
for select
to authenticated
using (
  exists (
    select 1 from public.snap_sessions s
    where s.session_id = snap_eligibility_results.session_id
      and s.user_id is not null
      and s.user_id = auth.uid()
  )
);

-- snap_audit_log is intentionally NOT exposed via authenticated-user
-- policies — only the service-role and a dedicated read-only auditor
-- role (provisioned separately) may read it. Authenticated user reads
-- of their own data are tracked in this log; allowing them to read the
-- log itself would create a feedback loop and PII exposure surface.

-- ===========================================================================
-- Retention
--
-- 7-year retention for benefits records (typical maximum across state
-- agency contracts). Audit log retained for full 7 years. Conversation
-- turns purged at 7 years from session creation.
-- ===========================================================================

create or replace function public.purge_snap_retention()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.snap_sessions
    where created_at < now() - interval '7 years';
  -- Cascades take care of conversation_turns, extracted_state, documents,
  -- eligibility_results. Audit log is intentionally NOT cascaded — it
  -- outlives the session for compliance review.
  delete from public.snap_audit_log
    where occurred_at < now() - interval '7 years';
$$;
