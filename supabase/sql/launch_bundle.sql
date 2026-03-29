-- VoteNow launch SQL bundle (idempotent)
-- Run this entire script in Supabase SQL Editor before launch.

begin;

create extension if not exists pgcrypto;

-- 20260308_mapv_notification_suppression.sql
create table if not exists public.user_election_status (
  user_id uuid not null,
  election_id text not null,
  completion_state text not null
    check (
      completion_state in (
        'not_started',
        'in_progress',
        'ballot_mailed',
        'ballot_delivered',
        'provisional_pending',
        'cure_needed',
        'voted',
        'ballot_received',
        'ballot_accepted'
      )
    ),
  completed_at timestamptz,
  completion_source text,
  completion_confidence numeric(4,3),
  notifications_suppressed boolean not null default false,
  suppression_reason text,
  suppression_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, election_id)
);

create index if not exists user_election_status_completion_idx
  on public.user_election_status(completion_state, notifications_suppressed, suppression_updated_at desc);

alter table public.scheduled_notifications
  add column if not exists plugin_id text;

alter table public.scheduled_notifications
  add column if not exists plan_snapshot_id text;

alter table public.scheduled_notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists scheduled_notifications_pending_unique_user_election_type
  on public.scheduled_notifications(user_id, election_id, notification_type)
  where status = 'pending';

-- 20260327_add_mapc_call_analytics.sql
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

-- 20260325_harden_identity_and_rls.sql (launch-critical subset)
do $$
begin
  if to_regclass('public.mapv_plans') is not null then
    execute 'alter table public.mapv_plans enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'mapv_plans' and column_name = 'user_id'
    ) then
      execute 'alter table public.mapv_plans alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists mapv_plans_own_all on public.mapv_plans';
    execute 'create policy mapv_plans_own_all on public.mapv_plans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.feedback') is not null then
    execute 'alter table public.feedback enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'feedback' and column_name = 'user_id'
    ) then
      execute 'alter table public.feedback alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists feedback_own_all on public.feedback';
    execute 'create policy feedback_own_all on public.feedback for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.device_tokens') is not null then
    execute 'alter table public.device_tokens enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'device_tokens' and column_name = 'user_id'
    ) then
      execute 'alter table public.device_tokens alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists device_tokens_own_all on public.device_tokens';
    execute 'create policy device_tokens_own_all on public.device_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.scheduled_notifications') is not null then
    execute 'alter table public.scheduled_notifications enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'scheduled_notifications' and column_name = 'user_id'
    ) then
      execute 'alter table public.scheduled_notifications alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists scheduled_notifications_own_all on public.scheduled_notifications';
    execute 'create policy scheduled_notifications_own_all on public.scheduled_notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.address_search_events') is not null then
    execute 'alter table public.address_search_events enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'address_search_events' and column_name = 'user_id'
    ) then
      execute 'alter table public.address_search_events alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists address_search_events_own_all on public.address_search_events';
    execute 'create policy address_search_events_own_all on public.address_search_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.mapc_call_events') is not null then
    execute 'alter table public.mapc_call_events enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'mapc_call_events' and column_name = 'user_id'
    ) then
      execute 'alter table public.mapc_call_events alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists mapc_call_events_own_all on public.mapc_call_events';
    execute 'create policy mapc_call_events_own_all on public.mapc_call_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.user_election_status') is not null then
    execute 'alter table public.user_election_status enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'user_election_status' and column_name = 'user_id'
    ) then
      execute 'alter table public.user_election_status alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists user_election_status_own_all on public.user_election_status';
    execute 'create policy user_election_status_own_all on public.user_election_status for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;
end
$$;

commit;

-- Verification queries (run right after the migration section above)
select 'tables' as section, to_regclass('public.user_election_status') as user_election_status, to_regclass('public.mapc_call_events') as mapc_call_events;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'mapv_plans',
    'feedback',
    'device_tokens',
    'scheduled_notifications',
    'address_search_events',
    'mapc_call_events',
    'user_election_status'
  )
order by tablename;

select tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'mapv_plans',
    'feedback',
    'device_tokens',
    'scheduled_notifications',
    'address_search_events',
    'mapc_call_events',
    'user_election_status'
  )
order by tablename, policyname;

select proname
from pg_proc
where proname = 'mapc_call_sums_for_current_user';
