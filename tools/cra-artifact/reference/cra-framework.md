# CRA Framework Reference

A cited review of the Community Reinvestment Act (CRA) — the regulations, who is
covered, how banks are examined and rated, where the public data and Performance
Evaluations live, and the interagency guidance the Civica bank-pitch channel
relies on. This is the **corpus** the per-bank pitch and qualification-memo work
draws from; it is not legal advice, and it does not decide how any activity is
treated under CRA — **that determination rests with the bank's own compliance
team and its examiners.**

- **Compiled:** 2026-09-12
- **Scope:** U.S. federal CRA framework administered by the FRB, FDIC, and OCC
  (via the FFIEC). State "mini-CRA" statutes are covered in the companion
  [`cra-state-laws.md`](./cra-state-laws.md).
- **Sourcing note:** FFIEC's own pages (`ffiec.gov/data/cra/*`, `/craratings/*`)
  return HTTP 403 to automated fetchers; those pages were read live in a
  browser, and every dollar figure and date below is additionally cross-checked
  against a primary regulatory source that loads programmatically — the Federal
  Register (and its API), and OCC / FDIC / Federal Reserve bulletins and press
  releases. Items resting on a single blocked-page snapshot are flagged in
  [§11 Confidence & caveats](#11-confidence--caveats).

---

## 0. Contents

1. [Statutory & regulatory basis](#1-statutory--regulatory-basis)
2. [Current regime status (dated) — read this first](#2-current-regime-status-dated--read-this-first)
3. [Who is covered, and who reports data](#3-who-is-covered-and-who-reports-data)
4. [Examinations & performance tests](#4-examinations--performance-tests)
5. [Ratings & Performance Evaluations](#5-ratings--performance-evaluations)
6. [Public data products](#6-public-data-products)
7. [Distressed & underserved tracts](#7-distressed--underserved-tracts)
8. [Interagency Q&A & interpretive letters (incl. the SNAP/LMI proxy)](#8-interagency-qa--interpretive-letters)
9. [What this means for the Civica pitch](#9-what-this-means-for-the-civica-pitch)
10. [Source index](#10-source-index)
11. [Confidence & caveats](#11-confidence--caveats)

---

## 1. Statutory & regulatory basis

**The statute.** The CRA was enacted in 1977 and is codified at **12 U.S.C.
§ 2901 et seq.** Section 2901 sets the purpose: encourage insured depository
institutions to help meet the credit needs of their entire communities,
including low- and moderate-income (LMI) neighborhoods, consistent with safe and
sound operation.
- Statute: <https://www.law.cornell.edu/uscode/text/12/2901>

**Written evaluations and ratings.** **12 U.S.C. § 2906** requires the
appropriate federal agency to prepare a public written evaluation after each
examination, and § 2906(b)(2) fixes the four rating categories (see [§5](#5-ratings--performance-evaluations)).
- Statute: <https://www.law.cornell.edu/uscode/text/12/2906>

**The three implementing regulations.** CRA is administered by three prudential
regulators through parallel rules, coordinated via the FFIEC:

| Regulator | Regulation | Codification | Supervises (for CRA) |
|---|---|---|---|
| **Federal Reserve Board (FRB)** | Regulation BB | **12 CFR Part 228** | State member banks |
| **FDIC** | — | **12 CFR Part 345** | State nonmember banks & savings institutions |
| **OCC** | — | **12 CFR Part 25** | National banks & federal savings associations |

- FRB regulation list (Reg BB / CRA): <https://www.federalreserve.gov/supervisionreg/reglisting.htm>
- OCC CRA program (12 CFR 25): <https://occ.gov/topics/consumers-and-communities/cra/index-cra.html>
- FDIC CRA regulation (12 CFR 345): <https://www.ecfr.gov/current/title-12/chapter-III/subchapter-B/part-345>
  *(the eCFR page redirects automated clients to a bot-block; the Part 345
  citation is confirmed from FDIC rulemaking materials.)*

A bank has exactly one primary CRA regulator (its prudential supervisor), which
determines which rule applies, which search tool holds its Performance
Evaluation ([§5](#5-ratings--performance-evaluations)), and who examines it.

---

## 2. Current regime status (dated) — read this first

**Bottom line (as of 2026-09-12): banks are examined under the pre-2023
"1995-era" framework** (the 1995 rules as amended; reinstated by the OCC in
2021) — **12 CFR Parts 25, 228, and 345 as they stood on March 29, 2024.** The
much-publicized October 2023 overhaul **never took effect** and is being
unwound; a newer 2026 FDIC/OCC reform proposal is out for comment but not in
force. Everything else in this file describes the operative 1995 framework.

Do **not** describe the 2023 rule's tests, thresholds, or metrics as current.

**Timeline:**

- **Oct 24, 2023** — FRB, FDIC, and OCC jointly issue the interagency CRA final
  rule (a major overhaul), scheduled to phase in from April 1, 2024.
- **Feb 5, 2024** — Trade groups sue in *Texas Bankers Association v. OCC*
  (N.D. Tex.), alleging the agencies exceeded their statutory authority.
  <https://www.consumerfinancemonitor.com/2024/02/07/trade-groups-file-lawsuit-in-texas-federal-court-challenging-final-occ-fdic-federal-reserve-community-reinvestment-act-rules/>
- **Mar 29, 2024** — The court grants a **preliminary injunction** staying the
  2023 rule's dates (later applied nationwide). The rule is enjoined and never
  takes full effect.
  <https://www.cov.com/en/news-and-insights/insights/2024/04/federal-court-enjoins-community-reinvestment-act-final-rule>
- **Mar 28, 2025** — The three agencies announce intent to propose rescinding
  the 2023 rule and returning to the prior framework.
  <https://www.federalreserve.gov/newsevents/pressreleases/bcreg20250328a.htm>
- **Jul 16–18, 2025** — Joint **NPRM** (a proposal, not a final rescission) to
  rescind the 2023 rule and reinstate rules "substantively identical to those
  in effect on March 29, 2024." Published July 18, 2025.
  <https://www.federalregister.gov/documents/2025/07/18/2025-13559/community-reinvestment-act-regulations>
- **Jul–Aug 2026** — Rather than finalize the 2025 rescission, the **FDIC and
  OCC** issue a **new NPRM** (Federal Register Aug 12, 2026) proposing targeted
  reforms to the 1995 framework (illustratively: small bank < $1B; a new
  intermediate band $1–10B; large banks > $10B; evaluating only "major product
  lines"; a narrowed service test). **Comments due Oct 13, 2026. The Federal
  Reserve did not join this proposal** and continues under the 1995 rules.
  <https://www.fdic.gov/news/financial-institution-letters/2026/fdic-and-occ-seek-public-comment-joint-notice-proposed>

**What this means for the pitch:** cite the 1995-framework structure and the
current annually-adjusted thresholds ([§3](#3-who-is-covered-and-who-reports-data)).
Expect change: a rescission and a further FDIC/OCC amendment are both pending,
so re-verify this section before any dated external use.

---

## 3. Who is covered, and who reports data

**Coverage vs. reporting are different questions.** *All* insured depository
institutions above the small-bank size are subject to CRA and are examined and
rated. Only **large banks** must *collect and report* CRA loan data; small and
intermediate small banks are exempt from data reporting unless they opt to be
evaluated as a large bank. (Note: any bank, of any size, can earn CRA
consideration for qualifying community-development activity — reporting status
is separate from whether an activity counts.)

**Asset-size categories (1995 framework).** Thresholds are adjusted **annually**
by the change in the CPI-W (12 months ending in November), rounded to the
nearest million.

| Category | 2026 (effective Jan 7, 2026) | 2025 (effective Jan 1, 2025) |
|---|---|---|
| **Small bank** | assets **< $1.649B** | assets **< $1.609B** |
| **Intermediate small bank (ISB)** | **≥ $412M** and **< $1.649B** | **≥ $402M** and **< $1.609B** |
| **Large bank (data reporter)** | assets **≥ $1.649B** | assets **≥ $1.609B** |

Asset size is measured as of December 31 of **both** of the prior two calendar
years (a bank crosses a line only after two consecutive year-ends on the far
side). CPI-W rose 2.51% for the 12 months ending Nov 2025 (2026 update) and
2.91% the prior year (2025 update). For lineage, the 2024 figures were small
< $1.564B and ISB minimum $391M.

- 2026 thresholds (FR 2026-00042, Jan 7, 2026): <https://www.federalregister.gov/documents/2026/01/07/2026-00042/community-reinvestment-act-regulations-asset-size-thresholds>
- OCC Bulletin 2025-48 (2026): <https://www.occ.gov/news-issuances/bulletins/2025/bulletin-2025-48.html>
- OCC Bulletin 2024-36 (2025): <https://www.occ.gov/news-issuances/bulletins/2024/bulletin-2024-36.html>

> ⚠️ These figures change every January — always date them, and re-check the
> current year before external use. (For contrast, the enjoined 2023 rule would
> have used Small < $600M / Intermediate $600M–$2B / Large ≥ $2B; **not in
> effect** — do not use those.)

**What large (reporting) banks collect and report** (12 CFR § __.42):
- **Small-business loans** and **small-farm loans** — number and dollar amount
  originated/purchased, by census tract, in loan-size bands.
- **Community-development (CD) loans** (and CD investments) — number and dollar
  amount, by county.
- Reported via the FFIEC CRA Data Entry Software as a transmittal sheet plus
  loan/application records; published back out as per-institution **Disclosure
  Statements** and combined **Aggregate** tables ([§6](#6-public-data-products)).
- Data-collection guide: <https://www.ffiec.gov/data/cra/data-collection-guide>
- Reporting criteria: <https://www.ffiec.gov/data/cra/reporting-criteria>

**Filing mechanics:**
- **Deadline:** prior calendar year's data is due **March 1** (next business day
  if March 1 is a weekend). 2025 data was due March 1, 2026; 2026 data is due
  March 1, 2027.
- **Software:** the free, **year-specific** FFIEC CRA Data Entry Software (DES);
  the wrong year's software will not produce a valid file.
- **Submission:** "Submission via Web" (preferred, returns a receipt) or an
  encrypted file emailed to `crasub@frb.gov`. Help: `crahelp@frb.gov` /
  (202) 872-7584.
- How to file: <https://www.ffiec.gov/data/cra/how-to-file> · Software:
  <https://www.ffiec.gov/data/cra/software-downloads>

---

## 4. Examinations & performance tests

Under the 1995 framework the **examination method depends on the bank's asset
size** (see [§3](#3-who-is-covered-and-who-reports-data)):

- **Large bank** — three tests:
  - **Lending Test** (weighted most heavily): volume and distribution of loans
    across the assessment area (AA), especially to LMI borrowers and LMI
    geographies.
  - **Investment Test**: qualified community-development investments and grants.
  - **Service Test**: branch distribution and community-development services.
- **Intermediate small bank (ISB)** — two tests: a **streamlined lending test**
  plus a combined **Community Development test** (CD loans, investments, and
  services together).
- **Small bank** — a **streamlined lending test** (loan-to-deposit ratio, share
  of lending inside the AA, distribution across borrower incomes and
  geographies, response to complaints).
- **Alternatives** — wholesale/limited-purpose banks use a **Community
  Development test**; any bank may elect an approved **Strategic Plan**.

> **Home-mortgage lending is a major — often the largest — driver of the Lending
> Test**, but note the split from [§3](#3-who-is-covered-and-who-reports-data):
> CRA-specific *data collection* is small-business, small-farm, and CD loans —
> **home mortgage is not CRA-reported; the examiner pulls it from HMDA** — yet the
> Lending Test *evaluation* leans heavily on that home-mortgage record. So
> "mortgage drives CRA" is true of the evaluation, not the reporting. This also
> frames Civica's fit: a grant-funded benefits-access program **is not lending**,
> so it never touches the mortgage-driven Lending Test — it is a
> community-development contribution, evaluated on the Investment/Service (or CD)
> side. See [`cra-state-laws.md`](./cra-state-laws.md) for how several states
> extended CRA specifically to reach *nonbank mortgage lenders*.

**Exam scheduling.** Each agency must publish its **quarterly CRA examination
schedule at least 30 days before** the quarter begins; the FDIC, for example,
issues quarterly lists of institutions up for CRA exam.
- FFIEC examinations: <https://www.ffiec.gov/data/cra/examinations>
- FRB evaluation methods: <https://www.federalreserve.gov/consumerscommunities/cra_exam.htm>

The unit of evaluation is the bank's **assessment area(s)** — the geographies
(whole political subdivisions containing its main office, branches, and
deposit-taking ATMs, plus surrounding areas where it originates most loans) that
the bank delineates and the examiner reviews.

---

## 5. Ratings & Performance Evaluations

**The four statutory ratings** (12 U.S.C. § 2906(b)(2); publicly disclosed since
July 1, 1990 under a FIRREA 1989 mandate):

| Rating | Plain meaning |
|---|---|
| **Outstanding** | Substantially exceeds expectations for meeting community credit needs. |
| **Satisfactory** | Adequately meets community credit needs (a passing grade). |
| **Needs to Improve** | Below expectations; deficiencies in meeting community credit needs. |
| **Substantial Noncompliance** | Seriously deficient record of meeting community credit needs. |

- Statute: <https://www.law.cornell.edu/uscode/text/12/2906>
- FFIEC interagency ratings: <https://www.ffiec.gov/craratings/>

**Where to find a specific bank's rating and full Performance Evaluation (PE).**
One interagency search (ratings) plus three regulator-specific tools (full PEs),
split by the bank's primary regulator:

| Tool | Covers | URL |
|---|---|---|
| **FFIEC Interagency Ratings** | All regulators — **ratings only**, updated quarterly, back to July 1990 | <https://www.ffiec.gov/craratings/> |
| **FDIC CRAPES** | State nonmember banks & savings institutions | <https://crapes.fdic.gov/> |
| **FRB CRAPubWeb** | State member banks (searchable by name, geography, asset range, exam type, per-test ratings) | <https://www.federalreserve.gov/apps/CRAPubWeb/CRA/BankRating> |
| **OCC CRA Search** | National banks & federal savings associations (PDFs from April 1996; earlier via FOIA) | <https://occ.gov/publications-and-resources/tools/index-cra-search.html> |

**What a PE document contains** (public section, per 12 U.S.C. § 2906(b)):
- **Assessment-area delineation** — the geographies the bank is evaluated in.
- **Performance context** — demographics, economy, competition, community credit
  needs.
- **Test conclusions** — findings and rating under each applicable test, plus any
  state / multistate-MSA ratings.
- (A separate confidential section is not public.)

The PE is the anchoring document for a per-bank pitch: it states the bank's
**own delineated assessment area**, its most recent overall rating, and the exam
date — the geography and posture the pitch should map to.

> No aggregate rating-distribution statistic (e.g., "% Outstanding") is published
> on the search-tool pages; any such figure would have to be computed from the
> downloadable FFIEC ratings data file and cited as an own-computation. **Do not
> quote a distribution percentage as if the agencies published it.**

---

## 6. Public data products

All at FFIEC; each page's printed "last updated" date is noted where captured.
Current data years run through **2024** on the interactive tools.

| Product | What it is | Assessment-area use | URL |
|---|---|---|---|
| **Aggregate Reports** | Combined small-business / small-farm / CD lending totals for **all reporters** in a state, MSA/MD, or county | Size the market; benchmark one bank against the aggregate | <https://www.ffiec.gov/data/cra/aggregate-reports> |
| **Disclosure Reports** | A **single institution's** CRA lending record by geography | The per-bank counterpart to the aggregate | <https://www.ffiec.gov/data/cra/disclosure-reports> |
| **National Aggregate Reports** | National small-business / small-farm totals by neighborhood-income category (Excel export) | A nationwide yardstick for AA-level performance | <https://www.ffiec.gov/data/cra/national-aggregate-reports> |
| **Census & Demographic Data** | Census, income, and MSA data by geography; classifies each tract low/moderate/middle/upper income (updated 4/22/2025) | The backbone for defining LMI geographies in an AA | <https://www.ffiec.gov/data/census> |
| **Flat Files** | 1,000+ tract-level fields, annual, with MSA boundaries and distressed/underserved flags (2026 file dated 7/9/2026) | Bulk joinable dataset for custom AA analysis with HMDA/CRA data | <https://www.ffiec.gov/data/census/flat-files> |
| **Distressed & Underserved Tracts** | Annual list of qualifying nonmetro middle-income tracts, 2015–2026 (updated 6/30/2026) | Flags where CD activity earns credit in a nonmetro AA ([§7](#7-distressed--underserved-tracts)) | <https://www.ffiec.gov/data/cra/distressed> |

> The FFIEC census tools are "intended to be used with HMDA and CRA data only."
> Civica's need model uses ACS PUMS, allocated to counties by a tract-to-PUMA
> crosswalk — the FFIEC tract income levels are the natural cross-reference for
> LMI-geography claims.

---

## 7. Distressed & underserved tracts

Source: Interagency Q&A **§ __.12(g)(4)(iii)—1** (as reproduced in the FDIC
Consumer Compliance Examination Manual XI-12).
<https://www.fdic.gov/consumer-compliance-examination-manual/xi-12-interagency-questions-and-answers-regarding-community>

- These are **nonmetropolitan middle-income census tracts** the agencies
  designate annually (a tract can be both distressed and underserved).
- **Distressed** — the county triggers one or more of: unemployment ≥ 1.5× the
  national average; poverty rate ≥ 20%; population loss ≥ 10% (decennial) or net
  migration loss ≥ 5% (5-year).
- **Underserved** — meets population size/density/dispersion criteria via USDA
  Economic Research Service "urban influence codes" 7, 10, 11, and 12.
- **Why it matters:** activities that revitalize or stabilize a designated
  distressed-or-underserved nonmetro middle-income tract count as **community
  development**, extending CD consideration to *middle-income* rural tracts (not
  only LMI). The annual FFIEC list ([§6](#6-public-data-products)) is the
  authoritative set of qualifying tracts.

---

## 8. Interagency Q&A & interpretive letters

**The Interagency Questions & Answers Regarding Community Reinvestment** is the
agencies' consolidated interpretive guidance — released July 15, 2016 (**81 FR
48505**), superseding prior Q&A.
- FFIEC Q&A: <https://www.ffiec.gov/data/cra/interagency-qa> (page updated 3/29/2025)

**Community development** (the category Civica's activity falls under) covers,
among other things: affordable housing for LMI individuals; **community services
targeted to LMI individuals**; and activities that promote economic development
by financing businesses/farms meeting SBA size-eligibility standards; plus
revitalize/stabilize activities (incl. distressed/underserved tracts, [§7](#7-distressed--underserved-tracts)).

### 8.1 The SNAP / LMI proxy — § __.12(g)(2)—1 (load-bearing for the pitch)

The pitch's citation is **correct**. Q&A **§ __.12(g)(2)** is headed "Community
services targeted to low- or moderate-income individuals," and its Q&A
**§ __.12(g)(2)—1** asks how an institution may determine that community
services reach LMI individuals. The answer treats recipients of income-qualified
government programs as LMI, and **names SNAP explicitly**. Illustrative examples
in the answer (each quote < 15 words, from the § __.12(g)(2)—1 answer via the
FDIC manual page above):

- "a school at which the majority of students qualify for free or reduced-price meals"
- "individuals who receive or are eligible to receive Medicaid"
- "government assistance programs that have income qualifications equivalent to, or stricter than" LMI
- programs named include "section 514, 516, and Supplemental Nutrition Assistance programs"

So a benefits-access program that drives SNAP-eligible residents to enroll is
"community services targeted to LMI individuals" under the operative guidance,
**without** household-level income documentation — the program eligibility is
the proxy. This is the guidance behind the pitch's "Beneficiaries" line.

**Two refinements to keep the citation clean:**
1. Frame SNAP under the general prong — "income qualifications equivalent to, or
   stricter than" LMI — with free/reduced-price-meal eligibility and Medicaid as
   the parallel named examples. That is how the Q&A carries SNAP.
2. **Citation form — verified 2026-09-12, and it has a trap.** Under the
   operative **1995 framework**, community development is defined at **§ __.12(g)**
   and community services to LMI at **§ __.12(g)(2)** (interpreted by Q&A
   **§ __.12(g)(2)—1**) — confirmed against the Interagency Q&A and OCC/FFIEC
   sources. **However, the current eCFR/Cornell codification shows the enjoined
   2023 rule**, which moved community development to **§ __.13** and *renamed* the
   category "community supportive services" at **§ __.13(d)**. So a present-day
   lookup of "§ __.12(g)(2)" will not match the codified text, and "§ __.13(d)"
   is the **enjoined, non-operative** rule. Resolution for bank documents: **cite
   the 1995 form (§ __.12(g)(2)) and disclose the framework**; do not cite the
   § __.13 codification. In this repo, the pager cites only the unambiguous Part
   number (12 CFR Part 345/25/228) and the qualification memo cites § __.12(g)(2)
   with a footer stating citations follow the operative 1995 framework. The
   Q&A page's "read as Appendix G" transition note is an artifact of the enjoined
   rule and is moot.

### 8.2 Interpretive letters

Fact-specific staff letters (1995–2006) that supplement the Q&A; the newest
(Jan 11, 2006) addresses qualified investments in minority-owned institutions.
Most FAQs are handled by the Q&A rather than new letters.
- <https://www.ffiec.gov/data/cra/letters> (page updated 9/19/2025)

---

## 9. What this means for the Civica pitch

Mapping the framework to the per-bank artifact and qualification memo:

- **The activity is CD-eligible on its face.** Benefits-access outreach and
  application assistance for SNAP-eligible LMI residents is "community services
  targeted to LMI individuals" ([§8.1](#81-the-snap--lmi-proxy--__12g21-load-bearing-for-the-pitch)),
  and SNAP is a named income proxy — so no household-level income docs are
  needed to establish LMI targeting.
- **Geography is the discipline.** Consideration runs through the bank's
  **delineated assessment area** ([§4](#4-examinations--performance-tests),
  [§5](#5-ratings--performance-evaluations)); the pitch should map outreach and
  reporting to the AA from the bank's own PE, which is why the artifact pulls the
  AA from the PE and reports within it.
- **Reporting status ≠ eligibility.** Only large banks (≥ $1.649B in 2026) file
  CRA data ([§3](#3-who-is-covered-and-who-reports-data)), but a bank of any
  size can receive CRA consideration for CD activity. The pitch's tiers do not
  depend on the bank being a data reporter.
- **Posture.** The determination that any activity qualifies — and how it is
  weighted — is the examiner's, under the operative 1995 framework
  ([§2](#2-current-regime-status-dated--read-this-first)). Pitch copy states the
  documented need and the CD category and stops there: "treatment under the CRA
  framework remains subject to your institution's compliance team and examiners."
  Never assert "this qualifies for CRA."
- **Currency.** Thresholds change each January and the rules themselves are in
  flux ([§2](#2-current-regime-status-dated--read-this-first)); re-verify [§2](#2-current-regime-status-dated--read-this-first)
  and [§3](#3-who-is-covered-and-who-reports-data) before any dated external use.

---

## 10. Source index

**Statute & regulations**
- 12 U.S.C. § 2901 (purpose): <https://www.law.cornell.edu/uscode/text/12/2901>
- 12 U.S.C. § 2906 (evaluations & ratings): <https://www.law.cornell.edu/uscode/text/12/2906>
- FRB Reg BB / 12 CFR 228 (reg list): <https://www.federalreserve.gov/supervisionreg/reglisting.htm>
- FDIC 12 CFR 345: <https://www.ecfr.gov/current/title-12/chapter-III/subchapter-B/part-345>
- OCC 12 CFR 25: <https://occ.gov/topics/consumers-and-communities/cra/index-cra.html>

**Regime status (2023 rule → rescission → 2026 proposal)**
- Court injunction (Mar 29, 2024): <https://www.cov.com/en/news-and-insights/insights/2024/04/federal-court-enjoins-community-reinvestment-act-final-rule>
- Agencies' intent to rescind (Mar 28, 2025): <https://www.federalreserve.gov/newsevents/pressreleases/bcreg20250328a.htm>
- Rescission NPRM (Jul 18, 2025): <https://www.federalregister.gov/documents/2025/07/18/2025-13559/community-reinvestment-act-regulations>
- FDIC/OCC 2026 reform NPRM: <https://www.fdic.gov/news/financial-institution-letters/2026/fdic-and-occ-seek-public-comment-joint-notice-proposed>

**Thresholds**
- 2026 (FR 2026-00042): <https://www.federalregister.gov/documents/2026/01/07/2026-00042/community-reinvestment-act-regulations-asset-size-thresholds>
- OCC Bulletin 2025-48 (2026): <https://www.occ.gov/news-issuances/bulletins/2025/bulletin-2025-48.html>
- OCC Bulletin 2024-36 (2025): <https://www.occ.gov/news-issuances/bulletins/2024/bulletin-2024-36.html>

**Reporting, filing, examinations**
- Reporting criteria: <https://www.ffiec.gov/data/cra/reporting-criteria>
- Data-collection guide: <https://www.ffiec.gov/data/cra/data-collection-guide>
- Examinations: <https://www.ffiec.gov/data/cra/examinations>
- How to file: <https://www.ffiec.gov/data/cra/how-to-file>
- Software downloads: <https://www.ffiec.gov/data/cra/software-downloads>

**Ratings & Performance Evaluations**
- FFIEC interagency ratings: <https://www.ffiec.gov/craratings/>
- FDIC CRAPES: <https://crapes.fdic.gov/>
- FRB CRAPubWeb: <https://www.federalreserve.gov/apps/CRAPubWeb/CRA/BankRating>
- OCC CRA search: <https://occ.gov/publications-and-resources/tools/index-cra-search.html>

**Data products**
- Aggregate: <https://www.ffiec.gov/data/cra/aggregate-reports>
- Disclosure: <https://www.ffiec.gov/data/cra/disclosure-reports>
- National aggregate: <https://www.ffiec.gov/data/cra/national-aggregate-reports>
- Census & demographic: <https://www.ffiec.gov/data/census>
- Flat files: <https://www.ffiec.gov/data/census/flat-files>
- Distressed & underserved: <https://www.ffiec.gov/data/cra/distressed>

**Guidance**
- Interagency Q&A: <https://www.ffiec.gov/data/cra/interagency-qa>
- Interpretive letters: <https://www.ffiec.gov/data/cra/letters>
- Q&A full text (FDIC manual XI-12, used for verbatim quotes): <https://www.fdic.gov/consumer-compliance-examination-manual/xi-12-interagency-questions-and-answers-regarding-community>
- 2016 Q&A (81 FR 48505): <https://www.federalregister.gov/documents/2016/07/25/2016-16693/community-reinvestment-act-interagency-questions-and-answers-regarding-community-reinvestment>

---

## 11. Confidence & caveats

- **High confidence (2+ independent primary sources):** the current operative
  framework is the 1995-era rules; the four statutory ratings; the 2025
  ($1.609B / $402M) and 2026 ($1.649B / $412M) thresholds; the March 1 filing
  deadline; the three PE search tools and their regulator coverage; the Q&A
  § __.12(g)(2)—1 SNAP/LMI-proxy citation and content.
- **Moderate confidence (single blocked-page snapshot):** exact FFIEC software
  version strings and the fine detail of the file/register structure; the
  precise Federal Register volume/page numbers for the 2026 FDIC/OCC NPRM. A
  person on a normal browser can open every FFIEC URL above to confirm.
- **Time-sensitive — re-verify before dated external use:** the regime status
  ([§2](#2-current-regime-status-dated--read-this-first)) — a rescission and a
  further FDIC/OCC amendment are both pending; and the asset thresholds
  ([§3](#3-who-is-covered-and-who-reports-data)), which the agencies re-index
  every January.
- **Citation form — verified 2026-09-12.** Operative citation is the 1995
  framework's **§ __.12(g)(2)**; the current eCFR codifies the enjoined 2023 rule
  at **§ __.13(d)** ("community supportive services"), so cite the 1995 form and
  disclose the framework, never the § __.13 codification. Details in
  [§8.1](#81-the-snap--lmi-proxy--__12g21-load-bearing-for-the-pitch).
- **Not legal advice.** Whether any activity qualifies for CRA consideration,
  and how it is weighted, is determined by the bank's regulator and examiners.
