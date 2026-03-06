-- Call-first scoring V1 (private call_score + leaderboard-ready eligible call rollups)

create extension if not exists pgcrypto;

create table if not exists public.call_launch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  office_id text not null,
  issue_id text,
  launched_at timestamptz not null default now(),
  source_screen text not null default 'issue_call_center',
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists call_launch_events_user_launched_idx
  on public.call_launch_events(user_id, launched_at desc);

create index if not exists call_launch_events_office_launched_idx
  on public.call_launch_events(office_id, launched_at desc);

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  office_id text not null,
  issue_id text,
  launch_event_id uuid not null references public.call_launch_events(id) on delete cascade,
  completed_confirmed_at timestamptz not null default now(),
  verification_method text not null
    check (verification_method in ('app_initiated_self_confirmed')),
  scoring_eligible_boolean boolean not null default false,
  scoring_ineligibility_reason text,
  created_at timestamptz not null default now()
);

create index if not exists call_events_user_completed_idx
  on public.call_events(user_id, completed_confirmed_at desc);

create index if not exists call_events_user_office_issue_completed_idx
  on public.call_events(user_id, office_id, issue_id, completed_confirmed_at desc);

create index if not exists call_events_eligible_completed_idx
  on public.call_events(scoring_eligible_boolean, completed_confirmed_at desc);

create table if not exists public.call_score_snapshots (
  user_id uuid primary key,
  call_score int not null default 0 check (call_score >= 0 and call_score <= 100),
  activation_points int not null default 0,
  recency_points int not null default 0,
  consistency_points int not null default 0,
  breadth_points int not null default 0,
  momentum_points int not null default 0,
  tier_name text not null,
  updated_at timestamptz not null default now()
);

create index if not exists call_score_snapshots_updated_idx
  on public.call_score_snapshots(updated_at desc);

create table if not exists public.leaderboard_call_rollups (
  user_id uuid not null,
  period_type text not null check (period_type in ('daily', 'monthly', 'annual')),
  period_start timestamptz not null,
  eligible_verified_call_count int not null default 0,
  unique_office_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_type, period_start)
);

create index if not exists leaderboard_call_rollups_period_rank_idx
  on public.leaderboard_call_rollups(
    period_type,
    period_start,
    eligible_verified_call_count desc,
    unique_office_count desc,
    updated_at desc
  );
