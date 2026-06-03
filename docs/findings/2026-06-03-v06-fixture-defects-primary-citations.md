---
id: 2026-06-03-v06-fixture-defects-primary-citations
date: 2026-06-03
scope: [snap, eligibility, oracle, regulation, profile-harness]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/273.4"
    note: "Cornell LII — verbatim text of 7 CFR 273.4 (a) eligible-persons categories and (c) sponsored-alien handling"
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/273.9"
    note: "Cornell LII — verbatim text of 7 CFR 273.9 (a)(1) gross-income test + E/D waiver, (b)(2) unearned-income def, (c) exclusions intro, (d)(3) medical $35 floor"
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/273.10"
    note: "Cornell LII — verbatim text of 7 CFR 273.10 (e)(1)(ii) net-income rounding, (e)(2)(ii)(A) final-benefit formula + two rounding methods, (e)(2)(ii)(C) HH1-2 minimum"
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/273.11"
    note: "Cornell LII — verbatim text of 7 CFR 273.11 (c) treatment of ineligible-member income, (c)(3) state-option count-all vs pro-rata; (n) via web search fallback"
  - kind: url
    ref: "https://portaldir.ct.gov/dss/SNAP/FleeingFelonProbationorParoleVi1.html"
    note: "CT DSS verbatim 7 CFR 273.11(n) text — fleeing-felon disqual + remaining-member treatment (Cornell LII page truncates before (n) at time of fetch)"
  - kind: file
    ref: "data-ops/sample/civica-test-profiles/v0.6.json"
    note: "v0.6 oracle fixture under audit"
  - kind: github-issue
    ref: "matthewgg22/Civica#441..#449"
    note: "9 fixture-defect issues opened against v0.6 from this audit"
  - kind: github-pr
    ref: "matthewgg22/Civica#450"
    note: "Engine-side companion: cite-and-pin commit (no math change)"
---

## What we found

For each of the 9 v0.6 fixture defects surfaced by the 2026-06-03 profile-harness audit (CA + MA), the cited federal regulation — quoted verbatim from the Cornell LII text of 7 CFR Part 273 — confirms the engine's behavior and contradicts the oracle's expected verdict. This document pins the primary-source language behind each issue so the fix author doesn't have to re-derive the citation chain.

## Why it matters

The harness's "FAIL" column was being read as engine drift. The audit instead shows it's drift in the *oracle*. Acting on the harness as if it were authoritative would inject regulatorily-incorrect behavior into the engine. Each issue below cites the words of the regulation that say so.

## Per-issue primary citations

### Issue [#441](https://github.com/matthewgg22/Civica/issues/441) — D07 (refugee + citizen spouse, oracle DENY)

**Cited:** 7 CFR 273.4; 7 CFR 273.11(c)

> The income and resources of the ineligible household member(s) shall continue to count in their entirety, and the entire household's allowable earned income, standard, medical, dependent care, child support, and excess shelter deductions shall continue to apply to the remaining household members.

[7 CFR 273.11(c) — verbatim, Cornell LII]

**What this proves:** the regulation explicitly contemplates that "remaining household members" (m2, the citizen spouse in D07) keep eligibility and continue to receive deductions. The ineligible alien (m1) does not zero out the household. The oracle's uniform DENY across all five states is contrary to the regulation as written.

---

### Issue [#442](https://github.com/matthewgg22/Civica/issues/442) — M18 (mixed-status proration math)

**Cited:** 7 CFR 273.11(c)(3)

> The State agency must count all or, at the discretion of the State agency, all but a pro rata share, of the ineligible alien's income and deductible expenses and all of the ineligible alien's resources in accordance with paragraphs (c)(1) or (c)(2) of this section.

> In exercising its discretion under this paragraph (c)(3)(i), the State agency may count all of the alien's income for purposes of applying the gross income test for eligibility purposes while only counting all but a pro rata share to apply the net income test and determine level of benefits.

[7 CFR 273.11(c)(3)(i) — verbatim, Cornell LII]

**What this proves:** "count all" is the default and an explicit state option. CA's election of count-all (per the CalFresh handbook) is regulatorily valid. M18's `integrity` block names "prorate" as the `correct_method` but the $591 amount it claims as correct only reconciles to count-all + full-HH-size math. The block is internally inconsistent against the cited regulation.

---

### Issue [#443](https://github.com/matthewgg22/Civica/issues/443) — M30[without] (DENY at zero income)

**Cited:** 7 CFR 273.10(e)(2)(ii)(A); 7 CFR 273.9(a)(1)

> The household's monthly allotment shall be equal to the maximum SNAP allotment for the household's size reduced by 30 percent of the household's net monthly income […]

[7 CFR 273.10(e)(2)(ii)(A) — verbatim, Cornell LII]

**What this proves:** with gross income = $0 (M30's base profile has `income: []`), `30 percent × net = 0`, so the allotment equals the max allotment by construction. There is no path from these facts to any deduction-comparison that flips a denial. The `without` variant's DENY expectation is mathematically unreachable.

---

### Issue [#444](https://github.com/matthewgg22/Civica/issues/444) — P52[active_warrant] (whole-HH DENY)

**Cited:** 7 CFR 273.11(n)

> The eligibility and benefit level of any remaining household members of a household containing individuals determined ineligible because of their fleeing felon status shall be determined as follows, and the income and resources of the ineligible household member(s) shall continue to count in their entirety, and the entire household's allowable earned income, standard, medical, dependent care, child support, and excess shelter deductions shall continue to apply to the remaining household members.

[7 CFR 273.11(n) — verbatim, via CT DSS quotation of the federal text]

**What this proves:** §273.11(n) explicitly establishes that "remaining household members" retain eligibility when one member is determined ineligible for fleeing-felon status. The disqualification is individual-level. P52's `active_warrant` variant expects whole-HH DENY despite a citizen child (m2) remaining in the household, contradicting the literal regulation.

---

### Issue [#445](https://github.com/matthewgg22/Civica/issues/445) — P53[medical_30] (E/D HH, sub-floor medical, DENY)

**Cited:** 7 CFR 273.9(a)(1); 7 CFR 273.9(d)(3)

> Households which contain an elderly or disabled member shall meet the net income eligibility standards for SNAP.

[7 CFR 273.9(a)(1) — verbatim, Cornell LII; this is the language exempting E/D HHs from the gross income test, requiring only the net test]

> That portion of medical expenses in excess of $35 per month, excluding special diets, incurred by any household member who is elderly or disabled.

[7 CFR 273.9(d)(3) — verbatim, Cornell LII]

**What this proves:** the $35 floor is correctly named in the variant note ("under $35 floor") and correctly applied in the engine (zero deduction on $30 of medical). But with m1 elderly+disabled, only the net test applies, and with $1,250 RSDI + $800 rent the net comes out far under 100% FPL even with zero medical deduction. The oracle's DENY is unreachable.

---

### Issue [#446](https://github.com/matthewgg22/Civica/issues/446) — P54[cash_to_household] (DENY on $400 unearned)

**Cited:** 7 CFR 273.9(b)(2); 7 CFR 273.10(e)(2)(ii)(A); 7 CFR 273.10(e)(2)(ii)(C)

> All eligible one-person and two-person households shall receive minimum monthly allotments equal to the minimum benefit. The minimum benefit is 8 percent of the maximum allotment for a household of one[…]

[7 CFR 273.10(e)(2)(ii)(C) — verbatim, Cornell LII]

**What this proves:** the engine correctly counts the $400/month cash gift as unearned per §273.9(b)(2). But at HH-1, $400 gross is far below any applicable threshold; the net floor and the §273.10(e)(2)(ii)(C) minimum-benefit rule together guarantee an APPROVE outcome. The oracle's DENY is unreachable.

---

### Issue [#447](https://github.com/matthewgg22/Civica/issues/447) — P58[above_net_limit] MA (cross-state divergence)

**Cited:** 7 CFR 273.9(a)(2)

> The income eligibility standards for the 48 contiguous States and the District of Columbia, Guam and the Virgin Islands shall be the Federal income poverty levels for the 48 contiguous States and the District of Columbia.

[7 CFR 273.9(a)(2) — verbatim, Cornell LII; this is the language that ties the net-income test to a FIXED FPL but leaves per-state SUA values to state policy under §273.9(d)(6)]

**What this proves:** the FPL threshold is federal-uniform, but the state-administered standard utility allowance can move excess shelter substantially. In P58, MA's higher SUA ($914 vs CA's $663) legitimately reduces net income below the 100% FPL threshold. The variant block's single DENY verdict for all states is therefore wrong on its face; per-state expectations are required for any variant whose outcome depends on the SUA value.

---

### Issue [#448](https://github.com/matthewgg22/Civica/issues/448) — P59 MA ($1 boundary rounding)

**Cited:** 7 CFR 273.10(e)(2)(ii)(A)

> The household's monthly allotment shall be equal to the maximum SNAP allotment for the household's size reduced by 30 percent of the household's net monthly income […] The State agency shall round the 30 percent of net income up to the nearest higher dollar; or […] the State agency shall round the allotment down to the nearest lower dollar.

[7 CFR 273.10(e)(2)(ii)(A) — verbatim, Cornell LII]

**What this proves:** the regulation gives two and only two allowed rounding methods for the final allotment step. Both produce $77 for P59 MA:

- **Method 1** (round 30%-of-net up to next higher dollar): $735 × 0.30 = $220.50 → ceiling $221. $298 − $221 = **$77**.
- **Method 2** (don't round 30%-of-net; round allotment down): $298 − $220.50 = $77.50 → floor **$77**.

The oracle's $78 requires standard 4/5 rounding at the final step, which is not an option the regulation permits.

---

### Issue [#449](https://github.com/matthewgg22/Civica/issues/449) — P63[vista_no_prior] (DENY on $1,500 stipend)

**Cited:** 7 CFR 273.9(c) (income exclusions, opening); 42 USC §5044(f) (DVSA §404(g) VISTA exclusion)

> Only the following items shall be excluded from household income and no other income shall be excluded.

[7 CFR 273.9(c) opening — verbatim, Cornell LII; the exhaustive-exclusions clause that establishes whatever isn't listed here is countable]

**What this proves:** the variant `americorps_vista_counted` correctly tags the stipend as countable per the DVSA §404(g) rule (excluded only when the volunteer was already receiving SNAP before joining VISTA). The engine counts it correctly. But $1,500 in a 2-person household stays under both the gross threshold ($3,526 at CA BBCE 200% FPL) and the net threshold ($1,763 at 100% FPL), so the variant's DENY expectation is unreachable.

## What changes

- Each of [#441–#449](https://github.com/matthewgg22/Civica/issues?q=is%3Aissue+is%3Aopen+label%3Abug+author%3Amatthewgg22+v0.6+fixture) now has a direct citation it can be closed against — fix the fixture (update verdicts or tune facts to make the named threshold actually flip).
- The engine doc change in [#450](https://github.com/matthewgg22/Civica/pull/450) is now backed by the verbatim §273.11(c)(3)(i) text quoted above, not just a section reference.
- No further engine work is needed to resolve these failures; the per-issue suggested fixes are all fixture-side.

## Open questions

- **eCFR access:** the eCFR source (ecfr.gov) returns a 302 to `unblock.federalregister.gov` for our WebFetch tool. The Cornell LII mirror is consistent with the official text but a regulatory-rigor confirmation pass against eCFR-rendered HTML would be cleaner — open follow-up if anyone audits this finding from outside the tool sandbox.
- **§273.11(n) source:** Cornell LII's page truncated before paragraph (n) at fetch time. The quotation was reconstructed from the CT DSS state SNAP manual, which renders the federal text verbatim. Re-verify against eCFR when access permits.
