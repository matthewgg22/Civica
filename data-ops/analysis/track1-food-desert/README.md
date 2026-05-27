# Track 1 — Food-access × PER (static artifact)

First demo artifact for the **Map + USDA + heatmap** track (decided 2026-05-22). Static,
committed visuals — no UI integration, no DB writes.

## What this is

A cross-join of three public datasets that gives the pitch its load-bearing line:

> **High Payment Error Rate × low retailer density = food access story.**

Statewide CA PER is **10.98%** (FY2024 USDA: 7.58 over / 3.40 under). The hexbin map
shows where SNAP-authorized retailers actually exist — 30,357 stores, dominated by Los
Angeles (8,192 stores, 23.4% grocery) and tailing off into single-digit-store counties
(Sierra, Mono, Mariposa). The SNAP-gap summary anchors the demand side: ~4.66M
estimated eligible Californians across 281 PUMAs, median 63.7% non-enrollment.

## Inputs

| Dataset | Grain | Vintage | Notes |
|---|---|---|---|
| `usda-snap-retailers-ca/retailers.csv` | store-level lat/lon | 2026-05-27 pull | 30,357 CA stores from FNS SNAP Retailer Locator (public domain) |
| `per/2024_payment_error_rates.csv` | **state-level only** | FY2024 USDA | CA = 10.98%; FNS does not publish county-level PER |
| `ca-snap-gap/ca_snap_gap_puma.csv` | PUMA-level | ACS 2023 1-Year PUMS | CV AUC 0.80; non-enrollment rate proxy |

## Outputs (`./artifacts/`)

- **`food_access_hexbin.png`** — headline visual. Log-binned retailer density across CA. Dim hexes = food-access stress.
- **`food_access_scatter.png`** — same stores colored by top-6 `Store_Type` (Convenience dominates volume; grocery clusters in metros).
- **`county_food_access.png`** — top 15 (LA → SF) and bottom 15 (≥20 stores) counties, split by grocery vs convenience. Carries the FY2024 CA PER annotation.
- **`snap_gap_summary.png`** — PUMA non-enrollment distribution; pairs the supply (retailers) story with the demand-side gap.
- **`retailers_by_county.csv`** — 57-row per-county aggregation (total / grocery / non-grocery / grocery_share). Drop-in for further analysis.
- **`summary.json`** — top-line numbers for slides.
- **`interactive_map.html`** — self-contained Folium map (~5 MB). Three toggleable layers: all-retailers heatmap, grocery-only heatmap, sampled marker cluster colored by `Store_Type`. The load-bearing interaction is the all-vs-grocery toggle: dense urban hexes collapse when convenience stores are removed, making the food-desert geography visible. Built by `build_interactive.py`.

## What's load-bearing for the pitch

1. **The 4.66M eligible / 63.7% median non-enrollment number** establishes the gap.
2. **Grocery share by county** (`grocery_share` column) is the food-desert proxy: counties
   under ~0.20 are convenience-store-dominated. SAN BERNARDINO at 0.185 is the clearest
   example of a populous county with weak grocery access.
3. **CA's 10.98% PER, with overpayment 2.2× underpayment**, is the QC pillar — frame
   error reduction as a *retailer-ecosystem-aware* problem, not just a casework problem.

## Honest caveats

- **PER is state-level only.** FNS does not publish county-level error rates. Anyone
  drawing a county-PER choropleth is fabricating data. The pitch uses statewide PER as
  the headline number and county-level retailer/grocery mix as the spatial story.
- **USDA 2016 category spend** (`data-ops/sample/usda-snap-2016/`) is national-only and
  intentionally **not** joined here. Use it for partner-pitch annotation
  ("SNAP households spend X% on Y") — never per-county.
- PUMAs cross county lines. The SNAP-gap chart is at PUMA grain on purpose; PUMA→county
  rollup needs a crosswalk we haven't vendored yet.

## Where to take it next

1. ~~Interactive layer~~ — shipped as `artifacts/interactive_map.html` (Folium, self-contained). Next: add PUMA non-enrollment polygon overlay once the crosswalk lands.
2. **PUMA → county crosswalk**: vendor the Census 2020 PUMA-to-county relationship file
   into `data-ops/reference/`, then aggregate `ca_snap_gap_puma.csv` to county grain. Unlocks a true two-axis county choropleth (gap × grocery share).
3. **Mobility / drive-time**: layer `nearest_grocery_distance_km` per census tract using
   the retailer geojson — that's the "food desert" claim made rigorous.
4. **Partner-pitch annotation**: pull subcommodity spend from `usda-snap-2016` to label
   the top retailer categories with national SNAP spend share (mojibake quirks documented
   in that dir's README).

## Reproduce

```
tools/ca-snap-gap/.venv/bin/python data-ops/analysis/track1-food-desert/build.py
tools/ca-snap-gap/.venv/bin/python data-ops/analysis/track1-food-desert/build_interactive.py
```

(Uses the existing `ca-snap-gap` venv. `matplotlib` and `folium` were added on
top of its `requirements.txt`; if rebuilding, `pip install matplotlib folium pandas numpy`.)
