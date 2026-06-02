---
id: 2026-06-01-ma-pilot-snap-gap
date: 2026-06-01
scope: [ma-pilot, snap-gap, project-bread, baseline]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "data-ops/sample/ma-snap-gap/ma_snap_gap_puma.csv@2026-06-01"
    note: "54 MA PUMAs, weighted eligible-non-enrollee counts at both 130% FPL (federal gross-income test) and 200% FPL (BBCE — MA/CA realistic threshold)."
  - kind: dataset
    ref: "data-ops/sample/ma-snap-gap/ma_snap_gap_summary.json"
    note: "Project Bread catchment overlay: 6 counties (Suffolk + Middlesex + Norfolk + Essex + Worcester + Hampden), 41 of 54 PUMAs, per-county breakdown."
  - kind: file
    ref: tools/ma-snap-gap/build.py
    note: "Reproducible builder. Inputs vendored under tools/ma-snap-gap/data/csv_hma.zip (2023 ACS 1-Year PUMS, MA)."
  - kind: url
    ref: "https://www2.census.gov/programs-surveys/acs/data/pums/2023/1-Year/csv_hma.zip"
    note: "Public-domain federal source for the PUMS household file."
  - kind: url
    ref: "https://www2.census.gov/geo/docs/reference/puma2020/2020_Census_Tract_to_2020_PUMA.txt"
    note: "Census official tract-to-PUMA crosswalk used for the PUMA→county dominant-county mapping (covers all 14 MA counties + 54 PUMAs)."
  - kind: dataset
    ref: "data-ops/sample/usda-qc-ma/ma_qc_fy2023.json"
    note: "MA QC element mix (FY2023): shelter 37.8%, wages 24.3%, medical 9.5%, dep-care 5.4%, UI 3.5% — the elements over-indexing in MA relative to CA are precisely what Civica's coached intake reduces."
  - kind: dataset
    ref: "data-ops/sample/usda-snap-retailers-ma/manifest.json"
    note: "Cross-validation: Project Bread catchment = 72% of MA retailers, exactly matching the 72% catchment share of state SNAP-gap. Two independent geographies align."
  - kind: file
    ref: docs/findings/2026-06-01-ma-state-baseline.md
    note: "Companion finding: MA PER + element mix story (FY2024 published 14.10% vs FY2023 raw 7.76% raw; element-mix delta is stable across years)."
  - kind: file
    ref: docs/designs/cbo-caseworker-mode.md
    line: 168
    note: "MA-first caseworker-mode design partner: Project Bread / FoodSource Hotline. This finding sizes their pre-pilot opportunity."
---

## What we found

**There are 125,386 SNAP-eligible non-enrollee households in Project
Bread's catchment** (federal 130% FPL gross-income basis) — **rising to
219,160 at the realistic 200% FPL BBCE basis MA actually operates**.

Project Bread serves 71.9% of MA's total SNAP-gap (130%) / 71.0% (200%)
through their 6-county footprint (Suffolk + Middlesex + Norfolk + Essex +
Worcester + Hampden). The catchment's 72% gap share **exactly matches**
its 72% share of MA SNAP-EBT retailers — two independent geographies
align, validating that Project Bread is positioned where the eligible-
but-unserved population actually lives.

**Per-county breakdown (Project Bread catchment, 200% FPL):**

| County | Eligible HHs | Non-enrolled | Rate |
|---|---:|---:|---:|
| **Middlesex** | 93,797 | **59,514** | **63.4%** |
| Suffolk | 87,695 | 41,411 | 47.2% |
| Essex | 70,968 | 35,919 | 50.6% |
| Worcester | 68,295 | 32,433 | 47.5% |
| Norfolk | 47,315 | 27,556 | 58.2% |
| Hampden | 58,496 | 22,327 | 38.2% |

**Surprise finding:** Middlesex is the biggest opportunity in the catchment,
not Suffolk/Boston. Middlesex has BOTH the highest absolute non-enrollee
count (59K) AND the highest non-enrollment rate (63.4%) — meaning 63% of
SNAP-eligible Middlesex households are not enrolled. Cambridge + Lowell +
Newton + Somerville + Framingham represent more eligible-but-unserved
households than Boston proper.

## Why it matters

**This is the Project Bread pitch sized in real numbers, not narrative.**
The single sentence: *"In your catchment alone, 125,000–219,000 SNAP-
eligible households are not enrolled. That's where Civica's coached
intake — built specifically for the elements MA over-errors on — moves
the needle."*

Combined with the [companion finding](2026-06-01-ma-state-baseline.md) on
MA's QC element mix, the full pitch:

1. **The population is real and well-sized** (this finding) —
   125K–219K eligible non-enrollees in catchment.
2. **MA's residual error mix is Civica-shaped** ([baseline](2026-06-01-ma-state-baseline.md)) —
   MA over-indexes on medical (9.5% vs CA 4.0%), dep-care (5.4% vs 2.0%),
   and unemployment (3.5% vs 0.7%) — the elements a coached intake form
   reduces.
3. **MA's published PER (14.10%, FY2024 FNS-380) is HIGHER than CA's
   (10.98%)** — giving Civica more headroom for measurable reduction in MA
   than CA, despite the FY2023 raw-QC direction reversal (see baseline
   finding's open question).
4. **The infrastructure already aligns** — Project Bread's 72% catchment
   share of SNAP retailers = 72% share of the eligible-non-enrollee gap.
   Geographic targeting is already correct.

For the DTA conversation (June 18 approval target):
- The methodology is **reproducible from public federal data** — Census
  PUMS + Census tract-to-PUMA crosswalk + HHS Poverty Guidelines. No
  proprietary models, no private data, no judgment calls in the
  eligibility filter.
- The numbers **cross-validate** against an independent USDA dataset
  (retailer count by county). Internal-consistency check before any
  external scrutiny.
- The honest framing — "fact base of weighted counts, no predictive
  model" — matches the discipline of [the truth-point finding](2026-05-29-error-rate-truth-point.md):
  *AI explains; a deterministic job computes.*

## What changes

- **Mission map** (`docs/strategy/mission-map-2026-05-31.md`) should
  add this finding's headline numbers to the distribution-strategy
  block — currently sized via union/gig channel projections that don't
  apply to MA. The MA pilot has its own concrete number set now.
- **Project Bread meeting deck**: lead with "125K–219K in your catchment"
  and the Middlesex finding (their second-biggest county after Suffolk
  is the biggest opportunity). The element-mix story comes second.
- **DTA June-18 approval packet**: cite this finding alongside the
  baseline. The dual-cross-validation (retailer footprint vs PUMS gap)
  is the methodological hook to lead with.
- **Caseworker mode v1 ranking**: the Middlesex finding suggests the
  pilot rollout should land the **Cambridge + Lowell** Transitional
  Assistance Offices first (highest Middlesex impact), then Boston
  Downtown, then Springfield. Currently `Civica/Features/SNAP/FindHelp/Fixtures/ma_seed_locations.json`
  has all major DTA TAOs but no priority weighting.

## Open questions

- **PUMS self-reported `FS` under-counts admin SNAP receipt.** Census
  surveys consistently show ~5–15pp under-reporting of program receipt
  vs administrative records (see e.g. Meyer et al. 2018 on SIPP/CPS;
  same pattern in ACS). The catchment gap of 219K is therefore an
  **upper bound** — true unserved population is somewhere between 184K
  and 219K. The directional finding holds; the headline number should
  be quoted as a band.
- **Predictive model layer not built.** CA's `ca-snap-gap-v0.1.0` ships
  a 45-feature HistGradientBoosting classifier on top of the fact base
  (CV AUC 0.80). Replicating this for MA is a ~1-day data-science task;
  it lets us identify *which* eligible HHs are most likely to be
  unserved (predictive demographics) rather than just the per-PUMA
  count. Not blocking for Project Bread / DTA pitches; useful for
  navigator-level outreach targeting later.
- **Middlesex non-enrollment rate is unusually high (63.4%).** Worth
  cross-checking against any MA DTA enrollment-by-county statistics if
  Project Bread has access. If real, it's a meaningful operational
  finding (Cambridge/Lowell area has known SNAP-access friction that
  could be Civica-addressable).
- **2024 ACS PUMS** (the first post-OBBBA snapshot) releases September
  2025. Rerun this builder then for the canonical post-§10102 baseline.

## How to reproduce

```bash
cd tools/ma-snap-gap
python3 -m venv .venv
.venv/bin/pip install pandas
.venv/bin/python build.py
# Writes data-ops/sample/ma-snap-gap/{ma_snap_gap_puma.csv, summary.json, model_card.json}
```

Related findings:
- [[2026-06-01-ma-state-baseline]] — the QC element-mix companion. This finding
  is the *audience-size half*; that one is the *what-to-fix-when-you-touch-them half*.
- [[2026-05-29-error-rate-truth-point]] — the methodology discipline this
  finding follows: reproducible artifact, public data, no fabrication.
- [[2026-05-28-distribution-union-gig-channels]] — CA-equivalent
  distribution strategy. The MA pilot now has its own catchment-grounded
  numbers; the union/gig channels don't transfer to MA.
- [[2026-05-28-retention-pillar-unrath]] — the burden-reduction → enrollment
  causal regression. Sizing how much of the 219K catchment gap a coached
  intake actually closes will need Civica-side data once the pilot ships.
