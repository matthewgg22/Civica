# MA SNAP-Gap — per-PUMA estimates

PUMA-level estimates of MA's **SNAP-eligible non-enrollee** population: among
households whose gross income makes them eligible for SNAP, how many
do *not* report SNAP receipt — both at the federal 130% FPL gross-income
test and the BBCE 200% FPL threshold MA + CA both operate.

This is the **fact base** (weighted counts) version of the analysis. A
predictive model (45-feature HistGradientBoosting) layered on top — analogous
to the CA build's `ca-snap-gap-v0.1.0` — is the natural follow-up; this
artifact gates on it being unnecessary for the Project Bread pitch (the
weighted counts ARE the pitch).

## Files

| File | Description |
| --- | --- |
| `ma_snap_gap_puma.csv` | One row per MA PUMA (54 rows). Schema below. |
| `ma_snap_gap_summary.json` | State totals + Project Bread catchment overlay (6 counties). |
| `model_card.json` | Sample counts, methodology, caveats. |

## Headline numbers

| | 130% FPL (federal gross-income test) | 200% FPL (BBCE — MA/CA realistic) |
|---|---:|---:|
| MA eligible HHs (weighted) | 374,453 | 586,918 |
| MA eligible non-enrollees | **174,358** | **308,680** |
| MA non-enrollment rate | 46.6% | 52.6% |
| **Project Bread catchment** (6 counties) | **125,386** non-enrollees | **219,160** non-enrollees |
| Catchment share of state gap | **71.9%** | **71.0%** |

**Cross-validation:** the catchment's 72% share of the state gap exactly
matches the catchment's 72% share of MA SNAP-EBT retailers (per the 2026-06-01
USDA pull at `../usda-snap-retailers-ma/`). The two independent geographies
align — Project Bread serves where the gap actually is.

## Per-county breakdown (Project Bread catchment)

Sorted by absolute eligible non-enrollee count at 200% FPL.

| County | PUMAs | Eligible (200%) | Non-enrolled | Rate (200%) |
|---|---:|---:|---:|---:|
| **Middlesex** | 13 | 93,797 | **59,514** | **63.4%** |
| Suffolk | 6 | 87,695 | 41,411 | 47.2% |
| Essex | 6 | 70,968 | 35,919 | 50.6% |
| Worcester | 7 | 68,295 | 32,433 | 47.5% |
| Norfolk | 6 | 47,315 | 27,556 | 58.2% |
| Hampden | 3 | 58,496 | 22,327 | 38.2% |

**Surprise:** Middlesex has both the largest absolute gap AND the highest
non-enrollment rate in the catchment (63.4% — meaning 63% of SNAP-eligible
Middlesex households are not enrolled). This contradicts the intuition that
Boston/Suffolk has the biggest opportunity — Middlesex (Cambridge, Lowell,
Newton, Somerville, Framingham) is materially larger.

Hampden's lower non-enrollment rate (38.2%) reflects Springfield's higher
historical SNAP participation among eligibles — there's still substantial
absolute gap (22K households) but the per-eligible coverage is better.

## Methodology

1. **Data:** 2023 ACS 1-Year PUMS, Massachusetts (FIPS 25). 35,600 raw
   household rows; 30,460 occupied housing units (excludes vacant +
   group quarters).
2. **Income:** annual gross household income = `HINCP × ADJINC / 1,000,000`
   (PUMS convention to inflate to survey-year dollars).
3. **FPL basis:** 2023 HHS Poverty Guidelines, 48 contiguous states + DC,
   by household size (`NP`).
4. **Eligibility filter:**
   - **130% FPL** — the SNAP gross-income test per 7 CFR §273.9(a)(1).
     This is the federal-baseline number — the state-agnostic "who is
     eligible" denominator.
   - **200% FPL** — the BBCE-expanded threshold MA + CA both operate.
     This is the realistic "who could Civica's intake actually serve"
     denominator.
5. **SNAP receipt:** PUMS `FS` column. `FS == 1` → HH reports SNAP/Food
   Stamps received in the past 12 months. `FS == 2` → did not.
6. **Weighted aggregation:** per-PUMA sums use `WGTP` (household weight).
7. **PUMA → county:** dominant-county assignment from Census's official
   2020 tract-to-PUMA crosswalk (verified for all 14 MA counties).
   Project Bread catchment = Suffolk + Middlesex + Norfolk + Essex +
   Worcester + Hampden (the 6 counties with 72% of MA SNAP-EBT retailers).

## Schema (`ma_snap_gap_puma.csv`)

| Column | Description |
| --- | --- |
| `puma_code` | 7-char: state FIPS "25" + 5-digit PUMA. |
| `puma_5` | 5-digit PUMA code. |
| `state_fips` | Always "25". |
| `primary_county_fips` | Dominant county (FIPS 25xxx). |
| `county_label` | Human-readable county name. |
| `project_bread_catchment` | True for Suffolk/Middlesex/Norfolk/Essex/Worcester/Hampden. |
| `n_sample_hh` | Unweighted PUMS sample HH count. |
| `weighted_hh` | Weighted population HH count. |
| `eligible_130_weighted` | HHs with income ≤ 130% FPL (weighted). |
| `eligible_130_with_snap_weighted` | …of those, FS==1 (receiving SNAP). |
| `eligible_130_without_snap_weighted` | …of those, FS==2 (THE SNAP-GAP). |
| `non_enrollment_rate_130` | gap / eligible at 130%. |
| `eligible_200_weighted` etc. | Same set at the BBCE 200% threshold. |

## Caveats

- **No asset test applied.** PUMS doesn't measure assets; eligible-by-income
  is a superset of truly-eligible since some HHs would fail the SNAP asset
  test (7 CFR §273.8). MA + CA's BBCE waives the asset test for most HHs,
  so the 200% basis is closer to "really eligible."
- **Self-reported SNAP receipt.** PUMS `FS` is what the respondent says.
  Known to under-count actual receipt vs admin records — meaning the gap
  counts here are an **upper bound** on the truly-unserved.
- **PUMA-to-county assignment uses dominant county.** PUMAs are designed
  to nest within counties where possible but some span boundaries. Edge
  cases are assigned to the modal county.
- **No predictive model.** Per-PUMA estimates are weighted counts from
  the sampled HHs — no ML overlay (the CA equivalent adds a 45-feature
  HistGradientBoosting classifier; that's a natural follow-up, not a
  blocker for the headline numbers).
- **Single-year vintage** (2023 ACS). 2024 PUMS releases September 2025;
  rerun then for the post-OBBBA snapshot.

## How to reproduce

```bash
cd tools/ma-snap-gap
python3 -m venv .venv
.venv/bin/pip install pandas
.venv/bin/python build.py
```

Inputs (already vendored under `tools/ma-snap-gap/data/`):
- `csv_hma.zip` — 2023 ACS 1-Year PUMS, MA household file (5.3 MB).
- `csv_pma.zip` — MA person file (12 MB, not used by this build).

## Cross-references

- CA sibling — [`../ca-snap-gap/`](../ca-snap-gap/)
- MA QC element mix — [`../usda-qc-ma/`](../usda-qc-ma/)
- MA SNAP retailer footprint (catchment validation) — [`../usda-snap-retailers-ma/`](../usda-snap-retailers-ma/)
- Pilot finding — [`../../../docs/findings/2026-06-01-ma-pilot-snap-gap.md`](../../../docs/findings/2026-06-01-ma-pilot-snap-gap.md)
- Caseworker mode MA-first design — [`../../../docs/designs/cbo-caseworker-mode.md`](../../../docs/designs/cbo-caseworker-mode.md)

## Two MA fact bases live here — do not confuse them

- `ma_snap_gap_puma.csv` / `ma_snap_gap_summary.json` / `model_card.json` — the **Project Bread**
  build (`tools/ma-snap-gap/build.py`), carrying the `project_bread_catchment` column. Cited by
  `docs/findings/2026-06-01-ma-pilot-snap-gap.md`. **Left untouched.**
- `ma_county_metrics.csv` plus the `*_statewide` files — the **generic** build
  (`tools/snap-gap-states/build_state.py`, 2026-08-22), matching the schema every other state uses.
  This is what the county ranking joins on; Massachusetts was previously invisible to it because no
  county file existed.

Both use 2023 ACS 1-Year PUMS and the 130% FPL gross-income screen. They agree on the statewide
non-enrollment rate (0.466).
