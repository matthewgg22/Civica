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

### P63 — VISTA stipend, no prior SNAP at joining

**Disposition: ENGINE_BUG · Evidence: VERIFIED**

- **Controlling citation:** 7 CFR 273.9(b)(1)(iv) (VISTA payments are earned income) + 7 CFR 273.9(c)(10)(iii) (exclusion only for those receiving SNAP/PA at time of joining).
- **Verbatim from §273.9(c)(10)(iii):** *"New applicants who were not receiving public assistance or SNAPs at the time they joined VISTA shall have these volunteer payments included as earned income."*
- **Engine behavior:** treats `americorps_sn` as universally excluded.
- **Correct behavior:** count as earned income (with 20% EID per §273.9(d)(2)) unless household was on SNAP/PA at the time member joined VISTA.
- **Fix location:** `packages/snap-rules/src/facts.ts` (the `EXCLUDED` income type set, plus the conditional logic).
- **Real-world impact:** new applicants who joined VISTA without prior SNAP are getting wrongly approved with stipend ignored. Federal QC would catch this.

### D07 — Refugee in refugee status, post-OBBBA

**Disposition: ENGINE_BUG (two parts) · Evidence: VERIFIED**

The audit identified two distinct bugs in the same path. The first is fixed (commit follows). The second is a larger refactor and stays open.

**Part 1 (FIXED) — OBBBA effective date:** engine had `obbbaCutoff = 2025-11-01`. That was the FNS 120-day hold-harmless deadline, not the statutory effective date. Per FNS memo Attachment 1 (2025-10-31), eligibility changes are "effective July 4, 2025." Engine updated to `2025-07-04`. No verdict change in the current test set (no profile has `as_of_date` in the contested July-November 2025 window), but correctness against primary source. A10 guard confirmed: refugee-who-adjusted-to-LPR continues APPROVE (uses `lpr + exempt:refugee_adjusted` branch, not the refugee branch).

**Part 2 (OPEN — bigger refactor) — ineligible-alien household-size recomputation:** D07 fixture encodes m1 with `immigration: "removed_status:refugee"` (correctly ineligible per engine) and m2 as citizen child. Per 7 CFR 273.11(c), an ineligible alien's income should be deemed in proportion, but they do NOT count toward household size for benefit calculation. Engine currently computes benefit for the full household (HH2 max allotment $546 in CA, similar in MA). Correct behavior: compute as HH1 ($298 max allotment) with m1's income deemed in. D07 fixture's expected DENY is also questionable — with zero income, a HH1 citizen-only household should APPROVE at $298. The fixture may need re-authoring, OR the fixture is implicitly testing a single-member refugee household that the schema doesn't support.

- **Verbatim from FNS memo Attachment 1:** *"Refugees | Post-OBBB Eligibility: Not eligible."*
- **Verbatim from §273.11(c)(1):** ineligible aliens' income is treated "as if" prorated; benefit allotment computed for remaining eligible members only.
- **Fix location for Part 2:** `packages/snap-rules/src/verdict.ts` or new `gates/composition.ts` logic to recompute effective HH size from immigration eligibility before calling `computeBenefit`.
- **Action:** Part 1 shipped. Part 2 deferred to a follow-up PR with the proration math + a re-authored D07 fixture. Until then, D07 remains a known harness failure attributed to the proration gap, not to immigration eligibility logic.

### P58 — Elderly E/D HH1 over net limit (state-specific)

**Disposition: ORACLE_BUG (state-specific) · Evidence: VERIFIED**

- **Reversed from earlier hypothesis** that this was an engine min-benefit-floor bug. After computing the math against the actual fixture facts:
- **Variant facts (`above_net_limit`):** HH1, age 67, E/D, $1,100/mo SSDI + $1,200/mo wages = $2,300 gross, rent $700, HCSUA tier, no medical/depcare/CS.
- **MA math:** EID $240, SD $209, adjusted $1,851, shelter $1,614 ($700 + $914 MA-HCSUA), half-adj $925.50, excess shelter $688.50 (uncapped E/D), **net = $1,162.50 ≤ $1,305 (100% FPL HH1) → net test PASSES → household IS eligible**.
- **Computed benefit:** $298 - 0.30 × $1,162.50 = -$50.75 → floored to $0 → min-benefit floor: $0 < $24 → benefit = $24.
- **Engine is correct.** The min-benefit floor applies because the household is eligible per the net test.
- **CA math (for comparison):** same facts, CA HCSUA $663 → shelter $1,363, excess shelter $437.50, net = $1,413.50 → exceeds $1,305 → net test FAILS → DENY. CA harness confirms P58 passes in CA (not in the 6-failure list).
- **Why oracle is wrong:** the variant's expected DENY was authored against CA-shaped math. In MA the higher SUA flips the household to eligible. The variant either needs a state-specific expected verdict, or needs different income values that force net > limit in both states.
- **Fix location:** v0.6 oracle fixture. Either (a) add MA-specific `expected_by_state` entry that flips this variant to APPROVE $24, or (b) re-author the variant with income values that exceed net limit in both states.
- **Lesson:** the fresh-eyes hypothesis (engine wrongly floors ineligible households) was wrong because the agent reasoned about the rule without computing the actual MA math. **Worksheets prevent this.**

### P52 — Fleeing felon, active_warrant only

**Disposition: ORACLE_BUG · Evidence: VERIFIED**

- **Controlling citation:** 7 CFR 273.11(n)(1) — titled "Four-part test to establish fleeing felon status" per 2024 final rule.
- **Verbatim:** disqualification requires (i) outstanding warrant + (ii) person is aware/should expect it + (iii) evasive action + (iv) law enforcement actively seeking (20/30-day response window per (n)(3)).
- **Oracle expected:** DENY based on `active_warrant=true` alone.
- **Why oracle is wrong:** §273.11(n)(1) requires all four prongs. A bare warrant flag fails the test. Even when the test is met, §273.11(n) routes the disqualified member's income through (c)(1) — this is a **member-level disqualification**, not a household-level denial.
- **Fix location:** v0.6 oracle fixture. Update P52 to either (a) encode all four prongs as separate fact fields and re-author the expected verdict, or (b) re-author as a member-disqualification scenario (household stays eligible, member excluded with income prorated).
- **Engine behavior is currently right** (treats it as a member-level rather than household-level disqualification).

### P53 — Medical $30 (under $35 floor)

**Disposition: ORACLE_BUG · Evidence: VERIFIED**

- **Controlling citation:** 7 CFR 273.9(d)(3) (medical-deduction $35 floor) + 7 CFR 273.10(e)(2)(i)(C) (E/D households exempt from gross-income test).
- **Verbatim from §273.9(d)(3):** *"That portion of medical expenses in excess of $35 per month..."*
- **Oracle expected:** DENY because medical < $35.
- **Why oracle is wrong:** the $35 floor means "no medical deduction this month" — not "denial." The household is still tested on its other math. For an E/D HH1, the household is exempt from the gross test anyway and only fails if net > 100% FPL.
- **Fix location:** v0.6 oracle fixture. Update P53 expected verdict from DENY to APPROVE with the derived benefit amount, or reposition the variant as a "medical deduction does not apply" scenario rather than a denial scenario.
- **Engine behavior is currently right.**

### P59 — HH1 BBCE boundary, $77 vs $78

**Disposition: NEEDS_FACTS · Evidence: VERIFIED on rule**

- **Controlling citation:** 7 CFR 273.10(e)(2)(ii)(A) (benefit formula + rounding state-option).
- **Verbatim:** states may "round the 30 percent of net income up to the nearest higher dollar" OR "round the allotment down to the nearest lower dollar" but never neither.
- **The $1 delta:** engine produces $77, oracle expects $78. Classic state-option rounding-direction mismatch.
- **What's needed:** the MA-elected rounding rule from the DTA Online Guide. The MA value should be added to the registry as a state-option constant.
- **Not actionable until:** the MA rounding rule is fetched from primary source (DTA Online Guide section, currently behind mass.gov access barriers).

### M30 — Child-support deduction at net margin

**Disposition: NEEDS_FACTS · Evidence: VERIFIED on rule (cite is mislabeled in fixture)**

- **Controlling citation:** 7 CFR 273.9(d)(5) (state-option child-support deduction).
- **Fixture cites:** 7 CFR 273.9(d)(6) (excess shelter). Wrong subsection.
- **Verdict cannot be adjudicated without:** the gross/net/threshold math from the worksheet for both `with` and `without` variants. Currently the engine output doesn't surface intermediate values, so we can't see whether the net actually crosses the 100% FPL threshold in the "without" arm.
- **Blocks on:** the worksheet-surfacing engine change (see "Bigger pattern" below).

### P54 — Cash gift to household

**Disposition: NEEDS_FACTS · Evidence: VERIFIED on classification**

- **Controlling citation:** 7 CFR 273.9(b)(2)(v) (cash gifts are countable unearned income) unless 7 CFR 273.9(c)(12) applies (nonprofit gifts ≤ $300/quarter are excluded).
- **Engine behavior:** ambiguous — APPROVE $298 means it counted something, but doesn't show what.
- **What's needed:** gift amount, gift frequency, gift source (nonprofit-charitable?). Without these from the facts_patch, can't say which classification applied.
- **Blocks on:** the worksheet-surfacing engine change.

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
