---
id: 2026-05-30-obbba-10105-grounding
date: 2026-05-30
scope: [analytics, pitch, compliance, snap-qc-engine]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "USDA FNS SNAP QC Payment Error Rates FY2024 (per by state) + FNS National/State Monthly Data (FY24 issuance)"
    note: "Real published data; national avg PER = 10.93%, CA = 10.98%, CA FY24 issuance = $12.18B."
  - kind: file
    ref: data-ops/sample/snap-per-by-state/per_by_state_fy24.csv
    note: "Every state's FY2024 PER + SNAP issuance — the §10105 inputs."
  - kind: file
    ref: apps/dashboard/lib/analytics/section10105.ts
    note: "Grounded the model: real PER × issuance × tier schedule; corrected the relative-to-national trigger to the absolute-tier mechanism; replaced the fabricated 4.2% cohort PER with the client-error floor."
  - kind: file
    ref: data-ops/sample/obbba-scenarios/obbba_rollup.json
    note: "The prior scenario fixture ($1.72B CA liability) this grounds — the $1.83B real figure validates its absolute-tier interpretation."
---

## What we found

We grounded the project's OBBBA **§10105** cost-share model — previously
all-fixture — in real federal data. §10105 ties a state's share of SNAP
*benefit* cost to its payment error rate (PER), turning the PER into a budget
liability. The real numbers:

- **CA FY2024 PER = 10.98%** → top absolute tier (≥10% → 15% benefit-cost share).
- **CA FY2024 SNAP issuance = $12.18B** (real, FNS monthly).
- **CA §10105 exposure ≈ $1.83B/yr** (issuance × 15%) — independently
  validating the prior `obbba_rollup` fixture's $1.72B and its absolute-tier read.

**Two corrections the real data forced:**

1. **The trigger is absolute PER tiers, not "≥105% of the national average."**
   The demo assumed an 8.6% national average; the **real FY2024 national PER is
   10.93%**, and **CA at 10.98% is at the *median* (1.005×)** — *not* a relative
   outlier. A relative trigger gives CA ~zero exposure; only the absolute tier
   exposes it. The old test literally asserted "CA PER ≥ 105% × national — the
   load-bearing claim of the B2G pitch"; real data falsifies it.
2. **The "Civica cohort PER = 4.2%" (the source of the "error 60% less"
   tagline) was fabricated.** Replaced with the honest client-error floor
   (35% × statewide = **3.84pp** for CA) — the modeled *ceiling* on reduction,
   not a measured result.

## Why it matters — the wedge, quantified and bounded

- **The first tier crossing is the pitch.** CA dropping 15%→10% share needs a
  **0.98pp** PER cut — ~14% of its operationally-addressable error (7.14pp of
  headroom) — and **saves ~$610M/yr.** That is squarely in Civica's wheelhouse
  and is now a real, defensible number, not a fixture.
- **It bounds the over-promise.** Each deeper tier costs ~3pp then ~5pp; CA's
  **3.84pp client-error floor** is the wall — Civica can move CA down a tier or
  two, never to zero. Honest, and still worth nine figures a year.

## Where error reduction is hardest (data-ranked)

1. **The ~35% client-caused floor** (≈3.84pp for CA) — applicant-side error a
   bridge can't reach. Sets the hard minimum under any §10105 tier.
2. **Over-cap shelter** — biggest error *count* (~40%) but ~0 benefit leverage
   ([[2026-05-29-policyengine-benefit-leverage]]); messy to verify, low payoff.
3. **Volatile earned-income** — highest dollar-leverage to fix, but a moving
   monthly target (gig/hourly).
4. **The new ABAWD work-requirement surface (55–64)** — a brand-new procedural
   error/churn channel OBBBA creates, with no track record.

## The pivot that decides who to sell to

**Is §10105 banded (absolute tiers) or continuous (proportional)?** The repo's
two artifacts model it both ways and they diverge for CA. If **banded**,
marginal reduction is worthless until it crosses a threshold → target
mid-error states sitting just above a band edge. If **continuous**, CA's huge
issuance base makes every point worth real money → CA is the best target. **This
is statutory, not in the data — settle it with counsel before pitching dollars.**

## Honest limits

- **Tier schedule is a statutory assumption** (encoded + flagged in
  `TIER_SCHEDULE`); confirm thresholds/shares/effective-FY + the FY2025/26
  lookback against the enacted text.
- Issuance is total SNAP issuance; the actual cost-share *base* may exclude
  admin/EA — a refinement, not a reversal.
- The relative-trigger framing also lives in `lib/analytics/transforms.ts`
  (untouched here) — flag for the same correction.

Related: [[2026-05-29-usda-qc-ca-grounding]] (the 65/35 split) ·
[[2026-05-29-data-snap-per-by-state]] (PER panel) ·
[[2026-05-30-data-fns-state-monthly]] (issuance base) ·
[[2026-05-30-regression-burden-participation]] (BBCE-removal → churn → PER-drift mechanism).
