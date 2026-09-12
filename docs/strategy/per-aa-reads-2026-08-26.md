# The three per-AA reads — and the ranking flaw they exposed

**2026-08-26.** Every one of the three deferred banks turned out to differ materially from
what the ranking implied. Two are loaded, one is blocked, and the ranking itself needed
rebuilding.

## Frost — loaded, peer, $25,000

**Its Houston assessment area is not the Houston MSA.** Verbatim:

> "The Houston Metropolitan AA consists of a portion of the Houston MSA, including the
> counties of Brazoria, Fort Bend, Galveston, Harris, and Montgomery. However, the AA
> **excludes** the Houston MSA counties of Austin, Chambers, Liberty, and Waller."

Five counties, not the nine that Truist, Woodforest and Prosperity all use. **Copying the
nine-county definition across would have overstated Frost's assessment area by four
counties** — the wrong-AA error in its purest form, and only a read catches it.

Giving is Table 45, donations column, for this assessment area: **144 donations totaling
$639,000**, against $142.1M of investments. Investment "excellent", Service "good" — clean,
so peer. 61 branches, 31.3% of the bank's total.

## First-Citizens — loaded, peer, but **pooled at $3,000**

The Phoenix MSA AA is **Maricopa County only** ("the bank delineated only Maricopa County").
Giving, AA-scoped: **seven donations totaling $59,149**. The bank's $4.6 million
donations-and-grants figure is bank-wide and was not used.

**A $236 billion bank with a two-branch Phoenix footprint and $59,149 of disclosed
assessment-area giving is a pooled-tier prospect**, not the number-two target the ranking
implied. Arizona ratings: Lending Low Satisfactory / Investment High Satisfactory / Service
High Satisfactory.

## Glacier — blocked

**Phoenix is a limited-scope area** for Glacier; the full-scope Arizona area is Prescott. The
PE discloses **no Phoenix figure at all**. The only Arizona number is statewide and mixes
categories — "425 investments and grants totaling $43.6 million in the state of Arizona".
Prescott's $886,000 belongs to Prescott.

Recorded with an `ask_scope_caveat`; the generator refuses it. Correct outcome.

## The ranking flaw

The triage summed each bank's branches across **all** top-60 need counties, then labelled it
with a single "top county". For a multi-state bank that is close to meaningless — and it got
the top county itself **wrong** in three of the four cases checked:

| Bank | Old metric | Actual, in that county |
|---|---|---|
| First-Citizens | 92 branches, "Maricopa" | **18** in Wake, NC — and **2** in its Phoenix AA |
| Glacier | 45 branches, "Maricopa" | **11** in Utah County, UT — ~15 in *all* of Arizona |
| Truist | 351 branches, "Harris" | **25** in Dallas, TX |
| Prosperity | 169 branches, "Harris" | **60** in Harris, TX ✅ |

Rebuilt as `universe_ranked_percounty_2026.csv`, ranked on **branches in a single county ×
unserved households in that county**. Corrected head of queue:

| | Bank | Branches in top county | Exposure |
|---|---|---:|---:|
| **GAP** | **Prosperity Bank** | 60 in Harris, TX | 1,641,360 |
| peer | **Truist Bank** | 25 in Dallas, TX | 575,750 |
| peer | WaFd Bank | 10 in Maricopa, AZ | 299,590 |
| peer | Stock Yards Bank & Trust | 29 in Jefferson, KY | 285,563 |
| peer | Pinnacle Bank | 16 in Davidson, TN | 239,152 |
| GAP | German American Bank | 15 in Franklin, OH | 198,795 |

**Prosperity and Truist survive as the top two**, so the reads already done were the right
ones. Everything below them reorders.

## What this run confirms

Branch presence orders a *reading queue* and nothing else. It does not measure assessment-area
membership — Frost has 61 Houston branches and still excludes four Houston MSA counties — and
it does not predict capacity: First-Citizens has 18 branches in its top county and $59,149 of
giving in the one we care about. **Only the PE says what a bank's assessment area is and what
it gave inside it.**

## Roster

**23 sendable, $422,000.** Two blocked on scope caveats (Prosperity, Glacier) and one on a
bank-wide figure (FirstBank TN) — all three are real targets awaiting one figure each.
