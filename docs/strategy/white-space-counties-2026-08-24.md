# The four uncovered counties — all four have answers

**Date:** 2026-08-24 · **Data:** `bank-pe-mining/white_space_counties_2026.csv`

The national screen left five top-50 counties with no pressured bank: Clark NV (#15),
Fresno CA (#26), Kern CA (#30), Pima AZ (#32), St. Louis MO (#48). **None of them was
actually a white space.** Each was a different failure of the instrument, and naming
the failure matters more than the banks.

## St. Louis (#48) — a bug in my own join

St. Louis County (rank 48, 70,811 unenrolled) and St. Louis **city** (rank 170, 29,419)
are separate FIPS entities. My county-name normaliser stripped the word "city", so both
collapsed to the same key and the county's coverage was silently overwritten by the
city's.

St. Louis County has **three** pressured banks: **Regions Bank** (22 branches),
**Simmons Bank** (13) and **The Central Trust Bank** (10). It was never uncovered.

Fixed — independent cities are no longer folded away. National coverage rises to
**1,540 counties**, and the top-50 count to **46**.

## Clark (#15) and Pima (#32) — Western Alliance, invisible by construction

Both are inside Western Alliance assessment areas, with **published dollar goals** in
its 2024–2026 strategic plan:

| AA | County | Satisfactory 3-yr | Interim annual |
|---|---|---|---|
| Las Vegas | **Clark** | $945,750 | $250,000 – $380,000 |
| Tucson | **Pima** | $315,250 | $85,000 – $125,000 |

Western Alliance has **10 branches in Clark** and **2 in Pima**. It cannot appear in a
component-rating screen because, as a Strategic Plan bank, **it has no component
ratings** — performance is measured against negotiated goals instead.

This is the predicted blind spot, now confirmed twice. A pressure screen cannot see
strategic-plan banks at all, and they are disproportionately the large ones.

**Practical consequence:** the Western Alliance conversation is not a Maricopa
conversation. One relationship reaches **Maricopa, Los Angeles, Clark and Pima** on
full-service terms, each with its own published donation goal.

## Fresno (#26) and Kern (#30) — a second corrupt API row

Both counties looked empty because their one pressured bank had been **filtered out as
corrupt data**.

**Mechanics Bank** ($21.4B) appears in the FDIC API with `LENDING_RATING` and
`SERVICE_RATING` both `"Substantial Non Complianc"` against a **Satisfactory** overall
rating — impossible, since the lending test is weighted most heavily. The Busey guard
correctly flagged and dropped it.

The PE says: **Lending Low Satisfactory / Investment Outstanding / Service LOW
SATISFACTORY.** A real Service Test gap, and the counties are both in delineated AAs:

- **Fresno AA** — *"a portion of Fresno CSA #260, which includes Fresno MSA #23420 and
  Hanford-Corcoran MSA #25260"*, excluding Madera → **Fresno + Kings**
- **Bakersfield AA** — *"the entirety of the Bakersfield-Delano MSA"* → **Kern**

That is now **two corrupt CRAPES rows resolved the same way** (Busey, Mechanics). The
guard is doing exactly what it should — but a dropped row is a *lead to chase*, not a
bank to discard. Anything the guard flags needs a PE read, not a delete.

### Mechanics is loaded UNSIZED, deliberately

The gap is real and the counties are confirmed, but **both Fresno and Bakersfield are
limited-scope assessment areas**, so the PE breaks out no per-AA donation figure for
either. Institution-wide giving is large — 151 donations totaling $621,000 in 2019, 267
totaling $1.4M in 2020, 239 totaling $1.3M in 2021 — and the per-AA rule forbids
anchoring on it. That is the same discipline that caught City National's 10× overpricing.

The $15,000 on the record is a placeholder and `ask_sizing` says so. It is not sendable
until someone gets a Fresno-AA or Bakersfield-AA figure.

**Kern needs its own record.** The Bakersfield AA is separately delineated and must not
be merged into the Fresno one.

## What this changes about the method

Three different instrument failures produced five apparent white spaces, and **none was
a real absence of banks**:

1. a name-normalisation collision in our own join,
2. strategic-plan banks that no component screen can see,
3. corrupt regulator data that a correctness guard removed.

The screen is a way of generating leads, not a census. A county reading "uncovered"
should trigger the charter-probe and strategic-plan treatment before anyone concludes
there is no funder there.

## Open

- **Kern**: create the Mechanics Bakersfield-AA record.
- **Mechanics**: get a per-AA donation figure, or ask the bank directly.
- Re-check every row the corruption guard drops — there were 7 in the national sweep and
  two have now turned out to be real targets.
- Remaining uncovered in the top 100: ranks 74, 77, 91 (not yet examined).
