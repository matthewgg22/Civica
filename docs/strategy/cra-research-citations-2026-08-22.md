# Research Citations — what we may claim, and what we may not

Compiled 2026-08-22 after a verification pass on every research claim in the CRA channel. **A claim repeated throughout this project's early drafts turned out not to exist.** This file is the standing reference so it does not recur.

## The correction

Earlier work in this channel referred to "an NBER study using a SNAP interview-scheduling discontinuity that measured credit outcomes for marginally-enrolled versus marginally-denied applicants." **That paper does not exist.** Two real and separate literatures were merged:

- The **administrative-burden discontinuity** papers are real, but their outcomes are approvals, participation, and benefit dollars — **no credit-bureau outcomes at all**.
- The **credit-outcomes** paper is real, but it is a **Federal Reserve Board** paper using ABAWD work-requirement waivers, not interview scheduling, and it is not an NBER working paper.

**No study anywhere measures credit outcomes for marginally-enrolled vs. marginally-denied SNAP applicants.** There is no "SNAP enrollment raises credit scores by X points" finding.

## Cite these (verified)

**1. Dodini, Larrimore & Tranfaglia — "Financial Repercussions of SNAP Work Requirements."** Federal Reserve Board FEDS 2022-030; *Journal of Public Economics* 229 (2024), DOI 10.1016/j.jpubeco.2023.105034. FRBNY/Equifax Consumer Credit Panel, 2010–2017, ~6.28M person-quarters; difference-in-differences within commuting zones plus a difference-in-discontinuities at the age-50 ABAWD cutoff.

When households lose SNAP access through work requirements: credit inquiries **+12.9%**, probability of a new card **+1.82 pp**, total card limit **+$392 (+9.9%)**, card balances **+$132 (+7.9%)**, probability of any past-due card **+0.48 pp**, and **application success rates fall** — distress borrowing, not improved creditworthiness. Equifax Risk Score **−1.65 points**.

⚠️ Conditions on the −1.65: it is (a) a *decline from benefit loss*, not a gain from enrollment; (b) an **intent-to-treat** estimate; (c) averaged over a proxy sample in which **only ~10% are actually affected ABAWDs**, so it is attenuated toward zero; and (d) presented by the authors as a *mechanism test*, not a headline. State all four or don't use the number. Also: figures above come from the April 2023 working-paper draft — **re-check Tables 2 and 3 against the published 2024 version before printing them**.

**2. Giannella, Homonoff, Rino & Somerville — "Administrative Burden and Procedural Denials: Experimental Evidence from SNAP."** NBER WP 31239 (2023). Field experiment, **65,000 LA County applicants**: flexible applicant-initiated interviews raised approvals **+6 pp**, doubled early approvals, and raised long-term participation **+2 pp**. *This is the strongest evidence that our actual intervention — reducing procedural burden at intake — works.*

**3. Homonoff & Somerville — "Program Recertification Costs: Evidence from SNAP."** NBER WP 27311 → *AEJ: Policy* 13(4), 2021. Households given later recertification interview dates are **>20% less likely to recertify** and lose **~$600 in benefits** over the following year.

**4. Brookings — Cox, East & Pula (June 2024), "Beyond hunger."** Use for framing only. It reports **no independent magnitudes**; it restates Dodini et al. directionally. Never quote it for numbers.

## Do NOT cite

- **Any credit-score point gain attributed to SNAP enrollment.** Does not exist. Inverting the −1.65 ITT into a positive claim fails twice: on sign and on attenuation.
- **The +21/+33 point financial-coaching effect** (Theodos et al., Urban/CFPB RCT 2015) **as if it applied to us.** That tested one-on-one coaching over ~22 months, and the *same* RCT's second site produced **+3 points, not significant**. The effect isn't even portable across sites of the same intervention, let alone across intervention types.
- **"FEC clients increased scores by 35+ points."** A self-set program threshold counted pre/post with no counterfactual; the report explicitly disclaims causality and publishes **no average point figure**. (Also: it was authored in-house by the CFE Fund, not Urban Institute, and studied five replication cities — not New York.)
- **Working Credit's 42/30-point figures or Neighborhood Trust's "67% improved."** Program self-report on self-selected participants. Urban Institute studied Working Credit and pointedly declined to publish a point change.
- **Compass Working Capital's +19.8 as causal.** Abt states a significant difference cannot be attributed to the program alone.
- **The credit-builder-loan RCT as positive evidence.** Burke, Jamison, Karlan, Mihaly & Zinman (*RFS* 2023) found a precisely estimated **null on average** (−1.9 pts, SE 2.7); only the bottom tercile of baseline installment activity gained (+23 pts).
- **Bornstein & Indarte on Medicaid.** Different program, credit-*supply* mechanism, opposite direction. Do not blend with SNAP evidence.

## The approved framing

> Federally-evaluated research shows that when low-income households lose SNAP access, they substitute into unsecured credit — more inquiries, more accounts, ~8% higher card balances, and measurably more past-due card debt — while their credit scores and loan approval rates fall. Enrollment assistance addresses that substitution at its source. Separately, field-experimental evidence shows that reducing procedural burden in SNAP intake raises approvals by six percentage points across 65,000 applicants.

Fully sourced, no borrowed effect sizes, and it survives a regulator reading the underlying papers.

---

## Indirect cost rate — the other verified finding

**Budget indirect at 15%, labeled "Indirect costs (de minimis rate, 2 CFR 200.414(f))" — not "Administration."**

- **Verified:** 2 CFR 200.414(f) permits a de minimis rate of **up to 15% of modified total direct costs**, raised from 10% by OMB's 2024 Uniform Guidance revisions (89 FR 30136, Apr. 22, 2024), effective for new federal awards on or after **October 1, 2024**. No documentation or justification required. The regulation also bars federal agencies and pass-through entities from **requiring a lower rate**.
- Scope note: this binds federal awards, not bank foundations. Its value is as the strongest available third-party benchmark — a government-set floor established by regulation after notice and comment.
- **Sector context:** BBB Wise Giving Alliance Standard 8 requires ≥65% of total expenses on programs (so up to 35% admin + fundraising is compliant), and BBB explicitly names *"the higher costs of a newly created organization"* as a valid justification. Bridgespan's *Pay-What-It-Takes* found real indirect costs for **direct-service nonprofits median 25%** (range 21–89% across all types), and named the common 15% funder cap as the driver of the starvation cycle. Ford now funds ≥25%; MacArthur pays 29%. The Urban Institute/Indiana Nonprofit Overhead Cost Study found **37% of nonprofits with ≥$50K in contributions reported zero fundraising costs** — i.e. the low sector "norms" are partly an artifact of underreporting.
- **Why 10% was wrong for us:** at a $25,000 grant, 10% is $2,500 — which does not cover D&O and cyber insurance plus three state charitable registrations, before any bookkeeping, legal, banking fees, or the ~$5K CPA review. It also signals to a first-year funder either that the work hasn't been costed or that the gap will be absorbed — the second reads as going-concern risk.
- **One-sentence justification for the budget narrative:** *"Indirect costs are budgeted at 15% of modified total direct costs — the federal de minimis rate at 2 CFR 200.414(f), effective October 1, 2024 — which is below the 25% median indirect rate Bridgespan documents for direct-service nonprofits and well within BBB Wise Giving Alliance Standard 8."*
- **15% is a floor, not a stretch.** Where a funder permits more, 20–25% is defensible on the Bridgespan median and the Ford floor.

Sources: eCFR 2 CFR 200.414 · 89 FR 30136 · give.org BBB Standards · Bridgespan Pay-What-It-Takes · MacArthur indirect cost policy · Ford Foundation indirect commitment · Urban Institute Nonprofit Overhead Cost Study · Federal Reserve FEDS 2022-030 · NBER WP 31239 / WP 27311 · Urban Institute financial coaching RCT · NBER w26110 / RFS 2023.
