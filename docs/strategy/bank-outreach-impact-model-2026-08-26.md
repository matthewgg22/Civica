# Demeter AI — Bank Conversation Cheat Sheet: The Causal Chain

**Entity:** Civica Torrey Inc (501(c)(3))
**Prepared:** 2026-08-26 · **Audience:** CRA officers, community development / foundation staff at target banks
**Status:** **EXPECTATION-SETTING MODEL, NOT RESULTS.** Every conversion rate in Stages 1–3 is a *prior*, not a measurement. This document exists to show a banker **how we will know whether it worked** — the methodology is the product being sold in the first meeting, not the numbers.

---

## 0. How to open (say this almost verbatim)

> "I'm not going to show you impact numbers, because we don't have them yet — this is a pilot, and anyone showing you a polished impact deck before a pilot is showing you a model, not a result. What I *can* show you is the measurement chain end to end: what we spend to reach someone, what they do, whether they got on the program 90 days later, how many dollars a month that puts in their pocket, and what that does to their balance sheet — which is the part your examiner and your risk team both care about. Each link has a number attached. Some are measured from federal data, some are published ad benchmarks, and some are honest guesses. They're labeled, and the guesses are the ones I want you to push on."

Then hand them Section 2 (the chain) and let them pick a link to attack. **The labeling is the credibility.** A banker who has sat through six nonprofit pitches has never seen someone pre-flag their own weak assumptions.

---

## 1. Provenance key — use these tags out loud

| Tag | Meaning | If they push |
|---|---|---|
| **[M] Measured** | Our own computation from primary federal/state data, reproducible from our repo | Offer the source + the script. These are defensible line by line. |
| **[B] Benchmark** | Externally published, cited, third-party | Concede it's an industry average, not us. Our variance could be ±50%. |
| **[A] Assumed** | A prior. Unvalidated. **This is what the pilot buys.** | Agree it's a guess. Ask what number *they'd* use. This is the collaborative moment. |

**The single most important sentence in the meeting:** *"Stages 1 and 4 are mostly measured. Stages 2 and 3 are mostly assumed. The pilot's whole job is converting Stage 2 and 3 from [A] to [M]."*

---

## 2. The causal chain

### Stage 1 — Acquisition: click rate and cost per click

What it costs to put one person who is asking about food assistance in front of the product.

| Channel | CTR | CPC | Tag | Notes for the room |
|---|---|---|---|---|
| **Google Search — paid** | 4.85% (nonprofit vertical) vs ~3.2% cross-industry | **$2.49** charity/nonprofit; $2.96–$4.34 all-industry search | [B] | Highest intent. Someone typing "do I qualify for food stamps" is the best traffic that exists. Nonprofit is one of the two *cheapest* verticals on Google. |
| **Google Ad Grants** | must hold **≥5% CTR** or Google suspends | **$0** — $10K/mo in-kind, up to $120K/yr | [B] | **Lead with this.** We are a 501(c)(3), so a large share of search reach costs the bank nothing. $2 manual CPC cap (liftable via Smart Bidding). Realistic accounts spend 10–30% of cap, so model it at ~$2–3K/mo realized, not $10K. |
| **Meta (FB/IG)** | ~1.4% avg; 2.59% lead-gen | **$1.72** all-industry 2026 (up from $1.55); **$0.70** traffic objective; IG Feed $3.35 | [B] | Cheap reach, lower intent. Best for geo-fencing a bank's actual CRA assessment area — that targeting precision is a selling point. |
| **ChatGPT Ads** | not yet published | **$3–5** entry CPC; CPM ~$25–60 | [B] | Live since Feb 2026, self-serve since May 2026, **spend minimum removed**. Highest intent of the three — the user is *already asking an assistant* about benefits, which is literally our product's shape. Also the least proven; treat as a 15–20% experimental slice, not the core buy. |

**The Stage 1 talking point:** blended cost per click lands near **$1.00–$1.60**, and the Ad Grant means a meaningful share of the search volume is free. Cost to *reach* is not the risk in this model — everything interesting happens after the click.

---

### Stage 2 — Participation: do queries predict submission?

**This is the weakest-measured and most important link, and you should say so.**

The hypothesis: **query depth is the leading indicator of submission.** A visitor who asks one question is browsing. A visitor who asks four or more is working a real problem — household composition, income timing, what counts as a resource — and that person submits at a multiple of the one-question rate.

| Step | Rate | Tag |
|---|---|---|
| Click → session start (asks ≥1 question) | 55% | [A] |
| Session → **engaged** (≥3 substantive queries) | 40% | [A] |
| Engaged → completes eligibility screen | 45% | [A] |
| Screened → screens **likely eligible** | 60% | [A] · sanity-checked against [M] non-enrollment rates (TX 65.4%) |
| Eligible → starts a real application | 55% | [A] |
| Started → **submitted** | 65% | [A] |

**The pre-registered claim to test:** sessions with **≥3 substantive queries submit at 4–6× the rate of 1-query sessions.** [A]

**Say this:** *"If that multiple turns out to be 1.2× instead of 5×, the product thesis is wrong and you should know that within a quarter. I'd rather find out on a $25K pilot than on a $500K program."*

**⚠️ Instrumentation gap — disclose it, don't paper over it.** The query log we run today records the question, the citations, the state scope, and the model — but **no session identifier and no outcome event**. As built, we can count queries and we can count submissions; we *cannot yet join them.* Measuring this correlation requires adding (a) a session-grain key and (b) a submission/outcome event. That is a scoped engineering task in the pilot, not a research problem, and it is the first thing the money pays for.

That admission is worth more in the room than any conversion rate on this page.

---

### Stage 3 — The 90-day review: did they get on, and were they eligible?

Two distinct questions. Keep them separate — bankers conflate them and the conflation is where impact claims go to die.

**(a) Did they enroll?** The hard part is *observation*. We do not have administrative access to state caseload systems. Three-source approach:

1. **Consented follow-up at 90 days** — SMS/email to users who opted in. Expect 25–40% response [A]. Self-reported, honest about it.
2. **Consented outcome sharing** — a subset who authorize us to confirm status. Small n, high quality.
3. **Aggregate administrative check** — county-level SNAP enrollment vs. our county-level exposure. Never proves an individual case; catches an implausible aggregate claim.

**(b) Were they eligible, and did the system treat them correctly?** This is where our measured federal data is strongest, and it is the part that makes the case that assistance changes outcomes rather than just shuffling them:

- **~2 in 3 California SNAP application denials are procedural, not ineligibility** (66.1–71.3%, CDSS CF-296) — independently cross-validated at ~60% by an unrelated county panel (ICPSR 39331). [M]
- **~1 in 4 CA applications (23.9%) is procedurally denied** — paperwork, not eligibility. [M]
- **~5.2% of recertifications and ~8.5% of semi-annual reports end in benefit loss for a household that was still eligible** (CDSS CF-18, FY2024-25; ~330K household-events). [M]
- Burden-reducing policy causally **raises** participation: simplified reporting **+8.9%**, broad-based categorical eligibility **+7.6%**, call centers **+6.3%**; **+17% by year 3+** on an event study with flat pre-trends (51 states × 1996–2020, 15,300 state-months, TWFE, cluster-robust). [M]

**Why that last bullet is the most valuable thing you own:** it is external, public-data proof of the mechanism — *lower friction produces more enrollment* — established **before** Demeter has a single production user. It means the bank is not betting on whether the mechanism works. It is betting on whether *we execute it.* That is a much smaller bet, and saying so out loud is disarming.

**Modeled approval:** 65% of submissions approved [A]; **counterfactual haircut of 50%** — i.e., assume half would have enrolled anyway without us. [A]

**Volunteer the haircut before they ask for it.** Nothing kills a nonprofit impact claim faster than a banker having to be the one to point out that some of those people would have signed up regardless.

---

### Stage 4 — Downstream: dollars per household per month

Our firmest ground. Computed directly from USDA FNS state monthly tables, not quoted from a secondary source:

- **$324 per household per month** — California, FY2025 (3.23M households, $12.58B annual issuance). [M]
- **$191 per person per month** — cross-checks against the ~$188 national figure. [M]
- **~$3,889 per household per year.** [M]
- **1.54× local economic multiplier** — $1B in SNAP → $1.54B GDP + 13,560 jobs (USDA ERS ERR-265, Canning & Stacy 2019). [B] *Caveat honestly: estimated for a slowing economy; treat as an upper bound.*

State variance is real — use the state's own figure when pitching a specific bank, not California's.

---

### Stage 5 — Tertiary: credit and financial capability

**Both directions of the causal arrow are now identified — lead with the enrollment side, it is the study built on our exact mechanism.**

**The NYU study (Homonoff, Lee & Meckel — NYU Wagner/UCSD, NBER w34434, Oct 2025):** two California experiments linking administrative SNAP records to the UC Consumer Credit Panel. In **Los Angeles** (RCT, ~65K applicants), giving applicants scheduling flexibility on the mandatory interview — a pure burden-reduction treatment, no eligibility change — raised approval **+6.2pp**; marginally-approved households then cut credit-card balances by **$236 / $1,394 / $2,436** across years 1–3 (**−50% vs control** by year 3), cut the delinquent-account share **5–10pp** (−¼), and cut severe delinquencies **up to 13pp** (−⅔). In **San Francisco** (quasi-random recertification-interview dates), the marginal **disenrollee** added **+$500 card debt (+26%)** and **lost 15 credit-score points within a year**, with delinquent accounts **+0.41 (+87%)** by year 3. Marginal LA enrollees averaged **$375/month** in benefits — above our $324 caseload-average anchor, so the Stage-4 model is conservative. Bonus mechanism stat: **missed interviews account for up to half of all SNAP denials** — the exact friction an assisted application removes.

**The Fed corroboration:**

Dodini, Larrimore & Tranfaglia (*Journal of Public Economics*, 2023; Fed FEDS 2022-030) used nationally representative credit records with a county-level difference-in-differences design and found that when SNAP work requirements took effect and people **lost** benefits, they responded by:

- opening **more** new credit accounts,
- carrying **higher** outstanding balances on bank and retail cards,
- going **past due more often** on cards and consumer finance accounts. [B]

Together: the **debt and delinquency improvements on the enrollment side are experimentally identified** (LA RCT); the per-person **credit-score point figure** (+15 yr 1, ~+33 by yr 3) is the loss-side estimate run in reverse — keep that one labeled as a proxy.

**The move that wins this section:** don't ask the bank to accept our measurement. Offer a **matched-cohort study on the bank's own portfolio.** They hold the data, they control the analysis, and the result is examiner-ready in a way nothing we produce could be:

| Metric | Direction | Why a bank cares |
|---|---|---|
| 30/60/90-day delinquency | ↓ | Direct credit-loss line |
| Revolving utilization | ↓ | Score input + loss predictor |
| New subprime / consumer-finance openings | ↓ | The Dodini substitution effect, in reverse |
| Overdraft & NSF frequency | ↓ | $324/mo of cushion against a ~$35 fee event |
| Deposit balance stability | ↑ | Funding quality |

**Quantified proxy for the scenario:** per enrolled adult, **+15 credit-score points in year 1** (SF marginal-disenrollee estimate, sign-reversed) growing toward **~+33 by year 3** (Fed/Equifax ITT −1.651 ÷ ~5% treated share, their footnote-28 method; 613 baseline → ~646, across the 620/640 thresholds lenders price on). Cohort totals at ~1 credit file/household: **+5,000 → +11,000 points gross / +2,500 → +5,500 incremental**; card debt avoided by year 3: **$811K gross / $407K incremental** (333 and 167 HH × $2,436, the LA RCT treatment-on-treated figure). Attribution: cite as **NYU Wagner/UCSD (NBER w34434)** for the experiments and the **Federal Reserve Board (*J. Public Econ.* 2023)** for the national panel.

For a household at ~$1,800/month, $324 is roughly an **18% increase in disposable resources** [A, illustrative]. That is the mechanism connecting Stage 4 to Stage 5, and it is intuitive to anyone who has looked at a thin-file balance sheet.

---

## 3. Worked example — one review, $25,000, end to end

Present this as **one scenario**, never as a forecast. Reproducible arithmetic; all stage rates are [A].

**Media plan (6 months)**

| Channel | Spend | CPC | Clicks |
|---|---|---|---|
| Google Search (paid) | $12,000 | $2.00 | 6,000 |
| Meta (traffic objective) | $8,000 | $0.90 | 8,888 |
| ChatGPT Ads | $5,000 | $4.00 | 1,250 |
| **Google Ad Grant (in-kind)** | **$0** | $1.50 notional | **8,000** |
| **Total** | **$25,000** | — | **24,138** |

Cost per **paid** click **$1.55** · blended including grant **$1.04**.

**Funnel**

| Stage | × | Remaining | Cost / unit |
|---|---|---|---:|
| Clicks | — | 24,138 | $1.04 |
| Session start (≥1 query) | 0.55 | 13,276 | $1.88 |
| Engaged (≥3 queries) | 0.40 | 5,310 | $4.71 |
| Completes eligibility screen | 0.45 | 2,390 | $10.46 |
| Screens likely eligible | 0.60 | 1,434 | $17.44 |
| Starts application | 0.55 | 789 | $31.70 |
| **Submitted** | 0.65 | **513** | **$48.77** |
| **Approved** (65%) | | **333 households** | **$75** |
| **Incremental** (50% haircut) | | **167 households** | **$150** |

**Unit economics per enrolled household**

| Metric | Gross | Incremental |
|---|---:|---:|
| Cost of acquisition (CAC) | $75 | $150 |
| Benefits obtained / year 1 | $3,889 | $3,889 |
| Benefits obtained per $1 of CAC | $52 | $26 |
| Grant cost per $1 of benefits delivered | 1.9¢ | 3.9¢ |
| CAC recovered in benefit-days | 7 days | 14 days |

**Outcome**

| | Gross | Incremental |
|---|---|---|
| Households enrolled | 333 | 167 |
| Benefits delivered / month | $107,950 | $53,975 |
| **Benefits delivered / year** | **$1,295,398** | **$647,699** |
| Cost per household | $75 | $150 |
| **Leverage on the bank's $25K** | **51.8 : 1** | **25.9 : 1** |
| Local economic activity (×1.54) | $1,994,914 | $997,457 |
| Credit-score proxy, per enrolled adult | +15 pts yr 1 → ~+33 by yr 3 | +15 → ~+33 |
| Credit-score proxy, cohort total | +5,000 → +11,000 pts | +2,500 → +5,500 pts |
| Card debt avoided by yr 3 (−50% per HH, LA RCT) | $811K | $407K |
| **Stress test — every conversion rate cut in half** | ~85 HH · $331K/yr · 13:1 | ~43 HH · $167K/yr · 7:1 |

**Lead with the incremental column: ~26:1.** Let them find the gross number themselves and be pleasantly surprised. Leading with 52:1 makes you sound like every other pitch; leading with the conservative number and having a defensible one behind it makes you sound like a analyst.

---

## 4. Objection handling

| They say | You say |
|---|---|
| "These numbers are made up." | "Stages 1, 4 and the policy evidence in 3 are measured or published — I'll send the sources. Stages 2 and 3 conversion rates are assumed, and I've labeled every one. The pilot's purpose is to replace them." |
| "How do you know they actually enrolled?" | "At 90 days, three ways: consented follow-up, a consented outcome-sharing subset, and an aggregate county-level check. The first is self-reported and I'm not going to pretend otherwise. That's why the pilot includes building the outcome join, not just the ad spend." |
| "Wouldn't they have enrolled anyway?" | "Some absolutely would. I've already cut the number in half for that. If you want a cleaner read, we run a geographic holdout — comparable counties, no media — and the difference is the real answer." |
| "Why not just fund a food bank?" | "You should also fund the food bank. This is different math: $25K here moves roughly $650K of *federal* money into your assessment area every year, and it recurs, because enrollment persists. A food bank grant is spent once." |
| "What's your CRA-creditable activity?" | "Community development services and qualified investment in your assessment area, delivered as documented enrollment assistance to LMI households — with county-level counts you can put in an exam file." |
| "What if it doesn't work?" | "Then you'll know in one quarter, from a number I gave you in advance. The failure signal is pre-registered: if engaged sessions don't submit at several times the rate of one-question sessions, the thesis is wrong." |
| "Isn't card debt how banks make money?" | "Not this debt. It's 610-score distress borrowing at 25–30% APR, and the studies show it goes delinquent — +87% delinquent accounts for the SF disenrollees. That's charge-off risk, and it sits overwhelmingly on national monoline issuers' books, not a community bank's. What you gain is deposit stability and customers crossing 620/640 into products you actually underwrite — auto, secured cards, eventually mortgages." |
| "Do you have results from another bank?" | "No. You'd be first, and I'd rather say that than dress up a pilot as a track record. What I do have is the federal-data groundwork — I'll show you the causal estimate that lower friction raises participation, on 15,300 state-months of public data." |

---

## 5. Instrumentation: today vs. pilot

| Stage | Today | Pilot adds |
|---|---|---|
| 1 — Acquisition | ❌ No analytics wired on the web surface | UTM capture, per-channel attribution, Ad Grant account |
| 2 — Participation | ⚠️ Query log exists (question, citations, state scope, model) — **no session key, no outcome event** | Session identifier + submission event + the join |
| 3 — 90-day outcome | ❌ Nothing | Consent flow, 90-day follow-up, aggregate county check |
| 4 — Dollars | ✅ [M] Modeled from state benefit data + our rules engine | Per-household actuals from confirmed enrollments |
| 5 — Credit / financial | ❌ Out of our reach by design | Matched-cohort study run by the bank on its own portfolio |

**Two ❌ and one ⚠️ in the first three rows.** Show this table. A funder who sees you name your own gaps trusts the rows you mark ✅.

---

## 6. Do not say

- ❌ **"60% less"** anything — retired as fabricated. Never appears in any funder material.
- ❌ Any claim of a **live, measured error-rate reduction** — no production traffic exists yet.
- ❌ **"tract-level"** for our SNAP-gap data. It is **PUMA-level**. Say "footprint" or "county."
- ❌ The predecessor entity name. The entity is **Civica Torrey Inc**, always.
- ❌ Quoting the credit-score point gain as experimentally proven. The **debt and delinquency** gains are experimental (LA RCT); the **+15/+33 point** figures are loss-side estimates run in reverse — label them proxies.
- ❌ Any per-household dollar figure without naming the state and fiscal year.

---

## 7. Sources

**Ad benchmarks (2026):** [WordStream Google Ads Benchmarks 2026](https://www.wordstream.com/blog/2026-google-ads-benchmarks) · [DigitalApplied — Google CPC/CTR/CVR by industry](https://www.digitalapplied.com/blog/google-ads-benchmarks-2026-cpc-ctr-cvr-industry) · [DigitalApplied — Facebook Ads benchmarks](https://www.digitalapplied.com/blog/facebook-ads-benchmarks-2026-cpc-cpm-ctr-industry) · [Get-Ryze Meta benchmarks](https://www.get-ryze.ai/blog/meta-ads-cost-benchmarks-by-industry-2026) · [Google Ad Grants guide (Big Sea)](https://bigsea.co/articles/get-google-ad-grants-nonprofit/) · [ChatGPT Ads 2026 guide (Segwise)](https://segwise.ai/blog/chatgpt-ads-2026-guide) · [ChatGPT ad rollout (Monks)](https://www.monks.com/articles/answer-engine-battles-navigating-chatgpt-ad-rollout)

**Program & economic:** [Homonoff, Lee & Meckel — The Financial Consequences of Being Denied Benefit Access (NBER w34434)](https://www.nber.org/papers/w34434) · [NYU press summary](https://www.nyu.edu/about/news-publications/news/2025/december/easing-snap-application-process-led-to-drop-in-credit-card-delin.html) · [USDA ERS ERR-265 — SNAP multiplier](https://www.ers.usda.gov/publications/pub-details?pubid=93528) · [Dodini, Larrimore & Tranfaglia — Financial Repercussions of SNAP Work Requirements (Fed FEDS 2022-030)](https://www.federalreserve.gov/econres/feds/financial-repercussions-of-snap-work-requirements.htm) · [Brookings — Beyond hunger: SNAP and financial strain](https://www.brookings.edu/articles/beyond-hunger-the-role-of-snap-in-alleviating-financial-strain-for-low-income-households/)

**Internal [M] findings:** `2026-05-29-cdss-cf296-denials` · `2026-05-29-cdss-cf18-churn` · `2026-05-30-regression-burden-participation` · `2026-05-31-ca-procedural-denial-panel` · `2026-05-30-data-fns-state-monthly` · `2026-06-01-ma-pilot-snap-gap` · `data-ops/sample/tx-snap-gap/`

**Companion docs:** `docs/strategy/cra-targets-national-2026-08-22.md` (which banks, and why they buy)
