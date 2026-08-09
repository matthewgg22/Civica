# National SNAP Coverage Framework — remaining states, special circumstances, tranches

> **Status: DRAFT 2026-08-09.** Extends `mae-state-corpus-framework.md` (16-state roster,
> approved 2026-08-04) from a *corpus* plan to a *whole-product* coverage plan across all
> four layers. Percentages are computed from repo data, not estimated — see §2.

---

## 1. Coverage is four independent layers, and conflating them is the main risk

A state is not "done" or "not done". It sits at a different level on each of four layers,
and each layer has a different cost, a different failure mode, and a different owner.

| # | Layer | Artifact | What it buys | What breaks without it |
|---|---|---|---|---|
| L1 | **Federal floor** | shared 7 CFR corpus | Demeter answers *any* state's federal questions | nothing — already national |
| L2 | **Content pack** | `packages/demeter-engine/src/states/<code>/` | state-accurate policy answers, `/verify` card, `/guides/<state>` SEO page | Demeter declines state-variable figures and says so |
| L3 | **Engine policy** | `packages/snap-rules/src/constants/states.ts` | benefit math: BBCE tier, SUA, allotment table, ABAWD waiver, drug-felony ban | `computeBenefit` throws or the composer SKIPs |
| L4 | **Oracle expectations** | `expected_by_state` in the v0.6 fixture | the state is *graded* — we can prove the engine is right there | the state is untested; a green run means "never asked" |

**The layers do not need to advance together, and mostly shouldn't.** L1 is done nationally.
L2 is cheap and user-visible. L3 is expensive and only matters where we quote dollars. L4 is
the only thing that converts "we shipped a state" into "we can defend a state".

The failure this framework exists to prevent: **shipping L2 and reporting it as coverage.**
Texas had a verified content pack while 74% of the engine test suite had never run there
(#607). GA, NY and WA are in that position today.

---

## 2. The denominator, and why percentages are dollar-weighted

**53 SNAP jurisdictions**: 50 states + DC + Guam + USVI. Puerto Rico and American Samoa run
NAP block grants rather than SNAP and are out of scope. This is grounded, not asserted —
`data-ops/sample/snap-per-by-state/per_by_state_fy24.csv` has exactly 53 rows, with GU and VI
present (issuance blank).

**State count is the wrong metric.** SNAP dollars are concentrated: California alone is 13.1%
of national issuance; the smallest 13 jurisdictions together are under 2.5%. A plan that
optimises "states shipped" will spend the same effort on Wyoming as on Florida.

All percentages below are **share of FY24 national SNAP issuance ($93.0B)** — the closest
proxy in-repo for *people reached*. Where a number is state-count, it says so.

---

## 3. Where we actually are (2026-08-09)

| Layer | Jurisdictions | State count | **% of SNAP dollars** |
|---|---|---:|---:|
| L1 federal floor | all 53 | 100% | **100%** |
| L2 content pack | CA, WA, TX, NY, GA | 5 / 53 (9%) | **34.3%** |
| L3 engine policy *with SUA* | CA, MA, TX | 3 / 53 (6%) | **23.8%** |
| L3 engine policy *any* | + KS, AK (archetypes) | 5 / 53 | 25.0% |
| L4 graded by the oracle | CA, MA + TX (as of #610) | 3 / 53 | **23.8%** |

Only **California** is complete on all four layers.

Two structural notes:

- **KS and AK are archetypes, not states.** They were authored as "Non-BBCE archetype (e.g.
  KS)" to exercise schema branches. Treating them as covered states overstates L3.
- **L4 ≤ L3 always.** You cannot grade a state whose policy the engine doesn't hold.

---

## 4. The coverage curve — where the marginal return collapses

Cumulative share of national issuance, adding jurisdictions in descending order:

| Jurisdictions | % of dollars | Through |
|---:|---:|---|
| 1 | 13.1% | California |
| 4 | 35.8% | + TX, NY, FL |
| **8** | **52.1%** | + IL, PA, OH, GA |
| 12 | 63.5% | + MI, NC, MA, AZ |
| **19** | **75.2%** | + LA, TN, MO … |
| **29** | **90.1%** | + NV … |
| 35 | 95.0% | + IA |
| 45 | 99.0% | + AK |
| 53 | 100% | + GU, VI |

**Half of all SNAP dollars sit in 8 jurisdictions. The last 8 jurisdictions are worth ~1%.**

Universal coverage is therefore a *policy* goal (equity: a Wyoming applicant deserves the same
answer), not an efficiency goal. Sequence by dollars; finish for fairness.

### The existing roster has a caseload blind spot

The approved 16-state roster was tiered by *ingestion cost × teaching value* — correct for
learning the schema, but it **omits 8 of the top 20 states by issuance**:

> Ohio 3.4% · North Carolina 3.2% · New Jersey 2.1% · Louisiana 2.0% · Alabama 1.9% ·
> Tennessee 1.7% · Missouri 1.6% · Oklahoma 1.6% — **17.6% of national issuance combined**

The 16-state roster caps out at **65.7%**. It cannot reach 75% without adding caseload states
that teach nothing new about the schema. That's fine — but it should be a deliberate second
phase, not a surprise.

---

## 5. Special circumstances — the things that break "just add a state"

Each of these is a schema or logic branch, not a data-entry task. The roster was chosen partly
to hit them early; the ones still unmodelled are flagged **OPEN**.

### 5.1 Income-screen shape
- **BBCE tiers are not a boolean.** 130% (GA), 165% (TX, IL), 200% (most), and **dual-pathway**
  (NY: 200% *and* 150%). A scalar `bbce_threshold_pct` already survives this.
- **Non-BBCE states** apply the federal 130% gross test, where boundary bugs actually bite —
  the only oracle FAIL on KS/AK is a $1 FPL rounding error invisible in BBCE states (#606).
- **OPEN — categorical sub-screens.** GA runs a 200% screen for all-adult elderly/disabled
  households *on top of* its 130% base. Currently unmodelled in `states.ts`.

### 5.2 Utility allowances (the single biggest L3 blocker)
- **Mandatory vs optional.** In 15 of 16 roster states the SUA is mandatory; in **Virginia** a
  household may claim actual costs. The engine has no "actual utility costs" path — **OPEN**.
- **Tier naming differs.** TX's "BUA" is the federal "LUA" (mapped in #610 with a comment).
- **Expiring rules.** Oregon's SUA lives in a temporary rule expiring 2026-09-14.
- Missing SUA is what made 95/129 profiles ungradeable in TX/KS/AK (#607).

### 5.3 Allotment tables
- **AK, HI, GU, VI have their own maximum-allotment tables** — AK further splits by region
  (urban / rural I / rural II). `allotment_tier` exists (`"48"` vs `"AK"`) but **HI, GU, VI
  tiers are OPEN**, and AK sub-regions are unmodelled.

### 5.4 Administration model
- **County-administered**: CA, NY, WI, MN, VA (+ NJ, OH, NC, CO, ND nationally). Operative
  practice varies below the state layer; NYC HRA is effectively its own agency.
- **OPEN — `Facts` carries no `county_fips`**, so the verdict composer cannot see county-level
  variation at all, including the 7 genuinely waived CA ABAWD counties that
  `CA_WAIVER_COUNTY_FIPS` already lists and `enrollment-api` already consumes (#608). Two
  surfaces can answer the same household differently **today**.

### 5.5 ABAWD time limits and waivers
- Waivers are **state-availability × county × expiry**, all three moving. CA resumed
  2026-06-01 with 7 counties waived through 2026-10-31; GA has run a fixed 36-month window
  since 1996; TX and KS hold none.
- State availability is now honoured (#608/#612); **county-level remains OPEN** per §5.4.

### 5.6 Deductions
- **Standard Medical Deduction** states (GA $161) vs none (NY, WA).
- **Child support**: deduction (GA) vs income exclusion (NY) — different math, same facts.
- **Heat-and-Eat / LIHEAP nominal payments** as an SUA qualifier — **OPEN**.

### 5.7 Simplified / parallel programs
TSAP and SNAP-CAP (TX), ESAP, WASHCAP (WA), Senior SNAP (GA), NYSCAP (NY), Elderly Simplified
Application Projects generally. These change certification length, interview requirements and
reporting — **all OPEN** in the engine; currently pack-only prose.

### 5.8 Certification & reporting
12-month-only (WA), 4-month ABAWD (TX), 36-month TSAP/CAP, 6-month default post-OBBBA (GA),
simplified vs change reporting. Engine models none of this — **OPEN**.

### 5.9 Restaurant Meals Program
Statewide mandate (CA, AB 942) vs county-only (IL: Cook & Franklin). Boolean
`rmp_operated` exists; county granularity **OPEN** per §5.4.

### 5.10 Tribal administration
638 / tribal-organisation-administered areas, plus the OBBBA "Indian, Urban Indian, or
California Indian" ABAWD exemption (broader than ANCSA). Exemption is modelled; **tribal
administration is OPEN**.

### 5.11 Territories
GU and VI: own allotment tables, own FPL basis, and **no issuance figure in our dataset** —
they will need a separate sourcing path. Roughly 0.3% of dollars; last tranche.

---

## 6. Tranches to deliverable

Each tranche has an **exit criterion that is measurable today** — the profile-harness pass
rate for its states, not "the pack merged".

### Tranche 0 — Make the five we have actually true *(days)*
No new states. Close the gap between shipped and graded.

- L3+L4 for **WA, NY, GA** (packs exist; SUA/BBCE facts already sit in their verified packs)
- **KS + AK SUA** so the archetypes stop skipping 95 profiles (#607)
- Fix the oracle defects that block honest grading: **#606** (FPL +$1), **#609** (TX BBCE-165
  expectation), **#611** (M12 unimplementable facts)
- **Exit:** all 5 pack states at 129/129, and `abawd_waiver_avail`-style flags exercised.
- **Moves:** L4 from 23.8% → **34.3%**; L2 unchanged.

### Tranche 1 — The concentrated head *(the 50% line)*
Add **FL, IL, PA, OH** to L2+L3+L4. With CA/TX/NY/GA that is the top 8.

- FL and IL are already on the roster; **OH is not** — add it.
- **Exit:** ≥50% of national SNAP dollars graded at 129/129.
- **Moves:** **52.1%** on all of L2/L3/L4.

### Tranche 2 — Finish the schema-teaching roster *(to ~66%)*
The remaining approved roster: **MI, MA, AZ, NV, OR, WI, MN, VA**.

Sequenced so each buys a branch: **VA** first (non-mandatory SUA — §5.2, the biggest open
engine gap), **WI** next (best-versioned source; builds the county sub-layer for §5.4), MN last.

- **Exit:** 65.7%, and §5.2 + §5.4 closed in the engine.

### Tranche 3 — Caseload catch-up *(to 75–80%)*
**NC, NJ, LA, AL, TN, MO, OK** — no new schema, pure reach. Candidates for a batched,
templated build now that every branch from Tranches 1–2 exists.

- **Exit:** ≥75%. This is the credible "we cover most of the country" claim.

### Tranche 4 — The long tail *(to 95%)*
Jurisdictions 20–35 by issuance. Expect diminishing returns and heavy reuse; the work is
sourcing, not schema.

### Tranche 5 — Universal *(to 100%)*
Remaining small states + **HI, AK regions, GU, VI** (§5.3, §5.11). Justified by equity and by
the "any state" product promise, not by dollars — the last 8 jurisdictions are ~1%.

---

## 7. Coverage decays — budget for it

Coverage is not monotonic. Three clocks run against every completed state:

1. **October COLA** — every dollar figure in L3 and every pack expires annually. TX's are
   already pinned `EXPIRES 2026-09-30`.
2. **Waiver expiry** — CA's 7 counties lapse 2026-10-31; GA's window rolls 2026-11-30.
3. **Source rot** — the Texas handbook URLs the TX pack cites now 404; the site restructured
   between the pack being built and 2026-08-09.

A state is not "done", it is "current as of". Every pack already carries machine-readable
`freshness.json` entries; **the missing piece is a scheduled job that fails CI when an entry
expires** — that should land in Tranche 0, because without it every later tranche silently
rots.

---

## 8. Honest summary

| Claim | Defensible today? |
|---|---|
| "Demeter answers SNAP questions for any state" | **Yes** — L1 is national and it declines state-specific dollars elsewhere |
| "We have verified state content for 5 states / 34% of SNAP dollars" | **Yes** |
| "Our engine is correct in California and Massachusetts" | **Yes** — 129/129 each |
| "Our engine is correct in Texas" | **As of #610**, 127/129 with both failures diagnosed and filed |
| "We cover the United States" | **No** — 34.3% of dollars at L2, 23.8% at L4 |

The one-line version: **we are ~1/3 of the way by dollars on content, ~1/4 on proof, and
100% on the federal floor.** Tranche 0 costs days and makes the existing claim true; Tranche 1
puts half the country's SNAP dollars behind a graded engine.
