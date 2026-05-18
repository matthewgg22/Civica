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

When new launch states join, append their ZIPs to the same file using the
same vintage of HUD's crosswalk to keep the lookup consistent.

## Agency directory

Per-state agency contact data is sourced from each state's official SNAP
agency website + FNS State Directory. CA + MA are fully enumerated; other
states have state-level entries only. Citations live in the per-state JSON
under the `_source` field.
