-- Issue briefing storage for source-backed civic briefing flow.
-- Retention target: 90 days for request/response/snapshot/policy telemetry.

create extension if not exists pgcrypto;

create table if not exists public.issue_core (
  canonical_issue text primary key,
  title text not null,
  category text,
  overview text,
  tags jsonb not null default '[]'::jsonb,
  synonyms jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.issue_evidence_item (
  evidence_id uuid primary key default gen_random_uuid(),
  canonical_issue text not null references public.issue_core(canonical_issue) on delete cascade,
  source_name text not null,
  source_url text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  claim text not null,
  evidence_type text not null default 'official',
  supports_view text
);

create unique index if not exists issue_evidence_item_issue_source_claim_idx
  on public.issue_evidence_item(canonical_issue, source_name, claim);

create table if not exists public.brief_request (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  safety_identifier text not null,
  concern_text text not null,
  requested_output text,
  allow_revision boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.brief_response (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.brief_request(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  safety_identifier text not null,
  status text not null,
  canonical_issue text,
  response_json jsonb not null,
  llm_model text,
  llm_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.issue_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  safety_identifier text not null,
  canonical_issue text not null,
  snapshot_json jsonb not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.policy_event (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  safety_identifier text not null,
  event_type text not null,
  reason text not null,
  policy_flags jsonb not null default '[]'::jsonb,
  concern_excerpt text,
  created_at timestamptz not null default now()
);

create index if not exists brief_request_user_created_idx
  on public.brief_request(user_id, created_at desc);
create index if not exists brief_response_user_created_idx
  on public.brief_response(user_id, created_at desc);
create index if not exists issue_snapshot_user_created_idx
  on public.issue_snapshot(user_id, created_at desc);
create index if not exists policy_event_user_created_idx
  on public.policy_event(user_id, created_at desc);
create index if not exists issue_evidence_item_issue_published_idx
  on public.issue_evidence_item(canonical_issue, published_at desc, retrieved_at desc);

alter table public.issue_core enable row level security;
alter table public.issue_evidence_item enable row level security;
alter table public.brief_request enable row level security;
alter table public.brief_response enable row level security;
alter table public.issue_snapshot enable row level security;
alter table public.policy_event enable row level security;

drop policy if exists issue_core_read on public.issue_core;
create policy issue_core_read
on public.issue_core
for select
to authenticated
using (true);

drop policy if exists issue_evidence_item_read on public.issue_evidence_item;
create policy issue_evidence_item_read
on public.issue_evidence_item
for select
to authenticated
using (true);

drop policy if exists brief_request_own_all on public.brief_request;
create policy brief_request_own_all
on public.brief_request
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists brief_response_own_all on public.brief_response;
create policy brief_response_own_all
on public.brief_response
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists issue_snapshot_own_all on public.issue_snapshot;
create policy issue_snapshot_own_all
on public.issue_snapshot
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists policy_event_own_all on public.policy_event;
create policy policy_event_own_all
on public.policy_event
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.purge_issue_briefing_retention()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.brief_response where created_at < now() - interval '90 days';
  delete from public.brief_request where created_at < now() - interval '90 days';
  delete from public.issue_snapshot where created_at < now() - interval '90 days';
  delete from public.policy_event where created_at < now() - interval '90 days';
$$;
