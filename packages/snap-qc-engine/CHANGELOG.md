# @civica/snap-qc-engine — CHANGELOG

## 0.3.0 — 2026-05-25

### Added

- **Population PER projection functions** (T0 of `/qc` Error Rate Intelligence redesign, see `docs/plans/qc-error-rate-intelligence-redesign.md`).
  - `computeProjectedPER(coverage: PillarCoverage): number` — projected population PER at supplied pillar engagement rates.
  - `computeEngagementImpliedPER(coverage: PillarCoverage): number` — same math, intent-distinguishing name for callers tracking observed-coverage realization vs. forward projection.
  - `pillarContribution(pillar, engagement): number` — per-pillar PER-reduction contribution in percentage points; at full engagement across all pillars, contributions sum to `CA_BASELINE_PER - PROJECTED_PER_AT_FULL_ENGAGEMENT` (≈5.48 pts).
- **Population PER constants**:
  - `CA_BASELINE_PER = 10.98` (USDA FNS-380 FY2024 California).
  - `PROJECTED_PER_AT_FULL_ENGAGEMENT = 5.5` (thesis §4 target at full stack engagement).
  - `PILLAR_SHARES_UNNORMALIZED` — un-renormalized CA FY2023 element-attribution shares per pillar, with row-by-row FNS-380 citations in source comments (closes eng review CMT3).
  - `RESIDUAL_FLOOR_SHARE` — irreducible floor (~0.25) for elements outside Civica's verification stack (RSDI, SSI, medical deduction, child support, unemployment).
- **`PillarCoverage` type** — struct with named keys (utility_sua / gig_income / shared_lease / assets / benefit_impact), distinct from `ScoringInput[]` so TypeScript catches per-packet vs population API mis-use (eng review A4).
- **Defensive boundaries** — population functions clamp inputs to `[0, 1]`, coerce NaN/Infinity → 0, never throw, never return NaN (eng review CQ2).

### Notes

- All additions are additive — no breaking changes to existing `scoreErrorRisk`, `ERROR_WEIGHT`, `CA_ELEMENT_ATTRIBUTION_FY23` consumers. The 178 existing tests (golden fixtures, parity, flows) pass unchanged.
- The population PER math (option A, 2026-05-25) uses tier-aware per-pillar contributions: `contribution = baseline × pillar_share × max_defensibility_shift × engagement × THESIS_CALIBRATION_FACTOR`. The calibration factor (~0.912) is explicit and traceable — it reconciles the theoretical max reduction (~6.01 pts) with the published thesis target (5.48 pts → 5.5% projected). Interpretable as the empirical leakage between pristine API verification and real-world QC findings.
- `PILLAR_MAX_DEFENSIBILITY_SHIFT` encodes shipped engineering state: shelter/income/calc reach STRONG tier (0.75 shift), shared-lease reaches MODERATE tier (0.56 shift via deterministic classifier, not API), assets stays WEAK (0 shift).
- Distinct from per-packet `scoreErrorRisk` which uses renormalized weights + per-flow DEFENSIBILITY_ERROR_PROB.
- 26 new tests added in `test/population-per.test.ts`.

## 0.2.0 — prior

- CA FY2023 recalibrated `ERROR_WEIGHT` (utility-sua 0.495, gig-income 0.354, shared-lease 0.098, assets 0.002, benefit-impact 0.051).
- Lease verification helper (`verifyLeaseExtraction`).
- Sublease classifier deterministic v1.
- Failure-to-elect detector.
