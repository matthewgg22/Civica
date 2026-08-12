# Maine pack — provenance

**Created:** 2026-08-12. Maine is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, and Arkansas's prior builds, Maine has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking against
an existing engine constant was possible or attempted; this pack's findings stand entirely on its
own primary-source research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content
layer — and does not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`,
both of which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Maine was built as part of a five-state parallel batch (ID, WV, HI, NH, ME), built concurrently by
separate agents in the same window; see the Registration section below for how any resulting merge
conflict on shared files was resolved.

## Method

Direct `WebFetch` of Maine DHHS's current SNAP consumer page and several DHHS rulemaking pages;
direct `curl` fetch (browser User-Agent) of two PDF attachments to SNAP Rule #244 (the Rule Pages
appendix-chart PDF and the Fact Sheet PDF), both converted locally with `pdftotext -layout`. Also
directly fetched the full text of 22 M.R.S. § 3104 (all 17 subsections) from legislature.maine.gov,
Maine DHHS's ABAWD-specific rulemaking pages (Rule #240A/#240P, Rule #234A), USDA FNA's ABAWD Waivers
FY2025-2029 state-response tracker, and USDA FNA's Restaurant Meals Program state list — the latter
two via direct `curl` fetch (browser UA), both clean HTTP 200. WebSearch/WebFetch cross-checks
(prisonpolicy.org, Ballotpedia, Maine Equal Justice, several income-limit aggregator sites) were used
specifically to hunt for secondary-source errors, and this pack found and corrected one significant
one (see Finding 1).

## Finding 0 — no bot-detection wall found anywhere in Maine's primary sources; the only
complications were two WebFetch timeouts on fna.usda.gov memo pages and a tracked-changes PDF

`maine.gov`, `legislature.maine.gov`, and `fna.usda.gov` all returned clean HTTP 200 to every direct
fetch this pack made — no Justia-403 or Radware/TSPD-style bot-detection pattern anywhere in this
pack's Maine research. Two complications, both resolved without needing an external archive fallback:
(1) two `WebFetch` calls to `fna.usda.gov` policy-memo pages (a "Waiver Termination" notice and a
"Waiver of the Time Limit – Status Update" notice, both dated July 2026) timed out; this pack worked
around it by reading USDA's ABAWD Waivers FY2025-2029 STATE-RESPONSE INDEX page directly instead,
which supplied the specific Maine fact this pack needed (no FY2026 waiver-response entry) without
requiring those two memo pages. (2) Maine's own SNAP Rule #244 Rule Pages PDF is a tracked-changes/
redline document whose historical FFY-by-FFY rows visually overlap under `pdftotext` extraction for
Charts 1 through 4 specifically (old and new figures merged into the same extracted line) — resolved
by cross-checking every FFY2026/CY2026 figure this pack cites against either a clean, non-overlapping
row in the same table, or Maine's live consumer page, and by explicitly disclosing the one figure
(Standard Deduction, household size 4) that could not be fully reconciled this way rather than
silently picking a value (see Finding 6).

## Finding 1 (flagship, correction) — Maine HAS fully opted out of the federal drug-felony SNAP
ban; a February 2026 secondary source got this wrong, likely by conflating it with a different,
narrower violent-crime statute

21 U.S.C. § 862a(a)(2) sets a federal default: anyone convicted of a state or federal drug-related
felony is permanently ineligible for SNAP unless a state opts out. This pack found a genuine,
consequential correction to make: `prisonpolicy.org`, in a February 2026 50-state survey, categorized
Maine as having NOT opted out — describing Maine only as still asking a probation-violation question
on its SNAP application, with "no explicit disqualification." This pack fetched Maine's own statute
directly (22 M.R.S. § 3104, all 17 subsections, read in full) and found the opposite has been the
operative law for years: subsection (14) states plainly that an otherwise-eligible person "may not be
denied assistance because the person has been convicted of a drug-related felony." Maine is a FULL
opt-out state for drug felonies. This pack's own reading of the likely source of the secondary
source's error: Maine DOES carry a separate, considerably narrower disqualification — subsection (15),
covering certain post-1/1/2018 violent-crime and sexual-assault felony convictions, conditioned on
non-compliance with sentence/parole/probation terms or fleeing-felon status — which a surface read of
Maine's statute index or application form could easily conflate with a "drug felony" rule. This pack
verified subsections (13), (14), and (15) each directly, in full, rather than relying on a section
heading or a secondary summary.

## Finding 2 (flagship, structural) — Maine's 165% FPL income column is NOT its BBCE ceiling; it is
a narrow "separate household" test. The real BBCE ceiling is 200% FPL, on a DIFFERENT (calendar-year)
update cycle than the state's other income tables

This pack fetched Maine's own current SNAP Rules Appendix (10-144 C.M.R. Ch. 301, § 999-3) directly
and read each chart's own header precisely rather than assuming a percentage figure functions the way
it does in other states this roster has built. Chart 3's 165% FPL column is explicitly scoped, in
Maine's own words, to "those purchasing and preparing meals with individuals who are elderly and have
a disability and their spouses to qualify as a separate household" — a household-composition
determination, not a categorical-eligibility income ceiling. Maine's actual BBCE gross-income ceiling
is Chart 4's 200% FPL test (7 C.F.R. § 273.2(j)(2), raised from 185% in July 2022 under 22 M.R.S.
§ 3104(13)) — and this pack found Chart 4 updates on a CALENDAR-YEAR cycle tied to the annual federal
poverty-guideline publication date, structurally distinct from Charts 1-3's federal-fiscal-year cycle.
This distinction matters for accuracy: a reader who saw only "165%" without reading the column header
could substantially understate how generous Maine's real BBCE ceiling (200%) actually is.

## Finding 3 (flagship, time-sensitive) — Maine's FY2025 ABAWD geographic waiver expired 9/30/2025;
this pack found no evidence of an FY2026 renewal on USDA's own tracker

Maine's 213-area ABAWD geographic waiver (approved 9/17/2024, retroactive to 10/1/2024) was, per
consistent secondary-source reporting, set to expire September 30, 2025. This pack independently
confirmed the expiration is very likely real and current by fetching USDA FNA's own ABAWD Waivers
FY2025-2029 state-response tracker directly: Maine's only listed FNA response entry is dated
09/13/2024 (FY2025), with no FY2026 entry — a sharp contrast with roughly two dozen other states on
the same tracker (including several already-built in this roster) that carry a second, FY2026-dated
response. This pack discloses this as strong-but-not-certain evidence (USDA's own tracker updates only
quarterly) rather than an absolute claim, and recommends direct re-verification before telling a Maine
applicant no area of the state is currently ABAWD-waived.

## Finding 4 (flagship, time-sensitive, structural) — OBBBA's "Heat & Eat" restriction now limits
AUTOMATIC utility-allowance qualification via LIHEAP to elderly/disabled households only — an
estimated 980 Maine households affected

Maine DHHS's own July 2025 blog post on H.R. 1 (OBBBA) implementation states the law's national
restriction on the "Heat & Eat" mechanism — which previously let a household auto-qualify for the Full
Standard Utility Allowance via a small LIHEAP energy-assistance payment, without a separately-billed
heating/cooling cost — now limits that automatic-LIHEAP pathway to households with an elderly or
disabled member, effective Fall 2025, with DHHS's own estimate of approximately 980 Maine households
affected. This pack reads this as removing a SHORTCUT for non-elderly/disabled households, not the
underlying FSUA deduction itself — a household of any composition that is directly and separately
billed for heating/cooling costs still qualifies for the FSUA regardless of this change.

## Finding 5 — Maine's own SNAP rules manual title settles the naming question directly:
"SNAP" is current; "Food Supplement Program" is the retired former name

This pack fetched Maine's current SNAP rules manual directly and found its own title reads
"SUPPLEMENTAL NUTRITION ASSISTANCE PROGRAM (SNAP) RULES (formerly FOOD SUPPLEMENT PROGRAM)" — settling
precisely the naming ambiguity this task flagged as worth verifying rather than assuming. The same
transition shows up in the statute: 22 M.R.S. § 3104's 2019-era codified title was "Statewide food
supplement program"; its current title on legislature.maine.gov is "Statewide Supplemental Nutrition
Assistance Program." Some URL slugs (maine.gov/dhhs/ofi/programs-services/food-supplement) still carry
the retired name, a minor, disclosed naming-transition residue rather than a live ambiguity.

## Finding 6 — disclosed, unresolved: an apparent $10 transcription anomaly in Maine's own rule
document for the Standard Deduction at household size 4

Maine's own current SNAP Rules Appendix (Chart 7) lists $233/month as the FFY2026 Standard Deduction
for a household of 4. This pack's independent cross-check of the national FFY2026 SNAP Standard
Deduction figure (identical across every state per USDA FNS's own published table, and independently
confirmed by this roster's Nebraska pack at $223 for the same household size) found $223, not $233.
This pack could not resolve the $10 discrepancy from its own sources and discloses it explicitly in
`freshness.json` rather than silently choosing one figure — this is exactly the kind of anomaly this
task's research-quality bar asked to be surfaced, not hidden. The household-size 1-3 ($209), 5
($261), and 6-or-more ($299) figures in the same chart DO match the confirmed national figure and
carry no such flag.

## Finding 7 — Maine does NOT operate a Restaurant Meals Program, and this pack found no pending
legislation to establish one (a genuine negative result, disclosed as such)

This pack fetched USDA FNA's current RMP state list directly (Arizona, Maryland, New York, California,
Massachusetts, Rhode Island, Illinois [Cook/Franklin Counties], Michigan, Virginia) — Maine is absent.
Unlike this roster's Nebraska pack, which found and documented a specific failed 2025-2026 Nebraska
RMP bill (LB920), this pack's search did not surface any comparable pending Maine RMP legislation.
This pack treats Maine's current RMP answer as a stable "no," not a live/evolving situation, and
discloses that it searched for but did not find contrary legislative activity — a genuine negative
result stated as such, per this task's instruction to disclose "found neither" honestly.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

Maine has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine constant
this pack could confirm or contradict — every finding above is a first-pass primary-source finding. A
future `packages/snap-rules` build for Maine (out of scope for this task, requiring its own separate,
explicit go-ahead per the standing park rule) should treat this pack's citations as a starting point,
not a final answer, and should specifically re-verify the ABAWD waiver status (Finding 3, the most
volatile fact in this pack), the Standard Deduction household-size-4 discrepancy (Finding 6), and the
SUA federal-approval finality (see `freshness.json`) before hardcoding Maine's parameters into engine
constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Maine text, checking specifically
for: claims inferred from a section heading rather than its own body text; dollar figures not
traceable to a specific dated source; and any Maine-vs-common-assumption contrast overclaimed as
settled when the underlying evidence was genuinely ambiguous or still in motion. Concrete catches from
this pass:

- The drug-felony correction (Finding 1) is the most consequential catch in this pack: it required
  reading all 17 subsections of 22 M.R.S. § 3104 in full, not just subsection (14), specifically to
  confirm subsection (15)'s existence and scope — without that check, this pack could not have
  explained WHY the secondary source likely erred, only that it did.
- The 165%-vs-200% distinction (Finding 2) is grounded in Chart 3's own header text quoted verbatim
  ("...to qualify as a separate household (Section 111-1(2)(c))"), specifically because a reader
  skimming only the percentage figures could easily assume 165% functions as Maine's BBCE ceiling the
  way an elevated percentage does in several other states this roster has built.
- The ABAWD waiver-expiration finding (Finding 3) is stated with an explicit confidence caveat (USDA's
  tracker updates quarterly and could lag a very recent approval) rather than as flat certainty, and
  the corresponding `freshness.json` entry preserves that caveat rather than smoothing it away.
- The Standard Deduction discrepancy (Finding 6) is disclosed rather than resolved — this pack
  considered simply using $223 (the figure it has higher external confidence in) but decided that
  silently substituting a number that Maine's OWN posted rule document does not say would be a worse
  failure mode than disclosing the conflict, especially given this pack could not access final-adopted
  rule text (only the proposed Rule #244 filing) to settle it definitively.
- The Restaurant Meals Program finding (Finding 7) explicitly states a negative search result
  ("this pack's search did not surface any comparable pending Maine RMP legislation") rather than
  silently omitting the fact that a search for contrary evidence was performed and came up empty.
- The Heat & Eat finding (Finding 4) is scoped precisely to the AUTOMATIC-LIHEAP-qualification pathway
  specifically, not overclaimed as removing the FSUA deduction generally for non-elderly/disabled
  households with an actual, separately-billed heating cost.

## Sources

| Source | Access | Dated |
|---|---|---|
| Maine DHHS, SNAP consumer page (income/benefit summary) | direct WebFetch | fetched 2026-08-12; page itself shows CY2025 BBCE figures, a disclosed staleness gap |
| Maine DHHS, SNAP Rule #244 Rule Pages (TC) PDF, 10-144 C.M.R. Ch. 301 § 999-3 Appendix Charts 1-9 | direct curl fetch (browser UA), converted with `pdftotext -layout` | FFY2026 effective 10/1/2025; CY2026 BBCE effective 1/13/2026; fetched 2026-08-12 |
| Maine DHHS, SNAP Rule #244 Fact Sheet PDF | direct curl fetch (browser UA), converted with `pdftotext -layout` | filed 2026-02-04, comment deadline 3/9/2026; fetched 2026-08-12 |
| 22 M.R.S. § 3104, all 17 subsections | direct WebFetch, full text read directly | current as codified |
| Maine DHHS, SNAP Rule #240A/#240P (ABAWD Update) and Rule #234A (ABAWD Geographic Exemptions) rulemaking pages | direct WebFetch | 2025-12-10, 2025-10-08, 2024-11-20 |
| USDA FNA, ABAWD Waivers FY2025-2029 state-response index | direct curl fetch (browser UA), clean HTTP 200 | fetched 2026-08-12; Maine's only entry dated 09/13/2024 |
| USDA FNA, SNAP Restaurant Meals Program page | direct curl fetch (browser UA), clean HTTP 200 | page updated 08/07/2026; fetched 2026-08-12 |
| Maine DHHS blog, "Federal Budget Reconciliation Law Now in Effect" | direct WebFetch | published 2025-07-11 |
| prisonpolicy.org, Ballotpedia, Maine Equal Justice, income-limit aggregator sites | WebSearch/WebFetch corroboration only | cross-checked against, and in one case corrected by, primary-source text |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (ME guide questions, at least 3), `eval/answer-eval.ts` (ME_GOLD,
spread into ALL_GOLD). Maine is deliberately NOT added to any `engine-citations.ts` per-state constant
map — Maine has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("ME",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build adds
a Maine policy — this matches the precedent already set by Nebraska's, New Mexico's, Kansas's,
Mississippi's, Arkansas's, Iowa's, Utah's, Connecticut's, Oklahoma's, Kentucky's, Louisiana's,
Alabama's, South Carolina's, Colorado's, Maryland's, Missouri's, Indiana's, Tennessee's, Virginia's,
New Jersey's, North Carolina's, Ohio's, and Pennsylvania's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Maine `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Batch-tier merge conflict:** Maine was built in parallel with Idaho, West Virginia, Hawaii, and New
Hampshire (a five-state batch). All five states registered in the same four shared files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`). See the
top-level commit history for how any resulting merge conflict was resolved — the rule to follow is to
always COMBINE every state's additions (StateCode union members, REGISTRY entries, QUESTIONS entries,
and `_GOLD` arrays spread into the aggregate export), never to drop another state's entry to resolve a
conflict.
