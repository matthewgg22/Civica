# County → bank target map

**Built 2026-08-22.** Ranks counties by unmet SNAP need, then maps every bank target we have
evidence on to the counties it covers, with a willingness tier and an evidence-anchored ask.

## The ranking criteria, and why

**Primary: absolute eligible-unenrolled households.** Campaign scale, and the number a bank's
performance-context narrative can use. Households not persons, so states are comparable.

**Secondary: non-enrollment rate.** How badly served the county is. A high rate on a small base is a
responsiveness story; a high rate on a large base is both.

**Third, and the one that decides action: fundable bank presence.** A county with no
CRA-pressured bank is unreachable through this channel no matter how large the gap. `pool_potential`
sums the Tier A and B asks in that county — what a pooled county programme could raise today.

## Willingness tiers — evidence, not guesswork

| Tier | Meaning |
|---|---|
| **A** | Current NTI/SNC, **or** a component test at Needs to Improve / Low Satisfactory — a documented gap in the test a grant counts under |
| **B** | Satisfactory with no standout weakness; exam timing, consent order or disclosed giving capacity carries the case |
| **C** | Outstanding on a material test — deprioritise; a grant fixes nothing they need fixed |

## Caveats that matter

- **Assessment areas are PE-verified for the eight Band A banks only.** Every other row is
  HQ-inferred and marked as such — an HQ county is a bank's primary market, **not** its assessment
  area. Read the PE before treating any inferred row as a target.
- **California and Massachusetts counties are absent from the ranking.** Their fact bases are
  PUMA-level (CA additionally modeled) with a different schema, so they are not comparable in a
  county table. CA figures live in `ca-snap-gap`, MA in `ma-snap-gap`.
- 12 states, 1,006 counties, 5,304,426 eligible-unenrolled households covered.
- 2023 ACS 1-Year PUMS, 130% gross-income screen — an upper-range estimate of unmet need.

## county_need_persons_2026.csv — CORRECTION, supersedes the household ranking for prioritisation

The household ranking excluded California entirely, because CA's fact base carries
`eligible_pop` and `non_enroll_rate` but **not** household columns. That was a schema mismatch, not
a finding — and it hid the largest opportunity in the dataset.

Ranked in **persons**, which all 13 states carry: **Los Angeles is #1 at 796,577 eligible-unenrolled
persons**, 60% larger than Harris TX (497,207). California holds **five of the top twenty** — LA #1,
San Diego #7, Orange #8, Riverside #11, San Bernardino #12 — and 2,825,452 unenrolled persons in
total, 21% of the 13,686,208 across all covered states.

⚠️ **Methodology differs and the column says so.** California is `MODELED` (gradient-boosted
classifier over ACS PUMS, PUMA-level, allocated to counties); the other twelve states are
`survey-weighted` direct estimates. They are ranked together because persons is the only common
unit, but a bank scrutinising the CA figure is scrutinising a model output. Say "footprint-level",
never "tract-level".

Use **persons** for prioritisation across states, and **households** (the other file) for campaign
sizing within a state, since the funnel is household-based.
