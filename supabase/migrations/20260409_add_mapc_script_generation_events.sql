-- Script generation analytics for MAPC build flow

create extension if not exists pgcrypto;

create table if not exists public.mapc_script_generation_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  package_id text,
  session_id text,
  event_type text not null check (
    event_type in (
      'generated',
      'feedback',
      'mapc_completion'
    )
  ),
  concern_text text,
  selected_ask text,
  chosen_option text,
  final_script text,
  decision text check (decision in ('accurate', 'revise')),
  mapc_completed boolean,
  script_generation_source text check (
    script_generation_source in ('template_only', 'llm_rewrite', 'llm_full')
  ),
  canonical_issue_id text,
  fallback_used text,
  metadata jsonb
);

create index if not exists mapc_script_generation_events_user_created_idx
  on public.mapc_script_generation_events(user_id, created_at desc);

create index if not exists mapc_script_generation_events_package_idx
  on public.mapc_script_generation_events(package_id);

create index if not exists mapc_script_generation_events_event_type_idx
  on public.mapc_script_generation_events(event_type);

alter table public.mapc_script_generation_events enable row level security;

drop policy if exists mapc_script_generation_events_own_all on public.mapc_script_generation_events;
create policy mapc_script_generation_events_own_all
  on public.mapc_script_generation_events
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
