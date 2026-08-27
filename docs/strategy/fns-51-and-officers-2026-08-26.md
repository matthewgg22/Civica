# The full FNS table, and 70 named CRA officers

**2026-08-26.**

## The 51-state table, parsed and validated

Downloaded Cunnyngham, *Reaching Those in Need: Estimates of State SNAP Participation Rates in
2022* (Mathematica for USDA FNS, February 2025) and parsed the eligible-people chart.

**Validated against every figure the project had previously published by hand — 10 of 10:**

| | Published | Parsed |
|---|---:|---:|
| California | ~877,000 | **877,420** |
| Texas | ~1,000,000 | **999,960** |
| Florida | ~556,000 | **556,130** |
| New York | ~230,000 | **230,220** |
| Arizona | ~189,000 | **189,060** |

Total across 51 jurisdictions: **4,703,000**, against the report's national ~4.6M.

**County allocation goes from 874 counties to 2,628.**

## Cook and Philadelphia were never missing data

Illinois, Massachusetts and New Mexico sit at a **capped 100%** participation rate, and
Pennsylvania at 100% as well. The report is explicit that 100% is a *capped estimate*, not
literal full enrollment.

So the em dashes on Cook and Philadelphia were not a hole — **those states have no measurable
gap under federal eligibility rules**, which is a finding. It is also exactly the FNS-divergence
case the codebase already handled: `states.py` has carried `headline_mode: "coverage"` for PA and
NJ since the coverage-mode work. Those counties should be worked on relative coverage with no
absolute claim attached, and the card now says so rather than showing a blank.

## 70 named CRA officers

The Consumer Bankers Association publishes its **Community Reinvestment Committee roster** —
the people who hold the CRA function at member banks, which is precisely the role this outreach
is addressed to. It names 54 officers.

| | Roster (48) | Universe (2,085) |
|---|---:|---:|
| **Named officer** | **18** (was 4) | **70** (was 5) |
| CRA channel | 5 | 5 |
| Role route | 25 | 2,010 |
| No route | 0 | 0 |

Every megabank now has a name: **Kristen Comstock** (JPMorgan Chase), **Alicia Vela** (Bank of
America), **Jada Grandy-Mock** (Wells Fargo), **Anthony Weekly** (Truist), **Danny Spears**
(PNC), **Michael Innis-Thompson** (TD), **Jim Matthews** (Capital One) — and
**Doug Schaeffer** at Woodforest, who chairs the committee.

## Matching is exact, because a wrong name is worse than none

A substring match put **Citizens Financial Group's** head of community development against both
**First-Citizens Bank & Trust** and **Citizens Business Bank** — three unrelated institutions.
The same class of error as the wrong-AA trap, and it would have put a stranger's name on a
letter.

Matching is now an **exact token-set comparison** with generic words and stray initials removed,
so "JPMorgan Chase Bank, N.A." still equals "JPMorgan Chase" while "Citizens" no longer equals
"First-Citizens". **Eight banks whose names are shared by unrelated institutions are held back
entirely** — Five Star, City National, Liberty, United, Northwest, First Financial (twice),
Independent — even though a name is available for each.

## Where the four goals stand

| Goal | Status |
|---|---|
| 1. Institutions + best contact | 2,085 routed · **70 named**, 5 channels, 2,010 role routes |
| 2. Effective unenrolled by district | **2,628 counties**, one method, all 51 states; capped states named as such |
| 3. CRA incentive and context per bank | Done |
| 4. Generatable one-pager | Pro-rata impact, week-by-week schedule, closing report |

## Data

- `data-ops/analysis/national-snap-coverage/fns_state_2022.json` — 51 jurisdictions
- `data-ops/analysis/national-snap-coverage/county_eligible_unenrolled_2026.csv` — 3,222 counties
- `data-ops/analysis/bank-pe-mining/cba_cra_officers_2026.json` — 54 officers
- `data-ops/analysis/cra-universe-2026/universe_first_contact_2026.csv` — 2,085 institutions

Source: [Consumer Bankers Association, Community Reinvestment Committee](https://consumerbankers.com/committee/community-reinvestment-committee/) ·
[Mathematica, Reaching Those in Need 2022](https://www.mathematica.org/publications/reaching-those-in-need-estimates-state-supplemental-nutrition-assistance-program-participation-2022)
