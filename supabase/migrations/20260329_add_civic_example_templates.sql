-- Remote-managed premade example scripts for Civic "Call my Rep".
-- Each row is one publishable script card controlled in Supabase.

create table if not exists public.civic_example_templates (
  issue_id text primary key,
  slug text,
  title text not null,
  category text not null default 'General',
  target_chambers jsonb not null default '["house","senate"]'::jsonb,
  primary_ask text not null default 'support',
  summary text not null,
  related_bills jsonb not null default '[]'::jsonb,
  template_asks jsonb not null default '[]'::jsonb,
  live_script text not null,
  voicemail_script text not null,
  supporter_variant text,
  undecided_variant text,
  staffer_variant text,
  voicemail_footer text,
  placeholders jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  display_order integer not null default 100,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint civic_example_templates_primary_ask_check check (
    primary_ask in (
      'support',
      'oppose',
      'cosponsor',
      'vote_yes',
      'vote_no',
      'seek_oversight',
      'ask_public_statement',
      'ask_amendment'
    )
  ),
  constraint civic_example_templates_window_check check (
    ends_at is null or starts_at is null or ends_at > starts_at
  )
);

create index if not exists civic_example_templates_active_window_idx
  on public.civic_example_templates(is_active, starts_at, ends_at, display_order);

create index if not exists civic_example_templates_updated_idx
  on public.civic_example_templates(updated_at desc);

alter table public.civic_example_templates enable row level security;

drop policy if exists civic_example_templates_select_active on public.civic_example_templates;
create policy civic_example_templates_select_active
  on public.civic_example_templates
  for select
  to authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );
