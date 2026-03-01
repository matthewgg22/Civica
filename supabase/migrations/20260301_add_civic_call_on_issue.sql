-- Civic "Call on an issue" feature schema (V1 + phase-2 statement source stub)

create extension if not exists pgcrypto;

create table if not exists public.issue_catalog (
  issue_id text primary key,
  user_id uuid,
  issue_title text not null,
  issue_summary text not null,
  selected_ask text not null,
  optional_bill_ref text,
  resolved_bills jsonb not null default '[]'::jsonb,
  resolved_committees jsonb not null default '[]'::jsonb,
  resolved_agencies jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists issue_catalog_user_updated_idx
  on public.issue_catalog(user_id, updated_at desc);

create table if not exists public.issue_legislation_links (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null references public.issue_catalog(issue_id) on delete cascade,
  bill_ref text,
  congress int,
  bill_type text,
  bill_number int,
  policy_area text,
  latest_action_date date,
  latest_action_text text,
  summary text,
  source text not null default 'congress_gov',
  updated_at timestamptz not null default now()
);

create index if not exists issue_legislation_links_issue_idx
  on public.issue_legislation_links(issue_id);

create index if not exists issue_legislation_links_bill_idx
  on public.issue_legislation_links(congress, bill_type, bill_number);

create table if not exists public.rep_issue_signals (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null,
  rep_id text not null,
  rep_slot text,
  is_sponsor boolean not null default false,
  is_cosponsor boolean not null default false,
  committee_relevance boolean not null default false,
  chamber_match boolean not null default false,
  house_vote_signal boolean not null default false,
  public_statement_signal boolean not null default false,
  latest_action_date text,
  latest_action_text text,
  summary text,
  reason_badges jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  unique(issue_id, rep_id)
);

create index if not exists rep_issue_signals_issue_idx
  on public.rep_issue_signals(issue_id);

create table if not exists public.call_briefs (
  brief_id text primary key,
  user_id uuid,
  issue_id text not null references public.issue_catalog(issue_id) on delete cascade,
  rep_id text not null,
  rep_name text not null,
  office_type text not null,
  primary_phone_number text not null,
  local_office_phone_number text,
  relevance_badges jsonb not null default '[]'::jsonb,
  related_bills jsonb not null default '[]'::jsonb,
  related_committees jsonb not null default '[]'::jsonb,
  live_script text not null,
  voicemail_script text not null,
  talking_points jsonb not null default '[]'::jsonb,
  rep_slot text,
  created_at timestamptz not null default now()
);

create index if not exists call_briefs_user_issue_idx
  on public.call_briefs(user_id, issue_id);

create table if not exists public.call_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid,
  rep_id text not null,
  rep_name text,
  issue_id text not null references public.issue_catalog(issue_id) on delete cascade,
  issue_title text,
  brief_id text not null references public.call_briefs(brief_id) on delete cascade,
  outcome text not null,
  staffer_position text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists call_logs_user_created_idx
  on public.call_logs(user_id, created_at desc);

create index if not exists call_logs_issue_idx
  on public.call_logs(issue_id, created_at desc);

-- Phase 2 placeholder: source inventory for official member statements.
create table if not exists public.member_statement_sources (
  id uuid primary key default gen_random_uuid(),
  rep_id text not null,
  source_url text not null,
  source_kind text not null check (source_kind in ('website', 'rss')),
  last_ingested_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(rep_id, source_url)
);

create index if not exists member_statement_sources_rep_idx
  on public.member_statement_sources(rep_id, is_active);
