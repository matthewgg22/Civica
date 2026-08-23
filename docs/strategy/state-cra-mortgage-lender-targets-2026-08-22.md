# Mortgage lender targets — New York and Massachusetts state CRA

**Built:** 2026-08-22 from CFPB/FFIEC HMDA Data Browser, 2024 filing year.
**Data:** [`data-ops/analysis/state-cra-mortgage/`](../../data-ops/analysis/state-cra-mortgage/) —
full ranked CSVs plus method and caveats.
**Context:** [state-cra-and-nonbank-channels-2026-08-22.md](state-cra-and-nonbank-channels-2026-08-22.md)

**Headline counts:** **70 non-depository lenders** cross New York's 200-origination threshold.
**102** cross Massachusetts' 50-loan threshold.

---

## New York — 70 lenders, nobody examined yet

NYDFS's implementing regulation took effect **July 7, 2026**. It covers DFS-licensed non-depository
mortgage bankers originating **200+ HMDA-reportable New York loans** in the prior calendar year, and
evaluates them on HMDA loan distribution **plus "participation in community development-related
services."** No lender has been examined under it.

Every one of these is standing up a compliance program right now with no incumbent community
partner, against a need of **505K eligible-unenrolled across Kings, Queens and the Bronx.**

| # | Lender | NY originations 2024 |
|---|---|---|
| 1 | Rocket Mortgage, LLC | 11,366 |
| 2 | United Shore Financial Services (UWM) | 10,994 |
| 3 | Premium Mortgage Corporation | 4,738 |
| 4 | CrossCountry Mortgage, Inc. | 4,716 |
| 5 | Homestead Funding Corp. | 3,966 |
| 6 | Contour Mortgage Corporation | 2,069 |
| 7 | NewRez LLC | 1,907 |
| 8 | Movement Mortgage, LLC | 1,860 |
| 9 | Loan Funder LLC | 1,851 |
| 10 | Nationwide Mortgage Bankers, Inc. | 1,703 |
| 11 | loanDepot.com, LLC | 1,626 |
| 12 | Plaza Home Mortgage, Inc. | 1,616 |
| 13 | PennyMac Loan Services, LLC | 1,451 |
| 14 | 1st Priority Mortgage, Inc. | 1,424 |
| 15 | PrimeLending, a PlainsCapital Company | 1,387 |
| 16 | Home Town Funding, Inc. | 1,051 |
| 17 | Guaranteed Rate, Inc. | 1,044 |
| 18 | Norwich Commercial Group, Inc. | 970 |
| 19 | Cardinal Financial Company, LP | 969 |
| 20 | Hunt Mortgage Corporation | 914 |
| 21 | CMG Mortgage, Inc. | 895 |
| 22 | Nationstar Mortgage LLC | 866 |
| 23 | United Mortgage Corp. | 863 |
| 24 | Meadowbrook Financial Mortgage Bankers Corp. | 858 |
| 25 | Fairway Independent Mortgage Corporation | 814 |

*Full 70 in the CSV.*

**Where to start.** Not necessarily the top of the list. **Premium Mortgage (4,738), Homestead
Funding (3,966), Contour (2,069), 1st Priority (1,424), Home Town Funding (1,051), Hunt (914),
United Mortgage (863) and Meadowbrook (858) are New York-concentrated** regional lenders. A brand-new
statewide obligation is a bigger relative problem for a NY-focused originator than for Rocket, which
has a national compliance function and will treat this as one more line item. The regional lenders
also have no CRA muscle memory at all.

Rocket and UWM are worth a shot for the signal value of a named funder, but expect long cycles.

---

## Massachusetts — the ratings list is a trap; the exam schedule is the target list

The seven Needs-to-Improve lenders looked like the obvious targets. **Cross-referencing volume says
six of the seven are effectively out of the market:**

| NI lender | MA originations 2024 | Exam date of NI rating |
|---|---|---|
| MLD Mortgage | 84 | 10/31/2022 |
| Provident Funding | below 50 | 8/31/2023 |
| Toll Brothers Mortgage | below 50 | 12/18/2023 |
| Poli Mortgage Group | below 50 | 2/3/2023 |
| FBC Mortgage | below 50 | 9/19/2022 |
| Northeast Home Loan | below 50 | 11/15/2021 |
| MiLend | below 50 | 5/10/2017 |

MA's rule triggers at **50 or more** MA home mortgage loans in the prior year. Six of seven now fall
below it, so they may have dropped out of coverage entirely — their NI ratings are relics of when
they were larger. **A bank with a bad rating is a prospect; a lender that has left the market is not.**

**The live exam schedule is where the money is:**

| Exam | Lender | MA originations 2024 |
|---|---|---|
| **Q3 2026 — live now** | **Guaranteed Rate, Inc.** | **4,444** |
| **Q3 2026 — live now** | **Fairway Independent Mortgage** | **2,100** |
| Q3 2026 | Envoy Mortgage | 162 |
| Q3 2026 | Plaza Home Mortgage | 135 |
| Q3 2026 | Ark-La-Tex Financial | 125 |
| Q2 2026 | Total Mortgage Services | 1,327 |
| Q2 2026 | Radius Financial Group (Norwell MA) | 594 |
| Q2 2026 | American Neighborhood Mortgage | 313 |
| Q2 2026 | Nations Direct Mortgage | 296 |
| Q1 2026 | Freedom Mortgage | 740 |
| Q1 2026 | First Home Mortgage | 206 |
| Q1 2026 | AmWest Funding | 77 |

**Guaranteed Rate and Fairway are the two MA targets that matter** — both under examination this
quarter, both with real volume. **Fairway is the strongest single name across every list in this
project**: MA CRA exam live this quarter, *plus* an active ~$9.9M DOJ redlining consent order in
Birmingham. The only institution appearing on both our federal and state target lists.

The largest MA non-depositories overall: Rocket (5,027), Guaranteed Rate (4,444), UWM (3,842),
CrossCountry (3,233), Guild (2,301), Fairway (2,100), Movement (1,763), CMG (1,625), Total Mortgage
(1,327), loanDepot (1,206). Full 102 in the CSV.

---

## Why this pitch is different from the bank pitch

**No geographic precision problem.** Both states set the assessment area at the **whole state** (MA
explicitly; NY evaluates statewide lending distribution). No county map, no per-county attribution,
no overlapping-AA double-counting, and **no exposure to Meta's special-ad-category radius floor** —
statewide targeting never needed ZIP granularity.

**The credit thesis is first-order, not analogous.** For a bank, "SNAP access raises credit scores"
is community benefit. For a mortgage lender it is pipeline: a household moving 17 points off a 634
average is moving toward the line that decides whether they qualify at all. NBER WP 34434 was always
going to land hardest here. *(Cite version-stamped as preliminary — see
[cra-wp34434-estimates.md](cra-wp34434-estimates.md).)*

**These buyers understand paid acquisition natively.** Rocket, UWM, Guaranteed Rate and Fairway run
large performance-marketing operations. Cost-per-outcome is their language already.

---

## Blockers before any of this can be sent

1. **Charitable-solicitation registration.** MA Form PC + Schedule A-2 (~$150) legally gates MA
   solicitation. **NY CHAR410 is the known-onerous one** and gates NY. Neither is filed.
2. **Coverage is a licensee question, not a HMDA question.** HMDA gives volume. Whether a given
   lender is a DFS-licensed non-depository mortgage banker (NY) or a DOB-licensed mortgage lender
   (MA) must be checked against the state licensee register. **Do not treat a CSV row as proof of
   coverage.**
3. **Depository classification here is a name heuristic**, corrected once already (the first pass
   let Citibank, KeyBank, M&T and bankESB through because `\bbank\b` does not match "Citibank").
   Verify individually before any outreach.
4. **The generator has no mortgage-lender template.** Its artifact assumes a bank, a CRA Performance
   Evaluation, county need and a map. A statewide lender artifact is a different document — smaller,
   without the map, and organized around the credit-pipeline argument instead of the county need.
5. **2024 filing year.** Both rules test the prior calendar year; re-verify against 2025 data.
6. **MA has no Outstanding rating in the entire lender population** — the observed ceiling is High
   Satisfactory. Never imply a grant produces an Outstanding.
