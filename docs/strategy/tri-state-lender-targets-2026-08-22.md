# Tri-state mortgage lender targets — MA, NY, IL scoped

**Built:** 2026-08-22 from CFPB/FFIEC HMDA 2024 and the state coverage rules.
**Data:** [`il_nondepository_50plus_2024.csv`](../../data-ops/analysis/state-cra-mortgage/il_nondepository_50plus_2024.csv) ·
[`tri_state_lender_overlap_2024.csv`](../../data-ops/analysis/state-cra-mortgage/tri_state_lender_overlap_2024.csv) ·
plus the existing MA and NY lists
**Context:** [state-cra-other-jurisdictions-2026-08-22.md](state-cra-other-jurisdictions-2026-08-22.md)

Targets are now scoped in all three jurisdictions that examine mortgage lenders and have a workable
test. **The finding that matters is not any single list — it is that the same lenders appear in all
three.**

---

## The target universe

| State | Coverage threshold | Authority | Non-depository lenders over it |
|---|---|---|---|
| **Illinois** | **50+** home mortgage loans in the State | 205 ILCS 635 / 38 Ill. Adm. Code 1055 | **162** |
| **Massachusetts** | **50+** home mortgage loans in MA | M.G.L. c. 255E §8 / 209 CMR 54.00 | **102** |
| **New York** | **200+** HMDA-reportable NY loans | Banking Law §28-bb / NYDFS reg eff. 7/7/2026 | **70** |

Illinois is the largest of the three and had never been scoped.

---

## 🔑 The real finding: 28 lenders are covered in all three states

**77 lenders are covered in two or more of the three jurisdictions. 28 are covered in all three.**

| Lender | MA | NY | IL | Total |
|---|---|---|---|---|
| **Rocket Mortgage** | 5,027 | 11,366 | 9,338 | **25,731** |
| **UWM (United Shore)** | 3,842 | 10,994 | 8,956 | **23,792** |
| **Guaranteed Rate** | 4,444 | 1,044 | 9,021 | **14,509** |
| **CrossCountry Mortgage** | 3,233 | 4,716 | 5,020 | **12,969** |
| **Fairway Independent** | 2,100 | 814 | 3,963 | **6,877** |
| **loanDepot.com** | 1,206 | 1,626 | 3,521 | **6,353** |
| Guild Mortgage | 2,301 | — | 2,505 | 4,806 |
| **NewRez** | 951 | 1,907 | 1,712 | **4,570** |
| Broker Solutions | 850 | 342 | 2,907 | 4,099 |
| Movement Mortgage | 1,763 | 1,860 | 380 | 4,003 |
| Mortgage Research Center | 492 | 735 | 2,729 | 3,956 |
| PennyMac | 812 | 1,451 | 1,572 | 3,835 |
| Nationstar | 874 | 866 | 1,499 | 3,239 |
| CMG Mortgage | 1,625 | 895 | 384 | 2,904 |
| Freedom Mortgage | 740 | 328 | 1,171 | 2,239 |
| Plaza Home Mortgage | 135 | 1,616 | 475 | 2,226 |
| PrimeLending | 246 | 1,387 | 537 | 2,170 |
| Guaranteed Rate Affinity | 664 | 294 | 984 | 1,942 |

Full 229 rows in the overlap CSV.

### Why this changes the pitch

**One grant can satisfy a CRA obligation in three jurisdictions at once.** That is worth
substantially more to the lender than a Massachusetts-only grant, and it justifies a larger ask than
the MA-only ladder supports — without exceeding what any single state's giving history would bear,
because the giving is being aggregated across three obligations rather than stretched within one.

It also fixes the weakness of the MA-only model. Massachusetts alone is many targets at $2,500–$7,500
— viable but small. A tri-state program to the same lender is one conversation, one artifact family,
and roughly three times the value delivered.

**Revised ask for multi-state lenders:** roughly **2.5× the single-state figure** — a lender worth
$5,000 in Massachusetts is worth **$12,500** as a three-state program. Anchor on the sum of their
originations across covered states, not on one state's volume.

### The standout, on evidence rather than size

**Guaranteed Rate.** 14,509 originations across all three states, **headquartered in Chicago** (so
Illinois is home-market, not a satellite), a Massachusetts exam **stale since 7/2021**, and a
foundation whose stated focus is *"investments in housing stability and food security"* backed by
$6.7M to Feeding America and Baby2Baby. No other target aligns on obligation, geography and mission
simultaneously. Ask **$25,000–$40,000** as a tri-state program.

**Fairway** is second: 6,877 across three states, an active ~$9.9M DOJ redlining consent order, a
Massachusetts exam live this quarter, and a published MA evaluation crediting it for funding an
organization that provides **SNAP application assistance**.

**loanDepot and NewRez** both carry a Massachusetts **Service Test "Needs to Improve"** and are
covered in all three states — documented failure plus tri-state reach.

---

## The method generalises — this is a repeatable recipe

Scoping any new jurisdiction took two inputs and about an hour:

1. **Read the coverage threshold out of the state rule.** IL and MA both use 50+ loans in-state;
   NY uses 200+. The threshold is always in the implementing regulation, not the statute.
2. **Pull per-lender origination counts from the HMDA Data Browser.**
   `/view/filers?years=YYYY&states=XX` for the filer universe, then
   `/view/aggregations?...&actions_taken=1&leis=LEI` per candidate for true origination counts.
   ⚠️ `filers` honors `states` but **ignores `actions_taken`** — its count includes denials and
   withdrawals, so it overstates by roughly 2×. Use it only to build a candidate set.
3. **Classify depository vs non-depository by name**, then verify against the state licensee
   register before treating anything as covered. HMDA gives volume; **only the licensee list gives
   coverage.**

Applied to DC it would produce a list, but DC applies its investment test only to institutions
holding public deposits, which excludes non-depository lenders from the test where a grant counts —
so the list would be unusable. **The four mortgage-lender jurisdictions are the whole universe**;
there is no further state to extrapolate to until California, Maryland or Pennsylvania enacts one.

---

## Caveats

- **2024 filing year.** All three rules test the prior calendar year — re-verify against 2025 data.
- **Coverage is a licensee question.** A CSV row proves volume, not that the lender is licensed in
  that state under the covered category.
- **Depository classification is a name heuristic**, corrected twice already (`\bbank\b` missing
  "Citibank"; CEFCU and similar credit unions surviving as "non-depository"). Spot-check.
- **No Illinois or New York evaluations exist**, so those two lists carry no rating or gap data —
  ranking is by volume alone. Massachusetts is the only state where a target can be chosen on a
  documented failure.
