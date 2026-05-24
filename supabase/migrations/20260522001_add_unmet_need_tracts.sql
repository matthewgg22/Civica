-- Census-tract level unmet-need overlay for the SNAP enrollment heatmap.
--
-- Track 1 / M4. The B2G "outreach intelligence" dashboard reads this table
-- to render a heatmap of CalFresh-eligible-but-not-enrolled population by
-- tract — the headline visual in a county procurement pitch.
--
-- Designed to be safe with PUBLIC data sources only (ACS 5-year estimates
-- of eligible households + USDA modeled enrollment) AND with a private
-- CDSS / county feed if a data-sharing agreement lands later. The trigger
-- prefers the private number when present, so the schema is forward-
-- compatible without touching call sites.
--
-- Data ingest is intentionally NOT in this migration. The table arrives
-- empty; an out-of-band populate step (ACS API ingest or hand-seeded demo
-- tracts) fills it. The iOS heatmap layer must handle an empty response
-- gracefully (no overlay, not an error).

create table if not exists public.unmet_need_tracts (
  tract_geoid text primary key,                    -- 11-char US Census tract GEOID
  state_code text not null,                        -- USPS two-letter state code
  county_name text,                                -- e.g. "Los Angeles County"
  polygon_geojson jsonb not null,                  -- GeoJSON Polygon for rendering
  -- Pre-computed bbox so range queries don't have to parse polygon_geojson.
  -- Populated by the ingest job from the polygon's coordinate envelope.
  bbox_min_lat double precision not null,
  bbox_min_lng double precision not null,
  bbox_max_lat double precision not null,
  bbox_max_lng double precision not null,
  -- Public-source counts: ACS 5-year estimate of CalFresh-eligible
  -- households (acs_eligible_estimate) and USDA / state-published estimate
  -- of currently enrolled (public_enrolled_estimate).
  acs_eligible_estimate integer,
  public_enrolled_estimate integer,
  -- Private-source count: populated only when a CDSS / county data-sharing
  -- agreement lands. Null otherwise. The trigger below prefers this number
  -- over public_enrolled_estimate when computing unmet_need_pct so the
  -- private feed becomes a drop-in upgrade with no schema change.
  private_enrollment_count integer,
  -- Materialized fraction (0.0 – 1.0). Computed by the trigger.
  unmet_need_pct double precision,
  last_computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unmet_need_tracts_state_check check (state_code ~ '^[A-Z]{2}$'),
  constraint unmet_need_tracts_bbox_check check (
    bbox_min_lat between -90 and 90
    and bbox_max_lat between -90 and 90
    and bbox_min_lng between -180 and 180
    and bbox_max_lng between -180 and 180
    and bbox_min_lat <= bbox_max_lat
    and bbox_min_lng <= bbox_max_lng
  ),
  constraint unmet_need_tracts_pct_range check (
    unmet_need_pct is null or unmet_need_pct between 0 and 1
  ),
  constraint unmet_need_tracts_eligible_nonneg check (
    acs_eligible_estimate is null or acs_eligible_estimate >= 0
  ),
  constraint unmet_need_tracts_public_enrolled_nonneg check (
    public_enrolled_estimate is null or public_enrolled_estimate >= 0
  ),
  constraint unmet_need_tracts_private_count_nonneg check (
    private_enrollment_count is null or private_enrollment_count >= 0
  )
);

create index if not exists unmet_need_tracts_state_idx
  on public.unmet_need_tracts(state_code);

-- Bbox range index. The RPC bounds-checks both extents, so an index on
-- (state, max_lat, min_lat, max_lng, min_lng) lets the planner narrow
-- quickly within a state then bound-filter inside it.
create index if not exists unmet_need_tracts_bbox_idx
  on public.unmet_need_tracts(state_code, bbox_max_lat, bbox_min_lat, bbox_max_lng, bbox_min_lng);

-- Recompute unmet_need_pct on insert / update. Prefer the private number
-- when present so a CDSS data-sharing rollout is a value-only update with
-- no API churn.
create or replace function public.compute_unmet_need_pct()
returns trigger
language plpgsql
as $$
declare
  enrolled integer;
begin
  enrolled := coalesce(NEW.private_enrollment_count, NEW.public_enrolled_estimate);
  if NEW.acs_eligible_estimate is null
     or NEW.acs_eligible_estimate <= 0
     or enrolled is null
  then
    NEW.unmet_need_pct := null;
  else
    -- Clamp to [0, 1] so a noisy private count above the public eligible
    -- estimate can't push the fraction negative or above 1.
    NEW.unmet_need_pct := greatest(0::double precision, least(1::double precision,
      (NEW.acs_eligible_estimate::double precision - enrolled::double precision)
      / NEW.acs_eligible_estimate::double precision
    ));
  end if;
  NEW.last_computed_at := now();
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists unmet_need_tracts_compute_pct on public.unmet_need_tracts;
create trigger unmet_need_tracts_compute_pct
  before insert or update of acs_eligible_estimate, public_enrolled_estimate, private_enrollment_count
  on public.unmet_need_tracts
  for each row execute function public.compute_unmet_need_pct();

-- RLS: read open to anon + authenticated. The underlying numbers are
-- derived from public ACS / USDA datasets; the iOS app gates the visual
-- overlay behind a navigator role claim so applicants don't see the B2G
-- view by default. If the private CDSS feed later lands we may tighten
-- this to authenticated-only.
alter table public.unmet_need_tracts enable row level security;

drop policy if exists "unmet_need_tracts_anon_read" on public.unmet_need_tracts;
create policy "unmet_need_tracts_anon_read"
  on public.unmet_need_tracts for select
  to anon, authenticated
  using (true);

-- unmet_need_for_bbox: return tracts that intersect a bounding box, for
-- the iOS heatmap overlay. Only display-relevant columns are returned;
-- the private vs public enrollment source is collapsed into a single
-- `enrolled_estimate` field so call sites don't have to know which feed
-- backed the number.
create or replace function public.unmet_need_for_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  state_filter text default null,
  max_results int default 200
)
returns table (
  tract_geoid text,
  state_code text,
  county_name text,
  polygon_geojson jsonb,
  unmet_need_pct double precision,
  acs_eligible_estimate integer,
  enrolled_estimate integer,
  last_computed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with clamped as (
    select greatest(1, least(coalesce(max_results, 200), 500))::int as r_limit
  )
  select
    t.tract_geoid,
    t.state_code,
    t.county_name,
    t.polygon_geojson,
    t.unmet_need_pct,
    t.acs_eligible_estimate,
    coalesce(t.private_enrollment_count, t.public_enrolled_estimate) as enrolled_estimate,
    t.last_computed_at
  from public.unmet_need_tracts t
  cross join clamped
  where t.bbox_max_lat >= min_lat
    and t.bbox_min_lat <= max_lat
    and t.bbox_max_lng >= min_lng
    and t.bbox_min_lng <= max_lng
    and (state_filter is null or t.state_code = upper(state_filter))
    and t.unmet_need_pct is not null
  order by t.unmet_need_pct desc nulls last
  limit (select r_limit from clamped);
$$;

revoke all on function public.unmet_need_for_bbox(
  double precision, double precision, double precision, double precision, text, int
) from public;
grant execute on function public.unmet_need_for_bbox(
  double precision, double precision, double precision, double precision, text, int
) to anon, authenticated;
