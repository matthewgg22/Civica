-- RPCs for the Find Help directory map.
-- find_help_locations_nearby: bounding-box + haversine search, no PostGIS dependency.
-- find_help_location_sources: attribution snapshot for the disclosure UI.

create or replace function public.find_help_locations_nearby(
  lat double precision,
  lng double precision,
  radius_km double precision default 25,
  service_type text default null,
  language_code text default null,
  max_results int default 25
)
returns table (
  id uuid,
  external_id text,
  source text,
  name text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  zip text,
  latitude double precision,
  longitude double precision,
  phone text,
  email text,
  website_url text,
  hours_json jsonb,
  languages_json jsonb,
  service_types text[],
  notes text,
  source_last_updated_at timestamptz,
  civica_last_synced_at timestamptz,
  distance_km double precision
)
language sql
security definer
set search_path = public
stable
as $$
  with clamped as (
    select
      greatest(1.0, least(coalesce(radius_km, 25), 100.0))::double precision as r_km,
      greatest(1, least(coalesce(max_results, 25), 100))::int as r_limit
  ),
  bbox as (
    select
      r_km,
      r_limit,
      (r_km / 111.0)::double precision as dlat,
      -- Avoid division-by-zero near the poles; clamp cos(lat) to a small minimum.
      (r_km / (111.0 * greatest(cos(radians(lat)), 0.01)))::double precision as dlng
    from clamped
  )
  select
    l.id,
    l.external_id,
    l.source,
    l.name,
    l.address_line_1,
    l.address_line_2,
    l.city,
    l.state,
    l.zip,
    l.latitude,
    l.longitude,
    l.phone,
    l.email,
    l.website_url,
    l.hours_json,
    l.languages_json,
    l.service_types,
    l.notes,
    l.source_last_updated_at,
    l.civica_last_synced_at,
    -- Haversine: 6371 km earth radius, lat/lng in radians.
    (2 * 6371.0 * asin(sqrt(
      power(sin(radians((l.latitude - lat) / 2)), 2)
      + cos(radians(lat)) * cos(radians(l.latitude))
        * power(sin(radians((l.longitude - lng) / 2)), 2)
    )))::double precision as distance_km
  from public.find_help_locations l
  cross join bbox
  where l.active = true
    and l.latitude is not null
    and l.longitude is not null
    and l.latitude between lat - bbox.dlat and lat + bbox.dlat
    and l.longitude between lng - bbox.dlng and lng + bbox.dlng
    and (service_type is null or service_type = any (l.service_types))
    and (
      language_code is null
      or l.languages_json ? language_code
    )
    and (2 * 6371.0 * asin(sqrt(
      power(sin(radians((l.latitude - lat) / 2)), 2)
      + cos(radians(lat)) * cos(radians(l.latitude))
        * power(sin(radians((l.longitude - lng) / 2)), 2)
    ))) <= bbox.r_km
  order by distance_km asc
  limit (select r_limit from bbox);
$$;

revoke all on function public.find_help_locations_nearby(double precision, double precision, double precision, text, text, int) from public;
grant execute on function public.find_help_locations_nearby(double precision, double precision, double precision, text, text, int) to anon, authenticated;

create or replace function public.find_help_location_sources()
returns table (
  source text,
  display_name text,
  attribution_url text,
  last_synced_at timestamptz,
  last_succeeded_at timestamptz,
  last_error text
)
language sql
security definer
set search_path = public
stable
as $$
  select source, display_name, attribution_url, last_synced_at, last_succeeded_at, last_error
  from public.find_help_sources
  order by display_name;
$$;

revoke all on function public.find_help_location_sources() from public;
grant execute on function public.find_help_location_sources() to anon, authenticated;
