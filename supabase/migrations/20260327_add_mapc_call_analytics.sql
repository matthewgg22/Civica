-- MAPC call analytics schema + per-user sums RPC

create extension if not exists pgcrypto;

create table if not exists public.mapc_call_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null default auth.uid(),
  issue_id text,
  issue_title text,
  brief_id text,
  rep_id text,
  rep_name text,
  rep_slot text,
  event_type text not null check (
    event_type in (
      'mapc_started',
      'call_launch',
      'call_completion_confirmed',
      'call_completion_failed',
      'call_outcome_logged'
    )
  ),
  completed boolean,
  outcome text,
  source_screen text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mapc_call_events_user_created_idx
  on public.mapc_call_events(user_id, created_at desc);

create index if not exists mapc_call_events_event_completed_idx
  on public.mapc_call_events(event_type, completed);

create index if not exists mapc_call_events_issue_idx
  on public.mapc_call_events(issue_id);

alter table public.mapc_call_events enable row level security;

drop policy if exists mapc_call_events_own_all on public.mapc_call_events;
create policy mapc_call_events_own_all
  on public.mapc_call_events
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.mapc_call_sums_for_current_user()
returns table (
  total_completed_calls bigint,
  monthly_completed_calls bigint,
  user_completed_calls bigint
)
language sql
security invoker
stable
as $$
  select
    count(*) filter (
      where event_type = 'call_completion_confirmed'
        and completed is true
    ) as total_completed_calls,
    count(*) filter (
      where event_type = 'call_completion_confirmed'
        and completed is true
        and created_at >= date_trunc('month', now())
    ) as monthly_completed_calls,
    count(*) filter (
      where event_type = 'call_completion_confirmed'
        and completed is true
        and user_id = auth.uid()
    ) as user_completed_calls
  from public.mapc_call_events;
$$;

grant execute on function public.mapc_call_sums_for_current_user() to authenticated;
