# Payment Integrity Engine — sibling to the Eligibility and Integrity Engine

**Status:** stub · **Date:** 2026-06-01 · **Companion:** [snap-rules-matrix.md](snap-rules-matrix.md) (the Eligibility and Integrity Engine)

> **The boundary.** The [Eligibility and Integrity Engine](snap-rules-matrix.md) answers *"did we run OUR rules right, consistently, and cite each step?"* — verified **internally** by replay, target ~100%. **This** engine answers the other question: *"do our outcomes match ACTUAL SNAP policy / what a caseworker would pay, in dollars?"* — the federally-audited **payment error rate (PER)**, verified only by **external** ground truth. PER can be nonzero even when eligibility integrity is perfect, because our codified rules may be incomplete or wrong relative to real policy.

This engine is **not built yet** and depends entirely on the eligibility engine's trace + fact snapshot existing first (its L4/L5). Outline only — gets a full plan doc when the eligibility engine's Phase 2 (trace) lands.

## Components

1. **Reconcile** — compare each cited determination to the county's authoritative outcome (the TODO-44 webhook, `packet_outcomes.source = 'county_authoritative'`) → a labeled agree/disagree per packet. This is the step that turns *consistency* into measured *correctness*; it is the only thing that detects a rule that is applied perfectly but is wrong vs. policy.
2. **Measured PER** — dollar-weighted error, computed from authoritative outcomes **only** (`qc_sample` + `county_authoritative`), behind the existing fidelity firewall (`packet_outcomes` CHECK constraint — self-reports may never carry error dollars). Published at n ≥ 30 with a confidence interval.
3. **Error prediction** — estimates P(determination ≠ actual policy) per packet and routes high-risk cases to the navigator review queue instead of auto-handoff. v0 heuristic (citation-bearing priors from findings #417 elderly×shelter, #420 procedural — works at n = 0 ground truth) → v1 model, **blended by credibility weighting** as labels accrue (champion/challenger before promotion; disparate-impact audit on the router, since it routes humans).
4. **§10105 liability overlay** — aggregate PER → state cost-share exposure, modeled IBNR-style with a CI, on a separate plane from any individual determination.

## What it consumes from the eligibility engine
- the cited, replayable `Determination` + its `facts_snapshot` (the prediction features — `Fact.status`/`confidence`/`source_ref` are the highest-value signal)
- the rule `trace[]` (which rules/elements fired → element-level risk)

## What it must never do
- feed back into the eligibility determination (the firewall runs one way)
- let a self-reported outcome move measured PER
