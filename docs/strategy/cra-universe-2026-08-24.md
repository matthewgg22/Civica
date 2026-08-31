# The CRA candidate universe

**Date:** 2026-08-24 · **Scope:** national, all 51 jurisdictions

Everything before this was a county-at-a-time search: pick a county, find its banks,
read their PEs. That method kept working but it could never answer *"have we missed
one?"* — the question that produced the California omission and the empty-looking
Maricopa. This is the sweep that answers it.

## Files

| File | What it is |
|---|---|
| `bank-pe-mining/fdic_pressure_universe_2026.csv` | 151 FDIC-supervised banks with an Investment or Service gap |
| `bank-pe-mining/fed_pressure_universe_2026.psv` | 82 Fed-supervised banks, same screen |
| `bank-pe-mining/county_pressure_coverage_2026.csv` | 1,537 counties × the pressured banks whose branches sit in them |
| `bank-pe-mining/ask_rebaseline_2026.csv` | every ask, before and after the new rule |
| `bank-pe-mining/meta_radius_feasibility_2026.csv` | per-AA Meta targeting feasibility |
| `tools/cra-artifact/src/ask.py` | the ask rule, executable and tested |

## 1. The universe: 233 pressured institutions

**151 FDIC + 82 Fed**, every one carrying a Low Satisfactory or worse on the
Investment or Service Test — the two tests a grant and an outreach campaign
actually feed.

Two instrument problems had to be solved to claim "national":

- **The FDIC state query silently caps at 500**, and **29 of 51 jurisdictions hit
  it** — including CA, NY, TX, IL and FL. A state-by-state sweep looked complete
  and was not. Re-run partitioned by quarterly release window (2015–2026), where
  no window approaches the cap.
- **The Fed result page caps at 30.** Partitioned by exam year instead; no
  partition hit the cap.

The internal-consistency guard written for Busey caught **7 further corrupt API
rows** at national scale — records claiming a Lending Test at Substantial
Noncompliance alongside a Satisfactory overall rating, which cannot both be true.

### The OCC has no equivalent, and that is a permanent limit

The OCC's "CRA Search" is a **Google Custom Search over PDFs**. Its only structured
listing is by *overall* rating. **Component ratings are not searchable anywhere at
the OCC.** This screen is therefore structurally FDIC + Fed only. OCC-supervised
banks can be found (by charter probing, as we did in Maricopa and Harris) but not
*screened*. Record that as a known blind spot rather than a completed sweep.

## 2. Coverage: 1,537 counties, and five real white spaces

Branch footprints from FDIC structure data are used as an **assessment-area proxy** —
a CRA assessment area must consist of geographies where the bank has branches, so
branch counties are a defensible lower bound on the AA. It is a proxy, not a
delineation, and every row it produces is tier 2 (`verified:false`, unsendable).

**1,537 of 3,143 counties** contain at least one pressured bank.

| Band | Covered |
|---|---|
| Top 25 counties by unenrolled population | **24 / 25** |
| Top 50 | 45 / 50 |
| Top 100 | 91 / 100 |
| Top 250 | 229 / 250 |

**The uncovered top-50 counties are the finding:**

| Rank | County | Unenrolled | Note |
|---|---|---|---|
| 15 | **Clark, NV** | 165,838 | Western Alliance's Las Vegas AA covers it, but WA is a Strategic Plan bank with **no component ratings**, so it cannot appear in a pressure screen at all |
| 26 | Fresno, CA | 106,028 | no pressured bank in footprint |
| 30 | Kern, CA | 96,800 | no pressured bank in footprint |
| 32 | Pima, AZ | 93,577 | no pressured bank in footprint |
| 48 | St. Louis, MO | 70,811 | no pressured bank in footprint |

Clark is the instructive one: it is not a hole in the market, it is a hole in the
*instrument*. Strategic-plan banks are invisible to a component-rating screen and
have to be found another way — which is exactly how Western Alliance was found.

**Match quality:** 1.7% of footprint county-entries fail to join, almost entirely
Connecticut's new planning regions (which replaced counties in 2022) and Puerto
Rico. Not fixed here; recorded.

## 3. The ask rule

`tools/cra-artifact/src/ask.py`. One rule, applied to every bank:

```
annual = assessment-area giving / review-period years
ask    = annual × 15% × gap multiplier, rounded to $2,500,
         clamped to [$10,000, $25,000]
```

The gap multiplier weights only the two tests we can move (Low Satisfactory 1.0,
Needs to Improve 1.3, Substantial Noncompliance 1.5; a second gapped test adds a
quarter, not a whole). **A lending-only gap raises an error** — a grant is a
qualified investment and outreach is a service; neither moves the Lending Test.

**The floor is the load-bearing part.** Below $10,000 a grant cannot fund a
campaign that reaches an assessment area, so a bank landing under it is a **pool
candidate, not a smaller ask**. That is what makes county pooling structural.

### What re-baselining found

**City National was carrying a $75,000 ask — the largest in the roster — anchored
on $13.2M of institution-wide giving. The assessment area we actually target
received $142,000 over three years.** It sizes to **$7,500, pool**. A 10× mispricing,
and precisely the error the per-AA rule exists to prevent: it had survived in the
record right up until the rule was made executable.

| Bank | Was | Now | |
|---|---|---|---|
| City National | $75,000 | **$7,500** | pool |
| First American | $15,000 | $25,000 | earmark |
| Busey | $15,000 | $20,000 | earmark |
| Texas First | $15,000 | $12,500 | earmark |
| Third Coast | $10,000 | $7,500 | pool |
| Banco do Brasil | $10,000 | $5,000 | pool |
| Lakeside | $10,000 | $5,000 | pool |

Roster total falls **$315,000 → $247,500** — a smaller number, defensible line by line.

**Seven banks are UNSIZED and now say so.** Hanmi, Five Star, American Business,
Bank of Marin, Helm, Mega and Bank Irvine were carrying asks with no stated basis.
Helm and Mega are Intermediate Small Bank evaluations where no Investment or
Service component exists at all; Bank Irvine's PE discloses **no donations
whatsoever**. These need a PE re-read before they can be priced or sent.

## 4. Proxy delivery: the Meta question, largely resolved

Read from Meta's own documentation rather than secondary sources.

**SNAP enrollment is not in Meta's written scope for Financial Products & Services.**
Meta's definition: *"Examples of financial products and services ads include those
promoting insurance, bank accounts, investment services and payment services."*
SNAP enrollment is none of those — **provided our creative never mentions credit,
debt or money management**. That is the firewall rule already in the docs, and it
is now the thing standing between us and a category we do not want.

**The bigger finding inverts the risk.** From the Marketing API documentation:

| Category | Min radius | ZIP targeting | Other |
|---|---|---|---|
| `FINANCIAL_PRODUCTS_SERVICES` | **15 miles** (25 km) | **not permitted** | ages 18–65+ forced |
| `ISSUES_ELECTIONS_POLITICS` | **none specified** | **not restricted** | authorization + "Paid for by" + 7-year Ad Library |

The working assumption had been that either classification would destroy
assessment-area precision. It would not. **If SNAP outreach were classified
SIEP, geographic precision survives entirely** — the cost is disclosure and
authorization overhead, not targeting. The category that breaks this channel is
Financial Products & Services, and that is the one Meta's own text says we are
not in.

### The radius table (worst case, if FPS were applied)

A 15-mile minimum radius means every targeted circle covers **≥707 sq mi**.

| Verdict | Banks |
|---|---|
| **FATAL** — one circle overflows the entire AA | **Habib American (527 sq mi)** — the Kings primary |
| TIGHT — heavy spill | Lakeside (1,273), Ocean (1,900) |
| WORKABLE | Busey, Bank of Marin, Banco do Brasil, Third Coast, Bank Irvine, Hanmi, Mega, First American, Helm, Five Star |
| AMPLE | Texas First, Western Alliance, American Business, City National |

Dense urban AAs are the exposed ones, and our best Kings candidate is the worst
case. Under SIEP or no special category, the problem disappears.

**Still a human gate:** confirm the category with Meta support in writing before
any spend. Meta's text is evidence, not a ruling, and enforcement is discretionary.

## Open

- **Tier-2 rows are unverified by construction.** Branch footprint ≠ assessment
  area. Nothing here is sendable until a PE is hand-read.
- **Seven unsized banks** need PE re-reads.
- **Fresno, Kern, Pima, St. Louis** have no pressured bank — they need the
  strategic-plan / charter-probe treatment that found Western Alliance.
- The OCC blind spot is permanent absent PE reading at scale.
