# USDA FNS SNAP Retailer Locator — Massachusetts slice

MA-filtered slice of the USDA Food and Nutrition Service's authorized SNAP/EBT
retailer dataset. Every store in Massachusetts that can currently accept EBT.

Sibling of [`../usda-snap-retailers-ca/`](../usda-snap-retailers-ca/) — built by
the same puller and intended for the MA-pilot rollout planned for June 2026
(see `docs/designs/cbo-caseworker-mode.md`, MA-first Project Bread track).

## Files

- `retailers.csv` — 5,321 rows, one per authorized retailer.
- `retailers.geojson` — same data with point geometry (`Point` features, WGS84).
- `manifest.json` — service URL, filter, row count, pull timestamp.

## Source

- **Live service (canonical):** https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0
- **Dataset hub:** https://usda-snap-retailers-usda-fns.hub.arcgis.com/datasets/USDA-FNS::snap-retailer-location-data/
- **ArcGIS item:** https://www.arcgis.com/home/item.html?id=8b260f9a10b0459aa441ad8588c2251c (owner: `FNS_SNAP_RPMD`)
- **Program page:** https://www.fns.usda.gov/snap/retailer-locator

USDA refreshes the underlying data every **2 weeks** per the ArcGIS item
description. National total at pull time: ~255K records; **MA: 5,321** (≈ 1/6th
of CA's 30,357).

## Pull provenance

- **Pulled:** 2026-06-01 (see `manifest.json` for exact UTC timestamp)
- **Filter:** `State='MA'`
- **Method:** Paged ArcGIS REST query, 1000 records per page, ordered by `ObjectId`.
- **Script:** `tools/usda-retailers/refresh.py MA` — deterministic, no auth, no API key.
- **Refresh cadence for this vendored copy:** **quarterly** is enough; the offers
  catalog and any density layer are tolerant of 2-week staleness.

To refresh:

```bash
python3 tools/usda-retailers/refresh.py MA
```

## License

**U.S. federal public domain** (17 U.S.C. § 105). No attribution required, but
cite the USDA FNS source above when published.

## Field dictionary

Identical to the CA slice — see [`../usda-snap-retailers-ca/README.md`](../usda-snap-retailers-ca/README.md#field-dictionary).
All `State` values are `MA` in this slice.

## MA-specific notes

### `Incentive_Program` is empty for every MA row

In this pull, **0 of 5,321 MA records carry a non-empty `Incentive_Program`
value**. HIP (Healthy Incentives Program) retailer participation is *not*
surfaced through this USDA dataset. The HIP retailer list is maintained
separately by Massachusetts DTA at https://www.mass.gov/info-details/find-hip-retailers
and must be joined in if HIP coverage matters for a downstream consumer (offers
catalog HIP-flagging, Find-Help HIP filter, etc.).

Do **not** use this file alone to claim HIP coverage. If you need HIP, ingest
the DTA list separately and join on store name + address.

### Store type breakdown

| Store_Type | Count | Share |
|---|---:|---:|
| Convenience Store | 2,374 | 44.6% |
| Other | 990 | 18.6% |
| Grocery Store | 662 | 12.4% |
| Farmers and Markets | 477 | 9.0% |
| Super Store | 399 | 7.5% |
| Supermarket | 342 | 6.4% |
| Specialty Store | 63 | 1.2% |
| Restaurant Meals Program | 14 | 0.3% |
| **Total** | **5,321** | 100% |

The 14 Restaurant Meals Program entries are notable — MA operates a small RMP
footprint (relative to CA's), but it exists; surface accordingly in
`SNAPAgencyDirectory` MA copy.

### Top counties by retailer count

| County | Retailers |
|---|---:|
| MIDDLESEX | 933 |
| WORCESTER | 701 |
| SUFFOLK | 681 |
| ESSEX | 571 |
| BRISTOL | 542 |
| HAMPDEN | 529 |
| NORFOLK | 420 |
| PLYMOUTH | 353 |
| BARNSTABLE | 201 |
| HAMPSHIRE | 150 |

Project Bread's primary catchment overlaps SUFFOLK / MIDDLESEX / NORFOLK
(Greater Boston) and HAMPDEN (Springfield) — covered by the top 6 counties,
together representing 3,856 / 5,321 = **72%** of MA EBT retailers.

## Cross-references

- CA sibling slice — [`../usda-snap-retailers-ca/`](../usda-snap-retailers-ca/)
- Find-Help iOS seed fixtures — [`Civica/Features/SNAP/FindHelp/Fixtures/ma_retailers.json`](../../../Civica/Features/SNAP/FindHelp/Fixtures/ma_retailers.json)
- Auto-memory: [`reference_usda_snap_retailer_locator`](../../../../.claude/projects/-Users-matthewgreer-gentis-Developer-Civica/memory/reference_usda_snap_retailer_locator.md)
