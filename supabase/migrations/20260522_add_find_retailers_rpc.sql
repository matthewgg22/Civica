-- find_retailers_nearby: convenience RPC for the EBT retailer map layer.
--
-- A specialization of find_help_locations_nearby that bakes in
-- service_type = 'ebt_retailer'. Same row shape, same haversine + bbox
-- math (delegated, not duplicated). Gives iOS a single call for the
-- "spend" layer and a clean seam to grow retailer-specific filters
-- (HIP, WIC, accepts-online, hours-open-now) without entangling the
-- generic locations RPC.
--
-- Track 1 / M2. Live retailer rows arrive via the USDA SNAP Retailer
-- Locator sync wired in M1 (apps/enrollment-api/src/lib/usda-retailer-sync.ts).

create or replace function public.find_retailers_nearby(
  lat double precision,
  lng double precision,
  radius_km double precision default 25,
  max_results int default 50
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
  select *
  from public.find_help_locations_nearby(
    lat := lat,
    lng := lng,
    radius_km := radius_km,
    service_type := 'ebt_retailer',
    language_code := null,
    max_results := max_results
  );
$$;

revoke all on function public.find_retailers_nearby(double precision, double precision, double precision, int) from public;
grant execute on function public.find_retailers_nearby(double precision, double precision, double precision, int) to anon, authenticated;
