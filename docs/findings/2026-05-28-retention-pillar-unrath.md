---
id: 2026-05-28-retention-pillar-unrath
date: 2026-05-28
scope: [retention, pitch, snap-qc-engine, research]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: external
    ref: "https://mattunrath.github.io/files/research/Unrath_SNAP.pdf"
    note: "Unrath, M. (2024). 'Targeting, Screening, and Retention.' CA admin panel, 16M Californians, 2005–2023. The citation-grade source."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/retention-risk.ts
    line: 191
    note: "scoreRetentionRisk() — G1 scorer; predicts P(exit at next reporting moment), coefficients anchored to the Unrath panel."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/retention-risk.ts
    line: 11
    note: "Header comment citing Unrath + the 11% baseline reporting-month exit rate for zero-earnings cases (paper §4.4)."
  - kind: pr
    ref: "https://github.com/matthewgg22/Civica/pull/284"
    note: "G1 scoreRetentionRisk() + G2 re-entry endpoints shipped 2026-05-27."
  - kind: memory
    ref: project_unrath_retention_pillar
    note: "Decision to add retention / Type-1 error reduction as the second pitch pillar; build order G1 → G2 → G4, with G3/G5 deferred."
---

## What we found

Civica gains a **second pitch pillar — retention / Type-1 (false-exit) error reduction** — alongside the primary county / intake-QC pillar. The evidence base is Unrath (2024), "Targeting, Screening, and Retention," built on a CA administrative panel (16M Californians, 2005–2023):

- **~40%+ of CA SNAP spells end at a periodic reporting moment** (SAR7 at 6mo, recert at 12mo, etc.) — i.e., churn is driven by *paperwork events*, not by genuine ineligibility.
- The **eligible-to-ineligible exit ratio is ≈2:1** — for every household that correctly exits at a reporting moment, roughly two *still-eligible* households exit. **Type-1 error dominates.** Most reporting-moment exits are people who should have stayed.

This is the load-bearing fact: the dominant SNAP failure mode in CA is dropping eligible households at administrative checkpoints, which is exactly what a retention scorer + re-entry assist can attack.

## Why it matters

- **A second, distinct value proposition.** Intake-QC reduces *entry-stage* error; the retention pillar reduces *exit-stage* (false-churn) error. Different stage, same auditable engine, two reasons for a county to buy.
- **Citation-grade, not modeled.** The 2:1 ratio and the ~40% reporting-moment exit share come from a peer-quality study on real CA admin data — defensible under the USDA Advanced Automation guidance in a way that our internal estimates are not.
- **Already shipped, not just argued.** `scoreRetentionRisk()` (G1) and the re-entry suggestion endpoints (G2) are live as of PR #284.

## What changes

- The pitch carries **two pillars**: county/intake-QC (primary) + retention/Type-1 reduction (Unrath-backed, secondary).
- Build order is **G1 retention scorer → G2 re-entry assist → G4 PhantomRecert hero**; G3/G5 deferred.
- `scoreRetentionRisk()` predicts P(exit at next reporting moment) and flags the medium+ tier — directly surfacing Unrath's central finding (most reporting-moment exits are still-eligible households).

## Open questions

- **Do not quote MVPF = 4.25 verbatim.** That marginal-value-of-public-funds figure is assumption-dependent; lean on the **direction** and the **2:1 eligible-to-ineligible ratio**, which are robust. Quoting the point estimate invites a methodology fight we don't need.
- **Coefficients need local calibration.** The scorer's coefficients are anchored to Unrath's statewide panel, not Civica's own outcomes; they'll need refinement once Civica accumulates real retention data.
- **Reporting-window coverage.** The scorer returns `no-reporting-window` when no SAR7/recert is scheduled in the horizon — fine, but it means the pillar only bites for households inside a reporting cycle. Coverage at any point in time is bounded by who's near a checkpoint.

Related: [[2026-05-28-error-attribution-framework]] — the proposed error ledger would route retention-churn events into the same per-slice attribution table, so the retention pillar and the intake-QC pillar read from one schema. [[2026-05-28-civica-tam-repositioning]] — both pillars target the earned-income subgroup, where reporting-moment churn is highest.
