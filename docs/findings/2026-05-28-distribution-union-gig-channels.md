---
id: 2026-05-28-distribution-union-gig-channels
date: 2026-05-28
scope: [distribution, gtm, tam]
confidence: low
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: apps/dashboard/app/compliance/page.tsx
    line: 355
    note: "~544K reachable households — the encoded distribution headline on the /compliance roadmap surface."
  - kind: file
    ref: apps/dashboard/app/compliance/page.tsx
    line: 363
    note: "Channel split: union (SEIU 2015 IHSS + UFW) ~240K + gig-platform onboarding partnerships."
  - kind: file
    ref: apps/dashboard/app/compliance/page.tsx
    line: 601
    note: "Pillar 4 — union/gig channel framed as lowest-CAC because the partner brings the audience."
  - kind: memory
    ref: project_distribution_strategy
    note: "Origin estimates: SEIU 2015 IHSS ~400K members / 55% eligible-unenrolled; gig ~1M CA workers / 35% unenrolled; combined ~544K/yr → ~$1.0B/yr household-side SNAP value."
---

## What we found

The lowest-cost CA distribution channel is **greenfield labor-union and gig-platform partnerships**, not direct-to-consumer acquisition. The partner already owns a trusted relationship with a high-eligibility, low-enrollment audience, so Civica's customer-acquisition cost collapses to an integration rather than a marketing spend.

Concrete channels (estimates):

- **SEIU 2015 / IHSS home-care workers** — ~400K members, ~55% eligible-but-unenrolled → ~220K households.
- **UFW (farmworkers)** — highest eligible-unenrolled hit-rate of any segment.
- **UNITE HERE Local 11** — hospitality, secondary.
- **Gig platforms** — ~1M CA workers, ~35% unenrolled → ~350K households.

Combined ≈ **544K reachable households/yr → ≈$1.0B/yr** in household-side SNAP value. The `/compliance` roadmap encodes the conservative reachable figure (544K × ~$1.9K/yr) and the union-vs-gig split as Pillar 4.

## Why it matters

- **Lowest CAC of any channel.** The partner brings the audience; Civica supplies the enrollment rail. This is the cheapest path to the TAM and the one most defensible in a B2G/B2B2C pitch.
- **Greenfield, not contested.** These cohorts are not being actively enrolled by county outreach today, so the channel is additive rather than a share-grab.
- **Stacks on the TAM repositioning.** These are earned-income households — the same high-PER subgroup the [[2026-05-28-civica-tam-repositioning]] pitch targets. Distribution and pitch point at the same population.

## What changes

- The GTM narrative leads with **union + gig partnerships as Pillar 4**, encoded in `/compliance` Section D.
- Mixed-immigration-status households (~1.4M gap) were **deliberately dropped** from the demonstrable TAM: the unlock there is CBO/legal-aid trust, not a technical capability Civica can demo, so it doesn't belong in a tech-led pitch.

## Open questions

- **None of the conversion rates are validated against Civica data.** The 55% / 35% eligible-unenrolled assumptions are USDA participation-gap-derived, not measured against a real partner cohort. This is why the finding is **low** confidence — it's a sizing hypothesis, not a measured funnel.
- **Partner willingness is unmodeled.** Reachable ≠ enrolled. We have no signed channel partner yet, so the 544K is a ceiling, not a forecast.
- **Per-channel CAC is asserted, not measured.** "Lowest CAC" is directionally sound (partner-owned audience) but un-instrumented.
