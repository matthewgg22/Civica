# What Examiners Require + Who Sells CRA Compliance Today

Compiled 2026-08-22. Two research passes: (1) the examiner-side ground truth — what a bank must actually produce for a CRA exam, read from the interagency exam procedures and the regulation itself; (2) the vendor landscape — findCRA and adjacent products, i.e. the competitive map for any future "CRA-grade impact attribution" product. Companion to [cra-officer-call-guide.md](cra-officer-call-guide.md) and [cra-targets-national-2026-08-22.md](cra-targets-national-2026-08-22.md).

Legend: **[V]** verified against regulation/exam-procedure text read directly · **[P]** practitioner-generalized (consistent across consultant/vendor literature) · **[S]** search-summary, not independently verified.

---

## PART 1 — Examiner ground truth

### The single most useful structural fact [V]

**Community-development grants are never publicly filed anywhere.** The CRA public file (12 CFR __.43) contains comments, the last PE, branch lists, service lists, AA maps, and (small banks) loan-to-deposit ratios — **no CD loans, no qualified investments, no grants, no CD services**. Large-bank CRA data reports CD loans only as an annual aggregate. Item-level grant detail exists in exactly one place: **the bank's internal log**, surfaced for the first time at exam.

Consequence: *the packet a nonprofit hands its bank is literally the bank's only exam evidence for that grant.* Whoever writes that packet controls whether the dollars count.

### How an exam actually starts [V — FDIC Compliance Exam Manual §III-1]

Quarterly schedule publishes → pre-exam letter (generic; does **not** enumerate CD documents) → **pre-examination interview** with the examiner-in-charge ("allows us to tailor any information and document requests appropriately") → **Compliance Information and Document Request (CIDR)** returned by the bank → follow-up request for transaction-level detail once scope is set. Fed process is analogous. The CIDR item lists are exam-internal, not published.

### What examiners must verify per activity [V — Large Institution CRA Exam Procedures, OCC/FRB/FDIC 2014]

- **Qualified investments (Investment Test step 1):** identify grants/donations/in-kind contributions "since the last examination that are for community development purposes"; obtain "a prospectus, or other information that describes the investment(s) and the geographic area(s) or population(s) served." Verify not already counted under lending/service tests; verify no affiliate double-claim.
- **CD loans (Lending step 2b):** meet the CD definition; benefit the AA or a broader statewide/regional area including it; not also reported as HMDA/small-business/farm/consumer; consortia pro-rated to participation share.
- **CD services (Service step 6):** identified through "discussions with management and review available materials" — *the bank's own log IS the evidence base.*
- Scored dimensions the log must support: number and dollar amount (in-AA vs broader area), **responsiveness to identified needs**, innovativeness/complexity (large banks only — explicitly NOT a factor for intermediate small banks), degree serving LMI areas/individuals.

### The per-activity evidence bundle [P — Wipfli, Jambo, KC Fed worksheet fields]

One log row + one bundle per activity, establishing independently:
(a) CD category + primary purpose (narrative + org mission/program docs) · (b) LMI beneficiary proof by an accepted method · (c) geocoded AA benefit, or "purpose, mandate, or function" evidence for a broader-area org · (d) amount/date/recipient · (e) not-counted-elsewhere attestation.
Standard log fields: entity, date, amount (or hours), CD category, purpose narrative, geography (state/county/MSA/tract), AA benefit flag, LMI-qualification method; for services also employee, role, and **financial expertise used**.

### What gets DISALLOWED [P, with [V] anchors]

| Failure | Saved by |
|---|---|
| No documented primary purpose | Purpose narrative + org docs captured **at time of grant** |
| No LMI evidence | Mission statement, income-limited grant terms, free/reduced-lunch %, Medicaid %, **or a named means-tested program (SNAP)** |
| Wrong geography / outside AA [V] | FFIEC geocode per activity; broader-area purpose/mandate/function evidence |
| Event sponsorship / gala portions [S] | Invoice split: charitable portion net of dinner/advertising value |
| Volunteer hours without **financial** expertise | Log the financial skill used (budgeting, financial ed, credit counseling, board service) |
| Double-counting [V] | Reconciliation columns: reported-elsewhere flag, affiliate attribution, participation % |
| Economic-development two-prong failure | Job counts, wages, permanency |

Directional: the **July 2026 OCC/FDIC joint proposal explicitly targets grants "diverted to other activities or excessive operating costs"** [S] — substantiation scrutiny is rising, which favors grantees who arrive documented.

### Performance context — the responsiveness lever [V]

Exam procedures direct examiners to "**Discuss with the institution, and consider, any information the institution may provide about its local community and economy, including community development needs and opportunities**" and to "document the performance context information, particularly community development needs and opportunities." Each test's conclusions are then formed "especially with regard to community needs." Practitioners advise banks to hand examiners a written performance-context narrative rather than let examiners draw their own conclusions [P].

**So:** county-level need data (ours) does not earn credit by itself — it raises the **responsiveness weighting** of the activity that addresses it, and it slots directly into the bank's performance-context narrative. That is the precise mechanism by which our page-1 need map has exam value, and it should be described that way, never as "this earns you credit."

---

## PART 2 — Vendor landscape (competitive map for a future attribution product)

### findCRA (Louisville, founded 2013; ex-CRA-officer founders) [V]

- **Community Qualifier** — bank-side search over **60,000+ pre-qualified nonprofit profiles**; output is a printable profile (contact, mission, CD-category coding, federal designations, IRS financials, geographic/demographic mapping) explicitly meant "to share with your examiners."
- **CRANIA** — qualification algorithm: 1,400+ data points from 20+ sources (IRS, Census, FFIEC, CDFI Fund, HUD), then **manual curation by CRA-expert staff**. Marketing: "fewer than 5% of nonprofits align with CRA; 100% of ours do."
- **Contexter** — ~200-data-point assessment-area market analysis (performance context).
- **ComplyAnswer** + consulting; **learncra.com** as content top-of-funnel; **CRA Verified** free nonprofit listings (supply-side moat).
- Pricing [S, single dead source]: ~$1.2K–$5K ACV, ~$2K typical — a cheap point solution, not enterprise.
- Distribution [V]: ABA Partner Network Gold Member (since 2022); **Ncontracts partnership (2023)** rides a 4,000-FI installed base.

**What findCRA does NOT do [V by omission]:** no lending-data analytics; no outreach *delivery*; **no outcome measurement or attribution** (its "% LMI served" is nonprofit self-report at claim time); no prescriptive need ranking.

### Adjacent vendors

| Vendor | Serves | Note |
|---|---|---|
| **Kadince** | CD-activity workflow: donation intake/routing, volunteer hours, event + relationship tracking | The bank's internal system of record. No external intelligence, no outcomes |
| **Wolters Kluwer CRA Wiz** | Lending-test data: collect/geocode/scrub/file CRA+HMDA+1071; Fair Lending Wiz | Enterprise incumbent on the data side |
| **Ncontracts (TRUPOINT)** | Lending analytics + some CD tracking, inside a risk suite | 4,000+ FIs; distributes findCRA |
| **RATA Associates** | HMDA/CRA/SBL geocoding + filing (since 1987) | Legacy filing specialist |
| **ICBA CRA Solutions** (ex-CRA Partners / SHCP) | **Sells delivered activity**: banks fund Senior Crimestoppers in LMI senior housing for "guaranteed CRA credit" | ICBA subsidiary; endorsed in 30+ states. The only player selling an *activity*, but one fixed program with no measurement |
| **RiskExec** | Launched a "Community Development Module" (2026) for centralizing CD documentation | Market is actively converging on the log-plus-evidence problem |

### The gap [inferred; verified by absence — moderate confidence]

The market is: **lending-data plumbing** | **CD paperwork** (internal workflow: Kadince; external partner qualification: findCRA) | **one packaged activity** (ICBA).

Nobody found combines: (a) quantitative **need mapping** that ranks unmet LMI need inside an AA (Contexter is descriptive, not prescriptive); (b) **delivery** of the community-development outcome itself; (c) **outcome attribution** — what the bank's dollars produced, in exam-ready form. The pilot's report (need map → delivered outreach → measured outcomes per dollar, with the LMI proxy and geocoded AA nexus attached) sits in that whitespace, with findCRA/Kadince as *complements* — documentation rails our packet feeds — rather than competitors.

**Real risk is not competition, it's examiner acceptance.** ICBA's moat is "guaranteed credit" via association endorsement, not software. Any product here inherits that requirement: association endorsement (ABA/ICBA/state associations) and a real exam that accepted the packet are the credibility assets — which is exactly what the nonprofit pilot is positioned to produce first.

---

## Implications for the pilot (apply now, not later)

1. **The qualification memo is the product.** Design it against the evidence-bundle list above: CD category + primary purpose narrative, SNAP-as-named-LMI-proxy citation, geocoded county/AA nexus, amount/date/recipient, and a "100% program delivery; not counted elsewhere" attestation.
2. **Frame need data honestly as performance-context input** ("raises responsiveness weighting"), never as credit.
3. **Say "no gala haircut" out loud** — every dollar is program delivery, which is a real differentiator against event sponsorships.
4. **Offer the annual impact letter** for the bank's next-exam file; that is the recurring artifact the market currently lacks.
5. If the C-corp path ever activates: the wedge is attribution + need mapping, sold *alongside* findCRA/Kadince, with distribution through association endorsement — and gated (per the CEO plan) on 2+ paying banks and one report that survived an actual exam.

Sources: Large Institution CRA Examination Procedures (OCC/FRB/FDIC, CA 14-2 att. 1) · FDIC Compliance Examination Manual §III-1 · 12 CFR 345.43 · Interagency Q&A 81 FR 48506 · Wipfli CD-documentation guide · CRA Today · Ncontracts nSight (performance context; CD credit) · CrossCheck Compliance · Jambo · KC Fed CD Qualification Worksheet · RiskExec CD Module release · findCRA/learnCRA product pages + ABA Partner Network listing + Ncontracts partnership release · Kadince · Wolters Kluwer CRA Wiz · RATA · ICBA CRA Solutions/SHCP Foundation · FDIC/OCC joint CRA proposal (Aug 2026).
