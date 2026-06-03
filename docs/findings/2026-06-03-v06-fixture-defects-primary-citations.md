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
    ref: "https://www.govinfo.gov/content/pkg/CFR-2024-title7-vol4/xml/CFR-2024-title7-vol4-sec273-4.xml"
    note: "GPO govinfo.gov — official CFR-2024 XML of 7 CFR 273.4 (mixed-status sponsored-alien handling, eligible-persons categories)"
  - kind: url
    ref: "https://www.govinfo.gov/content/pkg/CFR-2024-title7-vol4/xml/CFR-2024-title7-vol4-sec273-9.xml"
    note: "GPO govinfo.gov — official CFR-2024 XML of 7 CFR 273.9 (a)(1) gross-test waiver, (b)(2) unearned income, (c) exclusions opening, (d)(3) excess medical deduction"
  - kind: url
    ref: "https://www.govinfo.gov/content/pkg/CFR-2024-title7-vol4/xml/CFR-2024-title7-vol4-sec273-10.xml"
    note: "GPO govinfo.gov — official CFR-2024 XML of 7 CFR 273.10 (e)(2)(ii)(A) two-method allotment rounding, (e)(2)(ii)(C) HH1-2 minimum-benefit floor"
  - kind: url
    ref: "https://www.govinfo.gov/content/pkg/CFR-2024-title7-vol4/xml/CFR-2024-title7-vol4-sec273-11.xml"
    note: "GPO govinfo.gov — official CFR-2024 XML of 7 CFR 273.11 (c) intro on remaining-member treatment, (c)(3)(i) state-option count-all-vs-pro-rata, (n) fleeing-felon individual disqualification"
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/273.11"
    note: "Cornell LII — kept as redundant tertiary cross-check; matches GPO text for all sections fetched"
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

For each of the 9 v0.6 fixture defects surfaced by the 2026-06-03 profile-harness audit (CA + MA), the cited federal regulation — quoted verbatim from the **GPO govinfo.gov XML of CFR-2024 Title 7 volume 4** (the U.S. Government Publishing Office's authoritative public-access CFR archive) — confirms the engine's behavior and contradicts the oracle's expected verdict. This document pins the primary-source language behind each issue so the fix author doesn't have to re-derive the citation chain.

## Why it matters

The harness's "FAIL" column was being read as engine drift. The audit instead shows it's drift in the *oracle*. Acting on the harness as if it were authoritative would inject regulatorily-incorrect behavior into the engine. Each issue below cites the words of the regulation that say so.

## Per-issue primary citations

### Issue [#441](https://github.com/matthewgg22/Civica/issues/441) — D07 (refugee + citizen spouse, oracle DENY)

**Cited:** 7 CFR 273.4; 7 CFR 273.11(c)

> The income and resources of the ineligible household member(s) shall continue to count in their entirety, and the entire household's allowable earned income, standard, medical, dependent care, child support, and excess shelter deductions shall continue to apply to the remaining household members.

[7 CFR 273.11(c) intro — verbatim, GPO govinfo.gov CFR-2024-title7-vol4]

**What this proves:** the regulation explicitly contemplates that "remaining household members" (m2, the citizen spouse in D07) keep eligibility and continue to receive deductions. The ineligible alien (m1) does not zero out the household. The oracle's uniform DENY across all five states is contrary to the regulation as written.

---

### Issue [#442](https://github.com/matthewgg22/Civica/issues/442) — M18 (mixed-status proration math)

**Cited:** 7 CFR 273.11(c)(3)

> The State agency must count all or, at the discretion of the State agency, all but a pro rata share, of the ineligible alien's income and deductible expenses and all of the ineligible alien's resources in accordance with paragraphs (c)(1) or (c)(2) of this section.

> In exercising its discretion under this paragraph (c)(3)(i), the State agency may count all of the alien's income for purposes of applying the gross income test for eligibility purposes while only counting all but a pro rata share to apply the net income test and determine level of benefits.

[7 CFR 273.11(c)(3)(i) — verbatim, GPO govinfo.gov CFR-2024-title7-vol4]

**What this proves:** "count all" is the default and an explicit state option. CA's election of count-all (per the CalFresh handbook) is regulatorily valid. M18's `integrity` block names "prorate" as the `correct_method` but the $591 amount it claims as correct only reconciles to count-all + full-HH-size math. The block is internally inconsistent against the cited regulation.

---

### Issue [#443](https://github.com/matthewgg22/Civica/issues/443) — M30[without] (DENY at zero income)

**Cited:** 7 CFR 273.10(e)(2)(ii)(A); 7 CFR 273.9(a)(1)

> The household's monthly allotment shall be equal to the maximum SNAP allotment for the household's size reduced by 30 percent of the household's net monthly income […]

[7 CFR 273.10(e)(2)(ii)(A) — verbatim, GPO govinfo.gov CFR-2024-title7-vol4]

**What this proves:** with gross income = $0 (M30's base profile has `income: []`), `30 percent × net = 0`, so the allotment equals the max allotment by construction. There is no path from these facts to any deduction-comparison that flips a denial. The `without` variant's DENY expectation is mathematically unreachable.

---

### Issue [#444](https://github.com/matthewgg22/Civica/issues/444) — P52[active_warrant] (whole-HH DENY)

**Cited:** 7 CFR 273.11(n); 7 CFR 273.11(c) intro

> (n) Fleeing felons and probation or parole violators. Individuals who are fleeing to avoid prosecution or custody for a crime, or an attempt to commit a crime, that would be classified as a felony (or in the State of New Jersey, a high misdemeanor) or who are violating a condition of probation or parole under a Federal or State law shall not be considered eligible household members. The income and resources of the ineligible member shall be handled in accordance with (c)(1) of this section.

[7 CFR 273.11(n) — verbatim, GPO govinfo.gov CFR-2024-title7-vol4]

> (c) Treatment of income and resources of certain nonhousehold members. During the period of time that a household member cannot participate for the reasons addressed in this section, the eligibility and benefit level of any remaining household members shall be determined in accordance with the procedures outlined in this section.

[7 CFR 273.11(c) intro — verbatim, GPO govinfo.gov CFR-2024-title7-vol4]

**What this proves:** §273.11(n) makes the fleeing-felon disqualification individual ("shall not be considered eligible household members" — singular treatment) and routes the ineligible member's income through §273.11(c)(1). §273.11(c) intro then guarantees that "remaining household members" (m2, the citizen child) have their eligibility determined per the procedures in this section. There is no whole-HH disqualification path. P52's `active_warrant` variant expects DENY for the entire household, contradicting the literal regulation.

---

### Issue [#445](https://github.com/matthewgg22/Civica/issues/445) — P53[medical_30] (E/D HH, sub-floor medical, DENY)

**Cited:** 7 CFR 273.9(a)(1); 7 CFR 273.9(d)(3)

> Households which contain an elderly or disabled member shall meet the net income eligibility standards for SNAP.

[7 CFR 273.9(a)(1) preamble — verbatim, GPO govinfo.gov CFR-2024-title7-vol4; the second sentence is the gross-test waiver for E/D HHs]

> Excess medical deduction. That portion of medical expenses in excess of $35 per month, excluding special diets, incurred by any household member who is elderly or disabled as defined in § 271.2.

[7 CFR 273.9(d)(3) — verbatim, GPO govinfo.gov CFR-2024-title7-vol4]

**What this proves:** the $35 floor is correctly named in the variant note ("under $35 floor") and correctly applied in the engine (zero deduction on $30 of medical). But with m1 elderly+disabled, only the net test applies, and with $1,250 RSDI + $800 rent the net comes out far under 100% FPL even with zero medical deduction. The oracle's DENY is unreachable.

---

### Issue [#446](https://github.com/matthewgg22/Civica/issues/446) — P54[cash_to_household] (DENY on $400 unearned)

**Cited:** 7 CFR 273.9(b)(2); 7 CFR 273.10(e)(2)(ii)(A); 7 CFR 273.10(e)(2)(ii)(C)

> All eligible one-person and two-person households shall receive minimum monthly allotments equal to the minimum benefit. The minimum benefit is 8 percent of the maximum allotment for a household of one[…]

[7 CFR 273.10(e)(2)(ii)(C) — verbatim, GPO govinfo.gov CFR-2024-title7-vol4]

**What this proves:** the engine correctly counts the $400/month cash gift as unearned per §273.9(b)(2). But at HH-1, $400 gross is far below any applicable threshold; the net floor and the §273.10(e)(2)(ii)(C) minimum-benefit rule together guarantee an APPROVE outcome. The oracle's DENY is unreachable.

---

### Issue [#447](https://github.com/matthewgg22/Civica/issues/447) — P58[above_net_limit] MA (cross-state divergence)

**Cited:** 7 CFR 273.9(a)(2)

> The income eligibility standards for the 48 contiguous States and the District of Columbia, Guam and the Virgin Islands shall be the Federal income poverty levels for the 48 contiguous States and the District of Columbia.

[7 CFR 273.9(a)(2) preamble — verbatim, GPO govinfo.gov CFR-2024-title7-vol4; same paragraph ties net-income standards to the federal FPL while leaving the per-state SUA to §273.9(d)(6)]

**What this proves:** the FPL threshold is federal-uniform, but the state-administered standard utility allowance can move excess shelter substantially. In P58, MA's higher SUA ($914 vs CA's $663) legitimately reduces net income below the 100% FPL threshold. The variant block's single DENY verdict for all states is therefore wrong on its face; per-state expectations are required for any variant whose outcome depends on the SUA value.

---

### Issue [#448](https://github.com/matthewgg22/Civica/issues/448) — P59 MA ($1 boundary rounding)

**Cited:** 7 CFR 273.10(e)(2)(ii)(A)

> (ii)(A) Except as provided in paragraphs (a)(1), (e)(2)(iii) and (e)(2)(vi) of this section, the household's monthly allotment shall be equal to the maximum SNAP allotment for the household's size reduced by 30 percent of the household's net monthly income as calculated in paragraph (e)(1) of this section. If 30 percent of the household's net income ends in cents, the State agency shall round in one of the following ways:

> (...) The State agency shall round the 30 percent of net income up to the nearest higher dollar; or

> (...) The State agency shall not round the 30 percent of net income at all. Instead, after subtracting the 30 percent of net income from the appropriate Thrifty Food Plan, the State agency shall round the allotment down to the nearest lower dollar.

[7 CFR 273.10(e)(2)(ii)(A) — verbatim, GPO govinfo.gov CFR-2024-title7-vol4]

**What this proves:** the regulation exhausts the two and only two allowed rounding methods for the final allotment step ("the State agency shall round in one of the following ways"). Both produce $77 for P59 MA:

- **Method 1** (round 30%-of-net up to next higher dollar): $735 × 0.30 = $220.50 → ceiling $221. $298 − $221 = **$77**.
- **Method 2** (don't round 30%-of-net; round allotment down): $298 − $220.50 = $77.50 → floor **$77**.

The oracle's $78 requires standard 4/5 rounding at the final step, which is not an option the regulation permits.

---

### Issue [#449](https://github.com/matthewgg22/Civica/issues/449) — P63[vista_no_prior] (DENY on $1,500 stipend)

**Cited:** 7 CFR 273.9(c) (income exclusions, opening); 42 USC §5044(f) (DVSA §404(g) VISTA exclusion)

> Only the following items shall be excluded from household income and no other income shall be excluded.

[7 CFR 273.9(c) opening — verbatim, GPO govinfo.gov CFR-2024-title7-vol4; the exhaustive-exclusions clause that establishes whatever isn't listed here is countable]

**What this proves:** the variant `americorps_vista_counted` correctly tags the stipend as countable per the DVSA §404(g) rule (excluded only when the volunteer was already receiving SNAP before joining VISTA). The engine counts it correctly. But $1,500 in a 2-person household stays under both the gross threshold ($3,526 at CA BBCE 200% FPL) and the net threshold ($1,763 at 100% FPL), so the variant's DENY expectation is unreachable.

## What changes

- Each of [#441–#449](https://github.com/matthewgg22/Civica/issues?q=is%3Aissue+is%3Aopen+label%3Abug+author%3Amatthewgg22+v0.6+fixture) now has a direct citation it can be closed against — fix the fixture (update verdicts or tune facts to make the named threshold actually flip).
- The engine doc change in [#450](https://github.com/matthewgg22/Civica/pull/450) is now backed by the verbatim §273.11(c)(3)(i) text quoted above, not just a section reference.
- No further engine work is needed to resolve these failures; the per-issue suggested fixes are all fixture-side.

## Sourcing trail

- **Primary source:** GPO's govinfo.gov, the official electronic CFR archive (`CFR-2024-title7-vol4`). All 9 verbatim quotes above are drawn directly from the GPO XML for §273.4, §273.9, §273.10, §273.11 (URLs in the `evidence` block at the top of this finding). govinfo.gov is the authoritative public-access publication channel for the CFR maintained by the U.S. Government Publishing Office.
- **Authoritative live-amended source:** the official eCFR (ecfr.gov) is the up-to-the-minute amended text. At fetch time on 2026-06-03, ecfr.gov returned an anti-bot CAPTCHA (`unblock.federalregister.gov`) and its API endpoint returned HTTP 503 to our tool sandbox. GPO's annual CFR codification (CFR-2024) is the same regulatory text as a fixed-vintage snapshot — appropriate for audit-trail purposes here and not affected by the eCFR availability issue.
- **Tertiary cross-check:** Cornell LII (law.cornell.edu/cfr/text/...) was the source of the initial citation pull. Cross-checked against GPO verbatim — text matches for every passage we depend on. Cornell stays cited in the evidence block as a redundant third source, not as the primary authority.
- **OBBBA-era amendments:** the v0.6 fixture's `D07` profile and our engine's immigration gate cite OBBBA §10108 for the post-2025-07-04 refugee removal. That statutory change postdates the CFR-2024 codification we draw from. The CFR text above governs the underlying mixed-status proration / HH-treatment math; the OBBBA statutory change is independently sourced from the FNS implementing memo dated 2025-10-31 (already cited inline in `packages/snap-rules/src/gates/immigration.ts:46-52`).

## Open questions

- **eCFR live re-verification:** when the GPO/eCFR site is reachable from the sandbox (or by a human reviewer in a browser), re-spot-check §273.11(n) and §273.10(e)(2)(ii)(A) against the live amended text for any post-CFR-2024 revisions. This finding is robust to amendments that don't reverse the cited rules; if a future amendment changes the two-method rounding rule or the individual-disqualification scope of (n), the issues would need re-audit.
