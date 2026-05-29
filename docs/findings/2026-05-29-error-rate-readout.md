---
id: 2026-05-29-error-rate-readout
date: 2026-05-29
scope: [analytics, snap-qc-engine, pitch]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "snap_enrollment.v_error_rate_current @ 2026-05-29T18:02:45Z"
    note: "First live snapshot run, engine 0.3.0 — 29 rows (4 top-line + 5 pillar + 5 income-group + 15 element)."
  - kind: dataset
    ref: "snap_enrollment.snap_packets + argyle_connections + packet_answers + uploaded_documents (diagnostic, 2026-05-29)"
    note: "322 active packets, created 2025-01-17 → 2026-05-23, 9 orgs, 279 submitted; 0 Argyle-linked, 0 SUA-answered, 1 confirmed lease."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/error-rate-snapshot.ts
    note: "buildErrorRateSnapshot — the engine that produced the numbers; engine owns the math."
---

## What we found

First live reading of the canonical error-rate truth point (run 2026-05-29
18:02 UTC, engine 0.3.0):

- **Baseline (published):** CA FY2024 total PER = **10.98%** (USDA FNS-380).
- **Projection (engine):** **5.5%** at full stack engagement (~50% target).
- **Engagement-implied today: 10.69%.**
- **Measured: pending** — 1 QC review, 0 errors, below the n≥30 gate.

**But the live number is reading test data — not production signal.** A
diagnostic of the 322 active packets behind it:

- created over **16 months** (2025-01-17 → 2026-05-23) across **9 orgs**, 279
  marked submitted;
- yet **0 Argyle-linked, 0 SUA-answered, 1 confirmed lease** — effectively
  **zero verification engagement** across the entire population.

279 "submitted" packets with no income or utility verification is not a real
applicant population; it is development / demo / UAT traffic accumulated during
the build (the 9 orgs include the `*.civica.test` UAT set). Civica is
pre-launch, so production volume is ~0. The four addressable pillars therefore
sit at 0% coverage and the only movement (0.29pp) is the always-on
benefit-impact pillar.

**Honest read:** the truth point is live and methodologically correct, but
**engagement-implied 10.69% is an artifact of test data, not a Civica
performance signal.** The system refusing to show a reduction is *correct* —
there is no real traffic to reduce errors on yet.

What IS citable now (published reference data, independent of Civica traffic):

- **Where errors live** (CA FY23, share of errored cases): Shelter **39.94%** +
  Wages **21.35%** = **61%** — exactly Civica's two primary pillars. Unearned
  (RSDI 11.06% + SSI 7.65% + other 6.25%) ≈ **25%** — the irreducible floor.
- **Who has them** (national FY23 PER): earned-income / Civica-TAM **13.95%** vs
  no-earned **5.84%** = **2.4×**. wage-only 15.61%, mixed wage+SE 19.26%.

## Why it matters

- **Guardrail (load-bearing):** do NOT cite the live engagement-implied or
  "measured" PER as a Civica result — it has no production signal. Cite the
  *methodology* and the *reference structure*. This is the truth point doing its
  job: refusing to let a test-data number masquerade as a real one.
- **It re-locates the bottleneck.** Not measurement (built), not "applicants
  failing verification" (there are no real applicants yet) — but **production
  launch with real Argyle / SUA / lease verification**. Every live number here
  is gated on that.
- **The reference layer is pitch-ready today.** 61% of CA errors sit in Civica's
  two pillars; the targeted earned-income cohort runs 2.4× the no-earned rate.
  That is a credible structural argument requiring no live data.

## What changes

- The live PER readout is **parked as not-yet-signal** until production,
  verification-engaged packets exist. Supersede this finding once pillar
  coverage climbs off zero on real traffic.
- Candidate refinement (deferred): filter the snapshot refresh to exclude
  `*.civica.test` orgs so engagement-implied is not diluted by UAT packets once
  real traffic begins.

## Open questions

- Confirm the 9 orgs are predominantly test/UAT (a quick org-name check) — the
  0 Argyle / 0 SUA already strongly implies it.
- When does production traffic begin? That is the gate on every live number.
- Measured PER still needs n≥30 real QC reviews to corroborate the projection.

Related: [[2026-05-29-error-rate-truth-point]] — the method behind this snapshot.
