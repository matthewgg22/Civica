# Wyoming pack — provenance

**Created:** 2026-08-12. Wyoming is a genuine BLANK SLATE in this roster — like Delaware's,
Nebraska's, Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, and New Mexico's
prior builds, Wyoming has NO existing `packages/snap-rules` entry and NO oracle fixture coverage at
all. No discrepancy-checking against an existing engine constant was possible or attempted; this
pack's findings stand entirely on its own primary-source research. This task's scope was CORPUS
ONLY — the Demeter chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the standing
rule (`feedback_dashboard_snap_rules_parked`).

Wyoming was built as one of a six-agent parallel batch (AK, VT, WY, DC, Guam, USVI), each on its own
branch, in the same window — this batch closes out the standard 50-state roster.

## Method

`dfs.wyo.gov` returned clean HTTP 200 to every direct curl attempt this pack made with a standard
browser User-Agent, including nine separate SNAP and POWER Policy Manual accordion sub-pages (100,
300, 500, 600, 700, 800, 900, 1100, 1200) — no WAF/bot-detection barrier of the kind this roster's
New Hampshire and Maine packs encountered. Two accordion URL guesses (200, 400, 1000) returned clean
HTTP 404s, meaning those numeric ranges are folded into adjacent sections rather than genuinely
missing content; this pack cross-checked full section-500 coverage (which lists every SNAP
eligibility factor by its section number) to confirm no numbered section was silently skipped.
`fns.usda.gov` (SNAP State Options Report PDF host, ABAWD waiver index) returned clean HTTP 301
redirects to a rebranded `fna.usda.gov` / `fns-prod.azureedge.us` host — reflecting a genuine USDA
Food and Nutrition Service-to-Food and Nutrition Administration (FNS-to-FNA) agency rename this pack
had not previously encountered in this roster; both redirects resolved cleanly to HTTP 200.

## Finding 0 (structural flagship, confirmed by BOTH a primary state source and a primary federal
source) — Wyoming is one of only 9 states nationally WITHOUT Broad-Based Categorical Eligibility

Wyoming DFS's own current Table I income-limits table carries NO 200% FPL column at all — only
165% (elderly/disabled separate-household gross test), 130% (standard gross), and 100% (net). This
pack independently fetched USDA FNS/FNA's own 16th-edition SNAP State Options Report (June 2024)
directly and found Wyoming listed under "No BBCE (9)" for the Broad-Based Categorical Eligibility
option — one of only nine states nationally without it. Wyoming DFS's own manual (Section 502)
independently confirms this: categorical eligibility is narrowly SSI/POWER/Tribal-TANF-recipiency
based only, with no income-based BBCE gate. This is a genuine minority-position structural fact,
corroborated by two independent primary sources agreeing with each other, not an error or omission.

## Finding 1 (flagship, primary-source correction of a widely-repeated, template-style
secondary-source claim, reached via a primary FEDERAL source rather than a state regulation chase)
— Wyoming has FULLY opted out of the federal drug-felony SNAP ban; several secondary sources
describing a "modified" ban conditioned on sentence/treatment compliance are simply wrong, not
merely stale

This pack found the SAME near-verbatim claim repeated across several low-quality SNAP-aggregator
secondary sources describing Wyoming as having a "modified" drug-felony ban conditioned on sentence
and treatment compliance — language this pack could trace to NO identifiable Wyoming-specific
primary source. This pack fetched USDA FNS/FNA's own 16th-edition SNAP State Options Report directly
and found Wyoming listed under "No disqualification (28)" for Drug Felony Disqualifications (7 CFR
273.11(m)). This pack independently corroborated that finding against Wyoming's own DFS manual: the
600-series section range (601-610) contains NO drug-felony-conviction disqualification section at
all — the only criminal-justice disqualification category in the entire manual is fleeing-felon/
probation-or-parole-violator status (Section 610), a narrower, differently-scoped provision. Unlike
this roster's Delaware pack (which traced a clean repeal order, 21 DE Reg. 722, for a provision that
DID once exist), this pack found no evidence such a drug-felony provision ever existed in Wyoming's
own regulatory history — a stronger correction than a typical staleness catch, and the underlying
enabling-statute citation itself remains a disclosed, unresolved gap (see freshness.json).

## Finding 2 — Wyoming's own DFS manual carries three specific, disclosed notes on FDPIR interaction
and reservation-specific administration (Wind River Reservation), and this pack found no evidence of
a broader tribal-administration structure beyond these three points

Researched specifically per this task's scope. Section 402 (Client's Rights) states plainly that
SNAP and the Food Distribution Program on Indian Reservations (FDPIR) are mutually exclusive — "under
no circumstances shall any household participate simultaneously" in both. Section 401 directs
enrolled Tribal members resident in Fremont or Hot Springs County (the two counties overlapping Wind
River, shared by the Eastern Shoshone and Northern Arapaho tribes) applying for Tribal TANF
specifically (not SNAP) to the appropriate Tribal TANF office — SNAP applications themselves still
route through standard DFS Field Offices. Section 708(B)(7) exempts any "member of an Indian tribe"
from the ABAWD work-requirement time limit entirely, a categorical membership-based exemption not
geographically restricted to Wind River. This pack discloses explicitly that this is the full extent
of what DFS's fetched manual sections and consumer pages state, and does not assume a broader
tribal-SNAP-administration structure (e.g., a tribal 638 SNAP agreement) exists beyond this.

## Finding 3 — a genuinely time-sensitive, not-yet-effective federal food-restriction demonstration
waiver: Wyoming will exclude sweetened, carbonated beverages from SNAP-purchasable items starting
February 1, 2027

This pack fetched a primary USDA FNA approval letter (dated 3/4/2026) confirming a 2-year
demonstration-project waiver excluding "sweetened, carbonated beverages" from SNAP-eligible food
statewide, with NO household opt-out, effective February 1, 2027. As of this pack's fetch date
(2026-08-12), the restriction is approved but NOT yet in effect — an applicant asking today what
they can buy with SNAP in Wyoming should be told sweetened, carbonated beverages ARE currently
purchasable, with an explicit flag that this changes on 2/1/2027. This finding was discovered
opportunistically while researching Restaurant Meals Program status via WebSearch, not from any
DFS-published source this pack found directly — flagged in freshness.json with a hard expiry date
tied to the waiver's own effective date.

## Finding 4 — DFS's own "Do I Qualify" consumer page carries stale standard-deduction and
shelter-cap figures that contradict DFS's own current Table I page for the same FFY2026 cycle

DFS's Table I page (explicitly self-dated "October 1, 2025 - September 30, 2026," with the prior
FFY2025 table visible immediately below it on the same page) states a Standard Deduction of
$209/$223/$261/$299 (by AU-size tier) and a $744 nonelderly/nondisabled shelter cap. DFS's separate
"Do I Qualify?" consumer page states $177/$184/$215/$246 and a $569 shelter cap for the same
categories — lower figures this pack could not confirm as a specific prior-FFY baseline but which
plainly conflict with Table I's explicitly-dated current figures. This pack treats Table I as
authoritative (it self-dates and shows its own historical comparison) and flags the "Do I Qualify"
page's figures as stale, an internal-site inconsistency structurally similar to, though independently
discovered from, this roster's Delaware pack's internal-DSSM-staleness catches.

## Finding 5 — Wyoming caps ALL certification periods at 12 months, with NO extended 24-month track
even for all-elderly/disabled no-earned-income households

Section 1201(D)(1) caps certification periods at 12 months on a calendar-month basis. Section
1201(J), effective January 1, 2016, explicitly confirms the 12-month cap applies even to
all-elderly/disabled no-earned-income households — Wyoming does NOT extend to 24 months the way
several other states in this roster (including this pack's own Delaware template) do for that
household type. A genuine, disclosed structural contrast rather than an oversight.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

Wyoming has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Wyoming (out of scope for this task, requiring its
own separate, explicit go-ahead per the standing park rule) should treat this pack's citations as a
starting point, not a final answer, and should specifically re-verify the enabling statute for
Wyoming's drug-felony opt-out (Finding 1, disclosed gap) and re-confirm the food-restriction waiver's
actual effective status (Finding 3) once past 2/1/2027 before hardcoding Wyoming's parameters into
engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Wyoming text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying primary
text; DFS manual section dates checked against known federal effective-date changes (OBBBA
7/4/2025); and any Wyoming-vs-common-assumption contrast overclaimed as settled when the underlying
evidence was genuinely single-sourced. Concrete catches from this pass:

- The No-BBCE finding (Finding 0) is grounded in TWO independent primary sources agreeing with each
  other (USDA's own federal report AND Wyoming's own manual text) rather than either alone — a
  stronger evidentiary basis than most single-source findings in this roster.
- The drug-felony finding (Finding 1) explicitly distinguishes "fully opted out, never had such a
  provision" from Delaware's "fully opted out via a traceable repeal of a provision that once
  existed" — an early draft pass that simply said "Wyoming has no drug felony ban" without this
  distinction would have understated how much stronger this correction is than a typical staleness
  catch, since the secondary-source claim here appears to be fabricated/templated rather than merely
  dated.
- The food-restriction-waiver finding (Finding 3) is stated with an explicit, hard NOT-YET-EFFECTIVE
  flag and a freshness.json expiry keyed to the waiver's own 2/1/2027 effective date, rather than
  being described as a current restriction — an early framing that led with "Wyoming excludes soda
  from SNAP" without the effective-date qualifier would have been actively wrong as of this pack's
  own fetch date.
- The tribal/FDPIR finding (Finding 2) explicitly states the boundary of what this pack found and
  declines to assume a broader tribal-SNAP-administration structure exists — this pack checked
  specifically for a tribal 638-style SNAP agreement analog and found none in the fetched materials,
  and says so rather than staying silent on the boundary.
- The "Do I Qualify" vs. Table I inconsistency (Finding 4) was not obvious from a single fetch — it
  required directly comparing both DFS consumer pages' dollar figures against each other; an early
  draft pass that only fetched Table I (the newer, comprehensive page) would have missed this
  internal-site staleness catch entirely, since the "Do I Qualify" page appears in its own right to
  be a plausible, well-formatted, current-looking source with no obvious date stamp signaling
  staleness — a legacy-mirror-style trap on the SAME domain rather than a separate stale mirror site.

## Sources

| Source | Access | Dated |
|---|---|---|
| Wyoming DFS, SNAP consumer page | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| Wyoming DFS, SNAP: Do I Qualify? consumer page | direct fetch, clean HTTP 200 | fetched 2026-08-12; FLAGGED stale relative to Table I |
| Wyoming DFS, Table I: SNAP Income Limits page | direct fetch, clean HTTP 200 | fetched 2026-08-12; current table published 10/1/2025-9/30/2026 |
| Wyoming DFS SNAP and POWER Policy Manual, Sections 100/300/500/600/700/800/900/1100/1200 (9 accordion pages) | direct fetch, clean HTTP 200 each | fetched 2026-08-12 |
| USDA FNS/FNA, SNAP State Options Report, 16th Edition | direct fetch, clean HTTP 200 after 301 redirect | dated June 2024, fetched 2026-08-12 |
| USDA FNA, Wyoming SNAP Food Restriction Waiver Demonstration Project approval letter | direct fetch, clean HTTP 200 | dated 3/4/2026, effective 2/1/2027, fetched 2026-08-12 |
| USDA FNA, SNAP Time Limit (ABAWD) Waivers FY2025-2029 index | direct fetch, clean HTTP 200 after 301 redirect | fetched 2026-08-12; Wyoming absent from state-response list |
| WebSearch corroboration only (drug-felony "modified ban" claim, actively CONTRADICTED by this pack's primary-source fetch; Restaurant Meals Program absence; food-restriction-waiver discovery lead) | WebSearch, not independently fetched except where a primary URL was then directly fetched | see freshness.json and Finding 1 for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (WY guide questions), `eval/answer-eval.ts` (WY_GOLD, spread into
ALL_GOLD). Wyoming is deliberately NOT added to any `engine-citations.ts` per-state constant map —
Wyoming has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("WY",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build
adds a Wyoming policy — this matches the precedent already set by every prior blank-slate corpus
pack in this roster, including Delaware's most recent build.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Wyoming `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Six-agent parallel batch:** Wyoming was built in parallel with Alaska (AK), Vermont (VT),
District of Columbia (DC), Guam, and U.S. Virgin Islands (USVI) — six separate agents in the same
window, each on its own branch (`feat/demeter-wy-corpus` for this one), closing out the standard
50-state roster. All six states register in the same four shared files (`states/index.ts`,
`packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and therefore all six PRs are
expected to conflict with each other on merge. The rule to follow when resolving that conflict is to
always COMBINE every state's additions (StateCode union members, REGISTRY entries, QUESTIONS
entries, and `_GOLD` arrays spread into the aggregate export), never to drop another state's entry to
resolve a conflict — matching the precedent this roster's prior same-window batch tiers already set.
