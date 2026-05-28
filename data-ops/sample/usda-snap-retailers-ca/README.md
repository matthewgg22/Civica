# USDA FNS SNAP Retailer Locator — California slice

CA-filtered slice of the USDA Food and Nutrition Service's authorized SNAP/EBT
retailer dataset. Every store in California that can currently accept EBT.

## Files

- `retailers.csv` — 30,357 rows, one per authorized retailer.
- `retailers.geojson` — same data with point geometry (`Point` features, WGS84).
- `manifest.json` — service URL, filter, row count, pull timestamp.

## Source

- **Live service (canonical):** https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0
- **Dataset hub:** https://usda-snap-retailers-usda-fns.hub.arcgis.com/datasets/USDA-FNS::snap-retailer-location-data/
- **ArcGIS item:** https://www.arcgis.com/home/item.html?id=8b260f9a10b0459aa441ad8588c2251c (owner: `FNS_SNAP_RPMD`)
- **Public web app:** https://usda-fns.maps.arcgis.com/apps/webappviewer/index.html?id=15e1c457b56c4a729861d015cd626a23
- **Program page:** https://www.fns.usda.gov/snap/retailer-locator

USDA refreshes the underlying data every **2 weeks** per the ArcGIS item
description. National total at pull time: **255,528** records; CA: **30,357**.

## Pull provenance

- **Pulled:** 2026-05-27 (see `manifest.json` for exact UTC timestamp)
- **Filter:** `State='CA'`
- **Method:** Paged ArcGIS REST query, 1000 records per page, ordered by `ObjectId`.
- **Script:** `tools/usda-retailers/refresh.py` — deterministic, no auth, no API key.
- **Refresh cadence for this vendored copy:** **quarterly** is enough; the offers
  catalog and any density layer are tolerant of 2-week staleness.

To refresh:

```bash
python3 tools/usda-retailers/refresh.py
```

## License

**U.S. federal public domain** (17 U.S.C. § 105). No attribution required, but
cite the USDA FNS source above when published.

## Field dictionary

| Column | Type | Notes |
|---|---|---|
| `Record_ID` | int | USDA-assigned unique retailer ID (stable across refreshes). |
| `Store_Name` | string | Retailer name as registered with USDA FNS. |
| `Store_Street_Address` | string | Street address. |
| `Additonal_Address` | string | Suite/unit/secondary line (note: USDA spelling, sic). |
| `City` | string | |
| `State` | string | Always `CA` in this slice. |
| `Zip_Code` | string | 5-digit ZIP. |
| `Zip4` | string | ZIP+4 suffix where known. |
| `County` | string | Uppercase, no "County" suffix (e.g. `LOS ANGELES`). |
| `Store_Type` | string | One of: `Convenience Store`, `Restaurant Meals Program`, `Other`, `Grocery Store`, `Supermarket`, `Super Store`, `Farmers and Markets`, `Specialty Store`. |
| `Latitude` | float | WGS84. |
| `Longitude` | float | WGS84. |
| `Incentive_Program` | string | E.g. SNAP Healthy Incentive participation flag. |
| `Grantee_Name` | string | Incentive program grantee (mostly blank). |
| `ObjectId` | int | ArcGIS-assigned row ID (NOT stable across refreshes — use `Record_ID`). |

## Snapshot stats (2026-05-27)

**By store type:**

| Type | Count |
|---|---:|
| Convenience Store | 11,934 |
| Restaurant Meals Program | 6,305 |
| Other | 3,008 |
| Grocery Store | 2,941 |
| Supermarket | 2,506 |
| Super Store | 2,379 |
| Farmers and Markets | 659 |
| Specialty Store | 625 |

**Top 10 counties:** Los Angeles (8,192), San Diego (2,286), Orange (2,087),
San Bernardino (1,984), Riverside (1,823), Sacramento (1,310), Alameda (1,057),
Fresno (1,000), Santa Clara (919), Kern (918).

**Major-chain spot checks:** Safeway 251 · Ralphs 177 · Trader Joe's 206 ·
Smart & Final 239. (Names are stored as USDA registers them; ampersand variants
like `SMART AND FINAL` don't appear — always match on `&`.)

## Downstream consumers (intent only — not yet implemented)

- **Offer platform** ([offer-platform PR #272](../../../docs/)): join authorized
  retailers against the offer catalog to validate redemption locations before
  surfacing offers to users.
- **Demo Track 1 — Map + USDA + heatmap:** retailer density layer for the food
  access / heatmap visualization in the four-feature demo track.
- **Distribution strategy:** geographic cross with UFW agricultural and SEIU
  homecare worker counties for channel-partner targeting.
- **Caseworker mode:** "find an authorized retailer near client" CBO utility.

## Known limitations

- USDA refreshes every 2 weeks; this vendored slice is a point-in-time copy.
  Re-pull before any production go-live.
- `Store_Name` has no chain normalization. A single chain may appear under
  several spellings (corporate vs. franchisee filings). Don't expect to count
  "Walmart locations" with a single substring match.
- `Additonal_Address` is misspelled in the upstream schema; preserved verbatim.
- `Restaurant Meals Program` rows only exist in states with active RMP waivers
  (CA is one). Filter on `Store_Type != 'Restaurant Meals Program'` if you only
  want grocery-class retailers.
