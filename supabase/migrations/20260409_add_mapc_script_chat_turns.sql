-- Full MAPC Build Script conversation logging (90-day retention)

create extension if not exists pgcrypto;

create table if not exists public.mapc_script_chat_turns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  session_id text not null,
  package_id text,
  role text not null check (role in ('user', 'assistant')),
  turn_index integer not null check (turn_index >= 1),
  message_text text not null,
  message_type text,
  metadata jsonb
);

create index if not exists mapc_script_chat_turns_user_created_idx
  on public.mapc_script_chat_turns(user_id, created_at desc);

create index if not exists mapc_script_chat_turns_session_turn_idx
  on public.mapc_script_chat_turns(session_id, turn_index asc);

alter table public.mapc_script_chat_turns enable row level security;

drop policy if exists mapc_script_chat_turns_own_all on public.mapc_script_chat_turns;
create policy mapc_script_chat_turns_own_all
  on public.mapc_script_chat_turns
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.prune_mapc_script_chat_turns_90d()
returns trigger
language plpgsql
as $$
begin
  delete from public.mapc_script_chat_turns
  where created_at < now() - interval '90 days';
  return new;
end;
$$;

drop trigger if exists mapc_script_chat_turns_prune_90d on public.mapc_script_chat_turns;
create trigger mapc_script_chat_turns_prune_90d
before insert on public.mapc_script_chat_turns
for each statement
execute function public.prune_mapc_script_chat_turns_90d();

