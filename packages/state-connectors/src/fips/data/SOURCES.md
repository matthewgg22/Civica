# Data sources

## zip-to-county.json

ZIP → county FIPS crosswalk for the package's currently-supported launch
states (CA + MA). Derived from the **HUD–USPS ZIP Code Crosswalk Files**
(Q4 2024 vintage), `ZIP_COUNTY` table, filtered to ZIPs whose dominant
county (`RES_RATIO` column) falls in CA (state FIPS `06`) or MA (state
FIPS `25`).

Source: <https://www.huduser.gov/portal/datasets/usps_crosswalk.html>
License: U.S. Government work, public domain.

The crosswalk picks one county per ZIP — the residentially-dominant one.
For ZIPs that cross county lines this is a best-effort guess; the
authoritative path is `fips.fromAddress()`, which calls the Census
geocoder and resolves the actual parcel.

### Coverage model

Two modes coexist for the same file:

1. **Anchor mode (default, shipped in repo)** — one curated ZIP per county,
   typically the county seat or largest city. Covers every CA + MA county at
   least once (58 + 14 = 72 counties → ~80 ZIP entries). For any other ZIP
   in a covered county, the fast path returns `undefined` and the caller
   falls back to `fips.fromAddress()`. Good enough for tests, navigator
   dashboards, and dev workflows; intentionally light on bytes.

2. **Full mode (regenerated via the seed script)** — every CA + MA ZIP from
   the HUD crosswalk, ~3.5k entries. Replace the file by running:

   ```bash
   pnpm --filter @civica/state-connectors regenerate:zip-to-county -- \
     --input ./tmp/ZIP_COUNTY_122024.csv \
     --output src/fips/data/zip-to-county.json
   ```

   The script accepts the HUD CSV directly (no preprocessing), filters by
   state FIPS, picks the dominant county per ZIP (max `RES_RATIO`),
   and preserves the `_meta` block. Re-run quarterly against each new
   HUD vintage to refresh.

When new launch states join, pass their state FIPS code via the script's
`--states` flag (e.g. `--states=06,25,36` adds New York) and re-run. The
output JSON keeps the file shape stable so the resolver and tests don't
need to change.

## Agency directory

Per-state agency contact data is sourced from each state's official SNAP
agency website + FNS State Directory. CA + MA are fully enumerated; other
states have state-level entries only. Citations live in the per-state JSON
under the `_source` field.
