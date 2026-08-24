# What the county ranking still cannot see

**Written 2026-08-22**, third pass. The California omission and the PA/NJ caution notes were the
first two instances of one failure: **available data not joined.** This records the remaining
instances rather than waiting for a fourth to be discovered.

## 1. A 3,222-county national index exists and the ranking never used it

`data-ops/analysis/national-snap-coverage/national_snap_coverage_county.csv` covers **every county in
the country** — 3,222 rows, `unserved_poor_hh` and `coverage_ratio`. The ranking used 1,064 counties
from 13 states while this sat unjoined.

⚠️ **It is not the same measure.** The national index is poverty-based (1,861,925 unserved poor
households nationally); the state fact bases use the 130% FPL gross-income screen (5.3M households /
13.7M persons). **Do not compare the magnitudes.** The index is the right instrument for answering
*which counties we cannot see*, not for sizing them.

## 2. Eight of the national top 25 are invisible to us

| # | County | Unserved poor HH | Coverage |
|---|---|---|---|
| 9 | **Salt Lake, UT** | 13,437 | 62% |
| 11 | **Franklin, OH** (Columbus) | 13,253 | 82% |
| 13 | **Jackson, MO** (Kansas City) | 11,735 | 73% |
| 16 | **Hennepin, MN** (Minneapolis) | 10,647 | 80% |
| 19 | **Hamilton, OH** (Cincinnati) | 9,888 | 81% |
| 21 | **Utah County, UT** | 9,826 | 45% |
| 22 | **Johnson, KS** | 9,620 | 34% |
| 25 | **Tippecanoe, IN** (Lafayette) | 9,394 | 37% |

## 3. Thirty-nine states have no fact base at all

Largest unserved-poor totals among them: **IN 91,312 · MO 78,904 · GA 64,281 · OH 61,908 ·
KS 57,710 · VA 54,036 · AL 49,707 · NC 47,677 · MN 43,927 · LA 39,947 · MI 39,825 · UT 39,400.**

Notable absences with large metros: Ohio (Columbus, Cincinnati, Cleveland), Michigan (Wayne/Detroit),
Georgia (Fulton/Atlanta), North Carolina (Mecklenburg), Minnesota, Missouri, Virginia, Washington,
Colorado, Nevada (Clark), Louisiana (Orleans), Wisconsin (Milwaukee), Indiana (Marion).

## 4. Massachusetts is *still* missing — the California error, unfixed

`ma-snap-gap/` holds `ma_snap_gap_puma.csv` and a summary, but **no county file**. California was
recoverable because `track1-food-desert/artifacts/county_metrics.csv` existed elsewhere; Massachusetts
has no such fallback, so it remains absent from the county ranking exactly as California was.

This matters more than the raw numbers suggest: **Massachusetts is the mortgage-lender channel's home
state**, where 40 lenders carry a documented Service Test failure and the registration is the one
already being filed.

## 5. The college-county caveat applies to several of the above

Coverage ratios are depressed where students are counted as poor households. In the top 25 that
plausibly affects **Brazos (Texas A&M), Champaign (Illinois), Tippecanoe (Purdue), Alachua (Florida),
Utah County (BYU)** and **Johnson KS**. A low coverage ratio in a university county is not
necessarily unmet need among settled low-income households. The source README flags this; it is
repeated here because these counties rank high precisely because of it.

## What would close each gap

| Gap | Fix | Cost |
|---|---|---|
| MA county ranking | `build_state.py MA` — the builder now works for any state since the gazetteer fix | one command |
| 39 missing states | `build_state.py <ST>` each; needs the ACS PUMS file per state | one command + one download each |
| National index unjoined | Join on FIPS for *ranking*; never mix the magnitudes | small |

**The honest position:** the ranking is sound for the 13 states it covers and silent everywhere else.
It should be described as a 13-state ranking, never a national one.
