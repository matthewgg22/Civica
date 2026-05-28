---
id: 2026-05-28-usda-advanced-automation-scope
date: 2026-05-28
scope: [b2g, compliance, regulatory, caseworker-mode]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: external
    ref: "https://www.fns.usda.gov/snap/advanced-automation"
    note: "USDA FNS 'Advanced Automation' guidance (Jan 10, 2024): state SNAP agencies must pre-notify (and often get permission from) FNS before deploying automation — AI, OCR, rules engines — in eligibility determination."
  - kind: memory
    ref: project_usda_advanced_automation
    note: "Founder read 2026-05-28 (NOT a live blocker for CBO-facing scope) + B2G positioning guidance + the consumer-vs-caseworker scope question for counsel. Sourced via Dave Guarino's 'overloaded state agencies' essay."
---

## What we found

USDA FNS's **"Advanced Automation" guidance (Jan 10, 2024)** governs *state-agency* automation of SNAP **eligibility determination** — the determination itself. **Founder read (2026-05-28): it is NOT a live blocker for Civica's current CBO / household-facing scope.** Civica helps a household assemble a packet; the county still makes the determination, which sits outside Advanced Automation's scope.

It becomes load-bearing only if Civica extends *into* the determination — e.g. Generate-style features that auto-draft eligibility outcomes (per the snap-rules Validate / Mutate / Generate split). Validate (a household previewing its own eligibility) is low risk; Generate (artifacts that influence a county's determination) is the entry point that triggers scrutiny.

## Why it matters

- **B2G credibility signal.** Surfacing this regulation *before the county does* — "USDA-Advanced-Automation-aware by design" — is a trust signal in a B2G conversation, even though it does not gate the current product.
- **Same regulatory bucket** as the [[2026-05-28-argyle-evidentiary-standard]] open question (Argyle vs 7 CFR 273.2(f)). Both are the federal ground caseworker mode must navigate *if* it touches determination.
- **Safe caseworker-mode framing** (per Dave Guarino): "we reduce caseworker burden, not their determination authority." An AI-conducted routine interview, with merit staff reserved for contested / opt-out cases, is the defensible shape.

## What changes

- Add Advanced Automation to the `/compliance` open-questions list, alongside Argyle / 273.2(f).
- Any future product surface that auto-drafts eligibility outcomes needs an Advanced Automation analysis + counsel sign-off before a county pilot. The OBBBA counsel review (Track 2/3) should cover this regime explicitly.

## Open questions

- Does the guidance distinguish consumer-facing self-screening (likely exempt) from caseworker-facing determination pre-fill? Confirm via counsel.
- What is the typical state pre-notification response timeline (it affects pilot timelines)?
- Has CDSS published a CA interpretation — check All County Letters from 2024 onward?
