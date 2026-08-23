# CRA qualification — primary-source verification before first contact

**Verified:** 2026-08-22, against agency primary sources rather than secondary commentary.
**Question asked:** if a bank pays for this, does it qualify for CRA consideration — with no confusion, no
barrier over SNAP as the eligibility source, and the documentation actually provided?
**Short answer:** yes, and the strongest possible evidence exists — **the interagency examiner guidance
names the Supplemental Nutrition Assistance program by name** as a qualifying LMI proxy. But qualification
is conditional on five things all holding, and one of them is ours to break.

---

## 1. The sentence that settles the LMI question

From the FDIC *Consumer Compliance Examination Manual*, reproducing **Interagency Q&A § \_\_.12(g)(2)—1**,
which answers how an institution determines that community services are targeted to LMI individuals:

> "The community service is provided to recipients of government assistance programs that have income
> qualifications equivalent to, or stricter than, the definitions of low- and moderate-income as defined by
> the CRA Regulations. Examples include U.S. Department of Housing and Urban Development's section 8, 202,
> 515, and 811 programs or U.S. Department of Agriculture's section 514, 516, and **Supplemental Nutrition
> Assistance programs**."

Source: [FDIC Consumer Compliance Examination Manual XI-12](https://www.fdic.gov/consumer-compliance-examination-manual/xi-12-interagency-questions-and-answers-regarding-community).
The Q&A is **interagency** — FDIC, OCC, and Federal Reserve — so it governs regardless of which agency
examines a given bank.

**Why this closes the "barrier on SNAP as source" worry.** The agencies did not merely permit a general
category of government-assistance proxies and leave banks to argue SNAP into it. They named the program as
an example. A bank's CRA officer does not have to make a judgment call about whether SNAP's income test is
strict enough relative to area median income — **the agencies already made it**, in writing, in the manual
their examiners use.

Practical effect: the household-level income documentation problem disappears. Serving SNAP applicants *is*
serving LMI individuals for CRA purposes. That is a stronger position than most community development
grantees can claim, and it is why the deliverable's examination-criteria page says every household served
is income-qualified by construction rather than inferred from geography.

**One residual nuance, disclosed for completeness.** Several states, California included, use Broad-Based
Categorical Eligibility to raise the gross-income screen above the federal 130% of the Federal Poverty Level.
The Q&A names the program without qualifying it by state threshold, so a bank may rely on the example as
written. Do not raise this unprompted; if a well-prepared officer raises it, the honest answer is that the
agencies named the program rather than a threshold, and that we can report the income distribution of
households served if their file would benefit from it.

---

## 2. The five conditions — all must hold

| # | Condition | Authority | How this program satisfies it | What would break it |
|---|---|---|---|---|
| 1 | **Primary purpose is community development** | § \_\_.12(h); Q&A § \_\_.12(h)—8 | The program does one thing: help income-eligible households complete benefit applications. There is no commercial line of business attached | Bundling anything commercial into the grant |
| 2 | **Community services targeted to LMI individuals** | § \_\_.12(g)(2); Q&A § \_\_.12(g)(2)—1 | Settled by the quote above | Serving a materially non-LMI population without disclosing it |
| 3 | **Geographic nexus to the assessment area** | § \_\_.12(h); Q&A § \_\_.12(h)—6, —7 | Outreach is bought against the bank's own AA counties as delineated in its Performance Evaluation, and reported by county | Spending outside the AA without stating it; misreading the AA from the PE |
| 4 | **The vehicle is a qualified investment** | § \_\_.12(t); Q&A § \_\_.12(t)—5 | A grant with a CD primary purpose is a qualified investment. For an ISB it is weighed under the community development test | Nothing structural — this one is clean |
| 5 | **The bank can document it at examination** | 12 CFR \_\_.43 | The quarterly report plus the signed one-page qualification memorandum | Us delivering neither, or delivering numbers we can't source |

**Condition 3 is the one we can break by carelessness**, which is why `--send` refuses to produce a document
for any bank still flagged `verified:false`. Every assessment area must be re-read from the bank's actual
Performance Evaluation before its packet goes out.

**A precision point worth getting right in conversation.** Secondary commentary — including the
uncommongiving.com post — describes SNAP enrollment help as qualifying "as a community development service."
That is the right *category* of community development but the wrong *vehicle* for a cash grant. A bank
writing a check is making a **qualified investment** (§ \_\_.12(t) covers a "grant"). A **community
development service** is a service the bank itself provides that is related to the provision of financial
services — bank staff volunteering at an enrollment event, for instance. Both can be true at once, and
offering the second is a genuinely useful ask: it costs the bank no additional money and gives it a second
kind of credit. Use the right word for each. An officer will notice.

---

## 3. What no regulator will do — and what to do instead

**No agency will pre-certify this program.** There is no process under the 1995 framework by which the FDIC,
OCC, or Federal Reserve issues a binding advance ruling that a third party's activity qualifies for a
particular bank. Anyone who promises otherwise is selling something.

**How qualification actually gets decided:** the bank's CRA officer determines that an activity qualifies and
documents why. The examiner reviews that determination at examination. **The decision is the bank's, and our
job is to make it easy and well-evidenced** — which is exactly what the qualification memorandum is for.

So the realistic ceiling on certainty before first contact is:

1. ✅ **The interagency guidance names the program.** Obtained — §1 above.
2. ✅ **The five conditions are identified and each is satisfiable.** Obtained — §2 above.
3. ⬜ **A regional Community Affairs conversation**, which is informal, non-binding, and still worth having.
4. ⬜ **The first bank's own CRA officer concurs** — the only determination that actually binds anything.

That is as close to 100% as this framework permits, and it is high. The remaining risk is not "does SNAP
enrollment qualify" — it is "did we scope this bank's assessment area correctly."

### The official contacts

FDIC Community Affairs provides information and technical assistance on community development and convenes
banks with community-based organizations. Regional offices
([full list](https://www.fdic.gov/consumer-resource-center/community-affairs-program-and-contacts)):

| Region | Covers | Manager | Contact |
|---|---|---|---|
| **San Francisco** | **California**, AZ, NV, OR, WA, AK, HI, ID, MT, UT, WY, Guam | Luke W. Reynolds | sfcommunityaffairs@fdic.gov · (415) 546-0160 |
| **Atlanta** | **Florida**, AL, GA, NC, SC, VA, WV | Lekeshia Frasure | atlcommunityaffairs@fdic.gov · (678) 916-2200 |

Also relevant depending on the bank's regulator: OCC District Community Affairs Officers, and the Community
Development department of the relevant Federal Reserve Bank (FRBSF for California).

### What to ask them — and what not to

Ask for a short call. Frame it as a nonprofit seeking to structure a program correctly, not as someone
seeking a ruling. Useful questions:

- We are structuring a SNAP enrollment-assistance program funded by bank grants, scoped to each bank's
  assessment area. Are we reading Q&A § \_\_.12(g)(2)—1 correctly that SNAP recipients serve as the LMI proxy?
- What documentation do examiners in this region find most useful from a grantee, as opposed to what banks
  typically assemble themselves?
- Are there community development needs in this region that examiners are hearing about and not seeing
  addressed? *(This is the highest-value question — it is performance-context intelligence, and it is what
  Community Affairs staff actually convene around.)*
- Would you be willing to point us toward banks in the region looking for community development activity?

**Do not** ask them to approve the program, confirm a specific bank's rating impact, or say whether a
particular grant will count. They cannot, and asking marks you as someone who does not understand the
framework.

---

## 4. Meta's Special Ad Category — the finding that affects the product

**This is the one place where the research changed something operational.**

Since **January 21, 2025**, Meta requires U.S. advertisers promoting financial products and services to
self-identify under the **Financial Products and Services Special Ad Category**, which replaced the narrower
"Credit" category. Ads in the category lose targeting precision:

- **ZIP-code targeting is eliminated; location targeting has a ~15-mile minimum radius**
- Age locked to 18–65+, no gender refinement
- Lookalike audiences and detailed-targeting expansion unavailable

**Assessment-area targeting is the entire product promise.** A 15-mile minimum radius does not respect county
lines, so for any bank whose assessment area is a subset of a metro — Bank Irvine in Orange County, say —
category placement would put spend outside the AA we are contractually reporting on. That is not a
presentational problem; it breaks condition 3 above.

**Is SNAP enrollment assistance in the category?** Meta's own policy page for financial products and services
does **not** mention government benefits, public assistance, SNAP, or benefits enrollment — it addresses
credit cards, loans, and insurance. So on the written policy, a "see if you qualify for food benefits" ad is
not a financial-services ad.

**But our own framing is the risk.** The credit-score research is what makes the bank pitch strong. If that
framing migrates into consumer ad creative — "protect your credit score," "build credit" — we invite Meta's
classifier to place us in the financial category, and we would have destroyed our own geographic precision to
borrow a talking point that belongs in a different document.

### The rule this produces

> **Credit framing is for bank-facing materials only. Consumer ad creative speaks about food benefits and
> nothing else.**

This is not a compromise. It is also the more honest split: the credit finding is a population-level research
result about administrative burden, and a consumer-facing promise about someone's credit score would be a
claim we have no basis to make to that individual. The firewall that protects our targeting is the same one
that keeps the consumer claim truthful.

**Before spending a dollar on Meta:** submit representative creative and confirm category placement in
writing through Meta support. Do not infer it. Google Ads' restricted categories cover housing, employment,
and credit — benefits enrollment is not obviously any of the three — but confirm there too rather than
assuming, and structure the media plan so that **Google can carry the geographically precise share** if Meta
placement turns out to be restrictive.

---

## 5. Bottom line before first contact

**Qualification is not the open risk.** The interagency guidance names the program; the five conditions are
identified and satisfiable; the documentation the bank needs is already built.

**The open risks are execution:** assessment areas still flagged `verified:false`, charitable-solicitation
registration not yet filed in either target state, and Meta category placement unconfirmed.

Related: [cra-officer-call-guide.md](cra-officer-call-guide.md) ·
[cra-examiner-requirements-and-vendors-2026-08-22.md](cra-examiner-requirements-and-vendors-2026-08-22.md) ·
[cra-wp34434-estimates.md](cra-wp34434-estimates.md)
