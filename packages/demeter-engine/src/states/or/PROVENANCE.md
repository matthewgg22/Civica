# Oregon pack — provenance

**Created:** 2026-08-11 (Wave 2 — `docs/plans/mae-state-corpus-framework.md` §7 picks Oregon specifically
because "OR teaches the expiring-temporary-rule freshness case for free": its Standard Utility Allowance
dollar figures live in OAR 461-160-0420, currently in force as a TEMPORARY rule (SSP 21-2026, effective
3/19/26 through 9/14/26) — a real near-term hard-expiration citation this pack was built to exercise, per
the user's explicit ask this session for state packs to surface dated facts a freshness checker can flag.).

**Method:** direct fetch of OAR Chapter 461 rule PDFs from `ch461rules.odhs.oregon.gov` (plain curl,
stable numeric filenames) via `pdftotext -layout`, reading the raw extracted text directly — NOT via an AI
web-fetch summarization tool. This distinction mattered in practice: see Finding 1 below.

## Why Oregon matters to the schema

- **A live-fire freshness case, not a hypothetical one.** OAR 461-160-0420 (SUA figures) is a temporary
  rule with a hard 9/14/26 expiration. More importantly, this pack independently found OAR 461-140-0265
  (Oregon's child-support income-exclusion rule) had ALREADY lapsed once — Oregon temp rules expire
  outright if not made permanent within 180 days, and this one wasn't. That's direct proof the risk this
  pack's freshness.json entries warn about is real, demonstrated Oregon behavior, not a worst-case guess.
- **A hybrid medical-deduction mechanism** (actual-expense-minus-$35, with a $170 FLOOR for any positive
  result under $170.01, uncapped above) — distinct from both this roster's flat-SMD states (GA/IL/MA) and
  its pure-actual-expense states (FL). No other state built so far combines a floor with an uncapped tail.
- **A document-conferral BBCE pathway** (the Information and Referral Services pamphlet) in the same family
  as Nevada's "This Is Your Copy" TANF page — reinforcing that this conferral-vehicle pattern recurs across
  unrelated states rather than being a one-off.
- **ABAWD exempt areas are named TRIBAL jurisdictions, not counties** — a genuinely different area-waiver
  shape from every other state in this roster, plus a SEPARATE county-level "discretionary exemption"
  mechanism (not a waiver) that this pack took care not to conflate with an area waiver.
- **A drug-felony treatment that is opt-out-with-an-exception**, not a clean full opt-out (IL, NV) or a
  modified ban (FL, AZ) — DHS retains a narrow, evidence-specific SUSPENSION path (trafficking conviction +
  active supervision + evidence of trading SNAP for drugs), a fourth distinct shape for this roster.

## Sources

| Source | Access | Dated |
|---|---|---|
| OAR 461-135-0505 (categorical eligibility / BBCE) | `pdftotext` of ch461rules.odhs.oregon.gov PDF | effective 4-08-25 (minor correction) |
| OAR 461-160-0015 (resource limits) | `pdftotext` of ch461rules.odhs.oregon.gov PDF | effective 10-01-24 |
| OAR 461-160-0420 (shelter cost / utility allowance) | `pdftotext` of ch461rules.odhs.oregon.gov PDF, current + full history PDF | TEMPORARY, effective 3/19/26-9/14/26 (SSP 21-2026) |
| OAR 461-160-0430 (income deductions) | `pdftotext` of ch461rules.odhs.oregon.gov PDF | effective 10-01-25 |
| OAR 461-140-0265 (child support exclusion) | `pdftotext` of ch461rules.odhs.oregon.gov PDF | EXPIRED — was effective 1/19/23, never made permanent |
| OAR 461-135-0520 (ABAWD) | `pdftotext` of ch461rules.odhs.oregon.gov PDF | effective 4-01-26 |
| OAR 461-135-0575 (expedited services) | oregon.public.law rendering | undated page, fetched 2026-08-11 |
| OAR 461-115-0450 (certification periods) | WebSearch-corroborated secondary summary + rule citation | effective 7-01-24 per search snippet, not independently pdftotext-verified this pass — see Finding 3 |
| ORS 411.119 (drug-felony treatment) | oregon.public.law rendering, cross-checked structurally against the statute's own subsection numbering | current statute |
| ODHS SNAP Restaurant Meals Program status page | WebFetch, oregon.gov | fetched 2026-08-11, "still in development," no target date given |
| USDA FNA Restaurant Meals Program state list | attempted, timed out this pass — see Finding 4 | not independently re-confirmed this pass |

## Findings a maintainer must know

1. **AI web-fetch summarization produced THREE wrong dollar figures for the same rule before this pack
   switched to raw `pdftotext` extraction.** Three separate WebFetch calls against OAR 461-160-0015
   (SNAP resource limits) returned three different, mutually inconsistent figure pairs ($4,500/$3,000,
   $3,500/$3,000, and $2,250/$3,500) — the AI summarizer was evidently confusing SNAP's own subsection
   (6) with adjacent OSIP/OSIPM/QMB program limits on the SAME rule page (subsections 2-4), or serving a
   stale cached rendering. The correct figures ($4,500 elderly/disabled, $3,000 standard) were only
   confirmed by downloading the raw PDF and reading `pdftotext -layout` output directly, subsection by
   subsection. This is a general methodology finding, not specific to one rule — every dollar figure in
   this pack was re-verified the same way after this was caught, and it is the reason this pack's
   `verification.method` field explicitly calls out pdftotext extraction over AI summarization.
2. **OAR 461-140-0265 (child support income exclusion) is EXPIRED, but the current deductions rule still
   cross-references it.** The rule's own text is bracketed and headed "THIS RULE IS EXPIRED (NOT PERMED
   BEFORE 180TH TEMP DAY)" — it was a temporary rule effective January 19, 2023, that lapsed because it
   was never made permanent within Oregon's 180-day window. Yet OAR 461-160-0430(1)(a)(B) (effective
   10-01-25, i.e. CURRENT) still says "an earned income deduction of 20 percent of the earned income
   excluded due to payment of court ordered child support (see OAR 461-140-0265)" — a live rule pointing
   at a dead one. This pack did NOT find a live successor rule establishing Oregon-specific child-support
   treatment (exclusion or deduction) outside that narrow earned-income cross-reference, and deliberately
   did NOT guess at one. The supplement instructs Mae to defer to the federal default (a deduction, 7 CFR
   273.9(d)(5)) rather than assert either an exclusion or a state-specific deduction mechanism for Oregon.
   This is exactly the kind of stale-cross-reference risk the freshness mechanism exists to catch, and it
   demonstrates Oregon's temp-rule-lapse risk is real, not hypothetical — directly motivating the framing
   of the `or-sua-temporary-rule-citation` freshness entry (Finding 3 below, and freshness.json).
3. **OAR 461-160-0420's TEMPORARY 9/14/26 citation may not change the SUA dollar figures at all.** The
   framework doc's original note ("SUA sits in a temporary rule expiring 9/14/26") reads as if the DOLLAR
   VALUE itself is temporary. This pack found the immediately-prior PERMANENT version of the same rule
   (effective 1/1/26, from ch461rules.odhs.oregon.gov's full rule-history PDF) carries the IDENTICAL four
   dollar figures ($515/$404/$65/$81) as the current temporary version — the temporary amendment's visible
   substantive content (section 6 of the rule) implements a homeless-individual vehicle-shelter-cost
   provision under section 10103 of the 2025 federal reconciliation law (Pub. L. 119-21), not a dollar
   change. The freshness.json warning is worded carefully to reflect this: what's confirmed to expire is
   the RULE CITATION, not necessarily the dollar figures — but given Finding 2 above (a real precedent of an
   Oregon temp rule lapsing outright), a maintainer should re-verify rather than assume continuity.
4. **Two sources were NOT independently re-verified this pass — disclosed, not silently assumed.**
   OAR 461-115-0450 (certification periods) was drafted from a WebSearch-summarized secondary source, not
   from a direct `pdftotext` pull of the rule PDF the way every dollar-bearing rule in this pack was — the
   content (12-month/6-month interim; 24-month elderly-disabled/12-month interim) is directionally
   consistent with the ODHS newsroom post that corroborated it, but given Finding 1's demonstrated failure
   mode for this exact fetch pattern, a maintainer should re-pull the raw PDF before treating this citation
   as fully load-bearing. Separately, a direct fetch of USDA FNA's Restaurant Meals Program state list
   timed out during this pass; Oregon's RMP-absence claim rests on ODHS's own status page (a first-party
   source, and a strong one) rather than the cross-check against USDA's list this roster's other RMP
   findings have used — the next state pack or a refresh pass should complete that cross-check.
5. **`packages/snap-rules` has no Oregon `StatePolicy` entry.** Consistent with NV and AZ (issues #719,
   #720) — this is a pre-existing authoring gap the corpus pack does not attempt to fix. No new issue filed
   this pass since the pattern (and the parked-package rule) is already tracked.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual `pdftotext` output captured during fetching,
not against my own summary of it, specifically checking for: (a) claims inferred from a section TITLE
rather than its body text, (b) any dollar figure not traceable to a specific numbered subsection, (c) any
state-vs-federal contrast overclaimed as settled when the evidence was genuinely ambiguous. Two corrections
made during this pass:

- The medical-deduction supplement's first draft described Oregon's mechanism as "a flat $170 Standard
  Medical Deduction" — checking the verbatim subsection (461-160-0430(1)(d)) against the draft showed this
  was wrong: $170 is a FLOOR for results in the $0.01-$170 range, not a flat replacement amount; results
  above $170 use the actual amount uncapped. Corrected to describe it as a hybrid before commit.
- The child-support supplement's first draft asserted Oregon "treats child support as a deduction" (the
  Georgia/Michigan/Florida shape) based on the earlier draft's assumption that 461-160-0430 contained a
  standalone child-support deduction subsection. Re-checking the actual `pdftotext` output of that rule
  found NO such subsection — only the narrow earned-income cross-reference to the now-expired 461-140-0265.
  Corrected to disclose the gap (Finding 2) rather than assert a specific mechanism.
