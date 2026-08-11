# Illinois pack — provenance

**Created:** 2026-08-11 (Wave 2 continued — `docs/plans/mae-state-corpus-framework.md`; taken as the 7th
state because it's confirmed live over plain curl and closes the same "engine math exists, corpus pack
doesn't" gap that Florida, Ohio, and Pennsylvania also have from the #619 Tranche-1 pass).
**Method:** direct fetch of ~55 IDHS Policy Manual (PM) / Workers' Action Guide (WAG) pages + 3 Manual
Release/Policy Memo bulletins from `dhs.state.il.us` (stable `page.aspx?item=N` URLs, plain curl, no
headless browser or Wayback fallback needed), cross-checked against the already-primary-sourced #619
engine constants (SUA, drug-felony citation) and the authoritative USDA FNS FY26 COLA memo, then
adversarially fact-checked before PR.

## Why Illinois matters to the schema

- **A genuine two-tier BBCE state, structurally different from Texas.** TX raises the whole household's
  screen to 165% + adds an asset test. Illinois keeps a PLAIN 165% screen for most households but raises
  it to 200% specifically for households with an elderly/disabled "Qualifying Member" — closer to Georgia's
  asymmetric elderly/disabled treatment than to TX's uniform-raise model, but on top of an already-elevated
  base rate neither GA nor TX has. `bbce_threshold_pct: 165` in the current engine constant captures only
  half the picture; the pack documents both tiers with real numbers.
- **A four-tier SUA ladder with a genuinely undermodeled tier.** Air Conditioning/Heating ($546), Limited
  ($457), Single ($78 — no slot in `{HCSUA, LUA, phone}`), Telephone ($67) — the same undermodeled-4th-tier
  pattern Ohio's Single SUA and Georgia's LSUA already established, now with its own dollar value and name.
- **Child support as an income EXCLUSION, not a deduction** — genuinely different mechanics from Georgia's
  and Michigan's DEDUCTION treatment of the same federal authority, worth cross-referencing.
- **A real production bug found and fixed along the way, twice.** Sourcing this pack surfaced two stale
  `packages/snap-rules` engine constants — see "Findings a maintainer must know" below. Both are logged as
  issues; one (#701) is fixed and merged (PR #702) with your go-ahead this session, the other (#704) is
  filed and open, pending a separate go-ahead.

## Sources

| Source | Access | Dated |
|---|---|---|
| IDHS Cash, SNAP, and Medical Manual — Policy Manual (PM) chapters 02, 03, 05, 06, 07, 13, 17, 19, 21 + paired Workers' Action Guide (WAG) sections | plain curl — `page.aspx?item=N`, static Antora-style site | per-section TOC listing carries a revision date + MR number (some sections stale, see findings below) |
| MR #25.33, "October 2025 SNAP Adjustments due to COLA..." | plain curl | 09/26/2025, eff. Oct 2025 issuances |
| IDHS Policy Memo, "End of Waiver for Time-Limited SNAP Benefits..." | plain curl | 10/16/2025 |
| MR #25.26, "Restaurant Meals Program" | plain curl | 07/15/2025 |
| 305 ILCS 5/1-10(c) | reused from the #619 engine pass, verified against ilga.gov there — not re-fetched this session | current statute |
| USDA FNS FY26 SNAP COLA memo | fetched to resolve the standard-deduction discrepancy below | Aug 2025, eff. 10/1/2025 |

## Findings a maintainer must know

1. **`packages/snap-rules`'s `IL.abawd_waiver_avail` was stale — FIXED this session.** Illinois' statewide
   ABAWD waiver ended in November 2025 (IDHS Policy Memo, 10/16/2025); the engine constant still said
   `true` (a documented fail-open default from #619 that this pack sourced). Filed as issue #701, fixed
   in [PR #702](https://github.com/matthewgg22/Civica/pull/702) with the operator's go-ahead this session —
   the constant, the regression test, and the affected oracle profile (`M12-abawd-in-a-waived-area`, IL
   entry) all moved together. Verified `/profile-simulation --state IL` at 129/0/0 after.
2. **`packages/snap-rules`'s `IL.rmp_operated` is ALSO stale — filed, NOT fixed this session.** Illinois'
   Restaurant Meals Program became permanent and statewide-by-eligibility in July 2025 (MR #25.26); the
   engine constant still says `false` on the outdated "Cook/Franklin counties only" pilot-era reasoning.
   Filed as issue #704 — lower urgency than #701 (under-claiming a convenience program, not misstating
   core eligibility/benefit math), left for a separate go-ahead rather than bundled into this session's
   engine touches.
3. **A discrepancy in Illinois' OWN current bulletin, not just a stale page.** MR #25.33 (07/15/2025) —
   the CURRENT, in-cycle COLA bulletin — prints the standard deduction as $205/$219/$257/$295. The
   authoritative USDA FNS FY26 COLA memo prints $209/$223/$261/$299 for the 48 states + DC, which is what
   `packages/snap-rules`'s shared `federal-tables.ts` already uses (unaffected by anything IL-specific,
   since standard deduction isn't a per-state field). This is NOT the usual "stale page" pattern (though
   IL also has one of those — see #4): MR #25.33 is dated to the SAME October 2025 cycle as the federal
   memo and still disagrees with it by $4 across every household size. The pack's `income-pathways` and
   `sua-values` supplements do NOT quote the $205 figure — they defer to the federal number and flag the
   discrepancy in `freshness.json` rather than silently picking one. No root cause identified (a bulletin
   typo vs. a genuine, undocumented state election is equally plausible from what this pass could verify);
   flagged for whoever revisits this at the FY27 cycle.
4. **A second, more ordinary stale-page trap: PM/WAG 13-01-04 (Standard Deduction) hasn't been revised
   since 06/13/11 (MR 11.13)** — fifteen years — and still shows the SAME wrong $205/$219/$257/$295 figures
   as MR #25.33 (finding #3), which at least explains where MR #25.33's number likely came from: it was
   probably copied forward from this already-stale manual page rather than freshly computed from the FY26
   federal memo. Same genre as Michigan's §3415 and Georgia's §3415-equivalent stale sections — the
   difference here is the staleness propagated INTO a current-cycle bulletin instead of just sitting
   unnoticed in an old page.
5. **Cross-state contrasts now live:** child support is an income EXCLUSION here (GA/MI: deduction);
   Standard Medical Deduction is a flat two-tier amount ($185/$485 for Group Homes) rather than GA's flat
   single tier ($161) or MI's actual-expense-minus-$35 (no flat standard at all); the ABAWD clock
   (1/1/24–12/31/26) doesn't align with GA's (12/1/23–11/30/26), WA's (1/1/24–12/31/26 — coincidentally
   IDENTICAL start/end to IL, confirmed by direct comparison, not assumed), or MI's (1/1/25–12/31/27),
   reconfirming the framework's #5 rule that ABAWD clocks never share logic across states even when two
   happen to land on the same dates by chance.
6. **RMP eligibility criteria (elderly 60+, disabled, homeless) match Michigan's almost exactly** — a
   third state independently landing on the same eligible-population definition as the federal RMP
   authorizing statute, not evidence of copying between states.

## Refresh triggers

- **Oct 2026 COLA** → successor to MR #25.33 (income standards, standard deduction, SUA, shelter cap,
  homeless deduction, asset limits, min/max benefits) — freshness entry. Re-check whether the
  standard-deduction discrepancy (finding #3) persists or self-corrects.
- **Dec 31, 2026** → fixed ABAWD 3-year window rolls; new window Jan 1, 2027 — freshness entry.
- **Waiver status** → re-verify against the FNS quarterly ABAWD waiver file or a newer IDHS Manual Release;
  this pack found no evidence of any post-November-2025 county-level waiver, but did not exhaustively rule
  one out either.
- **RMP restaurant density** → if/when IDHS publishes a current participating-restaurant count or map,
  worth adding as a Tier-C navigation fact.
- New MRs touching PM/WAG 03-16 (work requirement), 05-07 (categorical eligibility), 06-32 (RMP), or
  13-01 (income/deductions/shelter) → update the affected supplement.

## Verification log

- **Draft-time source discipline:** every dollar figure traces to its own PM/WAG page or Manual
  Release/Policy Memo bulletin (never a curated secondary extract). The one exception — 305 ILCS
  5/1-10(c) — is explicitly marked as REUSED from the already-verified #619 engine pass rather than
  re-fetched, and is labeled as such in `authorities.json` and the `criminal-justice-disqualifications`
  supplement.
- **Two real production bugs found while cross-checking against `packages/snap-rules`**, not merely
  corpus-text issues: #701 (ABAWD waiver, fixed same session) and #704 (RMP scope, filed and open). Both
  are logged above with full citation trails.
- **Self-conducted adversarial refute pass (2026-08-11, no Agent/Workflow spawned — this session's tools
  didn't authorize one):** re-read every claim in `supplements.json` against the originally fetched PM/WAG
  text before committing. 4 corrections found and applied:
  1. **`abawd-work-requirement` fabricated a false "(up from 60...)" claim.** First draft implied OBBBA
     raised Illinois' ABAWD exemption age from 60 to 65. The "60" actually belongs to a SEPARATE, still-
     current Work PROVISIONS exemption (PM 03-15-02) the source explicitly says is unaffected — a
     different rule entirely, not a prior value of the Work Requirement threshold. Corrected to state the
     two rules are distinct rather than implying a change that never happened.
  2. **`abawd-work-requirement` fabricated a false "(raised from 13)" claim.** First draft implied the
     dependent-child exemption age moved from 13 to 14. The source states the SAME threshold two ways in
     two different passages ('age 13 or younger' and 'under age 14') — not two different values. Corrected
     to note they're equivalent, not a change.
  3. **`expedited-service` invented a rule not in the actual source text.** First draft claimed a household
     is 'entitled to expedited service only once without meeting the standard eligibility criteria in full
     first,' inferred from PM 02-08-06's TITLE ('Limits on Receipt of Expedited Service') without having
     fetched its body text. Fetched it: the real rule is about REDETERMINATION TIMING (a household filing
     a timely REDE, or filing in the last half of its approval period, doesn't qualify for expedited
     service on that filing; one filed AFTER the approval period ended still can) — a completely different
     rule from what was drafted. Corrected to the verified text.
  4. **`reporting-certification` asserted an unverified income-reporting trigger amount.** First draft said
     SR households report 'when income crosses the reporting threshold' without having fetched the section
     that defines that threshold — MR #25.33 mentions a '$125 Income Reporting Requirement' in passing, but
     this pack never fetched PM 19-07-06 to confirm what that figure actually gates. Corrected to state
     only the two triggers independently verified elsewhere (lottery winnings, ABAWD hours) and explicitly
     flag the income-change trigger as unconfirmed rather than asserting a number.
  No fabricated citations were found — all four corrections were either invented mechanisms not actually
  in the cited section, or claims drawing an inference the source text doesn't support, not wrong page
  references. Structural tests, the retrieval-recall probe, and the frontdoor eval were re-run clean after
  each fix (see the PR description for the final numbers).
