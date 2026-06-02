# Special-category taxonomy — reconciliation with the built engine

**Status:** reconciliation + roadmap · **Date:** 2026-06-01
**Source:** `Civica USDA data/analysis/civica_special_category_taxonomy.md` (the 13-axis master taxonomy)
**Companions:** [snap-rules-matrix.md](snap-rules-matrix.md) · [payment-integrity-engine.md](payment-integrity-engine.md) · `civica_accurate_number_model.md`

The taxonomy is the master list the household-fact model, StateRuleProfile, and the 50 test profiles organize around. This maps it against what's built and sets the build order. The engine is, by design, a **Phase-A skeleton** (per `federal.py`) — the core sensitivity/region/flip architecture is solid; most special-circumstance *determination* logic is not yet implemented.

## Corrections the taxonomy mandated (applied)
- **Region labels → canonical condition-names** (§17): `Region` enum values are now `R_interior` / `R_capped` / `R_zeroshelter` / `R_flip` (was `interior_uncapped`/…). Kills the R-III/R-IV numbering drift the taxonomy flags as an integration bug. *(My mapping was never swapped — only the label strings changed.)*
- **FY2025 homeless shelter deduction $179 → $190.30** (§13); FY2026 = $198.99. Resolves the cross-engine divergence (the Swift $179 was stale).
- **FY2026 scalars confirmed** (§13): SD(1–3) $209 / cap $744 / min $24 / homeless $198.99 / τ $58 are now FNS-confirmed in `parameters.py`'s provenance (asset limits + max allotment still ◦; tables still unloaded).
- **§10105 cost-share cliff** (§21): `tier.py` now models the non-monotone exemption — liability steps at 6/8/10% PER, then **drops to 0 above ~13.32%** (state becomes cost-share-exempt). ⚠ confirm the 13.32% decimal vs PL 119-21.

## The standout alignment
The taxonomy's sharpest engine warning (§17): analytic distance-to-130%-FPL **mislocates the BBCE flip** (a BBCE household's binding constraint is the benefit-zero net point, not 130% gross) — "the exact error that under-weights BBCE in the router." **Our `p_flip` is perturb-and-re-run** (it re-runs the engine and observes whether eligibility actually flips), so it is correct regardless of where the gate sits — it structurally cannot make that error. The taxonomy's own remedy ("perturb-and-re-run for the authoritative sensitivity", §16) is exactly our primary primitive.

## Axis → build-status map

| Axis / mechanic | Status | Where | Note |
|---|---|---|---|
| 1 — Categorical eligibility (SSI/PA/BBCE/TBA/CAP/cash-out) | 🟡 partial | engine | pure-cash cat-elig (federal) + BBCE (CA/MA subclasses); TBA / CAP-standardized / SSI cash-out missing |
| 2 — Age (elderly 60+, OBBBA 60–64 & caregiver-u14 seams) | 🟡 | engine | elderly lever set ✓; the ABAWD age seams not derived |
| 3 — Disability (benefit-receipt defined) | 🟡 | engine | E/D lever set ✓ (no gross test, uncapped shelter, medical); separate-HH @165% FPL not modeled |
| 4 — Household composition / **proration** | 🟡 | engine | **regime A/B proration (§16) BUILT** (`rules/proration.py`); boarders/roomers/sponsor-deeming still gap |
| 5 — Living situation (homeless/destitute/shelter/GLA) | 🟡 | engine | homeless deduction param ✓ (not yet *applied*); **destitute calc mode** ❌; expedited partial |
| 6 — Work-requirement / ABAWD | ✅ | engine+scoring | **BUILT** (`rules/work_requirement.py`): `derive_work_class` (date-versioned ceiling 54→64 + OBBBA-removed homeless/veteran/foster exemptions + tribal/caregiver-u14/disabled); timeout → regime-A exclusion → §16 proration. Flip class also scored. 3-in-36 clock read from a field (not tracked); general-WR out of v1 |
| 7 — Immigration (§10108) | ✅ | engine | **BUILT** (`rules/immigration.py`): granular `ImmigrationStatus`, §10108 removals with the **2025-07-04 point-in-time** boundary, DACA/undocumented/H-2A ineligible, T-visa contested (flagged), ineligible → regime-B proration. 5-yr-bar simplified (flag) |
| 8 — Income-type | 🟡 | engine+scoring | earned/unearned/SE math ✓; minor-student exclusion, SE 40%-vs-actual, gig mileage ❌ |
| 9 — Expense/deduction + **region** | ✅ | engine+scoring | shelter clamp + 4 regions ✓; medical (E/D) ✓; SUA-tier + §10104 internet-removed partial |
| 10 — Assets | 🟡 | engine | asset-limit test ✓; vehicle valuation / lump-sum / `<$100` expedited trigger ❌ |
| 11 — **Verification status** (strongest integrity predictor) | ✅ | scoring | **BUILT** (`scoring/verification.py`): full §11 vocabulary (documented/interface-matched/self-attested/postponed/pending-SAVE/refused) + `evidence_class` + P(error) priors (postponed/refused highest) feeding `p_error`; bridged from `answer_source`. Capturing true verification *state* (vs origin) remains a §14 intake gap |
| 12 — Program/calc mode (CAP/RMP/FDPIR/D-SNAP) | ❌ | engine | none — these are distinct rule-sets, not modifiers (D-SNAP = parallel engine; FDPIR = same-month exclusion) |
| 13 — Access (LEP/ADA/DV) — **negative-case** universe | ❌ | (new) | improper-denial / churn surface; a *second* QC universe, not the payment rate |
| §16 — Proration A (full-count) / B (prorated × f) | ✅ | engine | **BUILT** as a countable-household pre-transform in `determine_eligibility` (identity if no exclusions → regression-safe); perturb-and-re-run prices the region transition. v1 flags: regime-A deduction treatment, medical/child-support/SUA/asset proration |
| §17 — 4-region sensitivity map | ✅ | engine | condition-named; decided equivalently to raw-excess; labels now aligned |
| flip class `P(flip)×B*` | ✅ | scoring | + perturb-based `p_flip` (dodges the BBCE bug above) |
| §20 — determination sub-mechanics | ❌ | engine | minor-student earnings exclusion (common over-count), SE fork, child-support *received*, split-custody tie-breaker, incarceration >30d, sponsor-deeming indigence, recert-gap fault, unborn-child option |
| §21 — QC-universe exclusions | ❌ | scoring/ledger | `qc_universe_status ∈ {active_reviewable, negative_reviewable, excluded(reason)}` — needed so the measured rate is honest |
| §24 — farmworker destitute mode | ❌ | engine | retrospective actual-only month, 12-mo-averaging carve-out, cross-state proration, NAC duplicate match |

## Determinant facts vs derived classifications (§0)
The taxonomy's load-bearing schema rule — facts set from evidence vs classifications the engine *computes* — matches our design: `shelter_region` is derived in the wrapper ✓; `cat_el_status` partially derived; **`work_class`, proration regime, and program/calc mode are the derived classifications still to build** (and must be computed, never accepted as caseworker input — the auditability point).

## Build order (recommended)
Highest error-coverage per unit effort, by wing:

1. ~~**Proration A/B (§16)**~~ — ✅ **DONE** (2026-06-01): `rules/proration.py` countable-household transform; regime A full-count / regime B ×f; region-transition handled; 5-case policy deck green; no-exclusion path byte-identical.
2. ~~**§10108 immigration + mixed-status (§7)**~~ — ✅ **DONE** (2026-06-01): `rules/immigration.py` resolver + the 2025-07-04 point-in-time boundary; ineligible noncitizens compose with regime-B proration; 7-case deck incl. the refugee pre/post-July-4 flip. 5-yr-bar + T-visa contested are flagged.
3. ~~**Verification-status axis formalized (§11)**~~ — ✅ **DONE** (2026-06-01): `scoring/verification.py` (6-state vocabulary + evidence_class + verification-keyed P(error), postponed/refused highest), wired into `InputUncertainty.p_error` + the sweep's provenance bridge. Capturing true verification state in intake is the remaining §14 gap.
4. ~~**work_class derivation + ABAWD clock (§6)**~~ — ✅ **DONE** (2026-06-01): `rules/work_requirement.py` derived work_class + date-versioned ABAWD seam + timeout→regime-A exclusion; 4-case deck incl. the 54→64 seam and the homeless/veteran removed-exemption flip.
5. **§20 sub-mechanics** (minor-student exclusion, SE 40%-vs-actual, split-custody) — *determination*. Where QC error mass actually lives; each is small + high-frequency.
6. **QC-universe exclusions (§21)** + **destitute/program modes (§19/§24)** + **Axis-13 access universe (§25)** — larger, sequence later.

Everything above is gated on the same two unlocks already tracked: intake collection (per-member ages/citizenship — see [intake-collection-gap.md](intake-collection-gap.md)) and FY2026 reference tables ([fy2026-reference-tables.md](fy2026-reference-tables.md) — now LOADED). No determination runs on live data until intake collection lands.

## Research-agent data + corrections (2026-06-01)

Three independent agents retrieved CA / MA / federal rules + citations. Folded in:
- **FY2026 federal (✓):** loaded — poverty $15,650+$5,500, allotment HH1–8, SD $209/$223/$261/$299, cap $744, homeless $198.99, min $24, asset $3,000/$4,500, τ $58. The MA `mass.gov` calculator showed **stale FY2025** ($204/$712); FNS-authoritative FY2026 is **$209/$744** — discrepancy resolved by the federal agent. ◦ cells (allotment HH1-3/5-8, SD 4/5/6) reconfirm vs the FNS primary table PDF.
- **CA / MA SUA (loaded):** CA $663/$170/$20 · MA $890/$542/$62.
- **§10105 (✓ CRS R48552):** 0/5/10/15% at <6/6–8/8–10/≥10%; the ~13.33% (PER×1.5≥20%) is a **start-DELAY (FY2029/30), not a permanent exemption** — `tier.py` corrected.
- **CFR citations (✓ vs eCFR):** all 11 validated; `citations.py` flag upgraded. (OBBBA amends ABAWD statutorily — follow §10102 over 273.24 text.)
- **Corrections to the taxonomy:** unborn child is **NOT** counted in CalFresh household size (taxonomy §20 said it is — CDSS MPP §63-402.142); MA disability standard lives at **106 CMR 361.210** (taxonomy §3 said 361.230, which is "Nonhousehold Members").
- **State data captured for later wiring (not yet in the engine):** CA MCE 200% + asset waiver, MA BBCE 200% **calendar-basis** (eff ~Feb 1); CA standard medical deduction $150 / MA $155 (engine lacks a standard medical deduction); `se_calc_method` CA = 40%-or-actual (default 40%), MA = **actual** (no 40% option); CA LPIE student rule; CA RMP (12 opt-in counties); CFAP (state-funded, OBBBA 2026-04-01 caveat). These feed the §9/§8/§20 build items.
