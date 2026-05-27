# data-ops/reference/

Geographic crosswalks + boundary files vendored for analysis use. Public domain.

## Files

### `2020_tract_to_puma.txt`
Census Bureau 2020 tract→PUMA relationship file. CSV: STATEFP, COUNTYFP, TRACTCE, PUMA5CE.
- Source: <https://www2.census.gov/geo/docs/maps-data/data/rel2020/2020_Census_Tract_to_2020_PUMA.txt>
- Pulled: 2026-05-27
- Use: aggregate PUMA-level data to county grain by counting tracts per (PUMA, county)
  overlap (rough proxy for population share when tract populations aren't available).

### `ca_counties.geojson`
California county boundaries (MultiPolygon per county, keyed by `name`).
- Source: <https://github.com/codeforgermany/click_that_hood> (`california-counties.geojson`)
- License: per upstream repo — Code for Germany / public-good geo data; redistribute with attribution.
- Pulled: 2026-05-27
- Use: county choropleths in Folium / matplotlib.
