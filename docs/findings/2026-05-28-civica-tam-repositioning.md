---
id: 2026-05-28-civica-tam-repositioning
date: 2026-05-28
scope: [pitch, tam, cdss, snap-qc-engine]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/cdss-mapping.ts
    line: 377
    note: "CIVICA_TAM_PROFILE — encodes the 13.95% earned-income subgroup PER and the 2.4× ratio to the 5.84% no-earned baseline."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/cdss-mapping.ts
    line: 410
    note: "pitch_framing string — the canonical sentence a county should hear. Source of truth for the repositioning."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/cdss-mapping.ts
    line: 309
    note: "BBCE_REMOVAL_SCENARIO — provenance still `TODO-4-spec`; the engine math (10.98% → 5.50%, a 5.48pp gap) is engagement-driven, not yet externally cited."
  - kind: pr
    ref: "https://github.com/matthewgg22/Civica/pull/273"
    note: "Shipped CIVICA_TAM_PROFILE into the QC engine (commit 3c49cded, 2026-05-27)."
  - kind: memory
    ref: project_civica_tam_repositioning
    note: "Origin of the repositioning; `CIVICA_TAM_PROFILE.pitch_framing` is canonical."
---

## What we found

The headline number a county should hear is **not** the 10.98% statewide payment-error rate (PER). It's the **13.95% PER of the earned-income subgroup** — the population Civica actually serves — which runs **2.4× the 5.84% no-earned-income baseline**. The 10.98% statewide average is dragged *down* by the large no-earned population that Civica does not target, so quoting it understates the error rate exactly where Civica operates.

The repositioning sentence: *"The population you're worried about is the population Civica was built for."* A county's worst error-rate exposure sits in the earned-income caseload (≈27.3% of the caseload, the cohort with churn, fluctuating wages, and SAR7 friction) — and that is precisely Civica's addressable market.

## Why it matters

- **Reframes the B2G pitch around the high-error subgroup, not the diluted average.** Selling against 10.98% makes Civica look like a marginal improvement; selling against 13.95% reframes it as targeted relief for the county's *most* error-prone caseload.
- **It's already encoded, not just a deck claim.** `CIVICA_TAM_PROFILE.pitch_framing` lives in the QC engine, so the same framing that drives the pitch also drives the scoring — they can't drift.
- **Defensible direction even with a soft number.** The *direction* (earned-income PER > statewide average) is structurally true under USDA's QC methodology regardless of the exact value; the repositioning survives even if the 13.95% figure moves.

## What changes

- The pitch leads with the **13.95% subgroup PER and the 2.4× ratio**, not the 10.98% statewide average.
- Civica's projected reduction is framed as **engagement-driven verification** (10.98% → 5.50%, a 5.48pp engine-computed gap), not a claim about removing BBCE or changing eligibility rules.
- Any external-facing use of the BBCE removal scenario waits on real provenance (see open questions).

## Open questions

- **The 13.95% figure is not yet externally cited.** `BBCE_REMOVAL_SCENARIO.provenance` is still `TODO-4-spec`. It must be backed by a CBPP / USDA citation before public use — a test in `cdss-mapping.test.ts` enforces this gate, so the number cannot ship to a partner-facing surface until the citation lands. This is why this finding is **medium**, not high, confidence.
- **Caseload-share stability.** The 27.3% earned-income share is a point-in-time read; OBBBA work-requirement changes could shift the denominator. Re-check against the next FY QC release.

Related: [[2026-05-28-error-attribution-framework]] — the per-slice error ledger is what would let Civica *prove* the earned-income subgroup's PER per county rather than asserting it from the statewide aggregate.
