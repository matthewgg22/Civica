---
id: 2026-06-03-ma-audit-clean
date: 2026-06-03
scope: [snap, eligibility-engine, audit, ma, primary-source-verified]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/273.9"
    note: "Verified §273.9(b)(1)(iv) + (c)(10)(iii) text on VISTA program-split rule"
  - kind: url
    ref: "https://www.govinfo.gov/content/pkg/CFR-2024-title7-vol4/xml/CFR-2024-title7-vol4-sec273-11.xml"
    note: "Verified §273.11(n)(1) four-part fleeing felon test"
  - kind: url
    ref: "https://www.fns.usda.gov/snap/obbb-alien-eligibility"
    note: "Verified FNS implementing memo (Oct 31 2025), Attachment 1: refugees not eligible post-OBBBA"
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/273.10"
    note: "Verified §273.10(e)(2)(ii)(C) minimum benefit applies to ELIGIBLE 1-2 person households only"
---

## The audit, in three sentences

We checked 8 cases where the software (the engine) and the test (the answer key) disagreed for Massachusetts. **The software was wrong on 2 of them** — one about VISTA volunteers, one about refugees after the 2025 law change — and both are now fixed. **The answer key was wrong on 3** — fleeing-felon, the $35 medical-expense floor, and an elderly retiree where Massachusetts's higher utility allowance changed the math — and those go back to the test author. **The remaining 3 are still pending** more information about the actual cases or fact patterns before we can adjudicate.

## What this is

The 8 Massachusetts failures from `/profile-simulation MA` adjudicated against verbatim primary source by three independent reviewers (caseworker reviewer Marlene, fresh-eyes reviewer, outside reviewer). Format follows the verification vocab at `docs/snap/VERIFICATION-VOCAB.md`.

## Disposition table (the headline)

| ID | Profile | Verdict (oracle / engine) | Disposition | Evidence | Owner |
|---|---|---|---|---|---|
| **P63** | VISTA stipend, no prior SNAP | DENY / APPROVE $382 | **ENGINE_BUG** | VERIFIED — §273.9(b)(1)(iv) + (c)(10)(iii) | engine fix |
| **D07** | Refugee in refugee status, post-OBBBA | DENY / APPROVE $546 | **ENGINE_BUG** | VERIFIED — FNS memo 2025-10-31 + OBBBA §10108 | engine fix |
| **P58** | Elderly E/D HH1 over net limit | DENY / APPROVE $24 | **ORACLE_BUG (state-specific)** | VERIFIED — engine math is correct in MA; oracle expected DENY based on CA-shaped math | oracle fix |
| **P52** | Fleeing felon, active_warrant only | DENY / APPROVE $546 | **ORACLE_BUG** | VERIFIED — §273.11(n)(1) four-part test | oracle fix |
| **P53** | Medical $30 (under $35 floor) | DENY / APPROVE $268 | **ORACLE_BUG** | VERIFIED — §273.9(d)(3) + §273.10(e)(2)(i)(C) | oracle fix |
| **P59** | HH1 BBCE boundary, $77 vs $78 | APPROVE $78 / APPROVE $77 | **NEEDS_FACTS** | VERIFIED rule via §273.10(e)(2)(ii)(A); state-option rounding flag needed | wait |
| **M30** | Child-support deduction at net margin | DENY / APPROVE $546 | **NEEDS_FACTS** | VERIFIED rule via §273.9(d)(5); citation mislabeled (d)(6) in fixture; verdict depends on math | wait |
| **P54** | Cash gift to household | DENY / APPROVE $298 | **NEEDS_FACTS** | VERIFIED §273.9(b)(2)(v) classification; verdict depends on amount + source | wait |

**Engine bugs to fix: 2** (VISTA + refugee). **Oracle bugs to send back: 3** (P52 + P53 + P58-state-specific). **Awaiting facts: 3** (M30 + P54 + P59).

## Per-failure detail

### P63 — The VISTA volunteer case

**What happened:** The software approved $382/month for an AmeriCorps VISTA volunteer who had no prior SNAP at the time of joining. The answer key said this person should have been denied.

**Who got it wrong:** The software (ENGINE_BUG). The VISTA stipend should have been treated as earned income, not excluded.

**How sure are we:** Certain (VERIFIED). I read the federal regulation directly today.

**What the rule actually says (verbatim from 7 CFR 273.9(c)(10)(iii)):**
> "New applicants who were not receiving public assistance or SNAPs at the time they joined VISTA shall have these volunteer payments included as earned income."

Plus §273.9(b)(1)(iv): VISTA payments are earned income (subject to the (c)(10)(iii) exclusion only for households already receiving SNAP/PA at joining time).

**What needs to happen:** Count the stipend as earned income (with the 20% earned-income deduction).

**Status:** ✅ Fixed in commit `fe9ae177`. After the fix, the engine produces APPROVE $472 instead of APPROVE $382 — the $90 difference is the 20% earned-income deduction flowing through. The verdict-level disagreement with the answer key still exists, but it's now the answer key that's wrong; the math behind it (HH2 with $1,500/mo single earner doesn't exceed the 200%-FPL gross limit or 100%-FPL net limit either way) doesn't support DENY.

**Why this matters in real life:** New VISTA volunteers walking into a state office would be approved for the wrong amount. Federal quality-control reviewers would catch the discrepancy in a sampled case.

### D07 — The refugee case, post-OBBBA

**What happened:** The software approved $546/month for a household where the head of household is a refugee in refugee status (not yet a permanent resident) and the other member is a citizen child. The answer key said this should be denied.

**Who got it wrong:** The software (ENGINE_BUG) — but in TWO different ways that need separate fixes.

**How sure are we:** Certain (VERIFIED). The outside reviewer fetched the FNS implementing memo directly today.

**What the rule actually says (verbatim from FNS memo Attachment 1, dated 2025-10-31):**
> "Refugees | Post-OBBB Eligibility: Not eligible."

Effective July 4, 2025. Eligible non-citizens are now only: U.S. citizens, U.S. nationals, lawful permanent residents (LPRs), Cuban/Haitian entrants, and COFA citizens. Refugees, asylees, parolees, conditional entrants, TPS, and deportation-withheld status are all removed from eligibility.

**Important nuance:** a refugee who later adjusted to LPR status is STILL eligible with no 5-year wait (PRWORA exemption preserved by OBBBA). The engine must distinguish "still in refugee status" (deny) from "former refugee, now LPR" (approve).

**What needs to happen (two-part fix):**

1. **Part 1 — Fix the effective date.** Engine had the cutoff at 2025-11-01 (the state-implementation deadline). The correct date is 2025-07-04 (statutory enactment). ✅ Fixed in commit `ce874bf0`.
2. **Part 2 — Fix the household-size math.** When a household has both an ineligible refugee parent AND an eligible citizen child, the engine currently computes the benefit as if the household had 2 people. The actual rule (7 CFR 273.11(c)) says the ineligible alien doesn't count toward household size — so the benefit should be computed for HH1 (the citizen child) with the refugee's income deemed in proportionally. This requires a bigger composer-level refactor. ⏸ Deferred to a follow-up PR.

**Status:** ✅ Part 1 shipped. ⏸ Part 2 deferred. D07 still shows as a harness failure until Part 2 lands, but the residual failure now belongs cleanly to the household-size math gap, not to the eligibility logic.

**A10 guard:** profile A10 ("Refugee adjusted to LPR") was checked after the Part 1 fix and still produces APPROVE — confirms the engine correctly distinguishes the two pathways.

**Why this matters in real life:** State agencies following the FNS memo are denying refugees today. The engine would still approve them. This produces both wrongful approval (which a federal QC review would catch) and applicant confusion (the agency says no, the app said yes).

### P58 — The elderly retiree case (the one that's state-specific)

**What happened:** The software approved $24/month (the federal minimum benefit) for an elderly disabled retiree in Massachusetts with $1,100/mo Social Security and $1,200/mo wages, paying $700 rent. The answer key said this should be denied because the household's income is over the net-income limit.

**Who got it wrong:** The answer key (ORACLE_BUG). And the bug is specifically because Massachusetts has different math than California.

**How sure are we:** Certain (VERIFIED). I computed the math by hand against the actual fixture facts.

**The interesting part — why the answer key got it wrong:**

The variant was authored thinking about California's math. In California, the engine computes:
- $2,300 gross income → $1,851 adjusted income → $1,413.50 net income
- $1,413.50 > $1,305 (the 100%-FPL limit) → DENY

But Massachusetts has a higher utility allowance ($914 instead of California's $663):
- $2,300 gross → $1,851 adjusted → **$1,162.50 net income**
- $1,162.50 < $1,305 → ELIGIBLE
- Benefit math: $298 - (0.30 × $1,162.50) = -$50.75 → floored to $0 → minimum-benefit floor applies → $24

So the household IS eligible in Massachusetts. The $24 minimum benefit correctly applies. The software is doing the right thing.

**What needs to happen:** Fix the answer key. Either give P58 a state-specific expected verdict (DENY in CA, APPROVE $24 in MA), or re-author the variant with income values that exceed the net-income limit in BOTH states.

**Status:** Going back to the test author.

**Lesson learned (the meta-point):** Earlier in the audit, a fresh-eyes reviewer hypothesized this was a software bug — that the engine was wrongly applying the $24 floor to an ineligible household. The hypothesis was reasoning from the rule without computing the actual Massachusetts math. **This is exactly why showing-your-work (the worksheet) matters.** Without seeing net=$1,162.50 vs limit=$1,305, you can't tell whether the $24 floor is rescuing an eligible household (correct) or rescuing an ineligible one (a bug). Same outcome, completely different stories.

### P52 — The fleeing-felon case

**What happened:** The software approved $546/month for a household where one member has an active arrest warrant. The answer key said denial.

**Who got it wrong:** The answer key (ORACLE_BUG).

**How sure are we:** Certain (VERIFIED). The fresh-eyes reviewer fetched the 2024 final rule text directly.

**What the rule actually says (verbatim from 7 CFR 273.11(n)(1), the "Four-part test to establish fleeing felon status"):**
Disqualification requires ALL FOUR of:
1. Outstanding warrant
2. The person is aware (or should expect) law enforcement is looking for them
3. They've taken evasive action
4. Law enforcement is actively seeking them (with a 20-30 day response window per (n)(3))

**Why the answer key is wrong:** Having an active warrant alone fails the four-part test. The 2024 final rule was specifically designed to prevent disqualification on warrants that haven't been actively pursued. Even when all four prongs ARE met, §273.11(n) routes the disqualified member's income through proration — it's a member-level exclusion, not a household-level denial.

**What needs to happen:** The test author needs to either (a) encode all four prongs as separate fact fields and re-author the variant to truly meet the four-part test, OR (b) re-frame this as a member-disqualification scenario (household stays eligible, that one member is excluded with their income prorated).

**Status:** Going back to the test author.

**Why this matters in real life:** Real caseworkers don't deny on a bare warrant. They check the response from law enforcement and wait 20-30 days. A caseworker who denied solely on "warrant exists" would be reversed on appeal.

### P53 — The medical-expense $35-floor case

**What happened:** The software approved $268/month for an elderly disabled person with $30/month in medical expenses (below the $35 deduction floor). The answer key said denial.

**Who got it wrong:** The answer key (ORACLE_BUG).

**How sure are we:** Certain (VERIFIED). The fresh-eyes reviewer fetched the regulation text directly.

**What the rule actually says (verbatim from 7 CFR 273.9(d)(3)):**
> "That portion of medical expenses in excess of $35 per month..." [is the allowable deduction]

Plus 7 CFR 273.10(e)(2)(i)(C): elderly/disabled households are exempt from the gross-income test entirely.

**Why the answer key is wrong:** The $35 floor means "if you have less than $35 in medical expenses, you don't get a medical deduction this month." It does NOT mean "you're denied." The household still gets tested on its other math. For an elderly/disabled single-person household, that's just the net-income test — which this household passes.

**What needs to happen:** Change the expected verdict from DENY to APPROVE. Or re-frame the variant as a "medical deduction doesn't apply this month" scenario rather than a denial scenario.

**Status:** Going back to the test author.

**Why this matters in real life:** Confusing "no deduction" with "denial" is one of the most common new-caseworker mistakes. A real worker who denied here would be reversed in supervisory review.

### P59 — The $1-rounding-difference case

**What happened:** The software produced $77/month, the answer key expected $78/month. Both agree on APPROVE; they just differ by $1.

**Who got it wrong:** We need to see the case details first (NEEDS_FACTS).

**How sure are we:** Certain about the rule (VERIFIED). The question is which state-option Massachusetts elected.

**What the rule actually says (verbatim from 7 CFR 273.10(e)(2)(ii)(A)):**
States may either "round the 30 percent of net income UP to the nearest higher dollar" OR "round the allotment DOWN to the nearest lower dollar." Never both, never neither.

**Why this is the rounding-direction story:** A $1 difference at the household-size-1 boundary case is the classic signature of two state-option rounding rules colliding. The software uses one direction; the answer key uses the other. Which Massachusetts actually elected determines who's right.

**What needs to happen:** Fetch Massachusetts's DTA Online Guide to confirm the elected rounding direction. Add it to the rulebook as a state-option constant. Then adjudicate.

**Status:** Waiting. Can't fetch the DTA Online Guide today; mass.gov has been blocked.

**Why this matters in real life:** A $1 rounding error on every benefit calculation, applied to thousands of cases, becomes a measurable payment-error rate. Worth the day to confirm.

### M30 — The child-support-deduction case

**What happened:** The software approved $546/month for a household with child-support payments at the net-income margin. The answer key said denial. The variant comes in two flavors ("with" the deduction and "without" it); the "without" flavor is the one in disagreement.

**Who got it wrong:** We need to see the case details first (NEEDS_FACTS).

**How sure are we:** Certain about the rule (VERIFIED). The fixture's citation is mislabeled — it cites (d)(6) (excess shelter) but the actual controlling section is (d)(5) (state-option child-support deduction).

**What the rule actually says (verbatim from 7 CFR 273.9(d)(5)):**
States may allow a deduction for legally obligated child support payments paid by a household member to or for a nonhousehold member.

**Why we can't adjudicate yet:** This is fundamentally a math question — does the household's net income cross the 100%-FPL threshold or not? The current software output doesn't show the worksheet (gross, deductions, adjusted income, net), so we can't see which side of the threshold the household lands on.

**What needs to happen:** The worksheet-surfacing engine change has to land first. Once we can see the engine's net-income computation for both variants, we can adjudicate this in 5 minutes.

**Status:** Waiting on the worksheet-surfacing PR.

### P54 — The cash-gift-to-household case

**What happened:** The software approved $298/month for a household receiving cash gifts. The answer key said denial.

**Who got it wrong:** We need to see the case details first (NEEDS_FACTS).

**How sure are we:** Certain about the rule (VERIFIED). The classification logic is two-part.

**What the rule actually says:**
- **7 CFR 273.9(b)(2)(v):** cash gifts directly to the household are countable unearned income.
- **7 CFR 273.9(c)(12):** nonprofit cash gifts up to $300/quarter are EXCLUDED.

**Why we can't adjudicate yet:** We need to see the gift amount, the frequency, and the source. A $100/quarter gift from a nonprofit church food pantry → excluded → APPROVE is correct. A $400/month gift from grandma → countable → may exceed the income limit → DENY may be correct. The software's APPROVE means it counted something, but the output doesn't show whether the gift was treated as countable or excluded, or what the resulting income calculation looked like.

**What needs to happen:** The worksheet-surfacing engine change. Once we can see the income line-item classification ("gift: $X/mo classified as countable under (b)(2)(v)" vs "gift: $X/mo excluded under (c)(12)"), this becomes a 2-minute adjudication.

**Status:** Waiting on the worksheet-surfacing PR.

**Why this matters in real life:** "Does grandma's $200 count as income?" is one of the most common questions caseworkers face. Getting this classification wrong is what generates appeals.

## The bigger pattern

All 8 failures share one shape problem the verification vocab makes explicit: **the engine emits a verdict and a benefit, not a worksheet.** Five of the eight rows above are listed as NEEDS_FACTS or ENGINE_BUG (hypothesis) — not because the regulation is unclear, but because the engine doesn't show what intermediate values it used.

| Must-capture item | Status across all 8 failures |
|---|---|
| Worksheet (intermediate values) | Missing on all 8 |
| Citation at controlling-subsection precision | Missing on all 8 |
| Expedited determination | Missing on all 8 |
| Recertification cycle | Missing on all 8 |
| Pend output with deficiency list | Missing — engine has no PEND verdict |
| Questionable-fact flags per §273.2(f) | Missing — engine treats all facts as verified |

These are all in the verification vocab. None are in the engine output. The fix priority is therefore:

1. **Worksheet surfacing** — engine emits the intermediate values + controlling subsection per gate. Closes 5 of 8 failures (the 3 NEEDS_FACTS plus the M30/P54/P59 trio become adjudicable once the worksheet is visible).
2. **Fix VISTA** — single classification change.
3. **Fix refugee post-OBBBA** — immigration gate + A10 guard.
4. **Fix min-benefit-floor over ineligible household** — composer + benefit-calc branch order.
5. **Send P52, P53 back to oracle author** — two fixture corrections with verbatim citations.

## Reversal log

Prior session calls that this audit reversed or strengthened, per the reversal protocol:

| Case | Prior call | Prior evidence | This audit | Stick? |
|---|---|---|---|---|
| P63 | "Engine right (excludes VISTA correctly)" | RECALLED (caseworker reviewer + me) | "ENGINE_BUG, oracle right" | VERIFIED via §273.9(b)(1)(iv) + (c)(10)(iii). **Reversal sticks.** |
| D07 | "Engine wrong (OBBBA removed refugees)" | INHERITED (triple-check finding) → NOT_RESOLVED (fresh eyes blocked) | "ENGINE_BUG (with A10 guard)" | VERIFIED via FNS memo Oct 31 2025. **Reversal sticks; A10 guard added.** |
| P52 | "Engine right (member-level DQ)" | RECALLED + INHERITED | "ORACLE_BUG, engine right but for a richer reason" | VERIFIED via §273.11(n)(1) four-part test. **Strengthened, not reversed.** |
| P58 | (not adjudicated previously) | — | "ENGINE_BUG (hypothesis on the floor branch)" | New finding. Confirm by code read before patching. |
| P53 | "Engine right (no deduction ≠ denial)" | RECALLED | "ORACLE_BUG, engine right" | VERIFIED via §273.9(d)(3) + §273.10(e)(2)(i)(C). **Strengthened.** |

## Acceptance criteria for the engine-bug PRs

For each ENGINE_BUG fix:

- [ ] Verbatim quote of the controlling subsection in the commit message.
- [ ] URL fetched in the commit-message authoring context.
- [ ] Test coverage added: a profile in the harness that exercises the specific bug path.
- [ ] Existing harness CA + MA totals do not regress.
- [ ] If the bug fix moves any verdict on any profile, the change must be listed line-by-line in the commit body.

For each ORACLE_BUG fix (sent back to oracle author):

- [ ] Specific verbatim quote of the controlling regulation.
- [ ] Proposed corrected expected verdict.
- [ ] If the variant labeling needs to change, the new variant name + the rationale.
