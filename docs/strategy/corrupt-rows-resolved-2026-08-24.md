# The guard-dropped rows: five of nine were real targets

**Date:** 2026-08-24 · **Data:** `bank-pe-mining/corrupt_rows_resolved_2026.csv`

The internal-consistency guard drops any FDIC record claiming a Lending Test at
Substantial Noncompliance alongside a Satisfactory-or-better overall rating — a
combination that cannot exist, since lending is weighted most heavily. Across the
national sweep it flagged **nine** institutions. Every one has now been read.

**The guard was right nine times out of nine: every flagged row was bad data.**
It was also expensive — **five of the nine are real targets** that the screen would
otherwise have thrown away.

## The pattern

All nine are **2022 examinations published 2022–23**. Nine bad rows clustered in a
single exam vintage is a batch loading defect, not random corruption. Any future
sweep should treat that window with suspicion and re-read rather than re-filter.

## Outcomes

| Bank | State | Assets | Outcome |
|---|---|---|---|
| **River City Bank** | CA | $4.0B | **TARGET — loaded, $25,000** |
| **Busey Bank** | IL | $12.5B | TARGET — loaded, Cook primary at $20,000 |
| **Mechanics Bank** | CA | $18.6B | TARGET — loaded, Fresno + Kern, unsized |
| **FirstBank** | TN | $12.2B | TARGET — AA unread |
| **Gateway First Bank** | OK | $1.9B | target, but marginal |
| Fairfield County Bank | CT | $1.9B | no target |
| Signature Bank | NY | $116B | **dead** — failed 2023-03-12 |
| Berkshire Bank | MA | $11.7B | **dead** — ended 2025-09-02 |
| Emigrant Bank | NY | $6.5B | **dead** — ended 2023-10-01 |

## River City Bank — the new target

| | |
|---|---|
| Regulator | FDIC (cert 18983), $4.0B |
| PE | Nov 2, 2022 |
| **Investment Test** | **Low Satisfactory** (Service High Satisfactory) |
| Sacramento AA | *"Sacramento, Yolo, Placer, and El Dorado Counties"* |
| Giving in that AA | **141 grants and donations totaling $1.4 million** |
| Ask | **$25,000** — the formula returns $70,000, clamped to the ceiling |

The API had reported Lending "Substantial Non Complianc" with Service missing. The
PE says Lending Low Satisfactory / Investment Low Satisfactory / Service High
Satisfactory. The pitch is the investment side only.

Its separate **Contra Costa AA** ("solely of Contra Costa County") is excluded.
It **overlaps Five Star Bank** on El Dorado, Placer, Sacramento and Yolo, so the pro
rata attribution rule applies if both fund.

## The other live three

**FirstBank (TN, $12.2B)** has a real **Service Test gap** and 132 offices across
Williamson, Rutherford, Hamilton and Davidson in Tennessee plus Jefferson County,
Alabama — Nashville and Birmingham. Its PE has a complex full-scope/limited-scope
structure that was not read here. **This is the largest unworked lead in the roster.**

**Gateway First (OK, $1.9B)** has a genuine Service gap but only 16 offices scattered
across Oklahoma, Tennessee, Washington, Louisiana and Arizona — four in Tulsa. Too
dispersed to anchor a county campaign.

**Fairfield County Bank (CT)** is Lending Low Satisfactory with Investment and Service
both High Satisfactory. The gap is on the one test our activity cannot move.

## A second data defect: CRAPES reports dead banks as alive

**All 18,902 records in the national sweep carry `INST_FIN_ACTV_FLG = "Y"`,** including
Signature Bank, which failed in March 2023. Three of these nine are closed institutions.

**The CRAPES active flag is worthless.** Liveness must come from FDIC BankFind
(`ACTIVE`, `ENDEFYMD`), and any candidate list built from CRAPES alone will contain
banks that no longer exist. Berkshire Bank ended in September 2025 — recently enough
that it would have looked entirely plausible in a pitch list.

## Open

- **FirstBank's assessment areas** — read the PE. Davidson (Nashville) and Jefferson
  (Birmingham) are both meaningful, and Tennessee is already wired into the generator.
- Re-screen the 2022-vintage window generally, not just the rows the guard caught.
- Add a liveness check to any future universe build, sourced from BankFind.
