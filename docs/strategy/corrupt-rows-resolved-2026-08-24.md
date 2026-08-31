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

**FirstBank (TN, $12.2B)** — AAs now read; see below. Real Service Test gap, but a
**pool candidate**, not the large earmark its balance sheet suggests.

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

## FirstBank — read, and the lesson is that assets do not predict grant capacity

FirstBank runs **five rated areas** (Tennessee, Alabama, Georgia, Kentucky, and a
Chattanooga multi-state MSA) with five full-scope AAs. The target is:

> "The Nashville MSA AA includes all 281 census tracts that make up Canon, Davidson,
> Dickson, Rutherford, Williamson, and Wilson Counties, six of 13 total counties that
> make up the Nashville-Davidson-Murfreesboro-Franklin, Tennessee MSA"

(The PE spells it "Canon". The county is **Cannon** County, FIPS 47015. All six resolve
in the Tennessee fact base.)

**The Nashville service finding is sharper than the institution rating.** The PE says the
bank "makes its alternative delivery systems **unreasonably accessible** to significant
portions of the Nashville MSA AA" and "does not have ATMs in low- and moderate-income
tracts, thereby reflecting a **very poor** level." That is a documented failure to reach
LMI households through the bank's own channels — exactly what an outreach campaign
answers. Nashville's AA also carries a disproportionality ratio of **1.19**, above the
1.15 display threshold, so the artifact renders it.

**And yet the ask is $7,500 — a pool figure.** FirstBank made 93 qualified investments
totaling **$84,493,000** "for the bank as a whole", of which **donations are $126,000**.
It meets CRA through large affordable-housing investments, not grants. Even assuming
every donated dollar landed in Nashville — a deliberately generous upper bound, since
the PE gives no per-AA donation figure — the formula returns a pool candidate.

**This is the clearest case yet that asset size does not predict grant capacity.** A
$12.2B bank with a $126,000 donation programme is a worse earmark prospect than River
City at $4.0B with $1.4M in a single assessment area. Balance sheet is not the signal;
disclosed per-AA giving is.

## Open

- Re-screen the 2022-vintage window generally, not just the rows the guard caught.
- Add a liveness check to any future universe build, sourced from BankFind.
