---
id: 2026-05-29-policyengine-benefit-leverage
date: 2026-05-29
scope: [analytics, snap-qc-engine, pitch]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: data-ops/sample/policyengine-ca/element_leverage_fy2024.json
    note: "Offline PolicyEngine US (v1.715.2, FY2024 params) over a 64-household representative CA panel. Per-element benefit leverage + the shelter cap split."
  - kind: file
    ref: tools/policyengine-ground/src/leverage.py
    note: "Reproducible harness. AGPL boundary documented in the README — run offline, ship outputs only, never imported into runtime."
  - kind: url
    ref: "https://github.com/PolicyEngine/policyengine-us"
    note: "AGPL-3.0 OpenFisca model of the US tax/benefit system, incl. federal + CA CDSS SNAP rules. Used offline; outputs are facts."
---

## What we found

The **modeled** lens for the error-rate page. QC says *which* parts of an
application error (shelter, wages, …). PolicyEngine says *how much each one
costs* — the benefit-dollar impact of a $1 error in each part, run over a
representative CA household panel (FY2024 params):

| Error in… | Benefit lost per $1 | Why |
| --- | --- | --- |
| **Unearned income** | **~$0.30** (median) | counts ~dollar-for-dollar into net income × the 30% benefit-reduction rate |
| **Wages** | **up to ~$0.24** | the 20% earned-income deduction softens each dollar |
| **Shelter (elderly/disabled)** | **~$0.30** | excess-shelter deduction is uncapped |
| **Shelter (non-elderly)** | **~$0** for ~72% | already over the excess-shelter cap (high-rent CA) |

Mean correct benefit across the panel: ~$354/mo.

## Why it matters

It **re-weights the error story from case-frequency to dollar-leverage**, and the
two disagree in a useful way:

- QC by **case frequency**: shelter is #1 (≈40% of errored cases), wages #2.
- PolicyEngine by **dollar leverage**: **income** is the most expensive thing to
  get wrong (~30¢/$; 24¢ for wages), while shelter — though the most *frequent*
  error — moves $0 for the ~72% of non-elderly CA renters already over the cap.

So the dollar-weighted error tilts toward **income** more than the case-count
shares suggest — and income is exactly the part **automated payroll verification**
fixes. The modeled lens turns "Civica verifies income" from a feature into the
highest-dollar-leverage move on the board.

This completes the page's evidence triangle: **measured** (QC overpayments +
CAPER denials), **witnessed** (Guarino), **modeled** (this).

## What changes

- `/findings/error-rate` gains a "what a mistake actually costs (modeled)" block.
- Vendored artifact + reproducible harness `tools/policyengine-ground/`; cited
  const `apps/dashboard/lib/analytics/ca-policyengine-grounding.ts`.

## Open questions / honest limits

- **Synthetic panel, not per-case QC.** The households are a representative grid,
  not the actual 867 QC cases. Confidence medium. Next: seed the panel from the
  QC marginals (size/income) for a tighter match.
- **Leverage ≠ realized error.** This is the *transfer rate* (benefit $ per input
  $), not the dollar size of errors that occur. The realized dollar-weighted error
  by element is computable from the QC AMOUNT fields — a clean way to *confirm*
  the income-tilt prediction. Deferred.
- **Floors/thresholds** pull the per-household median below the structural rate
  (e.g., wages median 0.135 vs structural 0.24); the page cites the structural
  rate with the cap/floor caveats.
- **AGPL:** PolicyEngine is AGPL-3.0; used offline only, never linked into a
  Civica runtime.

Related: [[2026-05-29-usda-qc-ca-grounding]] · [[2026-05-29-caper-denial-side-error]] · [[2026-05-29-guarino-error-rate-metric]] · [[2026-05-29-error-rate-truth-point]]
