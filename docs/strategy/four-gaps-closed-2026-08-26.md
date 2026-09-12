# The four open gaps, closed

**2026-08-26.** All four items the board listed as unresolved are now answered. One of them —
the largest — turned out to rest on a claim of mine that was simply wrong.

## 1. The OCC was never a blind spot

**The board said:** "OCC — 878: a permanent blind spot. The OCC publishes no searchable
component ratings, so 200 large-bank-sized institutions can only be checked one at a time."

**That was wrong.** The OCC runs a real searchable CRA database at `apps.occ.gov/crasearch`,
backed by a public JSON API:

```
POST https://apps.occ.gov/Occ.DataServices.WebApi.Public/api/CraEvaluations/Search/Options
{"q":"","rating":"Outstanding","state":"all","eFromDate":"","eToDate":"","pFromDate":"","pToDate":""}
```

**Why it looked absent:** the interface's own default, `rating="all"`, returns **zero rows**.
Only a specific rating value returns anything. Every casual probe came back empty and I read
that as "no data" rather than "wrong parameter." Iterating the four rating values across the
51 state options enumerates the whole archive.

**What it holds: 24,283 evaluations across 6,542 charters**, back to the pre-1995 Assessment
Factor era. Against the 878 currently-active OCC institutions:

| | Count |
|---|---:|
| Active OCC institutions | 878 |
| With an evaluation on file | 844 |
| **Addressable by exam method** | **404** |
| — Intermediate Small Bank | 237 |
| — Large Bank | 135 |
| — Limited Purpose / Strategic Plan / Wholesale | 32 |
| Large-bank-sized among them | 184 |

**And it was hiding the largest banks in the country.** JPMorgan Chase ($4.09T), Bank of
America ($2.65T), Citibank ($1.98T), Wells Fargo ($1.91T), U.S. Bank, Capital One, PNC, TD,
Fifth Third — every one rated **Outstanding**, every one a peer candidate, none previously
visible to any query we ran.

**The addressable universe goes from 1,781 to 2,185.**

One part of the original claim survives: the API exposes only the **overall** rating, not
component ratings. Service-Test screening still needs the PDF. But enumeration — the thing
that actually blocked us — is solved.

## 2. Massachusetts confirmed; New York, Connecticut and Rhode Island are clean

**MA is systematic, not a North Shore quirk.** Rockland Trust and Salem Five Cents both carry
the identical sentence: *"jointly issued public evaluation uses the term 'satisfactory' in
lieu of 'low satisfactory' for the Lending, Investment, and Service Test ratings."* Any
Massachusetts institution showing a bare "Satisfactory" component is ambiguous between High
and Low Satisfactory.

**NY, CT and RI do not have the defect.** Sampled federal evaluations for Apple Bank and State
Bank of India (NY), Liberty Bank and Union Savings (CT), Washington Trust and Centreville (RI)
— all use "Low Satisfactory" normally.

**But NYDFS's own state evaluations are a different instrument.** Its scale is 1–4 —
Outstanding, Satisfactory, Needs to Improve, Substantial Non-compliance — **with no component
test ratings at all.** So a NYDFS evaluation cannot support a Service-gap screen even in
principle.

## 3. The 2022–23 vintage is 100% corrupt, and the roster is untouched

Substantial Noncompliance runs 0.1% in every other exam year and 25.1% in 2022–23. What
settles it: of the **eleven** addressable banks whose 2022–23 record carries an SN component,
**all eleven** pair it with a *Satisfactory* overall rating — an impossible combination.
Corruption inside the window is total, not partial, which is what licenses discarding it
wholesale rather than case by case.

**Six are on our roster, and every one already carries the value read from the PDF:**

| Bank | CRAPES says | We recorded | From |
|---|---|---|---|
| Busey | Substantial Noncompliance | High Satisfactory | PE read |
| CTBC | Substantial Noncompliance | Low Satisfactory | PE read |
| FirstBank | Substantial Noncompliance | Low Satisfactory | PE read |
| Mechanics (×2) | Substantial Noncompliance | Low Satisfactory | PE read |
| Meridian | Substantial Noncompliance | Low Satisfactory | PE read |

The read-the-PDF rule caught **every instance**. That is the strongest evidence so far that it
earns its cost. `src/vintage.py` and three tests now enforce it: no roster rating may carry a
window SN value, and if any SN record in the window ever turns out to be internally coherent,
the blanket distrust fails a test and gets revisited.

## 4. Credit unions and New York lenders

**Credit unions have no federal CRA obligation** — including them would take an act of
Congress. But **six jurisdictions impose one by state law**: Massachusetts, New York,
Connecticut, Rhode Island, Illinois and DC. Connecticut and Rhode Island reach only credit
unions with a **geographic** field of membership. Massachusetts examines state-chartered
credit unions through the same Division of Banks process as its banks, which means the same
collapsed rating scale applies.

**New York lenders are workable, unlike Illinois.** NYDFS **does** publish performance
evaluations — found at `dfs.ny.gov/system/files/documents/{year}/{month}/cra{yy}{slug}.pdf` —
where IDFPR publishes none at all. Two caveats: there is no centralised searchable index, and
direct fetches are blocked (403), so retrieval needs a browser. And because the NYDFS scale
carries no component ratings, NY state-supervised institutions are a **capacity-only channel**,
the same shape as Intermediate Small Banks.

## Where coverage stands

| Regulator | Active | Addressable | Status |
|---|---:|---:|---|
| FDIC | 2,662 | 1,347 | complete |
| Federal Reserve | 699 | 434 | complete |
| **OCC** | **878** | **404** | **complete** |
| **Total** | | **2,185** | |

Remaining, and now precisely bounded: component ratings for OCC banks need the PDF; NY and
MA state-supervised institutions are capacity-only by construction; credit unions are
addressable in six jurisdictions and have never been enumerated.

## Sources

- [OCC CRA Search](https://apps.occ.gov/crasearch/default.aspx)
- [NYDFS CRA FAQs](https://www.dfs.ny.gov/apps_and_licensing/banks_and_trusts/cra_faqs)
- [CFPB, State Community Reinvestment Acts](https://www.consumerfinance.gov/data-research/research-reports/state-community-reinvestment-acts-summary-of-state-laws/)
- [Mass.gov, CRA for banks and credit unions](https://www.mass.gov/info-details/community-reinvestment-act-cra-for-banks-and-credit-unions)
