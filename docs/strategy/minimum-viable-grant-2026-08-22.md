# OCC evaluations mined — and the minimum viable grant problem

**Done:** 2026-08-22. All seven OCC-supervised targets mined. **23 of 31 banks now evidence-backed.**
**Data:** [`fdic_pe_scan_2026.csv`](../../data-ops/analysis/bank-pe-mining/fdic_pe_scan_2026.csv)

Two outcomes: three more targets drop out, one of my earlier flags was wrong — and the accumulated
giving evidence surfaces a structural problem the ask ladder alone cannot solve.

---

## 1. OCC retrieval — path and a trap

OCC evaluations live at `occ.gov/static/cra/craeval/{Mon}{yy}/{charter}.pdf` (both `Oct23` and
`oct23` resolve). Charter numbers come from FDIC BankFind's `CHARTER` field, alongside `REGAGNT` and
`FED_RSSD` — one query gives regulator and both identifiers.

**The trap: OCC's CDN rejects HEAD requests unreliably.** A HEAD sweep reported "no evaluation" for
six of seven charters including Woodforest, whose `Oct23` path I had already downloaded successfully.
Switching to `GET` with `Range: bytes=0-199` (returns 206) found evaluations for all seven. **Never
probe OCC with HEAD.**

---

## 2. Three more targets drop, one flag retracted

| Bank | Rating | Verdict |
|---|---|---|
| **First National Bank Texas** | **Outstanding** *(upgraded from Satisfactory in 2020)* | **Drop** — was Band C #1 |
| **Inwood National Bank** | **Outstanding**, Lending Outstanding | **Drop** |
| **Northfield Bank** | Satisfactory, Lending High Satisfactory | **Flag retracted** |

**The Northfield correction matters.** I reported an Investment Test rated *Needs to Improve* — that
came from a **2007** FDIC-era evaluation surfaced by CRAPES. Northfield is OCC-supervised now, and
its current October 2023 evaluation is Satisfactory with 138 donations and grants totaling $1.3M.
The gap I flagged does not exist. *(CRAPES returns historical FDIC records for institutions that have
since changed regulators — always check the evaluation date against the current supervisor.)*

**City National Bank confirmed Needs to Improve as of April 2024** — newer than the 3/2023 rating in
our target list, and it remains the strongest single federal target: NTI, a $31M DOJ consent order in
LA County, and **$13.2M in qualifying grants and donations to roughly 359 organizations** (average
$36,769). The $75,000 ask is well within their demonstrated giving.

**First National Bank of Pennsylvania** published a **July 2026** evaluation — last month — reporting
giving per assessment area at $170,760 / $273,660 / $296,360. Satisfactory, so lower pressure than
the consent order implied.

**Running tally of eliminations:** Stock Yards, Israel Discount Bank, First National Bank Texas and
Inwood are all Outstanding. Provident and ESSA are consent-order banks with strong ratings.
**Six named targets removed on evidence** — roughly $300,000 of "pipeline" that was never real.

---

## 3. 🔴 The minimum viable grant — a floor the ask ladder ignores

Across 23 mined evaluations, typical bank community development giving is **$1,200–$14,000 per
donation**. Anchoring asks there was correct. But it produces a problem the anchoring itself cannot
solve.

**A $5,000 grant buys roughly $3,000 of outreach** at the 60% split. At the measured funnel — $49 per
submitted application — that is about **60 applications and 34 approved households**. Real, but small.

**The harder constraint is that reporting cost does not scale down.** Each funded bank receives a
seven-page bespoke quarterly report and a signed qualification memorandum. Producing those requires
reading that bank's assessment area, computing county-grain need, rendering a map, and writing
against that examiner's criteria — the same work whether the grant is $5,000 or $50,000. At the 15%
measurement-and-reporting allocation, a $5,000 grant contributes **$750 a year** toward four
quarterly reports and a memo.

**That is not enough, and the gap is not marginal.** Below roughly **$10,000–$15,000**, each
additional bank consumes more program capacity than it contributes. The evidence-based asks for
Helm ($5,000), Mega ($5,000), Oakwood ($5,000), Bank Irvine ($5,000), Sonata ($2,500), Pearland
($2,500) and Zenith ($2,500) all sit **below that floor.**

**So the single-bank model does not work for most of the pipeline** — not because the asks are wrong,
but because they are right.

### Three ways out, and only two are real

**(a) Pool by county.** Multiple small banks fund one campaign in a shared assessment area, with
proportional attribution disclosed in each report. Three Florida banks at $5,000 each is $15,000 —
one properly funded campaign — and the shared reporting cost falls to a third per bank.

This is the same mechanism that fixes the **overlapping-assessment-area double-counting exposure**
still open from earlier: Miami-Dade, Broward and Orange are each claimed by all three Florida banks.
Pooling converts that exposure into the product. **It solves two problems with one structure**, which
is why it should be built rather than the discretionary-pool tier.

**(b) Standardize the artifact so marginal cost approaches zero.** This is already true of the
**lender** channel — a statewide assessment area means one document serves all forty Massachusetts
targets, and the fortieth costs nothing to produce. It is *not* true of the bank artifact, which is
bespoke per assessment area by design. Making bank reporting template-driven at the county level
would lower the floor materially.

**(c) Raise the asks above the floor.** Not available. Twenty-three evaluations say these banks do
not give that much, and asking past disclosed giving is the error this entire mining effort exists to
prevent.

### What this changes

- **Set an explicit minimum viable single-bank grant of $10,000** and stop pursuing sub-floor banks
  individually.
- **Sub-floor banks become pool participants, not standalone funders.** Helm, Mega, Oakwood, Bank
  Irvine, Sonata, Pearland and Zenith move into county pools.
- **The lender channel does not have this problem** and should be sequenced first on economics alone,
  independent of the Massachusetts evidence advantage.

---

## 4. What remains

**Eight of 31 unmined**, all Federal Reserve-supervised or otherwise not yet located: Susser Bank
(RSSD 965789), Maspeth Federal, Florida Capital, Dallas Capital, Interamerican, Terrabank,
Generations, OceanFirst. Federal Reserve evaluations are at `federalreserve.gov/apps/CRAPubWeb/`,
keyed by RSSD.

FDIC BankFind began rate-limiting during this pass, so the remaining regulator lookups need pacing
rather than parallelism.
