# New Mexico pack — provenance

**Created:** 2026-08-12. New Mexico is a genuine BLANK SLATE in this roster — like Connecticut's,
Utah's, Iowa's, and Arkansas's prior builds, New Mexico has NO existing `packages/snap-rules`
entry and NO oracle fixture coverage at all. No discrepancy-checking against an existing engine
constant was possible or attempted; this pack's findings stand entirely on its own primary-source
research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does
not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which
stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

New Mexico is part of a second BATCH TIER — built alongside Mississippi, Kansas, and Nebraska by
separate parallel agents in the same window; see the Registration section below for how the
resulting merge conflict on shared files was resolved.

## Method

Direct `curl` fetch (browser User-Agent) of the New Mexico Health Care Authority's (HCA) current
FFY2026 Income Eligibility Guidelines for SNAP & Financial Assistance PDF (`hca.nm.gov`, ISD 017,
revision date 9-30-2025), converted with `pdftotext -layout` — this pack's single most
load-bearing source, carrying the current 200% FPG BBCE column, current asset limits, and current
deduction figures in one dated table. Also directly curl-fetched NMAC 8.139.420 (Categorical
Eligibility), 8.139.510 (Resources and Property), and 8.139.520 (Income and Deductions) from
`srca.nm.gov` (the New Mexico State Records Center and Archives), and directly WebFetched several
HCA consumer/press pages (SNAP program overview, Keep Your Benefits NM!, two dated press releases,
the FDPIR page). The drug-felony opt-out statute (N.M. Stat. Ann. § 27-2B-11) could not be fetched
directly — resolved via two independently-fetched, textually-convergent secondary/quasi-primary
mirrors, disclosed explicitly (Finding 5).

## Finding 0 — a genuine, disclosed access barrier on ONE source only: New Mexico's own statute
host, not its regulation or agency hosts

Unlike this roster's Connecticut and Arkansas packs, which found live bot-detection blocks on
their PRIMARY dollar-figure sources, this pack found `hca.nm.gov` and `srca.nm.gov` returned clean
HTTP 200 to every direct curl attempt with a browser User-Agent — including the single most
consequential PDF (the FFY2026 Income Eligibility Guidelines). The one confirmed access barrier
was narrower and different in kind: `law.justia.com` 403'd on the drug-felony statute (the
now-familiar Justia pattern this roster has documented repeatedly), and `nmonesource.com` — New
Mexico's own official Compilation Commission statute database, tried specifically as a state-run
alternative to Justia — returned HTTP 404 on every URL pattern this pack attempted, a genuine
inability to locate the correct document path rather than a bot-detection challenge. This pack
resolved the gap via two independently-fetched, textually-identical mirrors rather than
fabricating statutory text (see Finding 5).

## Finding 1 (flagship, structural, precisely dated) — New Mexico's BBCE gross-income ceiling was
raised from 165% FPG to 200% FPG effective October 1, 2024 — this pack traced the stale 165%
figure some secondary sources repeat directly to a still-live, pre-rename HCA/HSD PDF

NMAC 8.139.420.8 (amended 3/1/2025) states plainly: broad-based categorical eligibility applies
when a household's gross income is "less than two hundred percent FPG." HCA's own September 23,
2024 press release dates the change precisely: "The gross income limit increased from 165% to 200%
of the federal poverty line... effective [October 1, 2024]," citing before/after examples ($4,290
vs. $5,200 monthly for a family of four). This pack found the LIKELY direct source of the stale
165% figure several secondary/calculator sites repeat: an Income Eligibility Guidelines PDF still
hosted live at `hsd.state.nm.us` (revision date 6-15-2023 — under the pre-rename HSD name) shows a
"165% FPG" categorical-eligibility column. HCA's current FFY2026 PDF (ISD 017, revision 9-30-2025)
confirms 200% FPG is now the live standard. This pack also flags a precise structural point often
blurred: broad-based CE in New Mexico waives RESOURCE verification, not the income tests — CE
households via broad-based CE must still meet BOTH the gross (200% FPG) and net (100% FPG) income
standards, unlike financial-assistance/SSI CE households, who skip both income tests entirely.

## Finding 2 — New Mexico's asset limits ($3,000 general / $4,500 elderly-disabled, FFY2026) are
explicitly published, but the practical asset test rarely applies because broad-based CE (up to
200% FPG) waives resource verification for nearly every household

HCA's own current PDF states these figures explicitly, matching the national FFY2026 elevated
standard this roster's Kentucky, Louisiana, Alabama, Missouri, Maryland, Colorado, Connecticut, and
Arkansas packs have each independently confirmed. This pack corrects an oversimplified secondary
claim that "New Mexico has no asset limit" — the dollar figures are real and operative for the
narrow set of households NOT categorically eligible (gross income at or above 200% FPG) — while
explaining precisely why the simplification arose: NMAC 8.139.420.8 exempts both financial-
assistance/SSI CE households and broad-based CE households from resource VERIFICATION, and because
nearly every household under 200% FPG qualifies for broad-based CE, most applicants never encounter
the asset test in practice even though it remains on the books. A separate, older secondary source
cites $2,250/$3,250 — this pack treats those as stale pre-FFY2026 figures, not current.

## Finding 3 (flagship, structural, refinement) — New Mexico's ABAWD waiver narrowed sharply on
January 1, 2026 but did NOT fully disappear — a partial waiver remains active in one county and
four pueblos

New Mexico previously held one of the broadest ABAWD waiver footprints nationally (29 counties, 18
reservations, through 12/31/2025). HCA's own current, directly-fetched Keep Your Benefits, NM!
page confirms statewide work rules took effect January 1, 2026 — but ALSO states plainly the rules
do "not apply in Luna County, Laguna Pueblo, San Felipe Pueblo, Taos Pueblo, or Tesuque Pueblo."
This pack flags this precisely because a reader encountering only the "statewide work rules took
effect Jan. 1, 2026" headline (accurate as far as it goes) could easily over-generalize to "no
waiver exists anywhere in New Mexico now" — which HCA's own page directly contradicts for five
specific jurisdictions, several of them tribal lands. HCA's exemption list separately includes a
standalone "member of a federally-recognized Native American tribe" category, distinct from the
geographic Pueblo waivers.

## Finding 4 — New Mexico's HSD-to-HCA agency rename (effective July 1, 2024) is inconsistently
reflected across the same regulation chapter's own hosted PDFs — a genuine, disclosed structural
quirk distinct from Connecticut's multi-program-manual finding

Unlike Connecticut's Uniform Policy Manual (shared across four programs), New Mexico's NMAC
Chapter 139 IS a dedicated, SNAP-only chapter — no structural departure on that dimension. But this
pack found a different, genuine quirk: sections re-published on `srca.nm.gov` with a post-2024
amendment (8.139.420, 8.139.520) correctly show "Health Care Authority" as the issuing agency;
sections this pack fetched from the legacy `hsd.state.nm.us` domain without a matching post-2024
amendment (8.139.400, 8.139.410) still show "New Mexico Human Services Department" — a department
name that has not existed since July 1, 2024, per 2023 Senate Bill 16. This pack cites the
srca.nm.gov versions wherever available and flags the hsd.state.nm.us PDFs as a live staleness
risk in `freshness.json` (host provenance, not program scope — see also the SUA/deduction figures,
which this pack independently sourced from a CURRENT hca.nm.gov-hosted PDF, not the stale ones).

## Finding 5 — New Mexico's drug-felony opt-out statute (§ 27-2B-11(C)) is worded narrowly around
DISTRIBUTION convictions specifically — a genuinely disclosed scope ambiguity, not resolved by
this pack's available sources, contrary to a broader "fully opted out" secondary characterization

This pack could not fetch § 27-2B-11's text directly (Finding 0). Two independently-fetched
mirrors — Public Health Law Center's SNAP Ban Opt-Out States Map and FindLaw's current-code
republication — quote IDENTICAL statutory language: New Mexico "elects to exempt all persons
domiciled in the state from application of 21 U.S.C. Section 862a(d)(1)(A) concerning the
restriction of eligibility for benefits on the basis of a conviction for DISTRIBUTION of a
controlled substance." This pack flags precisely: the statute invokes the FULL federal opt-out
provision (d)(1)(A), which by its own text covers both TANF and SNAP — but New Mexico's own clause
narrows its scope to distribution convictions, not the federal ban's full possession/use/
distribution scope. Public Health Law Center's OWN analysis (not this pack's inference)
independently makes the identical observation, describing the possession/use scope as genuinely
open. A different secondary source (Collateral Consequences Resource Center) describes New Mexico
as having "fully opted out of both SNAP and TANF bans" without this caveat — this pack does not
adopt that broader framing as settled, given the statute's own narrower quoted text.

## Finding 6 — New Mexico's certification-period extension and NEW MEXICO-SPECIFIC state
supplement for elderly/disabled households, both dated to the same October 1, 2024 change

HCA's Sept. 23, 2024 press release confirms, dated precisely: certification periods for households
where every adult is 60+ or disabled with no earned income were extended from 12 to 36 months,
AND — a distinct, New Mexico-specific state-funded top-up this pack found no equivalent for in
this roster's other built states — a state supplement for that same population was increased from
$32 to $100/month, both effective October 1, 2024. This pack flags the state supplement as worth
explicitly distinguishing from the federal SNAP allotment in any applicant-facing answer.

## Finding 7 — no Restaurant Meals Program, and no pending legislation found (unlike Connecticut)

USDA FNA's current RMP state list (fetched directly, clean HTTP 200) does not include New Mexico,
and this pack found no pending New Mexico bill analogous to Connecticut's SB 1475. This pack
separately found and distinguishes New Mexico's TEMPORARY, disaster-specific emergency hot-food
waivers (2024 wildfires, 2025 flooding) — narrower in scope (deli departments at EBT-authorized
retailers only, not restaurants) and time-limited to active disaster declarations, not evidence of
a standing RMP in development.

## Finding 8 — New Mexico's substantial tribal-land population makes the federal FDPIR/SNAP
household-exclusivity rule a genuinely live consideration, even though FDPIR itself is out of scope

New Mexico is home to 23 federally-recognized tribal nations and pueblos (Navajo Nation, 19
Pueblos, 3 Apache tribes). This pack confirmed via WebSearch (not New Mexico-specific — a federal
rule) that a household may receive EITHER FDPIR or SNAP in a given month, never both simultaneously,
and flags this precisely because several of New Mexico's still-ABAWD-waived jurisdictions (Finding
3) are themselves tribal lands where this choice is a live, practical consideration. A pending
federal bill (Tribal Access to Nutrition Assistance Act) would end this exclusivity if enacted —
not yet confirmed enacted as of this pack's fetch date.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

New Mexico has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for New Mexico (out of scope for this task, requiring
its own separate, explicit go-ahead per the standing park rule) should treat this pack's citations
as a starting point, not a final answer, and should specifically re-verify the current ABAWD
waiver-area list (Finding 3, the most volatile fact in this pack), the drug-felony statute's
possession/use scope ambiguity (Finding 5, genuinely unresolved by this pack's available sources),
and whether the hsd.state.nm.us-hosted sections (Finding 4) have since been re-published with
current content on srca.nm.gov, before hardcoding New Mexico's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched New Mexico text, checking
specifically for: claims inferred from a section heading rather than its own body text; dollar
figures not traceable to a specific dated source; and any New Mexico-vs-common-assumption contrast
overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete catches from
this pass:

- The 165%-vs-200% finding (Finding 1) does not merely assert the current figure is 200% — it
  traces the STALE 165% figure to a specific, still-live, dated PDF (revision 6-15-2023) and dates
  the change precisely via HCA's own press release, rather than presenting an unexplained
  contradiction between sources.
- The asset-limit finding (Finding 2) does not claim "New Mexico has an asset limit" without
  qualification — it explains precisely why the "no asset limit" simplification arose (resource-
  verification waiver for BBCE households, not an income-test waiver) and states the dollar figures
  remain operative for the narrower non-CE population.
- The ABAWD finding (Finding 3) does not overstate the January 1, 2026 statewide rollout as a full
  end to all waivers — it quotes HCA's own page listing five specific jurisdictions that remain
  waived, checked directly against the page's own text rather than inferred from the "statewide"
  headline framing alone.
- The drug-felony finding (Finding 5) does NOT adopt the broader "fully opted out" secondary
  framing as settled — it flags the statute's own narrower "distribution" language as a genuine,
  disclosed, UNRESOLVED ambiguity (not a confirmed correction in either direction), consistent with
  Public Health Law Center's own hedged analysis of the identical text, and discloses that this
  pack could not reach the statute's authoritative host directly.
- The state-supplement finding (Finding 6) is drawn directly from HCA's own dated press release
  quote, not inferred from a program-name resemblance to other states' supplements.
- The RMP finding (Finding 7) does not claim New Mexico will never adopt an RMP — it states plainly
  this pack found no pending legislation (a genuine absence-of-evidence, checked via targeted
  WebSearch, not merely an unstated assumption) and distinguishes the temporary disaster waivers
  precisely rather than conflating them with a standing program.
- The FDPIR finding (Finding 8) does not claim New Mexico has a state-specific FDPIR/SNAP
  interaction rule — it correctly attributes the exclusivity rule to federal law and flags the
  pending congressional bill's unenacted status explicitly.

## Sources

| Source | Access | Dated |
|---|---|---|
| HCA — Income Eligibility Guidelines for SNAP & Financial Assistance, FFY2026 (ISD 017) | direct curl fetch (browser UA), converted with `pdftotext -layout`, clean HTTP 200 | revision date 9-30-2025, effective 10/1/2025-9/30/2026 |
| HCA — legacy Income Eligibility Guidelines PDF (hsd.state.nm.us) | direct curl fetch, clean HTTP 200, cited ONLY to trace the stale 165% FPG figure | revision date 6-15-2023 |
| NMAC 8.139.420, 8.139.510, 8.139.520 (srca.nm.gov) | direct curl fetch (browser UA), clean HTTP 200 | amended 7/1/2024, 7/16/2024, and 3/1/2025 respectively |
| NMAC 8.139.400, 8.139.410 (hsd.state.nm.us) | direct curl fetch, clean HTTP 200, but stale pre-2024 issuing-agency line | no post-2024 amendment stamp found |
| HCA — SNAP overview, Keep Your Benefits NM!, Sept. 23 2024 press release, Feb. 4 2026 press release, FDPIR page | direct WebFetch, no access barrier | fetched 2026-08-12 |
| N.M. Stat. Ann. § 27-2B-11(C) | law.justia.com 403'd; nmonesource.com 404'd; resolved via Public Health Law Center + FindLaw, textually convergent | statute effective date not independently confirmed by this pack |
| USDA FNA — SNAP Restaurant Meals Program state list | direct curl fetch, clean HTTP 200 | New Mexico absent |
| FDPIR/SNAP household exclusivity rule | WebSearch corroboration, federal rule, not New Mexico-specific | not independently dated by this pack |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (NM guide questions), `eval/answer-eval.ts` (NM_GOLD, spread
into ALL_GOLD). New Mexico is deliberately NOT added to any `engine-citations.ts` per-state
constant map — New Mexico has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("NM", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a New Mexico policy — matching the precedent already set by this
roster's other corpus-only builds.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future New Mexico `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.

**Batch-tier merge conflict:** New Mexico was built in parallel with Mississippi, Kansas, and
Nebraska (this roster's second batch tier). All four states registered in the same four shared
files (`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`).
See the top-level commit history for how any resulting merge conflict was resolved — the rule
followed was to always COMBINE every state's additions (StateCode union members, REGISTRY entries,
QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never to drop another
state's entry to resolve a conflict, and to rebase again if another batch member merged after an
earlier conflict was already resolved.
