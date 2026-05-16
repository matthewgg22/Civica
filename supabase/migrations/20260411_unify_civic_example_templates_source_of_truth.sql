-- Unify civic premade templates so Supabase is the single source of truth.
-- This migration expands/normalizes public.civic_example_templates in place.

begin;

create table if not exists public.civic_example_templates (
  issue_id text,
  slug text primary key,
  title text not null,
  category text not null,
  summary text not null,
  action_sentence text,
  live_script text not null,
  voicemail_script text not null,
  vehicle_label text,
  status text not null default 'draft',
  display_order integer not null default 0,
  target_chambers text[] not null default '{}'::text[],
  primary_ask text,
  template_asks text[] not null default '{}'::text[],
  related_bills text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  is_active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  presentation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.civic_example_templates
  add column if not exists issue_id text,
  add column if not exists slug text,
  add column if not exists action_sentence text,
  add column if not exists vehicle_label text,
  add column if not exists status text,
  add column if not exists is_active boolean,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists presentation jsonb,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists display_order integer;

-- Keep legacy rows valid by deriving slug from existing identifiers where needed.
update public.civic_example_templates
set slug = coalesce(
  nullif(trim(slug), ''),
  nullif(trim(issue_id), ''),
  lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))
)
where slug is null or trim(slug) = '';

-- Helper: ALTER COLUMN TYPE USING cannot contain subqueries, so wrap the
-- jsonb→text[] conversion in a function the USING clause can call directly.
create or replace function public._jsonb_arr_to_text_arr(v jsonb)
returns text[]
language sql immutable as $$
  select coalesce(array(select jsonb_array_elements_text(v)), '{}'::text[])
$$;

-- Convert legacy jsonb array columns to text[] when needed.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'civic_example_templates'
      and column_name = 'target_chambers' and udt_name = 'jsonb'
  ) then
    execute $q$
      alter table public.civic_example_templates alter column target_chambers drop default;
      alter table public.civic_example_templates alter column target_chambers type text[] using public._jsonb_arr_to_text_arr(target_chambers);
      alter table public.civic_example_templates alter column target_chambers set default '{}'::text[];
    $q$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'civic_example_templates'
      and column_name = 'template_asks' and udt_name = 'jsonb'
  ) then
    execute $q$
      alter table public.civic_example_templates alter column template_asks drop default;
      alter table public.civic_example_templates alter column template_asks type text[] using public._jsonb_arr_to_text_arr(template_asks);
      alter table public.civic_example_templates alter column template_asks set default '{}'::text[];
    $q$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'civic_example_templates'
      and column_name = 'related_bills' and udt_name = 'jsonb'
  ) then
    execute $q$
      alter table public.civic_example_templates alter column related_bills drop default;
      alter table public.civic_example_templates alter column related_bills type text[] using public._jsonb_arr_to_text_arr(related_bills);
      alter table public.civic_example_templates alter column related_bills set default '{}'::text[];
    $q$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'civic_example_templates'
      and column_name = 'tags' and udt_name = 'jsonb'
  ) then
    execute $q$
      alter table public.civic_example_templates alter column tags drop default;
      alter table public.civic_example_templates alter column tags type text[] using public._jsonb_arr_to_text_arr(tags);
      alter table public.civic_example_templates alter column tags set default '{}'::text[];
    $q$;
  end if;
end
$$;

drop function if exists public._jsonb_arr_to_text_arr(jsonb);

-- Fill nulls before enforcing NOT NULL constraints.
update public.civic_example_templates
set
  status = case
    when coalesce(is_active, true) = false then 'draft'
    when ends_at is not null and ends_at < now() then 'archived'
    when starts_at is not null and starts_at > now() then 'draft'
    else 'published'
  end,
  presentation = coalesce(presentation, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now()),
  target_chambers = coalesce(target_chambers, '{}'::text[]),
  template_asks = coalesce(template_asks, '{}'::text[]),
  related_bills = coalesce(related_bills, '{}'::text[]),
  tags = coalesce(tags, '{}'::text[]),
  display_order = coalesce(display_order, 0);

update public.civic_example_templates
set status = lower(status)
where status <> lower(status);

alter table public.civic_example_templates
  alter column title set not null,
  alter column category set not null,
  alter column summary set not null,
  alter column live_script set not null,
  alter column voicemail_script set not null,
  alter column slug set not null,
  alter column status set default 'draft',
  alter column status set not null,
  alter column display_order set default 0,
  alter column display_order set not null,
  alter column target_chambers set default '{}'::text[],
  alter column target_chambers set not null,
  alter column template_asks set default '{}'::text[],
  alter column template_asks set not null,
  alter column related_bills set default '{}'::text[],
  alter column related_bills set not null,
  alter column tags set default '{}'::text[],
  alter column tags set not null,
  alter column presentation set default '{}'::jsonb,
  alter column presentation set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column primary_ask drop not null;

alter table public.civic_example_templates
  drop constraint if exists civic_example_templates_primary_ask_check,
  drop constraint if exists civic_example_templates_status_check;

alter table public.civic_example_templates
  add constraint civic_example_templates_status_check
  check (status in ('draft', 'published', 'archived'));

create unique index if not exists civic_example_templates_slug_uidx
  on public.civic_example_templates (slug);

create index if not exists civic_example_templates_status_display_idx
  on public.civic_example_templates (status, display_order, updated_at desc);

create or replace function public.set_civic_example_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_civic_example_templates_updated_at on public.civic_example_templates;
create trigger trg_civic_example_templates_updated_at
before update on public.civic_example_templates
for each row
execute function public.set_civic_example_templates_updated_at();

alter table public.civic_example_templates enable row level security;

drop policy if exists civic_example_templates_select_active on public.civic_example_templates;
drop policy if exists civic_example_templates_select_published on public.civic_example_templates;
create policy civic_example_templates_select_published
  on public.civic_example_templates
  for select
  to anon, authenticated
  using (status = 'published');

commit;
