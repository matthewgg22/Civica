# District of Columbia pack — provenance

**Created:** 2026-08-12. DC is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, New Mexico's, New
Hampshire's, and Delaware's prior builds, DC has NO existing `packages/snap-rules` entry and NO
oracle fixture coverage at all. No discrepancy-checking against an existing engine constant was
possible or attempted; this pack's findings stand entirely on its own primary-source research.
This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully
parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

DC was built as one of a six-jurisdiction FINAL parallel batch closing out the standard 50-state
roster (AK, VT, WY, DC, Guam, USVI), each on its own branch, in the same window.

## DC-specific structural note

The District of Columbia is not a state, but it administers SNAP as its own single, unified
jurisdiction — like a state-administered program, structurally distinct from a county-administered
one, with no sub-jurisdictional policy variation. This pack sets `admin_model: "state"` accordingly.
DC's SNAP program is run centrally by DHS's Economic Security Administration (ESA) through ESA
Service Centers District-wide. DC's own governing statute (DC Code Title 4, Chapter 2B) is titled
the "Food Stamp Expansion Act" — an older naming convention preserved in the statute's own title
even though DHS's live consumer materials brand the program plainly as "SNAP."

Genuinely DC-specific and worth remembering: DC's state-specific SNAP policy is NOT consolidated in
one DCMR (DC Municipal Regulations) manual chapter the way Delaware's DSSM 9000 or many other
states' agency-issued manuals are. This pack searched Title 29 DCMR ("Public Welfare") directly and
found chapters for TANF, Medicaid, and other public-assistance programs, but no chapter titled for
food stamps/SNAP eligibility specifically. DC's SNAP-specific policy instead lives primarily in DC
Code Title 4, Chapter 2B (a codified STATUTE enacted by the DC Council, not an agency-issued manual)
plus DHS's own live, actively-maintained consumer pages. This is a genuine structural departure from
this roster's prior blank-slate builds and is disclosed in `freshness.json` rather than silently
assumed to mirror Delaware's structure.

## Method

Unlike this roster's New Hampshire and Maine packs, `dhs.dc.gov` and `code.dccouncil.gov` returned
clean HTTP 200 to nearly every direct fetch this pack made with a standard browser User-Agent — no
WAF/bot-detection barrier. One `dhs.dc.gov` page (`/page/apply-benefits`) returned a 200-status
"Access denied" page BODY rather than a 403 status code — a distinct failure mode this pack worked
around by using DC Hunger Solutions' (a DC-based SNAP outreach nonprofit) own apply-for-SNAP page,
cross-checked against other `dhs.dc.gov` pages that did fetch cleanly (the EBT page, the eligibility
page), rather than relying on the nonprofit page alone. This pack also found and explicitly avoided a
legacy-manual-mirror trap: `dcrules.elaws.us`, an unofficial DCMR mirror, carries its own page
metadata reading "D.C. Municipal Regulations (Last Updated: September 13, 2017)" — nearly nine years
stale, with no HTTP error signal distinguishing it from a current page — and was used ONLY to confirm
DCMR chapter-numbering structure, never for any current dollar figure or eligibility rule.

## Finding 1 (flagship, correction of a widely-repeated false secondary-source claim, confirmed by
TWO independent primary sources) — DC's ABAWD work requirements STARTED June 1, 2026; its
long-standing districtwide waiver was NOT renewed for FY2026

Several secondary sources this pack found (including a detailed-looking eligibility guide) describe
DC as having "a districtwide ABAWD waiver, meaning work requirements are not being enforced anywhere
in the District at this time." This pack fetched DHS's own live SNAP Work Requirements page directly
and found the opposite currently true: the page's own banner across multiple DHS pages states
plainly "SNAP ABAWD work requirements implementation started on June 1, 2026," with a fixed 36-month
clock running June 1, 2026 through May 31, 2029 for all DC ABAWD customers. This pack independently
cross-checked this against a wholly separate federal source — USDA FNS's own ABAWD Time Limit
Waivers FY2025-2029 index — which lists DC's most recent posted waiver-response entries as three
separate FY2025 responses (dated 04/26/2024, 01/13/2025, and 05/21/2025) with NO FY2026 entry,
corroborating that DC's districtwide waiver lapsed and was not renewed for the current fiscal year.
Two independent primary sources (DHS's own live consumer page and USDA FNS's own federal waiver
index) agree, giving this finding high confidence despite its recency (implementation began roughly
2 months before this pack's fetch date).

## Finding 2 (flagship, correction of a second widely-repeated false secondary-source claim,
confirmed by TWO independent primary sources) — DC does NOT operate a Restaurant Meals Program

Multiple secondary sources this pack found state plainly that "D.C. participates in the USDA SNAP
Restaurant Meals Program." This pack fetched USDA FNS's own official, current "States that Operate a
Restaurant Meals Program" list directly, and DC is NOT on it — the complete current list is Arizona,
Maryland, New York, California, Massachusetts, Rhode Island, Illinois (Cook and Franklin Counties
only), Michigan, and Virginia. This pack independently cross-checked this against DHS's own live SNAP
consumer page, which lists "Hot foods" and "Prepared Foods fit for immediate consumption" under items
you CANNOT buy with SNAP in DC, with no RMP exception mentioned anywhere. This pack's reading: DC
does not currently operate an RMP, and the secondary-source claims to the contrary most likely
conflate DC with its immediate RMP-operating neighbors, Maryland and Virginia, both of which DO
appear on USDA's own list.

## Finding 3 (structural, confirmed) — DC's SNAP categorical-eligibility gate is 200% FPL gross
income, codified directly in DC's own statute via a Mayor-established TANF-funded program

DC Code § 4-261.02 grants categorical eligibility to all applicants with income at or below 200% FPL
gross income, achieved through a Mayor-established TANF-funded program or service — the same
structural mechanism family as this roster's Delaware and New Hampshire packs, though DC's version
is directly codified in a DC Council statute (Title 4, Chapter 2B, the "Food Stamp Expansion Act")
rather than described only in an agency manual the way Delaware's DSSM 9042 is. This pack also
caught and flagged a genuine internal DC page labeling inconsistency: DHS's own income-limits table
header for the 200% FPL column literally reads "Maximum Net Monthly Income (200% FPL)" even though
the table's own footnote and DC Code § 4-261.02 both confirm 200% FPL is actually a GROSS-income
categorical-eligibility standard, not a net-income figure.

## Finding 4 (confirmation of a minority-position claim, reached via direct statutory text rather
than accepting a secondary-source label) — DC's drug-felony SNAP opt-out is full and unconditional

Several secondary sources correctly state DC has "fully opted out" of the federal drug-felony SNAP
ban, but this pack chose to verify this directly against DC's own codified statute rather than accept
it on a secondary source's authority alone (this roster's Delaware pack found several other
secondary sources describing a "modified" ban for a different state that turned out to be a stale,
pre-repeal characterization — a caution against taking any drug-felony-ban claim at face value).
DC Code § 4-205.71 states plainly: "An adult who is a drug felon shall not be denied cash or food
assistance benefits...solely because he or she is a drug felon" — a full, unconditional statutory
opt-out (no sentence-compliance condition, no treatment-program requirement) originally added April
20, 1999 (D.C. Law 12-241) and most recently amended November 26, 2019 (D.C. Law 23-31).

## Finding 5 — DC's resource limits ($3,000/$4,500) match the current federal floor exactly; DC's
36-month ESAP certification period for all-elderly/disabled no-earned-income households is genuinely
longer than the 24-month period several other jurisdictions in this roster use

DHS's own current page states DC's resource limits as $3,000 (general) / $4,500 (elderly or
disabled member) — matching the current federal FY2026 COLA-adjusted floor exactly, unlike this
roster's Delaware pack, which found its own regulatory text (DSSM 9045) citing a stale, below-federal
$2,000/$3,000 figure. DC's certification-period structure is also worth flagging precisely: DC's
Elderly Simplified Application Project (ESAP) certification period is 36 months for all-elderly/
disabled households with no earned income (dropping to 12 months if that household has earned
income) — genuinely longer than the 24-month elderly/disabled period this roster's Delaware pack and
several others use, confirmed directly on two separate DHS pages (the general eligibility page and
the elderly/disabled-specific page), not a misreading of the same federal baseline.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

DC has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine constant
this pack could confirm or contradict — every finding above is a first-pass primary-source finding.
A future `packages/snap-rules` build for DC (out of scope for this task, requiring its own separate,
explicit go-ahead per the standing park rule) should treat this pack's citations as a starting point,
not a final answer, and should specifically re-verify the DC-specific 4-person Standard Deduction
figure (Finding disclosed in freshness.json, not independently located) and locate any DC-specific
DCMR procedural chapter this pack did not find before hardcoding DC's parameters into engine
constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched DC text, checking specifically
for: claims inferred from a secondary-source summary rather than the underlying primary text; the
recency of the ABAWD-implementation change (roughly 2 months old at fetch time, requiring independent
federal-source corroboration rather than resting on a single DHS page); and any DC-vs-common-
assumption contrast overclaimed as settled when the underlying evidence was genuinely single-sourced.
Concrete catches from this pass:

- The ABAWD finding (Finding 1) is not stated on DHS's page alone — this pack deliberately sought a
  second, wholly independent federal source (USDA FNS's own waiver index) specifically because the
  claim contradicts a widely-repeated secondary-source characterization and DC's implementation date
  is recent enough that a single source alone would be thinner evidence than this finding's weight
  warrants.
- The RMP finding (Finding 2) is grounded in USDA's own authoritative jurisdiction list, not a
  secondary source's inference from silence — this pack did not merely note that DHS's page doesn't
  mention RMP (absence of evidence), but positively confirmed DC's absence from USDA's own list of
  states that DO operate one (evidence of absence), then cross-checked against DHS's own explicit
  purchase-restriction language for a second, independent confirmation.
- The categorical-eligibility labeling inconsistency (Finding 3) was not obvious from a single read —
  it required comparing the DHS table's own column HEADER text against both its own footnote and the
  DC Code's statutory text side by side; an early pass reading only the header would have concluded
  200% FPL is a net-income test, which is incorrect.
- The drug-felony finding (Finding 4) is grounded in DC Code § 4-205.71's own current text, not
  merely repeated from a secondary source's "opted out" framing — this pack fetched the specific
  statute directly and confirmed both its unconditional character and its amendment history, rather
  than assuming a secondary source's summary was precise.
- The DC Access EBT card name and the DC-specific 4-person Standard Deduction figure are both flagged
  explicitly as unconfirmed / not independently located rather than stated with the same confidence
  as this pack's more cross-checked findings, since DHS's own primary-source text does not state
  either directly.
- The "no dedicated DCMR SNAP chapter" finding (structural note above) is disclosed as a genuine
  research gap rather than silently assumed — this pack's search of Title 29 DCMR's chapter listing
  found no SNAP-titled chapter, but a more thorough search of the current official DC Register system
  (which this pack could not access beyond the stale eLaws mirror) might locate SNAP-specific
  procedural rules this pack did not find.

## Sources

| Source | Access | Dated |
|---|---|---|
| DC DHS, SNAP Eligibility Requirements page | direct fetch, clean HTTP 200 | fetched 2026-08-12; income/resource/deduction tables published 10/1/2025-9/30/2026 |
| DC DHS, SNAP Work Requirements page | direct fetch, clean HTTP 200 | fetched 2026-08-12; page updated 7/20/2026 |
| DC DHS, SNAP Monthly Benefit page | direct fetch, clean HTTP 200 | fetched 2026-08-12; allotment table published 10/1/2025-9/30/2026 |
| DC DHS, SNAP consumer page | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| DC Code, Title 4, Chapter 2B (Food Stamp Expansion Act), §§4-261.01/.02/.03/.21 | direct fetch, code.dccouncil.gov, clean HTTP 200 | fetched 2026-08-12; §4-261.02 last amended 3/10/2023 |
| DC Code §4-205.71 | direct fetch, code.dccouncil.gov, clean HTTP 200 | fetched 2026-08-12; last amended 11/26/2019 |
| USDA FNS, States that Operate a Restaurant Meals Program | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| USDA FNS, SNAP ABAWD Time Limit Waivers FY2025-2029 index | direct fetch, clean HTTP 200 | fetched 2026-08-12; page updated 7/22/2026 |
| DC Hunger Solutions, apply-for-SNAP page | WebFetch, direct fetch | fetched 2026-08-12; used only to work around a dhs.dc.gov access-denied page, cross-checked |
| dcrules.elaws.us, unofficial DCMR Title 29 mirror | fetched, confirmed stale via own page metadata | own metadata dated "Last Updated: September 13, 2017"; used only for chapter-numbering structure |
| WebSearch corroboration only ("DC Access" EBT card brand name; general categorical-eligibility framing) | WebSearch, not independently fetched for the specific claim | see freshness.json for the specific disclosed gap |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (DC guide questions), `eval/answer-eval.ts` (DC_GOLD, spread into
ALL_GOLD). DC is deliberately NOT added to any `engine-citations.ts` per-state constant map — DC has
no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("DC", ...)` will
throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build adds a DC
policy — this matches the precedent already set by every prior blank-slate corpus pack in this
roster, including Delaware's, New Hampshire's, and Maine's most recent builds.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future DC `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Six-jurisdiction FINAL parallel batch:** DC was built in parallel with Alaska (AK), Vermont (VT),
Wyoming (WY), Guam, and the U.S. Virgin Islands (USVI) — six separate agents in the same window, each
on its own branch (`feat/demeter-dc-corpus` for this one), CLOSING OUT the standard 50-state-plus
roster this project has been building toward. All six register in the same four shared files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and
therefore all six PRs are expected to conflict with each other on merge. The rule to follow when
resolving that conflict is to always COMBINE every jurisdiction's additions (StateCode union members,
REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never to
drop another jurisdiction's entry to resolve a conflict — matching the precedent this roster's prior
same-window batch tiers already set. Per the task brief, "VI" (Virgin Islands) collides with an
existing `VI_GOLD` Vietnamese-language gold set already in `answer-eval.ts` — a naming collision this
pack's own registration does NOT need to resolve (DC's own code is "DC," which collides with nothing
existing in this codebase), but future USVI-branch conflict resolution should be aware of it.
