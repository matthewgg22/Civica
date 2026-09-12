# The universe, rebuilt capacity-first

**2026-08-26.** Outputs in `data-ops/analysis/cra-universe-2026/`:
`fdic_universe_capacity_first_2026.csv` (1,347) · `universe_ranked_2026.csv` (375 workable).

## What changed

The previous universe was built by querying CRAPES **for gap ratings**, so a bank clean on
both tests could never appear. This pull queries **quarterly release windows with no rating
filter** — 36 windows, 2018–2026, all returning well under the 500-row cap that defeats
state queries. **6,463 evaluations across 3,308 institutions**, reduced to the current PE per
bank.

CRAPES also returns `EXM_ACT_PROC_DESC`, so exam method comes from the **actual examination**
rather than an asset-size proxy. That matters: an asset threshold suggested 723 "Large"
banks, but only **346** are genuinely examined under Large Bank procedures.

## The addressable universe

Only tests our activity can feed. Small Bank is excluded on the merits — its only test is
Lending, which no grant moves.

| Exam method | Count | What a grant reaches |
|---|---:|---|
| Intermediate Small Bank | **931** | Community Development Test |
| Large Bank | **346** | Investment Test + Service Test |
| Strategic Plan | 51 | plan-specific goals; no component ratings |
| Wholesale | 15 | CD Test only |
| Limited Purpose | 4 | CD Test only |
| **Total addressable** | **1,347** | |

**The old universe held 151. 1,196 institutions — 89% — were invisible.**

### What the gap-only screen was costing

Of the 336 Large banks carrying a Service rating, **231 are clean on Service.** Every one was
structurally unreachable by a query that filtered for gaps. That is **69% of large banks
excluded by construction**, not by judgement.

## Ranking: 375 workable banks

Branch presence was inverted to make this cheap — one query per county for the 60
highest-unserved counties (60 requests) instead of one per bank (1,347). Exposure is the sum
of unserved poor households across the high-need counties a bank has branches in.

**375 banks have branches in a top-60 need county. 309 of them are new.**

| | Large | ISB |
|---|---:|---:|
| In a top-60 need county | **154** | **184** |
| Service gap | 44 | — |
| Service clean (peer) | **110** | — |

### Head of the queue

**Service gap (remediation):** Bank OZK (76 branches, Harris) · Prosperity Bank (169, Harris)
· Gulf Coast Bank and Trust (Maricopa) · City Bank · Bank of Hope.

**Clean service, real presence (peer — all newly visible):**

| Bank | Service | Branches | Exposure | Anchor |
|---|---|---:|---:|---|
| **Truist Bank** | Outstanding | 351 | 334,717 | Harris, TX |
| First-Citizens Bank & Trust | High Satisfactory | 92 | 309,319 | Maricopa, AZ |
| Glacier Bank | High Satisfactory | 45 | 197,987 | Maricopa, AZ |
| Pinnacle Bank | High Satisfactory | 110 | 187,462 | Dallas, TX |
| Hancock Whitney Bank | Outstanding | 22 | 151,047 | Harris, TX |

Truist is the largest peer candidate found anywhere, and it was invisible to every query we
had run before today.

## The ISB question, answered

**ISBs are a capacity-only channel by construction.** The ISB examination is a Lending Test
plus a single **Community Development Test**, which evaluates CD loans, qualified investments
*and* CD services together as one rating. There is no separate Service rating to show a gap
— **807 of 931 carry no component ratings at all.**

That is exactly why they never surfaced: the old universe query looked for component-rating
gaps, and ISBs do not receive them. Their exclusion was never a decision.

**Cost to work them:** the full 931 is infeasible at roughly a PE read each. The workable set
is **184** — those with branches in a top-60 need county. Against 110 Large peer candidates,
the sensible order is Large first (a Service Test gives a sharper read on where our activity
lands) and ISBs second, sampled to test whether a CD-Test pitch converts before committing to
the tail.

## Data quality — two contaminations found and contained

**The 2022–23 vintage defect is present but small here.** SN rates by PE year: 0.0% for
2018–21, **8.3% in 2022**, **2.6% in 2023**, 0.0% for 2024–26. Confirmed live on **Busey**,
whose row reads overall "Satisfactory" with Service "Substantial Non Complianc" — internally
impossible. Our roster's Low Satisfactory, read from the PE itself, is correct and the CRAPES
field is corrupt. **Any 2022–23 component rating must be confirmed against the PDF.**

**Stale rows where supervision moved.** Third Coast returns a 03/01/2019 ISB evaluation here,
while its current PE is an August 2024 **Federal Reserve** examination (RSSD 3630323). CRAPES
holds only FDIC evaluations, so a bank that moved to Fed or OCC supervision freezes at its
last FDIC record.

## Still not exhaustive — and now precisely so

| Regulator | Active institutions | Covered by this rebuild |
|---|---:|---|
| **FDIC** | 2,662 | ✅ fully |
| **FED** | 699 | ❌ separate search exists, not yet pulled |
| **OCC** | 878 | ❌ **permanent blind spot** |
| **STATE** | 2 | — |

**The Federal Reserve portion is recoverable.** Its CRA search (`POST
/apps/CRAPubWeb/CRA/BankRatingResult`) exposes component ratings and caps at 30 results, so
it partitions by `ExamYears`. Roughly 200 of the 699 are large enough to matter. This is the
next mechanical step.

**The OCC portion is not.** The OCC publishes no searchable component ratings — its "CRA
Search" is a Google Custom Search over PDFs. **200 OCC banks are large-bank-sized and none
can be screened**, only checked one at a time once a name is already known. Woodforest and
Northfield are both OCC banks, which is exactly why they entered by hand.

So: this rebuild takes coverage from **7% of a biased sample to the complete FDIC universe**,
and leaves two named, sized gaps rather than an unknown one.
