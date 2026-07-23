---
id: 2026-07-23-procedural-over-verification-dominant
date: 2026-07-23
scope: [analytics, mae, product, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "CDSS CalFresh Management Evaluation (ME) Reports, FFY2024–2025 — 38 reports / 36 counties (CPRA production R012681, received 2026-07-23)"
    note: "Per-county denial/termination case-review narratives. Over-verification (CW 2200: requesting docs already on file / not questionable) appears in 37 of 38 county reports. Files staged in operator ~/Downloads, not yet vendored (see DATA_INVENTORY.md §9)."
  - kind: file
    ref: FOIA_DATA_AUDIT_2026-07-23.md
    note: "§2b — 14-theme denial/termination error taxonomy with per-county tallies + verbatim example quotes; §2 case-review aggregate 634/1025 (61.9%) errored, denials the highest-error action type (70–75%)."
  - kind: file
    ref: apps/dashboard/lib/mae/retrieval.ts
    note: "A2 curated 'verification limits' supplement (7 CFR 273.2(f); ACL 21-58) + B1 system-prompt guardrail operationalize this finding in the Mae assistant."
  - kind: pr
    ref: "#581"
    note: "Mae training PR encoding the anti-over-verification guardrail + eval; closes #576-580."
---

## What we found

**Over-verification — requesting documentation the household already provided or that is not required and not questionable — is the single most common documented CalFresh administrative error.** In CDSS's own FFY2024–2025 Management Evaluation reviews, the CW 2200 over-verification pattern appears in **37 of 38** county reports — more prevalent than income miscalculation (25/38). Across the 37 reports with case-review tables, **634 of 1,025 reviewed cases (61.9%) contained an error**, and **denials are the highest-error action type** (typically 5–8 of 8 denials errored per county; ME statewide denial error rate 70–75%). The dominant failure modes are procedural/access, not benefit math: over-verification (37), Notice of Missed Interview sent after the interview was completed (33), verification requested without documenting why it was questionable (32), Expedited-Service entitlement missed in CalSAWS (26), denied after the 30-day deadline (20), The Work Number not checked before requesting income docs (20), denied for "failure to provide" already-provided verification (19).

## Why it matters

This is **government-generated, primary-source** corroboration of the procedural-denial thesis (previously carried by modeled/secondary sources — CF-296, ICPSR 39331). It reframes where the error — and the product opportunity — lives: the breakage is at the *door* (how caseworkers handle verification, notices, and denials), not in whether applicants qualify. It independently supports [[2026-05-31-ca-procedural-denial-panel]] (~1 in 4 CA applications procedurally denied) and [[2026-05-29-caper-denial-side-error]] (denial-side error ~40%), and gives a concrete mechanism for the retention/Type-1-error pillar. **Honest boundary:** this validates the *problem*, not that Civica *reduces* it — no measured Civica outcome exists yet.

## What changes

- **Shipped (PR #581):** Mae now carries an anti-over-verification guardrail (system prompt) + a curated verification-limits authority (retrieval, citing 7 CFR 273.2(f) + CDSS ACL 21-58) so the assistant steers caseworkers away from the documented mistakes rather than into them; a 12-case + 3-adversarial eval pins the behavior.
- **Pitch:** lead the intake/QC pillar with "the state's own auditors document over-verification in 37/38 counties," kept strictly separate from any (still-unmeasured) Civica reduction claim.
- **Next:** the negative-action element codes (540 Notices, 413 Application, 416 Action Type) that dominate the CAPER side are candidates to add to the `packages/snap-qc-engine` error-risk weights.

## Open questions

- ME case reviews are **small-sample per county** (20–30 cases) and case-count, not dollar-weighted — the *aggregate* 37/38 signal is robust but county-level rates are noisy. The dollar magnitude of over-verification is not quantified here.
- The **aggregate coded denial-reason-code distribution** (LA Req 4 / CDSS #2 item 3) is still pending (est. 2026-07-31) — it would let us rank denial reasons by frequency directly rather than via narrative themes.
- Does an over-verification-avoidance nudge measurably change caseworker behavior / the procedural-denial rate? Requires a live Civica or county pilot.
