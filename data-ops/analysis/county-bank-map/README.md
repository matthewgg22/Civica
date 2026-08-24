# County → bank target map

**Built 2026-08-22.** Ranks counties by unmet SNAP need, then maps every bank target we have
evidence on to the counties it covers, with a willingness tier and an evidence-anchored ask.

## The ranking criteria, and why

**Primary: absolute eligible-unenrolled households.** Campaign scale, and the number a bank's
performance-context narrative can use. Households not persons, so states are comparable.

**Secondary: non-enrollment rate.** How badly served the county is. A high rate on a small base is a
responsiveness story; a high rate on a large base is both.

**Third, and the one that decides action: fundable bank presence.** A county with no
CRA-pressured bank is unreachable through this channel no matter how large the gap. `pool_potential`
sums the Tier A and B asks in that county — what a pooled county programme could raise today.

## Willingness tiers — evidence, not guesswork

| Tier | Meaning |
|---|---|
| **A** | Current NTI/SNC, **or** a component test at Needs to Improve / Low Satisfactory — a documented gap in the test a grant counts under |
| **B** | Satisfactory with no standout weakness; exam timing, consent order or disclosed giving capacity carries the case |
| **C** | Outstanding on a material test — deprioritise; a grant fixes nothing they need fixed |

## Caveats that matter

- **Assessment areas are PE-verified for the eight Band A banks only.** Every other row is
  HQ-inferred and marked as such — an HQ county is a bank's primary market, **not** its assessment
  area. Read the PE before treating any inferred row as a target.
- **California and Massachusetts counties are absent from the ranking.** Their fact bases are
  PUMA-level (CA additionally modeled) with a different schema, so they are not comparable in a
  county table. CA figures live in `ca-snap-gap`, MA in `ma-snap-gap`.
- 12 states, 1,006 counties, 5,304,426 eligible-unenrolled households covered.
- 2023 ACS 1-Year PUMS, 130% gross-income screen — an upper-range estimate of unmet need.

## county_need_persons_2026.csv — CORRECTION, supersedes the household ranking for prioritisation

The household ranking excluded California entirely, because CA's fact base carries
`eligible_pop` and `non_enroll_rate` but **not** household columns. That was a schema mismatch, not
a finding — and it hid the largest opportunity in the dataset.

Ranked in **persons**, which all 13 states carry: **Los Angeles is #1 at 796,577 eligible-unenrolled
persons**, 60% larger than Harris TX (497,207). California holds **five of the top twenty** — LA #1,
San Diego #7, Orange #8, Riverside #11, San Bernardino #12 — and 2,825,452 unenrolled persons in
total, 21% of the 13,686,208 across all covered states.

⚠️ **Methodology differs and the column says so.** California is `MODELED` (gradient-boosted
classifier over ACS PUMS, PUMA-level, allocated to counties); the other twelve states are
`survey-weighted` direct estimates. They are ranked together because persons is the only common
unit, but a bank scrutinising the CA figure is scrutinising a model output. Say "footprint-level",
never "tract-level".

Use **persons** for prioritisation across states, and **households** (the other file) for campaign
sizing within a state, since the funnel is household-based.


## 2026-08-22 rebuild — 26 states

Thirteen states built (`build_state.py MA IN MO GA OH KS VA AL NC MN LA MI UT`), taking the ranking
from 13 states / 1,064 counties to **26 states / 2,200 counties / 20,536,151 unenrolled persons**.
The new states are **33% of the total**.

Two broke straight into the top 20 — **Wayne MI (Detroit) #16 at 133,605** and **Franklin OH
(Columbus) #20 at 110,505** — and eleven more land in the top 62: Marion IN, Gwinnett GA, Salt Lake
UT, Cuyahoga OH, Hennepin MN, Mecklenburg NC, St. Louis MO, Fulton GA, Middlesex MA, Oakland MI,
Hamilton OH, DeKalb GA, Utah UT.

**Massachusetts is finally in the ranking** — 14 counties, 302,859 unenrolled, led by Middlesex
(64,622), Suffolk (38,578) and Essex (37,939). It had been invisible for the same reason California
was: no county file existed.

Still absent: 24 states and the territories. The ranking is a **26-state ranking** and must be
described as one.

## 2026-08-22 completion — 50 of 51 jurisdictions

All remaining states built. **3,135 counties across 50 jurisdictions, 24,385,681 eligible-unenrolled
persons.** The ranking is now national in fact, not just in framing.

New entrants near the top: **Clark NV #15 (165,838)** — higher than Wayne MI — **King WA #28
(100,101)**, Prince George's MD #44, Oklahoma OK #48, Honolulu HI #54, Milwaukee WI #59.

**Alaska and Hawaii required a builder change.** They were absent from `STATE_FIPS` entirely and the
docstring said "contiguous-48 + DC only", because they use different HHS poverty guidelines — an
Alaska one-person household is $18,210 against $14,580 in the lower 48. Using the contiguous table
would have understated their eligible populations badly. Both tables are now in `build_state.py`
and selected by postal code.

### ⚠️ Connecticut is the one gap, and it is structural

CT replaced counties with **nine Planning Regions** for Census purposes effective 2022 — the
gazetteer lists Capitol Planning Region, Greater Bridgeport Planning Region and so on, with GEOIDs
like 09110. The PUMA→county crosswalk and county-name lookup both assume counties, so Connecticut
needs its own handling rather than a rerun. Its 2023 PUMS download was also intermittently returning
HTML.

Connecticut matters modestly for this channel — it has a state CRA covering banks and credit unions
(not mortgage lenders), and CT/RI are the two states applying CRA only to credit unions with a
geographic field of membership.
