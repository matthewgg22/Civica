---
id: 2026-05-28-argyle-evidentiary-standard
date: 2026-05-28
scope: [compliance, b2g, verification, regulatory]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: external
    ref: "https://www.ecfr.gov/current/title-7/part-273/section-273.2#p-273.2(f)"
    note: "7 CFR 273.2(f) — the SNAP intake verification / documentation evidentiary standard Argyle must satisfy to serve as an audit trail."
  - kind: file
    ref: apps/dashboard/components/compliance/VerificationStackPanel.tsx
    line: 571
    note: "Argyle payroll connection framed as the load-bearing income-verification tool for gig/platform workers on the /compliance roadmap (P4 verification stack)."
  - kind: memory
    ref: project_compliance_page_strategy
    note: "The open question + 2026-05-28 scope changes: Canvas dropped, Argyle deferred past T0, and /compliance is a founder roadmap, not an external pitch surface."
---

## What we found

The single most load-bearing open question for Civica's B2G audit-trail story: **does Argyle digital income verification satisfy the 7 CFR 273.2(f) evidentiary standard for SNAP intake?**

- **If yes** → Civica is a compliance *accelerant*: the authenticated 1099 / W-2 pull is the audit trail, and the B2G "we produce the verification record" story holds.
- **If no** → counties can use Civica for enrollment UX, but not as the audit trail. The pitch narrows to experience, not compliance.

Scope as of 2026-05-28: **Canvas was dropped** as a second income-verification integration (over-engineering for stage; Argyle alone covers the gig-income case). **Argyle is deferred past T0** — off the launch critical path but still on the roadmap — so the compliance research is not urgent for v1, but must close before any B2G contract.

## Why it matters

- It determines whether Civica's B2G value proposition is "better UX" or "the compliant audit trail" — a different, higher-value sale.
- Argyle is the income-verification spine for the earned-income cohort that the [[2026-05-28-civica-tam-repositioning]] pitch and the [[2026-05-28-distribution-union-gig-channels]] gig channel both target — it is what makes variable gig income legible to intake.
- Same federal bucket as [[2026-05-28-usda-advanced-automation-scope]].

## What changes

- Treat `/compliance` as a **founder strategic roadmap**, not an external pitch surface — its scenario-modeled figures are appropriate for that purpose. Flag a claim only when it would need grounding before entering a B2G conversation.
- Before any B2G contract closes, get counsel to answer the 273.2(f) question for Argyle specifically.

## Open questions

- The 273.2(f) answer itself — unresolved, needs counsel. This finding records the *importance* of the question, not its answer.
- Does the answer vary by income type (W-2 vs 1099 vs gig-platform)? Argyle pulls all three; the evidentiary standard may treat them differently.
