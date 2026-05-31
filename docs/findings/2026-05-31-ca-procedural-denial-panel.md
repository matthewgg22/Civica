---
id: 2026-05-31-ca-procedural-denial-panel
date: 2026-05-31
scope: [analytics, retention, pitch]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: tools/ca-churn-regression/src/build_ca_churn_regression.py
    note: "The harness. CA county-month panel (ICPSR 39331), procedural-denial rate = APPS_DENIED_PROCEDURAL / APPS_RECEIVED, volume-weighted. Model A = between-county vs time variance shares + county-mean spread; Model B = EA-cliff interrupted time series. statsmodels WLS, cluster-robust by county."
  - kind: file
    ref: apps/dashboard/lib/analytics/ca-churn-results.json
    note: "Results artifact (source_kind=icpsr_39331_panel — REAL CA county-month data). Regenerate from the vendored panel; companion provenance sidecar."
  - kind: file
    ref: apps/dashboard/lib/analytics/ca-churn.ts
    note: "Typed loader; vitest locks the real values + the honest shape (co-equal variance split, EA null)."
  - kind: file
    ref: data-ops/sample/icpsr-39331-enrollment/ca_county_month_enrollment.csv
    note: "ICPSR 39331 (Pukelis) CA county-month, 58 counties × 2016–2024 (4,423 usable county-months). EA end date 2023-02-28 from ICPSR 39703 EA_PEXD."
  - kind: file
    ref: docs/findings/2026-05-29-data-cdss-cf296-denials.md
    note: "The descriptive companion (share-of-denials that are procedural, ~⅔). This finding is the per-application RATE + the county-panel regression dimension."
---

## What we found

On the real **ICPSR 39331 California county-month panel** (58 counties × 2016–2024, 4,423 usable county-months), the **procedural-denial rate** — applications denied for *failed-to-complete / paperwork*, not eligibility, as a share of applications received:

- **~1 in 4 CA SNAP applications is procedurally denied** — volume-weighted mean **23.9%** of applications received (p10–p90 across months ~14–37%). This is the **application door** (Get In), the counterpart to CF-18's *renewal*-door churn (Stay On).
- **A meaningful operational component — but not the majority.** Under **identical statewide rules**, county fixed effects alone explain **31%** of the procedural-denial-rate variance — a substantial, *persistent* between-county (administrative-practice) signal — but **time explains an equal ~31%** (seasonality + the COVID era). Among adequate-volume counties the rate persists at **~19% (p10) → ~32% (p90)**, up to **44.7% (Sonoma)**. So a real, tool-addressable operational slice — honestly, about a third, not "it's all operational."
- **The EA cliff did *not* move procedural denials — a clean null.** Around CA's Emergency-Allotment end (2023-02-28), the post-cliff coefficient is **−1.37 pp [−3.18, +0.44], p=0.14** (12 post-cliff months) — no detectable change. Expected: the cliff cut *benefit amounts*, not application processing.

## Why it matters

- **Sizes the application-door paperwork barrier in hard CA-panel numbers.** A quarter of CA applicants are turned away for paperwork, not ineligibility — exactly the failure a clean-application / completeness tool targets. It cross-validates the CF-296 (~⅔ of *denials* procedural) and CAPER (39.8% of negative actions erroneous) descriptive findings with a *per-application rate* + a *regression* cut.
- **It's the operational-error map's missing regression at the entry door.** QC (overpayment, dollar) + CAPER (denial-side error) + CF-18 (renewal churn) were descriptive; this adds a county-panel decomposition showing a persistent operational component under identical rules.

## Honest limits (what it does NOT say)

- **Not causal.** Model A is a variance decomposition (associational); the operational share is ~⅓, **co-equal with time** — not a claim that procedural denials are "mostly operational."
- **The EA-cliff model is an interrupted time series, not a diff-in-diff** — CA's cliff is a single statewide date with no within-CA control group; the null is honest but weakly identified.
- **Application-side proxy.** This is procedural *denial* of applications, not the dollar PER and not recert/SAR-7 churn (CF-18). Tiny rural counties (e.g. Alpine, ~0 apps) are volume-down-weighted; the spread is p10–p90, not the noisy min/max.

Related: [[2026-05-29-data-cdss-cf296-denials]] (share-of-denials procedural, the descriptive companion), [[2026-05-29-cdss-cf18-churn]] (the renewal-door churn this complements), [[2026-05-31-per-element-error-regression]] (the other real-data per-subset regression, on the QC overpayment side).
