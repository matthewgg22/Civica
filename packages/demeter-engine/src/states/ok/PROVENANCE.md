# Oklahoma pack — provenance

**Created:** 2026-08-12. Oklahoma is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, and Kentucky's prior builds, Oklahoma has
NO existing `packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted; this pack's
findings stand entirely on its own primary-source research. This task's scope was CORPUS ONLY —
the Demeter chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the standing
rule (`feedback_dashboard_snap_rules_parked`).

Oklahoma was the last state in this roster's "individual tier" (population above ~4M) before the
remaining states move to a batched, parallel build — this pack was built with extra care to keep
the established quality bar clean before that pace shift.

## Method

Direct `curl` fetch (browser User-Agent) of two OKDHS official dollar-figure appendices —
Appendix C-3 ("Maximum Food Benefit Allotments and Standards for Income and Deductions", effective
10/1/2025, current FFY2026 figures) and Appendix C-1 ("Maximum Income, Resource, and Payment
Standards", effective 7/1/2026) — both clean HTTP 200, converted with `pdftotext -layout`. Also
directly fetched: the Oklahoma Legislature's own official compiled Title 56 (Poor Persons) statute
PDF (`oklegislature.gov/OK_Statutes/CompleteTitles/os56.pdf`, clean HTTP 200, amendments through
Laws 2024), read in full for §§ 241-241.5 and cross-referenced against §§ 230.50-230.75. When
OKDHS's own HTML policy-library host returned HTTP 403 to direct curl, individual Oklahoma
Administrative Code (OAC) 340:50 sections were instead read via the Cornell Legal Information
Institute's regulatory mirror (`law.cornell.edu/regulations/oklahoma/...`), which republishes
OKDHS's own section text together with its official revision/effective dates. USDA FNA's current
Restaurant Meals Program state list was fetched directly. WebSearch cross-checks located two
independently-converging secondary sources for Oklahoma's 1997 drug-felony opt-out, cross-checked
against OAC 340:50's own current disqualification-category list.

## Finding 0 — a genuine, disclosed access barrier on OKDHS's own primary policy-library host,
resolved via a faithful regulatory mirror, not a fabricated citation

`oklahoma.gov/okdhs/library/policy/current/oac-340/chapter-50.html` and its individual-section
children returned a clean HTTP 403 to direct curl with a browser User-Agent on every attempt — a
genuine access barrier for Oklahoma's PRIMARY administrative-code publisher. This pack resolved it
by reading the same OAC 340:50 section text via the Cornell Legal Information Institute's
regulatory mirror instead, which republishes OKDHS's own official revision/effective dates
alongside the section text — a faithful independent mirror, not a silent substitution or a
fabricated quote. `regulations.justia.com` also 403'd on direct fetch, consistent with this
roster's now-familiar Justia-block pattern (documented previously for Louisiana, Virginia, Indiana,
Missouri, Maryland, Colorado, South Carolina, Alabama, and Kentucky). By contrast, OKDHS's own
dollar-figure appendix PDFs (Appendix C-1, C-3) and the Oklahoma Legislature's own compiled Title
56 statute PDF both returned clean HTTP 200 with no barrier at all.

## Finding 1 (flagship, structural) — Oklahoma is STATUTORILY BARRED from ever requesting an
ABAWD work-requirement waiver, a legislative self-restriction since 2013

56 O.S. § 241.3(C), added by Laws 2013, c. 178, § 1, effective September 1, 2013, states in full:
"Beginning October 1, 2013, the Department of Human Services shall not request a waiver to provide
Supplemental Nutrition Assistance Program services to able-bodied adults without dependents." This
is a genuine legislative self-restriction, independently found by this pack while reading Oklahoma's
own Title 56 statute text directly (not inferred from a search-result snippet) — OKDHS is barred by
Oklahoma state law from ever requesting an area-based ABAWD waiver, regardless of local unemployment
conditions. This independently and structurally explains why this pack found no current or
historical Oklahoma ABAWD area waiver anywhere: it is not that Oklahoma's counties have failed to
qualify under the federal 10%-unemployment threshold (a condition that could change with local
economic conditions, as it periodically has for this roster's Kentucky and other states' narrow
county waivers) — it is that Oklahoma's own legislature has forbidden the state agency from even
asking. This is a genuinely different and more permanent structural fact than every other state this
roster has built so far, and stands out clearly as the flagship finding for this pack.

## Finding 2 (flagship, time-sensitive) — Oklahoma's own three primary sources state THREE
different, all-stale ABAWD age ranges — none matches the true current federal standard (18-64)

Going into this build, no specific age-range assumption was stated in the task brief, but this pack
found a striking three-way internal inconsistency worth surfacing on its own terms. Oklahoma's 1997
statute, 56 O.S. § 241.3(A), still states: "all able-bodied recipients eighteen (18) years of age to
fifty (50) years of age... may receive food stamps for only three (3) months" — the pre-2023 federal
age band, never amended since the statute's last substantive change in 2013. Oklahoma's
administrative regulation, OAC 340:50-5-100 (last amended August 15, 2024, per the Oklahoma
Register, Volume 41, Issue 23), instead reflects the 2023 federal Fiscal Responsibility Act's own
incremental phase-in table — exempt at "50 years of age and older before September 1, 2023," then
51, then 53, then finally "55 years of age or older on or after October 1, 2024" (i.e., subject
through age 54). And OKDHS's OWN current consumer-facing SNAP page states, in the plainest possible
consumer language: "Meet work requirements (unemployed adults, ages 18 to 53)" — a THIRD figure,
directly fetched and confirmed verbatim, matching NEITHER the statute's 50 nor the regulation's 54.
None of Oklahoma's three own sources reflect the TRUE current federal standard: the One Big
Beautiful Bill Act (OBBBA), signed July 4, 2025, raised the ABAWD age ceiling to 64 effective
IMMEDIATELY upon enactment (narrowing the caregiver exemption from under-18 to under-14 children),
with states directed to complete phase-in by no later than June 2026 — nearly two months before this
pack's own August 12, 2026 fetch date. This pack treats OBBBA's 18-64 standard as the operative
federal floor regardless of which of Oklahoma's three stale figures a reader might encounter, and
discloses all three explicitly (see `freshness.json`) rather than picking one silently or assuming
Oklahoma's own sources are self-consistent when this pack directly confirmed they are not.

## Finding 3 — Oklahoma's drug-felony SNAP ban: a FULL opt-out (1997), confirmed via disclosed
convergent secondary corroboration, since the specific enabling session-law sections could not be
independently located as standing, currently-numbered Title 56 law

Oklahoma is among the minority of states that FULLY opted out of the federal drug-felony SNAP ban
(21 U.S.C. § 862a(a)(2)), and did so unusually early — as part of the same 1997 omnibus
welfare-reform act, H.B. 2170 (1997 Okla. Sess. Laws ch. 414), that created most of Oklahoma's
modern TANF/SNAP statutory framework. This pack found TWO independent secondary sources converging
on the IDENTICAL citation: the Collateral Consequences Resource Center's 50-state drug-conviction
survey cites "1997 Okla. Sess. Laws 414 § 28"; the Prison Policy Initiative's February 2026
SNAP-and-probation analysis independently cites "1997 Okla. Sess. Law Serv. Ch. 414 (H.B. 2170) §§
28, 31" for the identical Oklahoma total-opt-out conclusion, and separately confirms Oklahoma's own
SNAP application does not ask about probation violations. **Disclosed, not concealed:** this pack
could NOT independently locate §§ 28 or 31 as standalone, currently-numbered Title 56 sections in
the Oklahoma Legislature's own current compiled statute text — other sections of the identical 1997
chapter ARE independently locatable and codified today (§ 21 → 56-241.1; § 23 → 56-241.3; §§ 24-26 →
56-230.71 through 56-230.73), but §§ 28 and 31 are not, suggesting they were likely uncodified,
session-only provisions of the omnibus act rather than freestanding sections that persist as
separately citable law today. This pack cross-checked the full-opt-out conclusion against OAC
340:50's own CURRENT disqualification-category provisions (read via the Cornell LII mirror, per
Finding 0): fleeing felon, intentional program violation, work-registration noncompliance,
substantial lottery/gambling winnings, and certain post-February-2014 violent-crime convictions
(7 CFR 273.11(r) boilerplate) — NONE of these current categories mention a drug-felony conviction at
all, independently corroborating the full-opt-out reading. This pack treats the convergent secondary
corroboration plus the current regulation's own silence as sufficient confirmation, consistent with
this roster's established practice (see Louisiana's Justia-403 resolution) of disclosing an access
gap and resolving it via convergent, independent secondary sourcing rather than fabricating a direct
primary-source quote this pack could not actually obtain.

## Finding 4 — Oklahoma's categorical-eligibility (BBCE-equivalent) pathway removes the income test
entirely and states NO percentage-of-FPL ceiling for its "2-1-1 Oklahoma" track — a genuine
structural departure from this roster's other BBCE packs

OAC 340:50-11-111(b) makes a household categorically eligible when all members receive or are
authorized to receive TANF cash assistance, a combination of SSI and TANF, SSI alone, OR services
through "2-1-1 Oklahoma" (a TANF-MOE-funded information/referral service, with certain exclusions).
Subsection (d) states plainly that a categorically eligible household does "not have to meet either
the gross or net income eligibility standards of SNAP." This pack read this section (via the Cornell
LII mirror, per Finding 0) specifically looking for the percentage-of-FPL ceiling this roster's other
BBCE-equivalent packs generally document (Kentucky's dual-track 130%/200%, Louisiana's flat 200%,
Alabama's dual-track 130%/200%) and found NONE stated anywhere in Oklahoma's own SNAP manual for the
2-1-1 Oklahoma pathway. This is a genuine, checked-for structural departure, not an unexamined gap:
this pack does not assert Oklahoma's BBCE-equivalent track has literally no income ceiling
whatsoever — the actual gate, if any, most likely sits upstream in 2-1-1 Oklahoma's own
TANF-MOE-funded service-eligibility determination, a nonprofit referral service outside OKDHS's own
SNAP manual and this pack's primary-source access — but discloses plainly that OKDHS's own SNAP
regulation does not publish one, a genuinely different shape from every other BBCE pack this roster
has built so far.

## Finding 5 — Oklahoma's EBT card has a distinctive, directly-confirmed name: the ACCESS Oklahoma
Card

Unlike this roster's Kentucky finding (no distinctive EBT card name; an early, unverified
"Kentucky Purchase EBT Card" claim was explicitly rejected), this pack confirms Oklahoma's EBT card
DOES carry a distinctive branded name. OKDHS's own EBT Resource Center page (fetched directly, clean
HTTP 200) states plainly: "Oklahoma Human Services issues SNAP food benefits on a plastic card
called the ACCESS Oklahoma Card, also referred to as an EBT card." This is a direct primary-source
confirmation, not a secondary-source guess this pack chose to trust uncritically — the same standard
of verification this roster's Kentucky pack applied when it rejected an unverified card-name claim.

## Finding 6 — Oklahoma's agency rebrand ("Oklahoma Human Services") has not fully propagated to
its own statute and regulation text

The administering agency, historically "Oklahoma Department of Human Services," was rebranded
"Oklahoma Human Services" under Gov. Kevin Stitt. OKDHS's own current Appendix C-1 document
(effective 7/1/2026) already uses the new name. This pack found the rebrand has NOT propagated
everywhere within Oklahoma's own primary sources: both the current SNAP statute (56 O.S. § 241 et
seq.) and the Administrative Code (OAC 340:50, including 340:50-11-111's own text, read via the
Cornell LII mirror) still refer throughout to the "Department of Human Services (DHS)." A smaller-
scope but structurally similar finding to this roster's Kentucky (benefind→kynect rebrand lag) and
Louisiana (DCFS→LDH, a full agency transfer rather than a same-agency rebrand) findings.

## Finding 7 — Oklahoma's expedited-service standard is the plain federal 7 calendar days —
Oklahoma does NOT accelerate it the way Kentucky does

OAC 340:50-11-1 and 340:50-11-5 (read via the Cornell LII mirror) confirm Oklahoma's expedited
SNAP processing standard is exactly the federal 7-calendar-day ceiling, with no state-specific
acceleration. This is a genuine, checked-for CONTRAST worth stating plainly against this roster's
Kentucky pack, whose own internal processing standard (5 calendar days) exceeds the federal floor —
this pack does not assume Oklahoma mirrors Kentucky's acceleration and confirms it does not.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Oklahoma has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Oklahoma (out of scope for this task, requiring
its own separate, explicit go-ahead per the standing park rule) should treat this pack's citations
as a starting point, not a final answer, and should specifically re-verify the statutory ABAWD-
waiver-request ban's continued force (Finding 1, the most legally consequential fact in this pack),
the drug-felony opt-out's specific session-law text if it can be independently located (Finding 3),
and whether OKDHS's own consumer SNAP page has since corrected its stale ABAWD age figure (Finding
2) before hardcoding Oklahoma's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Oklahoma source text, checking
specifically for: claims inferred from a search-result summary rather than a direct primary-source
read; dollar figures not traceable to a specific dated source; and any Oklahoma-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- The ABAWD-waiver-ban finding (Finding 1) does not merely assert Oklahoma "currently has no
  waiver" — it is grounded in this pack directly reading 56 O.S. § 241.3(C)'s own statutory text
  (fetched via the Oklahoma Legislature's own compiled PDF, not inferred from a search snippet),
  which explains WHY no waiver exists in a way a simple "no waiver this quarter" fact would not.
- The three-way ABAWD age-range finding (Finding 2) does not merely restate one stale figure — it
  independently fetched and quoted all three Oklahoma sources verbatim (the statute, the
  regulation via Cornell LII, and the consumer page via direct curl) before concluding they
  disagree with each other AND with the true current federal standard, rather than assuming any
  single Oklahoma source was authoritative without checking the others.
- The drug-felony finding (Finding 3) does not claim a direct statute read of §§ 28/31 that this
  pack did not actually perform — it explicitly discloses the discoverability gap and states the
  conclusion rests on convergent secondary corroboration plus the current regulation's own
  silence, the same evidentiary standard this roster's Louisiana pack applied to its own
  Justia-403 statute.
- The BBCE/categorical-eligibility finding (Finding 4) does not claim Oklahoma's 2-1-1 pathway has
  literally zero income gate anywhere in the eligibility chain — it states precisely that OKDHS's
  OWN SNAP manual does not publish one, while disclosing that 2-1-1 Oklahoma's own upstream
  service-eligibility determination was outside this pack's primary-source access.
- The EBT-card-name finding (Finding 5) is grounded in a DIRECT OKDHS-hosted primary source (the
  EBT Resource Center page), not a secondary aggregator, avoiding the exact failure mode this
  roster's Kentucky pack caught and self-corrected (a fabricated card name from an AI-summarized
  search result).
- Initial research surfaced a claim that Oklahoma's BBCE "removes the asset test but does not
  raise the income limit above 130% FPL" from a third-party SNAP-eligibility aggregator. This pack
  did NOT repeat that claim as-is without independent verification — it instead read OAC
  340:50-11-111 directly (via the Cornell LII mirror) and found the more precise and more
  consequential underlying fact: Oklahoma's SNAP manual removes BOTH the gross AND net income
  tests entirely for categorically eligible households, not merely the asset test, with no stated
  percentage ceiling at all — a materially different and more specific finding than the
  aggregator's summary, corrected before being written into this pack (see Finding 4).
- The vehicle-resource-exclusion question was deliberately left UNASSERTED (see freshness.json)
  rather than assumed to match Kentucky's and Alabama's blanket exclusion, because this pack could
  only obtain secondary summaries of OAC 340:50-7-1/7-6, not a full verbatim read — a disclosed
  gap rather than a guessed contrast.

## Sources

| Source | Access | Dated |
|---|---|---|
| OKDHS, Appendix C-3, Maximum Food Benefit Allotments and Standards for Income and Deductions | direct curl fetch (browser UA) | effective 10/1/2025, FFY2026 figures |
| OKDHS, Appendix C-1, Maximum Income, Resource, and Payment Standards | direct curl fetch (browser UA) | effective 7/1/2026 |
| Oklahoma Legislature, Oklahoma Statutes Title 56 (Poor Persons), official compiled PDF | direct curl fetch (browser UA) | amendments through Laws 2024 |
| Cornell LII, OAC 340:50-11-111, 340:50-7-31, 340:50-5-100, 340:50-9-1/9-6, 340:50-11-1/11-5, 340:50-3-1 | accessed after oklahoma.gov's own policy-library host 403'd | republishes OKDHS's own revision/effective dates |
| OKDHS, SNAP consumer page (oklahoma.gov/okdhs/services/snap.html) | direct curl fetch (browser UA) | fetched 2026-08-12; "ages 18 to 53" ABAWD text found stale — see Finding 2 |
| OKDHS, EBT Resource Center (oklahoma.gov/okdhs/ebt.html) | direct fetch | confirms "ACCESS Oklahoma Card" |
| USDA FNA, SNAP Restaurant Meals Program state list | direct curl fetch (browser UA) | Oklahoma absent |
| Collateral Consequences Resource Center, national SNAP/TANF drug-felony survey | WebFetch | cites 1997 Okla. Sess. Laws ch. 414 § 28 |
| Prison Policy Initiative, "Hunger as punishment" (Feb. 2026) | WebFetch | independently cites 1997 Okla. Sess. Law Serv. ch. 414 §§ 28, 31 |
| USDA FNA, Food Distribution Program on Indian Reservations | WebSearch/WebFetch | confirms FDPIR/SNAP mutual exclusivity, general federal rule |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (OK guide questions), `eval/answer-eval.ts` (OK_GOLD, spread
into ALL_GOLD). Oklahoma is deliberately NOT added to any `engine-citations.ts` per-state constant
map — Oklahoma has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("OK", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds an Oklahoma policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, and Kentucky's corpus packs in this same
roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Oklahoma `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.
