---
id: 2026-06-01-ma-state-baseline
date: 2026-06-01
scope: [snap-qc, ma-pilot, baseline, error-rate]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "data-ops/sample/usda-qc-ma/ma_qc_fy2023.json@2026-06-01"
    note: "MA QC aggregates: total PER 7.76% (raw, no QC $-tolerance), n=950 cases, 367 attributable errored. Methodology reproduces CA reference within 0.25pp on every top-10 element share."
  - kind: dataset
    ref: "data-ops/sample/usda-qc-ca/ca_qc_fy2023.json"
    note: "CA reference build (same methodology): total PER ≈10.45% raw, n=867 cases, 379 attributable errored. Used to validate methodology port."
  - kind: dataset
    ref: "data-ops/sample/snap-per-by-state/per_by_state_fy24.csv"
    note: "FNS-380 published FY2024 PER: CA 10.98%, MA 14.10%. The OFFICIAL direction is MA > CA — opposite of the FY23 raw-QC direction. The engine constants (MA_BASELINE_PER, CA_BASELINE_PER) anchor on the published rates."
  - kind: dataset
    ref: "data-ops/sample/usda-qc-ma/ma_qc_fy2022.json@2026-06-01"
    note: "MA FY2022 QC same-method extension. Raw PER = 8.81%, earned-any 16.66%, no-earned 6.15%. Medical (6.87%) + dep-care (4.23%) over-index pattern present in both FY22 and FY23 — robust across years."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/error-risk.ts
    line: 449
    note: "State-keyed engine constants landed 2026-06-01: MA_BASELINE_PER (14.10), MA_BASELINE_FISCAL_YEAR (2024), MA_INCOME_GROUP_PER_FY23, MA_ELEMENT_ATTRIBUTION_FY23, STATE_CONSTANTS registry, *ForState function variants. CA-default behavior preserved (297 tests pass)."
  - kind: file
    ref: packages/snap-qc-engine/test/state-constants.test.ts
    note: "19 new tests verifying MA constants, *ForState function parity with CA-default APIs at state=CA, MA full-coverage projection ~7.06% (50% of MA baseline)."
  - kind: file
    ref: tools/usda-qc-ingest/src/ingest_qc.py
    line: 107
    note: "Multi-element + multi-AGENCY methodology (--multi-element flag). Validated to reproduce CA reference build (Δ ≤ 0.25pp on every top-10 element)."
  - kind: dataset
    ref: "data-ops/sample/usda-snap-retailers-ma/manifest.json@2026-06-01"
    note: "5,321 MA EBT-authorized retailers pulled from USDA FNS ArcGIS service; 72% concentrated in Project Bread's catchment counties (Suffolk/Middlesex/Norfolk/Essex/Worcester/Hampden)."
  - kind: file
    ref: data-ops/sample/usda-qc-ma/README.md
    note: "Full provenance, validation table vs CA reference, AGENCY-null caveat (MA 61% null vs CA 6% null — responsibility split unreliable)."
  - kind: url
    ref: "https://snapqcdata.net/datafiles"
    note: "Source: USDA SNAP QC Public-Use File FY2023, public-domain, no auth."
  - kind: file
    ref: docs/findings/2026-05-29-caper-denial-side-error.md
    note: "Cross-reference: MA denial-side erroneous = 21.08% (CAPER FY24), lower than national median — consistent with the lower QC PER finding here."
  - kind: file
    ref: docs/designs/cbo-caseworker-mode.md
    line: 170
    note: "Operational target: caseworker-mode v1 ships MA-first via Project Bread; this baseline is the pre-pilot reference against which to measure Civica's MA intervention."
---

## What we found

**Two reference points for MA SNAP PER — and they point in opposite
directions.** Be careful which one the pitch uses.

| Reference | MA | CA | Direction |
|---|---:|---:|---|
| **FY2024 official FNS-380 published** | **14.10%** | **10.98%** | **MA > CA** by 3.1pp |
| FY2023 raw QC microdata (no $-tolerance) | 7.76% | 10.45% | MA < CA by 2.7pp |

The **FY2024 published rate is the engine constant** (`MA_BASELINE_PER = 14.10`,
`CA_BASELINE_PER = 10.98`) and the rate any external audience will recognize.
The FY2023 raw-QC derivation is an **analytical workhorse** for element
attribution and same-method state comparisons — *not* a publishable headline.

We don't have MA FY2023 *published* (only CA FY23 published = 13.40%) to bridge
the methodology gap. The raw-QC-to-published gap is larger for MA than for CA,
and the FY23→FY24 shift in MA may also reflect a real worsening — these can't
be disentangled with the data on hand.

**The pitch headline is NOT "MA has lower PER than CA."** The honest framing
is: "MA's officially-published PER (14.10%) is higher than CA's (10.98%) —
which gives MA more Civica-addressable headroom — *and* the MA error mix
over-indexes on the elements Civica's coached intake actually moves."

This is the **pre-pilot MA baseline** for the June 2026 caseworker-mode
rollout with Project Bread.

The element-mix story is more interesting than the headline:

| Element | MA share | CA share | Δ |
|---|---:|---:|---:|
| Shelter deduction (363) | 37.82% | 41.50% | −3.7 |
| Wages (311) | 24.30% | 22.18% | +2.1 |
| Medical expense deduction (365) | **9.46%** | 4.03% | **+5.4** |
| Dependent care (350) | **5.41%** | 1.96% | **+3.5** |
| Unemployment compensation (323) | **3.51%** | 0.74% | **+2.8** |
| Self-employment (312) | 2.29% | 5.11% | −2.8 |

MA over-indexes on **medical-expense, dependent-care, and unemployment errors**
relative to CA — exactly the elements a coached intake form is structurally
well-positioned to reduce (clients often forget to claim medical expenses, or
misreport dep-care; UI is a verification element). MA under-indexes on
**self-employment** and (slightly) shelter.

The shelter + wages composite is essentially identical between states (MA 60.05%,
CA 60.80%), confirming the dominant-pair pattern is national, not state-specific.

## Why it matters

This finding **doubly** flips the strategic framing of the MA pilot:

1. **The "MA has cleaner pipeline → less Pillar-1 headroom" framing is doubly
   wrong.** First, MA's *officially-published* FY2024 PER (14.10%) is actually
   *higher* than CA's (10.98%), giving MA more headroom, not less. Second,
   even using the FY2023 raw-QC same-method comparison (where MA's 7.76% is
   lower), the residual errors over-index on the elements Civica's coached
   intake actually addresses (med/dep-care/UI). The MA pitch for Pillar-1
   should re-frame from *"catch DTA operational errors"* (the CA frame) to
   *"help clients self-report cleanly on the elements MA actually fails most"*
   — and the official published baseline supports a *stronger* Pillar-1 case
   for MA than the FY23 raw-QC numbers initially suggested.

2. **Pillar-3 retention remains the strategic lead** — MA's lower PER means
   less Type-2 error to recover, but MA's procedural denial pattern (CAPER
   21.08%, [[2026-05-29-caper-denial-side-error]]) and the causal burden→
   enrollment evidence ([[2026-05-30-regression-burden-participation]]) still
   provide more headroom than Pillar-1 in MA.

3. **§10105 federal cost-share exposure is materially smaller for MA than CA**
   (MA further from the penalty band if §10105 is banded — counsel question
   open per `mission-map-2026-05-31.md:200`). This reduces B2G urgency in MA
   relative to CA but doesn't reduce the SaaS/CBO pitch, which is the actual
   MA-pilot motion.

4. **The retailer footprint is concentrated.** 72% of MA's 5,321
   EBT-authorized retailers sit in Project Bread's primary catchment counties
   (Suffolk, Middlesex, Norfolk, Essex, Worcester, Hampden) — Find-Help seed
   and offer-catalog scoping for the pilot is tractable.

5. **Methodology is now state-agnostic and validated.** The same
   `--multi-element` ingest reproduces the CA reference output to within
   0.25pp on every top-10 element. Any future state extension (NY, TX, FL, …)
   needs only a state code, not a methodology port.

## What changes

- **MA pilot pitch deck** should lead with the element-mix delta (med/dep-care/UI)
  rather than the headline PER number. The headline PER alone *understates*
  Civica's MA value because the residual errors are Civica-shaped.
- **Engine reference constants are now state-keyed** as of 2026-06-01.
  `packages/snap-qc-engine/src/scoring/error-risk.ts` now exports
  `MA_BASELINE_PER` (14.10), `MA_BASELINE_FISCAL_YEAR` (2024),
  `MA_INCOME_GROUP_PER_FY23`, `MA_ELEMENT_ATTRIBUTION_FY23`, the
  `STATE_CONSTANTS` registry, and `*ForState` function variants
  (`computeProjectedPERForState`, `pillarContributionForState`,
  `computeEngagementImpliedPERForState`, `perPacketGapContributionForState`).
  CA-default behavior is preserved — all 297 prior tests still pass.
  Working assumption flagged in code comment: the per-pillar SHARES used in
  state-aware functions are still CA-derived (`PILLAR_SHARES_UNNORMALIZED`);
  MA's actual element mix differs (medical/dep-care over-index). Re-deriving
  per-state pillar shares is the natural follow-up if Civica adds a third
  pilot state.
- **Truth-point snapshot** (`error_rate_snapshot`) should add a `state` column
  and write both CA and MA rows once MA QC outcomes start flowing through
  `qc_outcomes`. Until then, the MA row reports the FY2023 QC baseline as
  `source = "usda_qc_baseline"`, mirroring the existing CA `baseline` row.
- **Project Bread targeting heatmap** (MA equivalent of PR #288's CA build)
  should weight by error-prone-element density per-county once the MA SNAP-Gap
  PUMA estimates land (raw PUMS inputs already vendored at
  `tools/ma-snap-gap/data/`; builder rebuild deferred).

## Open questions

- ~~**AGENCY-null rate is 61% in MA vs 6% in CA**~~ **RESOLVED 2026-06-01
  (structural).** Cross-year check confirms MA's AGENCY-null rate is a
  **state-level practice difference**, not a year-specific anomaly:

  | Year | State | Errored | EL slots | AG slots | AGENCY-null share |
  |---|---|---:|---:|---:|---:|
  | FY22 | CA | 322 | 374 | 345 | 7.8% |
  | FY22 | MA | 333 | 382 | 145 | **62.0%** |
  | FY23 | CA | 378 | 465 | 435 | 6.5% |
  | FY23 | MA | 367 | 431 | 167 | **61.3%** |

  MA reviewers structurally do not fill the AGENCY field as completely as CA
  reviewers do (~7× the null rate, persistent across both years checked).
  The 25.9/74.1 operational/client split derived for MA FY2023 is therefore
  based on only ~38% of MA's classifiable slots — a biased subset, not a
  representative slice. **Do NOT publish or pitch on the MA responsibility
  split.** Resolution requires either (a) the MA-specific QC review codebook
  (if one exists separate from the federal Tech Doc Ch. V), or (b) direct
  contact with USDA FNS or MA DTA. A cross-state survey would tell us
  whether MA is the outlier or part of a regional pattern, but doesn't
  unlock the split for publication.

- **Cross-year MA-vs-CA direction reversed FY22→FY23 in raw QC.** CA
  worsened (raw PER 9.11% → 10.45%, consistent with the published 13.40%
  FY23 peak), while MA improved (8.81% → 7.76%). The element-mix
  over-indexing on medical (6.87% → 9.46%), dep-care (4.23% → 5.41%) is
  **stable across both years** — that pitch finding is robust. Without MA's
  *published* FY22/FY23 baselines (not in the per-state dataset, which is
  FY24-only), we can't fully reconcile this with the FY24 published
  direction (MA 14.10% > CA 10.98%). Two possibilities: MA's PER actually
  rose substantially FY23→FY24 (raw → published methodology gap stayed
  similar), or MA's raw-to-published gap is larger than CA's and the
  direction swap is an artifact. A multi-year MA published panel (analog of
  the CA panel at `data-ops/sample/snap-per-by-state/per_ca_panel.json`)
  would resolve this — reproducible PDF extraction work, not a deep blocker.

- **No QC dollar-tolerance threshold applied.** Both MA's 7.76% and CA's
  10.45% are raw `sum(w × |error$|) / sum(w × benefit$)` — they omit the
  official $56 (FY2023) per-case tolerance the federal-published rate
  applies. Comparisons between MA and CA here are apples-to-apples (same
  method), but neither matches the official FNS-published PER. The
  *direction* of the MA<CA finding is robust to tolerance choice; the
  *absolute* numbers shift.

- **Element labels 365/350/323 over-index in MA but the engine constants
  registry doesn't include all three with the same labels.** Cross-check
  against FY2023 Technical Documentation Ch. V before publishing element labels.

- **n=367 attributable errored cases is small for subgroup inference.** The
  med/dep-care/UI deltas are real but their confidence intervals are wide; a
  multi-year MA panel (FY2021–FY2023, when ICPSR releases) would tighten them.

## How to reproduce

```bash
cd tools/usda-qc-ingest
.venv/bin/python src/ingest_qc.py build \
  --data ~/Downloads/qc_pub_fy2023.csv \
  --state MA --state-code 25 \
  --col-state STATE --col-weight FYWGT \
  --col-error AMTERR --col-benefit FSBEN --col-earned FSEARN \
  --multi-element
```

Related findings:
- [[2026-05-29-caper-denial-side-error]] — MA denial-side erroneous 21.08%, lower than national median; this finding shows the same direction at the QC level.
- [[2026-05-29-error-rate-truth-point]] — the methodology discipline (deterministic job computes; AI explains) that gates publication of these numbers as canonical.
- [[2026-05-28-civica-tam-repositioning]] — the CA earned-income TAM framing; the MA equivalent will need its own re-derivation once `tools/ma-snap-gap/` ships.
- [[2026-05-28-retention-pillar-unrath]] — the Pillar-3 retention lead which remains the strategic leader in MA given the lower Pillar-1 headroom.
