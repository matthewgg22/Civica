-- Serving table for current state legislators synced from Open States people repo.
-- Source scope: data/{state}/legislature/*.yml (current legislative roles only).

create table if not exists public.state_legislators_current (
  legislator_key text primary key,
  source_person_id text not null,
  seat_key text not null,
  state text not null,
  chamber text not null,
  district text not null,
  name text not null,
  title text not null,
  party text,
  website text,
  phone text,
  source_file text,
  source_snapshot_url text,
  source_snapshot_as_of text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint state_legislators_state_code_check check (state ~ '^[A-Z]{2}$'),
  constraint state_legislators_chamber_check check (chamber in ('upper', 'lower', 'legislature'))
);

create index if not exists state_legislators_current_lookup_idx
  on public.state_legislators_current(state, chamber, district);

create index if not exists state_legislators_current_name_idx
  on public.state_legislators_current(state, name);

create index if not exists state_legislators_current_synced_idx
  on public.state_legislators_current(last_synced_at desc);

alter table public.state_legislators_current enable row level security;

drop policy if exists state_legislators_current_select on public.state_legislators_current;
create policy state_legislators_current_select
  on public.state_legislators_current
  for select
  to anon, authenticated
  using (true);
