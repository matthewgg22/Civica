# Montana pack — provenance

**Created:** 2026-08-12. Montana is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, New Mexico's, New Hampshire's,
Idaho's, West Virginia's, Hawaii's, and Maine's prior builds, Montana has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking against
an existing engine constant was possible or attempted; this pack's findings stand entirely on its
own primary-source research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A
content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the standing
rule (`feedback_dashboard_snap_rules_parked`).

Montana was built as one of a five-agent parallel batch (RI, MT, DE, SD, ND), each on its own
branch, in the same window.

## Method

`dphhs.mt.gov` returned a clean, direct HTTP 200 to every fetch this pack attempted, with a
standard browser User-Agent — NO WAF/bot-detection barrier of the kind this roster's New
Hampshire and several other packs encountered. This pack located Montana's SNAP manual via
its actual current path (`dphhs.mt.gov/hcsd/Manuals/SNAPmanual`) — an initial guess at
`dphhs.mt.gov/HCSD/snapmanual` 404's due to path/casing — discovered by inspecting the internal
links of Montana DPHHS's general SNAP program page. This pack fetched the manual's current
Table of Contents (`SNAPTOC7.2026.pdf`, dated 07.01.26) first, to confirm exactly which section
numbers and effective/revision dates are currently operative, then fetched each individual section
PDF directly and ran `pdftotext -layout` on every one. One URL-guess miss occurred
(`SNAP801-1.pdf`, which does not exist; the real file is `SNAP801.1.pdf`) and was caught
immediately via a `file` type check — the failed fetch returned an HTML 404 page rather than a
PDF — and corrected on retry. `mca.legmt.gov` (the Montana Legislature's code site) required
following two chained 301 redirects to reach the current Food Stamp Program statute index. A
single `fns.usda.gov` WebFetch (Restaurant Meals Program page) timed out after 60 seconds; this
pack fell back to WebSearch corroboration and flags this explicitly in `freshness.json` rather than
silently treating the figure as independently primary-source-fetched.

## Finding 1 (flagship, correction) — Montana's own manual states a MODIFIED drug-felony ban
conditioned on supervision compliance, correcting a secondary source's oversimplified "won't
disqualify you" framing

This pack found a secondary source (Propel's Montana SNAP guide) stating flatly: "Montana won't
disqualify you because of a drug felony." This pack fetched Montana DPHHS's own current SNAP
manual directly and found the same exact modifier clause appearing consistently across three
separate sections (SNAP 001, SNAP 304-1, SNAP 602-4): an individual convicted after 08/22/96 of
a federal or state felony for possession, use, or distribution of illegal drugs is disqualified "and
not complying with conditions of supervision." This pack reads this as a genuine MODIFIED ban —
an individual complying with probation/parole terms is not disqualified, but an individual who is
NOT complying with supervision conditions genuinely is disqualified on this basis alone — and
flags the secondary source's framing as an overclaim that omits the supervision-compliance
condition entirely. This is distinct from a genuine full opt-out (which this roster's New Hampshire
and Maine packs each separately confirmed via their own states' 1990s implementing
directives/statutes) and distinct from Montana's separate fleeing-felon and work-registration
disqualification pathways.

## Finding 2 (flagship, correction of a stale figure) — Montana's own current resource limit is
$3,000 (non-elderly/disabled), not the $2,750 several secondary sources repeat

Montana DPHHS's own current SNAP 400 (Resources Overview, effective 10/01/2024, current per
the 07/01/2026 manual Table of Contents) states plainly: $4,500 for households with an elderly or
disabled member, $3,000 for all other non-CE/non-ECE households. Several secondary sources
this pack found instead cite $2,750 — a figure this pack reads as stale, carried over from an
earlier COLA cycle (the federal general SNAP resource limit rose from $2,750 to $3,000 effective
the FFY2025 cycle nationally). This pack flags the $2,750 figure as outdated and confirms $3,000
as Montana's own currently-published figure.

## Finding 3 (structural) — Montana's three-track eligibility structure (CE, ECE, and residual
"regular" rules) reads precisely rather than compressing into a flat "no asset test" claim

SNAP 304-1 and SNAP 400 together define a structure this pack reads precisely: Traditional
Categorical Eligibility (CE, TANF/Tribal TANF/SSI cash recipients, no income or resource test at
all), Expanded Categorical Eligibility (ECE, 200% FPG gross-income-only test, no resource test,
based on Montana's TANF Information and Referral Services brochure), and a residual "regular"
track for households that are neither CE nor ECE, which faces the real $3,000/$4,500 resource
limit and the 130%/100% FPG income tests. This pack's reading: the large majority of Montana
SNAP households likely qualify via CE or ECE and therefore never face a resource test, but the
flat "no asset limit in Montana" framing some secondary sources use is not literally, universally
true — the same structural caution this roster's New Hampshire pack applied to its own
three-track finding.

## Finding 4 (clean primary-source confirmation) — Montana currently has NO approved ABAWD
geographic waivers anywhere in the state

Montana DPHHS's own SNAP 802-1 (ABAWD Geographic Waiver, effective 11/01/2025) states in
full: "As of 11/01/2025, there are no areas within Montana with approved ABAWD geographic
waivers." This is a plain, unambiguous, directly-fetched primary-source statement — a cleaner
confirmation than several other states in this roster, where waiver absence had to be inferred
from a federal waiver index's lack of a current entry rather than stated directly by the state
itself.

## Finding 5 — Montana does NOT operate a Restaurant Meals Program, but does carry the
standard narrower federal congregate/meal-delivery provision

SNAP 0-3 (Introduction) states plainly that hot prepared foods cannot be purchased with SNAP
benefits, with a narrow federal exception for "a limited number of participants who meet specific
eligibility and residence criteria" using "an authorized meal delivery service, authorized communal
dining facility for elderly or SSI households." This pack reads this precisely as the standard
federal congregate/meal-delivery provision (available in every state, not a state-elected program)
and distinguishes it explicitly from a full state-option Restaurant Meals Program under 7 CFR
§ 274.7(g) — a distinction worth naming so an applicant asking about ordinary restaurant dining is
not misled by the presence of this narrower provision.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Montana has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Montana (out of scope for this task, requiring its
own separate, explicit go-ahead per the standing park rule) should treat this pack's citations as a
starting point, not a final answer, and should specifically re-verify the drug-felony
supervision-compliance modifier (Finding 1, cross-checked within DPHHS's own manual across
three sections but not found in a standalone MCA statute) and the homeless-shelter/excess-shelter
cap dollar figures (undisclosed in the fetched SNAP 602-4 text; flagged, not guessed) before
hardcoding Montana's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Montana text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying
primary text; a dollar figure that might be stale relative to the current COLA cycle; and any
Montana-vs-common-assumption contrast overclaimed as settled when the underlying evidence
was genuinely single-sourced. Concrete catches from this pass:

- The drug-felony finding (Finding 1) does not simply accept the secondary source's "won't
  disqualify you" framing at face value, nor does it simply accept the framing as flatly wrong —
  it reads DPHHS's own exact modifier text ("and not complying with conditions of supervision")
  across three independently-fetched manual sections and states the nuanced, conditional rule
  precisely, rather than either overcorrecting into "Montana still enforces the federal ban" or
  undercorrecting into repeating the secondary source's oversimplification.
- The $2,750-vs-$3,000 resource-limit catch (Finding 2) is grounded in a direct fetch of DPHHS's
  own current SNAP 400 text, not merely an assumption that secondary sources must be wrong —
  this pack explicitly reasons through WHY the discrepancy likely exists (a COLA-cycle figure lag)
  rather than asserting the secondary sources are simply mistaken without an explanation.
- The homeless-shelter-deduction and excess-shelter-cap dollar figures are flagged explicitly as
  UNCONFIRMED in `freshness.json` rather than estimated or borrowed from another state's figure,
  since SNAP 602-4's own text states both are "updated each year by 09/01" without stating the
  current numbers in that section.
- The ARM 37.76.x citation family is flagged explicitly as WebSearch-confirmed-only (rule numbers
  and titles, not full text) rather than presented with the same confidence as this pack's directly-
  fetched SNAP-manual citations.
- The Restaurant Meals Program 9-state list is flagged explicitly as WebSearch-corroborated only,
  since the direct `fns.usda.gov` WebFetch attempt timed out — this pack discloses the timeout
  rather than silently treating the WebSearch-derived figure as independently primary-source-
  verified.
- The vehicle-exclusion finding explicitly contrasts Montana's federal-baseline "one vehicle, highest
  equity value" rule against this roster's New Hampshire pack's more generous "one vehicle per
  adult" finding, rather than assuming all states follow the same vehicle-exclusion rule.

## Sources

| Source | Access | Dated |
|---|---|---|
| Montana DPHHS, State of Montana SNAP Program Overview | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| Montana DPHHS, SNAP Policy Manual Table of Contents (SNAPTOC7.2026.pdf) | direct PDF fetch, clean | dated 07.01.26 |
| Montana DPHHS SNAP 001, Gross and Net Income Standards | direct PDF fetch, clean | effective 10/01/2025-09/30/2026 |
| Montana DPHHS SNAP 304-1, Categorical and Expanded Categorical Eligibility | direct PDF fetch, clean | effective 10/01/2024 |
| Montana DPHHS SNAP 400, Resources Overview | direct PDF fetch, clean | effective 10/01/2024 |
| Montana DPHHS SNAP 402-1, Countable and Excluded Resources | direct PDF fetch, clean | fetched 2026-08-12 |
| Montana DPHHS SNAP 403-1, Vehicles | direct PDF fetch, clean | effective 10/01/2022 |
| Montana DPHHS SNAP 602-2, Deductions (Earned/Standard/Dependent Care/Child Support) | direct PDF fetch, clean | fetched 2026-08-12 |
| Montana DPHHS SNAP 602-3, Deductions (Medical) | direct PDF fetch, clean | fetched 2026-08-12 |
| Montana DPHHS SNAP 602-4, Shelter Deductions | direct PDF fetch, clean | effective 10/01/2025 |
| Montana DPHHS SNAP 705-1, Work Registration Disqualification | direct PDF fetch, clean | effective 09/16/2024 |
| Montana DPHHS SNAP 801-1, ABAWD Countable Months/Exemptions | direct PDF fetch, clean | effective 10/01/2025, confirmed post-11/1/2025 |
| Montana DPHHS SNAP 802-1, ABAWD Geographic Waiver | direct PDF fetch, clean | effective 11/01/2025 |
| Montana DPHHS SNAP 1502-1, Recertification | direct PDF fetch, clean | fetched 2026-08-12 |
| Montana DPHHS SNAP 0-3, Introduction | direct PDF fetch, clean | fetched 2026-08-12 |
| Montana DPHHS SNAP 103-1, Application Filing/Interview Process | direct PDF fetch, clean | fetched 2026-08-12 |
| Montana Legislature, MCA Title 53 Ch. 2 Part 9 (Food Stamp Program) sections index | direct fetch via chained 301 redirects | fetched 2026-08-12 |
| WebSearch corroboration only (ARM 37.76.x rule numbers/titles; USDA RMP 9-state list; Propel's drug-felony claim, cross-checked and corrected) | WebSearch, not independently fetched | see freshness.json for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (MT guide questions), `eval/answer-eval.ts` (MT_GOLD, spread into
ALL_GOLD). Montana is deliberately NOT added to any `engine-citations.ts` per-state constant map —
Montana has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("MT",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build adds
a Montana policy — this matches the precedent already set by this roster's other blank-slate corpus
packs.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Montana `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Five-agent parallel batch:** Montana was built in parallel with Rhode Island (RI), Delaware (DE),
South Dakota (SD), and North Dakota (ND) — five separate agents in the same window, each on its
own branch (`feat/demeter-mt-corpus` for this one). All five states register in the same four shared
files (`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and
therefore all five PRs are expected to conflict with each other on merge. The rule to follow when
resolving that conflict is to always COMBINE every state's additions (StateCode union members,
REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never to
drop another state's entry to resolve a conflict — matching the precedent this roster's prior
same-window batch tiers already set.
