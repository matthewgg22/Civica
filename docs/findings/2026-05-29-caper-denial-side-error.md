---
id: 2026-05-29-caper-denial-side-error
date: 2026-05-29
scope: [analytics, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "USDA FNS — SNAP Case and Procedural Error Rates (CAPER) FY2024"
    line: 1
    note: "https://www.fns.usda.gov/sites/default/files/resource-files/snap-fy24QC-CAPER.pdf (dated 2025-06-30). Extracted verbatim via pdftotext: CALIFORNIA 39.84, UNITED STATES 43.81, MASSACHUSETTS 21.08."
  - kind: file
    ref: data-ops/sample/usda-caper/caper_fy2024.json
    note: "Vendored full state/territory table + provenance + repro steps (README)."
  - kind: url
    ref: "https://www.fns.usda.gov/snap/qc/caper"
    note: "CAPER definition: error when a state takes one or more inaccurate or procedurally incorrect actions denying, terminating, or suspending benefits."
---

## What we found

SNAP has a **second**, less-cited federal error rate. The payment error rate
(PER) — the one Civica's page already grounds — covers only *approved/issued
payments*. It never looks at the households a state **denied, terminated, or
suspended**. The **Case and Procedural Error Rate (CAPER)** does exactly that:
the share of a state's negative actions that contained one or more inaccurate or
procedurally incorrect actions.

FY2024, straight from the USDA PDF:

| | CAPER FY2024 |
| --- | --- |
| **California** | **39.84%** |
| United States | 43.81% |
| Massachusetts | 21.08% |

Roughly **2 in 5** California denial/termination/suspension actions carried a
case or procedural error.

**And it is structural, not new.** Pulling every available CAPER report
(FY2012–FY2024), CA has stayed in a **32%–40% band every single year** — 32.5%
(FY2012) drifting up to ~39.9% (FY2023–24). Two gaps to read honestly: **FY2020
and FY2021 are absent** (USDA waived SNAP QC during COVID), and **FY2018 = 60.9%**
is a one-year outlier well outside the band. A decade of ~1-in-3 negative actions
carrying an error is a persistent operational gap, not a recent blip. Trend
vendored at `data-ops/sample/usda-caper/caper_ca_trend.json`.

## Why it matters

This is the **measured** answer to the question "is there *data* behind the
operational-error story, not just a quote?" — and it completes a symmetric,
all-federal picture:

- **Overpayment side** (PER / QC microdata, [[2026-05-29-usda-qc-ca-grounding]]):
  ~65% of CA error dollars are operational (agency), not household.
- **Denial side** (CAPER, this finding): ~40% of CA negative actions carry a
  case or procedural error.

Both doors of the program are error-prone, and both are **operational** — process
and paperwork, not policy or fraud. It is the federal-data form of Dave Guarino's
point ([[2026-05-29-guarino-error-rate-metric]]) that the payment rate is blind
to the access side. The pitch line: error is operational on *both* sides, which
is the whole case for getting the case — and the paperwork around it — right the
first time.

## What changes

- `/findings/error-rate` gains a "the other side of the rate" data block directly
  under the Guarino quote, so his point lands as federal data, not rhetoric.
- Vendored `data-ops/sample/usda-caper/caper_fy2024.json` (full table) + cited
  const `apps/dashboard/lib/analytics/ca-caper-grounding.ts`.

## Open questions / honest limits

- **Do not overclaim.** A case/procedural error in a negative action does **not**
  prove the household was eligible — many CAPER errors are procedural (notice,
  timeframe, handling). The honest claim is "the negative action had a case or
  procedural error," not "the person was wrongly denied benefits they deserved."
- **PER and CAPER are not additive** — different denominators (payments vs
  negative actions). Never sum them into one "total error" number.
- The **inaccurate-vs-procedural sub-breakdown** (e.g., CBPP's "~17% of FY2022
  denials/terminations were inaccurate") lives in a separate USDA release — worth
  pulling later for the access-side fraction that is substantively wrong.
- **National trend** (FY2012–FY2024 PDFs are all linked) and **CA churn** (CDSS
  CF 18) would deepen this; deferred.

Related: [[2026-05-29-usda-qc-ca-grounding]] · [[2026-05-29-guarino-error-rate-metric]] · [[2026-05-29-error-rate-truth-point]]
