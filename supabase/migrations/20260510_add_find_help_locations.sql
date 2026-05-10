-- Find Help directory storage: SNAP application offices and food assistance locations.
-- Public read-only data sourced from USDA, state agencies, and curated public pantry lists.
-- No PII; no user_id columns. RLS allows anon + authenticated select.

create extension if not exists pgcrypto;

create table if not exists public.find_help_locations (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null,
  name text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text not null,
  zip text,
  latitude double precision,
  longitude double precision,
  phone text,
  email text,
  website_url text,
  hours_json jsonb not null default '{}'::jsonb,
  languages_json jsonb not null default '[]'::jsonb,
  service_types text[] not null,
  notes text,
  source_last_updated_at timestamptz,
  civica_last_synced_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint find_help_locations_state_check check (state ~ '^[A-Z]{2}$'),
  constraint find_help_locations_source_check check (
    source in ('usda', 'state_ma_dta', 'ma_pantries', 'feeding_america', 'two_one_one')
  ),
  constraint find_help_locations_lat_range check (latitude is null or (latitude between -90 and 90)),
  constraint find_help_locations_lng_range check (longitude is null or (longitude between -180 and 180)),
  constraint find_help_locations_service_types_nonempty check (array_length(service_types, 1) >= 1)
);

create unique index if not exists find_help_locations_source_external_idx
  on public.find_help_locations(source, external_id);

create index if not exists find_help_locations_state_active_idx
  on public.find_help_locations(state, active);

create index if not exists find_help_locations_source_idx
  on public.find_help_locations(source);

-- Bounding-box index for haversine RPC (no PostGIS; plain btree on lat/lng range filter).
create index if not exists find_help_locations_latlng_idx
  on public.find_help_locations(latitude, longitude)
  where active = true and latitude is not null and longitude is not null;

create table if not exists public.find_help_sources (
  source text primary key,
  display_name text not null,
  attribution_url text,
  last_synced_at timestamptz,
  last_succeeded_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint find_help_sources_source_check check (
    source in ('usda', 'state_ma_dta', 'ma_pantries', 'feeding_america', 'two_one_one')
  )
);

-- Seed source registry rows so the disclosure UI has stable attribution from day one.
insert into public.find_help_sources (source, display_name, attribution_url)
values
  ('usda', 'USDA SNAP State Directory of Resources', 'https://www.fns.usda.gov/snap/state-directory'),
  ('state_ma_dta', 'Massachusetts Department of Transitional Assistance',
   'https://www.mass.gov/orgs/department-of-transitional-assistance/locations'),
  ('ma_pantries', 'Massachusetts Food Pantry Directory (curated public data)',
   'https://www.gbfb.org/need-food/'),
  ('feeding_america', 'Feeding America Food Bank Network', 'https://www.feedingamerica.org/find-your-local-foodbank'),
  ('two_one_one', '211 Food Assistance Resources', 'https://www.211.org/')
on conflict (source) do nothing;

alter table public.find_help_locations enable row level security;
alter table public.find_help_sources enable row level security;

drop policy if exists find_help_locations_public_select on public.find_help_locations;
create policy find_help_locations_public_select
  on public.find_help_locations
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists find_help_sources_public_select on public.find_help_sources;
create policy find_help_sources_public_select
  on public.find_help_sources
  for select
  to anon, authenticated
  using (true);
