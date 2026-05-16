create extension if not exists pgcrypto;

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

-- scheduled_notifications was created directly on the hosted DB before this
-- repo tracked it. CREATE IF NOT EXISTS makes this migration safe locally
-- and idempotent against production.
create table if not exists public.scheduled_notifications (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null,
  election_id     text        not null,
  notification_type text      not null,
  status          text        not null default 'pending',
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.scheduled_notifications
  add column if not exists plugin_id text;

alter table public.scheduled_notifications
  add column if not exists plan_snapshot_id text;

alter table public.scheduled_notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists scheduled_notifications_pending_unique_user_election_type
  on public.scheduled_notifications(user_id, election_id, notification_type)
  where status = 'pending';
