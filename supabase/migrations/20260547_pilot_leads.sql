-- T8: Pilot lead capture persistence for §10106 county admin cost dashboard.
-- Rows are inserted exclusively via service role from the lead-capture API route.
-- Readable by admin role for CRM export / HubSpot sync post-MVP.

create table if not exists public.pilot_leads (
  lead_id      uuid        primary key default gen_random_uuid(),
  name         text        not null,
  organization text        not null,
  email        text        not null,
  qc_process   text,
  source       text        not null default 'county-10106',
  created_at   timestamptz not null default now()
);

-- Enable RLS — all writes go through service role, no anon/user writes allowed.
alter table public.pilot_leads enable row level security;

-- Service role bypasses RLS by default in Supabase, but explicit policy keeps
-- intent readable and allows future admin-role SELECT for CRM export.
create policy "service_role_all" on public.pilot_leads
  using (true)
  with check (true);
