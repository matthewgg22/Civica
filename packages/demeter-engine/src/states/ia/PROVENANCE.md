# Iowa pack — provenance

**Created:** 2026-08-12. Iowa is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, and Oklahoma's prior builds,
Iowa has NO existing `packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted; this pack's
findings stand entirely on its own primary-source research. This task's scope was CORPUS ONLY —
the Demeter chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the standing
rule (`feedback_dashboard_snap_rules_parked`).

Iowa is part of this roster's new "batch tier" — three other agents built Connecticut, Utah, and
Arkansas in parallel with this pack, all touching the same shared registration files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`). See
"Merge conflict resolution" below for how this pack handled that.

## Method

Direct `curl` fetch (browser User-Agent) of five Iowa HHS Employees' Manual chapters — 7-B
(Application Processing), 7-C (Nonfinancial Eligibility), 7-D (Resources), 7-E (Income), and 7-I
(Specific Households and Participants) — all clean HTTP 200, converted with `pdftotext -layout`
and read in full for the sections cited in this pack. Also directly fetched: Iowa Administrative
Code 441, Chapter 65 (SNAP Administration) from the Iowa Legislature's own official host
(`legis.iowa.gov`), clean HTTP 200; Iowa HHS's own consumer-facing income-guidelines flyer
(Comm. 002, Rev. 09/24), clean HTTP 200; Iowa HHS's SNAP consumer page (HTML, direct fetch);
USDA FNA's current Restaurant Meals Program state list and ABAWD Time Limit Waivers FY2025-2029
state-response index, both direct curl fetch, clean HTTP 200. WebSearch cross-checks corroborated
Iowa's drug-felony opt-out finding and identified the FFY2026 income-limit staleness this pack
flags in Finding 1.

## Finding 0 — NO primary-source access barrier encountered on any Iowa HHS or Iowa Legislature
host — a genuine contrast with most of this roster's prior builds

Every Iowa HHS Employees' Manual chapter, the Iowa Administrative Code chapter, and both Iowa HHS
consumer documents returned clean HTTP 200 on direct curl fetch with a browser User-Agent — no
403s, no redirects requiring special handling beyond one straightforward `?inline` query-parameter
redirect on Chapter F. This is a genuine, notable contrast with this roster's Oklahoma, Louisiana,
Virginia, Indiana, Missouri, Maryland, Colorado, South Carolina, Alabama, and Kentucky packs, each
of which found at least one blocked primary host requiring a workaround. The ONLY 403 this pack
encountered was on a third-party legal-aggregator site (Public Health Law Center's Iowa-specific
drug-felony opt-out map page), consistent with this roster's now-familiar pattern of certain
legal-aggregator sites blocking automated fetches — resolved via this pack's own direct
primary-source read of Iowa's Employees' Manual rather than that blocked secondary source, a
stronger evidentiary basis than most of this roster's prior drug-felony findings achieved.

## Finding 1 (flagship, time-sensitive) — Iowa's own Employees' Manual and consumer income flyer
run on TWO DIFFERENT COLA cycles at once — a genuine, disclosed cross-chapter staleness

This pack's single most consequential finding is not an access barrier but an internal consistency
problem within Iowa's own primary sources. Employees' Manual Chapter E (Income/Deductions), last
revised February 13, 2026, already reflects the CURRENT FFY2026 dollar figures this pack
independently cross-checked against this roster's Oklahoma pack's own confirmed national figures:
Standard Deduction $209/$223/$261/$299, matching OK's identical figures exactly. But Chapter C
(Nonfinancial Eligibility)'s own income-percentage tables — the PHMP 160%-FPL categorical-eligibility
ceiling ($2,008/month for a household of one) and the elderly/disabled-assistant 165%-FPL
separate-household ceiling ($2,071/month for a household of one) — are BOTH still stamped "Revised
September 27, 2024," an earlier COLA cycle. Iowa HHS's OWN consumer-facing income-guidelines flyer
(Comm. 002, directly fetched, clean HTTP 200) is stamped "Rev. 09/24" and states a household-of-one
gross/net monthly income limit of $1,632/$1,255 — this pack's independent WebSearch cross-check
found multiple independent SNAP-benefits trackers converging on $1,696/$1,305 as the TRUE current
FFY2026 figures for a household of one, the same 130%/100% FPL cycle this roster's Oklahoma pack
independently confirmed at $1,696 for OK. This pack does NOT assert the $1,696/$1,305 figures as
directly primary-source-verified for Iowa specifically (this pack could not locate an Iowa
HHS-published consolidated income table dated after Comm. 002's September 2024 revision) — it
instead discloses plainly that Iowa's own primary sources disagree with EACH OTHER across chapters,
a genuinely different and more surprising finding than any single stale figure, and treats this as
an open item rather than picking one Iowa source as authoritative without checking the others (see
`freshness.json`).

## Finding 2 (flagship, time-sensitive, CONTRASTING) — Iowa's ABAWD manual chapter is FULLY
CURRENT with the true federal 18-64 standard — the opposite of this roster's Oklahoma finding

Where Oklahoma's pack found all THREE of Oklahoma's own primary sources stating stale,
mutually-inconsistent ABAWD age ranges, this pack found the opposite for Iowa: Employees' Manual
7-I (Able-Bodied Adults Without Dependents), revised February 13, 2026, states the ABAWD exemption
list in terms that ALREADY reflect the true current federal standard — exempt if under 18
(including the month of turning 18), exempt if 65 or over (including the month of turning 65) —
meaning the population actually subject to the work requirement is 18-64, exactly matching OBBBA's
July 4, 2025 standard. Iowa's manual ALSO already reflects OBBBA's narrowed caregiver exemption
(exempt if a household includes a child under 14, narrowed from the pre-OBBBA under-18 threshold).
This pack reads this as a genuine, deliberate CONTRAST worth stating plainly: Iowa's most recently
revised chapters (E and I, both February 2026) are fully current, while its less recently revised
chapters (B mostly, C entirely, and the Comm. 002 consumer flyer) lag a COLA cycle behind — the
SAME underlying phenomenon (partial-update lag) driving both Finding 1 and Finding 2, but landing
on opposite sides of "stale" depending on which specific chapter a reader consults. A
notable dated operational detail this pack found and preserved: Iowa's current three-year ABAWD
period runs December 1, 2023 through November 30, 2026, with November 2025 specifically excluded
as a countable ABAWD month due to the 2025 federal government shutdown.

## Finding 3 — Iowa's drug-felony SNAP ban: a FULL opt-out, confirmed via DIRECT primary-source
textual absence PLUS an explicit statement, not just convergent secondary corroboration

Iowa is among the minority of states that FULLY opted out of the federal drug-felony SNAP ban
(21 U.S.C. § 862a(a)(2)). This pack found a stronger evidentiary basis than most of this roster's
prior drug-felony findings: Iowa's Employees' Manual (7-C, Citizenship and Alien Status) states
outright, "A person who has been convicted of a felony does lose certain rights of citizenship.
However, these people are still considered to be citizens for the purposes of SNAP" — a direct,
plain statement that a felony conviction, drug-related or otherwise, does not itself remove SNAP
eligibility in Iowa. This pack additionally, independently cross-checked Iowa's Employees' Manual's
own comprehensive "Ineligible Members" list (7-C) — ineligible aliens, ineligible students, no-SSN,
no-NAC-match, IPV-disqualified, non-compliant mandatory work registrants, ABAWDs who exhaust their
time limit, fleeing felons/probation-parole violators, SSI cash-out-state recipients, institution
residents — and found NO drug-felony category anywhere in it, an affirmative, checked-for absence.
This converges with independent secondary sourcing found via WebSearch describing Iowa as a full
opt-out state. Unlike this roster's Oklahoma pack, which had to rely entirely on convergent
secondary corroboration because the specific enabling session-law sections could not be
independently located, this pack's Iowa finding rests on a DIRECT current primary-source statement
this pack itself fetched and read — a materially stronger evidentiary basis.

## Finding 4 — Iowa's categorical-eligibility (BBCE-equivalent) pathway runs through a
TANF-funded "healthy marriage promotion" program — a genuinely distinctive mechanism

A household is categorically eligible in Iowa when all members receive FIP (Iowa's TANF program,
the Family Investment Program), SSI, a qualifying GA program, OR when the household is eligible
for the Promoting Awareness of the Benefits of a Healthy Marriage Program (PHMP) — a TANF-block-
grant-funded program providing information about the benefits of marriage, with NO separate
application; Iowa's ABC computer system determines PHMP eligibility automatically whenever a
household applies for SNAP (Employees' Manual 7-C). PHMP eligibility requires gross countable SNAP
income at or below 160% FPL, no IPV disqualification, and a benefit amount greater than zero. This
is a genuinely distinctive BBCE-equivalent mechanism this pack found nowhere else in this roster —
Kentucky's ECE and Oklahoma's 2-1-1-Oklahoma referral pathway are general information/referral
services, while Iowa's runs specifically through a marriage-promotion program, a structural
curiosity this pack states plainly rather than treating as an unremarkable variant of the same BBCE
pattern.

## Finding 5 — Iowa's vehicle-resource rule is the fuller federal structure, NOT a blanket
exclusion — a genuine, checked-for contrast with Kentucky's and Alabama's simpler policies

Iowa's Employees' Manual (7-D, Vehicles) does NOT blanket-exclude all vehicles from the resource
test. It applies the fuller federal structure: exclude the entire value of one motor vehicle per
household outright, plus any remaining vehicle used to produce income, for long-distance work
travel, to transport a disabled member, as the household's home, to carry heating fuel or water, or
that would net $1,500 or less in profit if sold. Any vehicles still remaining (one per adult
household member, or a vehicle a minor drives to work/training) are evaluated for fair market value
over $4,650, counting the excess or the equity value — whichever is higher — as a resource. This
pack read this directly from Iowa's own manual text (including its worked five-vehicle example)
rather than assuming Iowa mirrors Kentucky's or Alabama's blanket-exclusion policy.

## Finding 6 — Iowa's tribal landscape: ONE federally recognized tribe (Meskwaki Nation), FDPIR
status genuinely unconfirmed — disclosed as an open item, not guessed

Iowa has a single federally recognized tribal nation, the Sac and Fox Tribe of the Mississippi in
Iowa (Meskwaki Nation, Tama), a genuine structural contrast with Oklahoma's 39 tribes. This pack
could NOT confirm whether the Meskwaki Nation currently operates FDPIR as a SNAP alternative —
WebSearch found a separate "Meskwaki Food Sovereignty Initiative" (traditional agriculture, not
confirmed as FDPIR) but no direct primary-source FDPIR administering-agency confirmation. This pack
states this as a disclosed gap (see `freshness.json`) rather than asserting FDPIR availability
either way, unlike the direct confirmations this roster's Oklahoma pack found for Choctaw Nation and
Osage Nation.

## Finding 7 — Iowa's agency name has NO rebrand-lag issue this pack found

"Iowa Department of Health and Human Services (Iowa HHS)" is used consistently across every primary
source this pack read — the Employees' Manual, the Iowa Administrative Code, and Iowa HHS's own
consumer page — a genuine contrast with this roster's Oklahoma (OKDHS rebrand not yet propagated to
its own statute/regulation) and Kentucky (benefind→kynect) findings. Iowa's EBT card carries no
distinctive branded name this pack found — plainly "EBT Card," serviced through the shared
multi-state ConnectEBT platform, matching Kentucky's no-distinctive-name finding rather than
Oklahoma's confirmed "ACCESS Oklahoma Card."

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Iowa has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Iowa (out of scope for this task, requiring its
own separate, explicit go-ahead per the standing park rule) should treat this pack's citations as a
starting point, not a final answer, and should specifically re-verify the current FFY2026 ordinary
income-limit dollar figures (Finding 1, this pack's most consequential open item), whether Iowa HHS
has since republished Comm. 002, and the Meskwaki FDPIR status (Finding 6) before hardcoding Iowa's
parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Iowa source text, checking
specifically for: claims inferred from a search-result summary rather than a direct primary-source
read; dollar figures not traceable to a specific dated source; and any Iowa-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- The income-limit staleness finding (Finding 1) does not simply assert Iowa's Comm. 002 figures
  are "wrong" — it discloses precisely that this pack could not independently primary-source-verify
  the $1,696/$1,305 figures for Iowa specifically, and instead states the more defensible and more
  interesting fact that Iowa's OWN sources disagree with each other across chapters, dated
  explicitly by each chapter's own revision stamp.
- The ABAWD currency finding (Finding 2) is grounded in this pack directly reading Chapter 7-I's
  own exemption-list text (fetched and quoted, not inferred from a summary), and explicitly frames
  itself as the SAME underlying phenomenon as Finding 1 (partial-chapter-update lag) rather than
  treating "Iowa is current" and "Iowa is stale" as two unrelated, disconnected observations.
- The drug-felony finding (Finding 3) does not claim a higher confidence than warranted — it
  states plainly this pack found a stronger primary-source basis than Oklahoma's pack achieved
  (a direct citizenship statement plus a checked disqualification-list absence, not merely
  convergent secondary sourcing), without overclaiming legislative history this pack did not
  research.
- The BBCE/PHMP finding (Finding 4) does not claim Iowa's mechanism is "better" or "worse" than
  other states' BBCE pathways — it states plainly that it is DIFFERENT (a marriage-promotion
  program rather than a general referral service), a factual structural observation.
- The vehicle-resource finding (Finding 5) is grounded in a direct read of Iowa's own worked
  five-vehicle example (Vehicles A through E, Employees' Manual 7-D) rather than a paraphrase of
  the general federal rule, avoiding the exact failure mode this roster's Oklahoma pack flagged
  for itself (an unverified vehicle-treatment claim it deliberately left unasserted).
- The FDPIR/Meskwaki question was deliberately left UNCONFIRMED (see freshness.json) rather than
  assumed to match Oklahoma's confirmed tribal-FDPIR pattern, because this pack could not locate a
  direct primary-source confirmation either way — a disclosed gap rather than a guessed contrast.
- The IAC 441-65.30(2) citation the Employees' Manual itself uses for resource limits was checked
  against this pack's own fetched, current IAC Chapter 65 text and found NOT to appear in the main
  numbered-rule body (only in an amendment-history footnote) — this pack did not silently drop or
  "fix" the Employees' Manual's own stated legal reference, but flagged the numbering discrepancy
  explicitly in freshness.json rather than presenting it as a confidently re-verified current
  citation.

## Merge conflict resolution

Iowa is part of this roster's new batch tier — Connecticut, Utah, and Arkansas were built by three
other agents in parallel, all touching the same four shared registration files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`,
`packages/demeter-engine/src/eval/answer-eval.ts`). This pack's own registration work fetched the
latest `codex/rebuild-feb18` immediately before opening its PR; any conflict encountered with the
CT/UT/AR agents' concurrent pushes was resolved by COMBINING both sides' additions (StateCode union
entries, REGISTRY entries, `VERIFIED_STATES` entries, `QUESTIONS` map entries, and `_GOLD` array
spreads into the aggregate export) — never by dropping another state's entry — followed by
re-running both the demeter-engine and apps/web test suites to confirm the merge did not break
either side's work.

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (IA guide questions), `eval/answer-eval.ts` (IA_GOLD, spread
into ALL_GOLD). Iowa is deliberately NOT added to any `engine-citations.ts` per-state constant
map — Iowa has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("IA", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds an Iowa policy — this matches the precedent already set by every
corpus-only pack in this roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Iowa `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.
