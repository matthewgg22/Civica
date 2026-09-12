# The universe is not exhaustive, and the triage inherited the bias it was meant to fix

**2026-08-26.** Asked whether the target list is exhaustive. It is not, and the shortfall is
structural rather than incremental.

## The circularity

`county_pressure_coverage_2026.csv` was built by querying CRAPES **for banks with gap
ratings** — its own column is `n_pressured_banks`. Yesterday's revision established that a
gap-only screen is the wrong entry filter. Then `rescreen_triage_2026.csv` re-tiered *that
file* on the corrected signal, which cannot recover banks the original query never returned.

**A bank clean on both tests never entered the universe at all.** The 46 "tier 3" banks are
present only because an *Investment* gap admitted them — the very signal now dropped.

### The proof

**Woodforest is in none of the three universe files.** Outstanding on all three tests,
$17.8M of disclosed Houston-CSA giving, the largest capacity figure anywhere in this
project. It reached the roster only because its PE was already held from separate work. Had
it not been, a capacity-first screen run against our own universe would still have missed it.

## The size of the gap

| | Count |
|---|---:|
| Active FDIC-insured institutions | 4,241 |
| **Large Bank** — Investment Test *and* Service Test | **723** |
| **Intermediate Small Bank** — Community Development Test | **1,389** |
| **Addressable universe** | **2,112** |
| Screened to date | **151 (7%)** |

Small Banks are correctly excluded: their only test is Lending, which no grant moves. That
exclusion is sound and stays.

**ISBs were never considered at all.** The Community Development Test evaluates CD loans,
qualified investments *and* CD services together — a grant plus an outreach partnership
counts. Excluding 1,389 institutions was never a decision; it fell out of a universe query
that only looked for component-rating gaps, which ISBs do not receive.

## What is also missing

- **Flagstar** — per-AA giving of $285K / $334K / $718K / $783K / $9.2M across different
  assessment areas, unresolved. Needs one end-to-end read.
- **Massachusetts institutions** — all mis-tiered until re-screened, because MA has no
  "Low Satisfactory" (`ma-rating-scale-2026-08-26.md`). NY, CT and RI unverified for the
  same defect.
- **Credit unions** — never screened. NCUA has no CRA analogue federally; MA, CT and RI
  impose state obligations on those with geographic fields of membership.
- **New York lenders (~70)** — untouched. **Verify NYDFS actually publishes evaluations
  before spending time here**; Illinois cost a full workstream because IDFPR publishes none.
- **OCC-supervised banks** — a permanent structural blind spot. The OCC exposes no
  searchable component ratings; its "CRA Search" is a Google Custom Search over PDFs. Any
  OCC bank without a gap is invisible to every query we run.
- **The 2022–23 CRAPES vintage** — 25.1% Substantial Noncompliance against 0.1% in all
  other years. Anything sourced from that window is unreliable.

## What to do, in order

1. **Rebuild the universe capacity-first.** Query CRAPES by quarterly release window across
   all ratings — not filtered to gaps — for the 723 Large banks. Release windows stay under
   the 500-row cap that defeats state queries. This is the structural fix; everything else
   is triage on a biased sample.
2. **Read the tier-1 head.** Prosperity Bank is the largest unworked target found so far —
   406 branches, 97 counties, Harris-anchored, documented Service gap.
3. **Resolve Flagstar**, then re-screen Massachusetts.
4. **Decide on ISBs.** 1,389 institutions with a test our activity feeds. Probably the
   largest single expansion available, and it has never been costed.
5. Only then work credit unions and NY lenders.

## The honest framing

The roster of 20 is well-evidenced: assessment areas read from the banks' own evaluations,
asks anchored on disclosed per-AA giving, identities confirmed against BankFind, liveness
checked. **Nothing here retracts those 20.** What is wrong is calling the pipeline behind
them complete. It covers 7% of the institutions that can act on this, chosen by a filter we
have since established was the wrong one.
