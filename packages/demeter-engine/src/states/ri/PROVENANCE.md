# Rhode Island pack — provenance

**Created:** 2026-08-12. Rhode Island is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, New Mexico's, and New
Hampshire's prior builds, Rhode Island has NO existing `packages/snap-rules` entry and NO oracle
fixture coverage at all. No discrepancy-checking against an existing engine constant was possible
or attempted; this pack's findings stand entirely on its own primary-source research. This task's
scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay
fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Rhode Island was built as one of a five-agent parallel batch (RI, MT, DE, SD, ND), each on its own
branch, in the same window.

## Method

`dhs.ri.gov` returned a clean HTTP 200 to every direct curl attempt with a standard browser
User-Agent, including every PDF download this pack needed — NO WAF/bot-detection barrier this
pack encountered, in contrast to this roster's New Hampshire pack. The only friction: Rhode
Island's official regulation host, `rules.sos.ri.gov`, is a JavaScript single-page application
that a plain curl fetch could not extract full section body text from. This pack resolved this
entirely by locating and directly curl-fetching `dhs.ri.gov`'s own hosted copy of the same
268-page 218-RICR-20-00-1 regulation PDF (`dhs.ri.gov/media/7796/download`), run through
`pdftotext -layout` for full verbatim section text. This pack also directly curl-fetched Rhode
Island General Laws (`webserver.rilegislature.gov`) and USDA FNS/FNA's ABAWD waiver index (no
barrier at either), and used WebSearch for corroboration on a small number of secondary details
flagged explicitly in `freshness.json`.

## Finding 0 — a genuine tooling trap caught: dhs.ri.gov's own hosted regulation PDF contains
REDLINED, stale dollar figures from an August 2024 rulemaking amendment

`dhs.ri.gov/media/7796/download` — the full 218-RICR-20-00-1 regulation, hosted directly by DHS
itself — is dated August 2024 and shows visible redline artifacts: dollar figures render as
garbled single strings combining a struck-through OLD figure with an inserted NEW figure (e.g.
Rhode Island's resource limits appear as the literal text "$4,250500.00" and "$2,7503,000.00" in
the extracted PDF text, meaning old-$4,250-struck/new-$4,500-inserted and
old-$2,750-struck/new-$3,000-inserted respectively — an FFY2023-to-FFY2024 amendment, itself now
two COLA cycles stale). Had this pack used this PDF's dollar figures directly, it would have
published double-stale, actively-wrong figures. This pack caught this by checking the PDF's own
creation date (August 2024, via `pdfinfo`) against the known FFY2026 COLA cycle, and instead
cross-verified every dollar figure against a separately-fetched, correctly-dated DHS PDF (the
SNAP Annual Cost of Living Adjustment, Effective October 1, 2025) and DHS's live Eligibility & How
to Apply page — both of which independently agree and reflect the current FFY2026 cycle. This
pack DID rely on the redlined PDF's structural/procedural text (categorical-eligibility mechanics,
resource-test exemptions, vehicle-exclusion rules, deduction methodology, certification-period
rules), none of which showed comparable redlining.

## Finding 1 (flagship, structural) — Rhode Island's gross-income gate is TWO-TIER: 185% FPG for
households without an elderly/disabled member, 200% FPG for households WITH one — not a single
flat BBCE percentage

Several secondary sources this pack found compress Rhode Island's structure into a flat "185%
BBCE" claim. This pack's direct read of DHS's own current SNAP Annual Cost of Living Adjustment
(effective 10/1/2025) and live Eligibility & How to Apply page finds a precise two-tier structure:
185% FPG gross-income ceiling for households without an elderly (60+) or disabled member, and a
HIGHER 200% FPG ceiling for households WITH one — both established via 218-RICR-20-00-1 § 1.5.1's
"expanded categorical eligibility" pathway for TANF-funded-service households, and both exempt
from the resource test entirely once established. A household that has NOT established categorical
eligibility by this or another pathway (RI Works, SSI, GPA) still faces a real, enforced resource
limit — $4,500 (elderly/disabled) or $3,000 (all other) — under § 1.5.5(B)(1), remaining subject
to the underlying income tests. This pack's reading: the large majority of Rhode Island SNAP
households likely qualify via the 185%/200% categorical-eligibility pathway and therefore never
face a resource test, but the flat "no asset limit in Rhode Island" framing several secondary
sources use is not literally, universally true.

## Finding 2 (flagship, primary-source confirmation of a minority-position claim) — Rhode Island
FULLY opted out of the federal drug-felony SNAP ban, per its own general laws

Several secondary sources describe Rhode Island as having "fully opted out" of the federal
drug-felony SNAP ban. This pack treats a full opt-out as a genuine minority position among states
nationally (most states this roster has built carry a MODIFIED ban, not a full opt-out) and sought
primary-source confirmation rather than accepting the secondary-source claim at face value. This
pack fetched Rhode Island General Laws § 40-6-8 directly and confirms the claim precisely:
subsection (d) states "No person shall be ineligible for food stamp benefits due solely to the
restricted eligibility rules otherwise imposed by § 115(a)(2) of the Personal Responsibility and
Work Opportunity Reconciliation Act of 1996 ... 21 U.S.C. § 862a(a)(2)." This pack additionally
cross-checked Rhode Island's own 268-page SNAP regulation in full and confirms it contains NO
drug-felony-conviction disqualification provision anywhere in its text — corroborating the
statutory opt-out by absence, and distinguishing it explicitly from the SEPARATE
SNAP-benefits-for-controlled-substances trafficking penalty (24 months first offense, permanent
second offense), which is a program-integrity rule, not a drug-felony-conviction ban.

## Finding 3 (flagship, minority-position structural departure) — Rhode Island's vehicle exclusion
is CAPPED at two (2) vehicles per household, unlike this roster's uncapped-per-adult states

218-RICR-20-00-1 § 1.5.5(D)(1)(d)(AA) excludes one vehicle per adult household member, but "not to
exceed two (2) vehicles per household" — a narrower rule than the uncapped "one vehicle per adult
member, regardless of count" rule this roster's New Hampshire and several other states carry. This
pack cross-checked this specific figure against independent secondary-source corroboration
(WorkWORLD, SNAP Screener), which matched precisely. A secondary-source claim of a $4,650
fair-market-value threshold for additional vehicles beyond the cap could NOT be located or
confirmed in Rhode Island's own primary regulation text and is flagged as unconfirmed in
`freshness.json`.

## Finding 4 — Rhode Island's Standard Utility Allowance is a SINGLE combined tier ($844/month),
simpler than a multi-tier structure split by utility type

218-RICR-20-00-1 § 1.5.7(C) defines only three utility-cost methods: the SUA ($844/month current
FFY2026, a single tier bundling heating/cooling, cooking fuel, non-heat electricity/gas, one
telephone line, water, sewerage, and trash), actual non-heat utility expenses for a household not
SUA-eligible, or a $26/month Standard Telephone Allowance for a phone-only household not
SUA-eligible. This pack flags this as simpler than this roster's New Hampshire, which carries a
4-tier utility structure split partly by utility TYPE (Heating/Cooling, Utilities-Only,
Electric-Only, Telephone-Only). Consistent with the OBBBA "Heat and Eat" restriction this roster
has documented in other 2025-2026-built packs, DHS's own current SUA Update (effective 11/1/2025)
confirms households WITHOUT an elderly/disabled member can no longer automatically qualify for the
SUA via LIHEAP receipt alone and must now document actual heating/cooling expenses.

## Finding 5 — Rhode Island DELAYED its OBBBA ABAWD rollout to March 1, 2026, later than the
federal November 1, 2025 effective date most other states implemented on

Rhode Island DHS's own current ABAWDs FAQ (updated January 7, 2026) states DHS "is extending the
start date of this change to March 1 to help ensure customers can prepare for the federal change"
— for newly-affected ABAWDs, March 1, 2026 is their first countable month, not the federal 11/1/2025
date. This pack flags this as a genuinely distinctive, RI-specific implementation-timing departure
worth naming explicitly, since it directly affects when a Rhode Island applicant's countable months
began counting relative to what a nationally-generic OBBBA answer would state. USDA FNS/FNA's own
ABAWD Time Limit Waivers FY 2025-2029 index shows Rhode Island's most recent posted entry as FY2025
(dated 03/12/2025), with no FY2026 entry — consistent with no currently active area-wide ABAWD
waiver anywhere in the state.

## Finding 6 — Rhode Island DOES operate a Restaurant Meals Program, but a narrow one: nine
Subway locations only

DHS's own Online Purchasing & Restaurant Meals Program page confirms Rhode Island operates an RMP
for homeless and some elderly/disabled households, but currently limited to nine participating
Subway restaurants — a single-chain, narrow program, distinct from broader multi-vendor RMPs this
pack has seen described in other states.

## Finding 7 — Rhode Island's standard SNAP certification period is 12 months, matching the norm
most other states in this roster use (a genuine non-departure, stated explicitly)

218-RICR-20-00-1 § 1.8 assigns 36 months to ESAP (all-elderly/disabled, no-earned-income)
households, 24 months to migrant/seasonal-farmworker households, and 12 months (standard
Simplified Reporting) to all other households — Rhode Island does NOT carry this roster's New
Hampshire's unusually short 6-month standard period. This pack states this positively rather than
assuming every state's standard period needs its own flagged departure.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

Rhode Island has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Rhode Island (out of scope for this task,
requiring its own separate, explicit go-ahead per the standing park rule) should treat this pack's
citations as a starting point, not a final answer, and should specifically re-verify the 2-vehicle
exclusion cap (Finding 3) and the 185%/200% two-tier income structure (Finding 1) before hardcoding
Rhode Island's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Rhode Island text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying
primary text; a PDF's creation/amendment date relative to the current COLA cycle; and any
Rhode Island-vs-common-assumption contrast overclaimed as settled when the underlying evidence was
genuinely single-sourced. Concrete catches from this pass:

- The redlined-PDF trap (Finding 0) is the most consequential catch in this pack: an early
  extraction pass, before this pack checked the PDF's creation date via `pdfinfo` against the known
  FFY2026 COLA cycle, would have published two-cycles-stale dollar figures (some doubly garbled by
  the redline artifacts themselves) as current. This pack instead cross-verified every dollar figure
  against a separately-fetched, correctly-dated DHS PDF and discloses the near-miss explicitly.
- The two-tier 185%/200% income structure (Finding 1) does not simply repeat the "185% BBCE" framing
  several secondary sources use — it reads DHS's own live eligibility page and dated COLA PDF side
  by side and states explicitly that elderly/disabled households face a materially higher ceiling,
  rather than letting the majority-case simplification stand in for the full rule.
- The drug-felony finding (Finding 2) is grounded in R.I. Gen. Laws § 40-6-8's own statutory text,
  not merely repeated from a secondary source's "fully opted out" framing, and is additionally
  corroborated by this pack's own full-text read of the 268-page SNAP regulation finding no
  contradicting drug-felony provision anywhere in it.
- The vehicle-cap finding (Finding 3) is grounded in the primary regulation's own text
  ("not to exceed two (2) vehicles per household"), with the SEPARATE $4,650 fair-market-value claim
  explicitly flagged as unconfirmed rather than folded into the same sentence as if both figures
  carried equal evidentiary weight.
- The Restaurant Meals Program finding does not merely cite presence-of-mention — it reports the
  genuine narrowness of Rhode Island's program (nine Subway locations only) rather than letting a
  bare "yes, RI has an RMP" answer imply a broader program than DHS's own page describes.
- The certification-period finding explicitly states Rhode Island does NOT depart from the 12-month
  norm, rather than searching for a departure to report simply because other supplements in this
  pack found genuine departures elsewhere.

## Sources

| Source | Access | Dated |
|---|---|---|
| Rhode Island DHS, SNAP consumer landing page and Eligibility & How to Apply page | direct curl fetch (browser UA) | fetched 2026-08-12, page states "last updated September 15th, 2025" |
| Rhode Island DHS, SNAP Annual Cost of Living Adjustment PDF, Effective October 1, 2025 | direct curl fetch (browser UA) + pdftotext | fetched 2026-08-12, effective 10/1/2025 |
| Rhode Island DHS, Standard Utility Allowance (SUA) Update PDF, Effective November 1, 2025 | direct curl fetch (browser UA) + pdftotext | fetched 2026-08-12, effective 11/1/2025 |
| Rhode Island DHS, ABAWDs New Federal SNAP Work Requirements FAQ | direct curl fetch (browser UA) + pdftotext | fetched 2026-08-12, updated 1/7/2026 |
| Rhode Island DHS, full 218-RICR-20-00-1 regulation PDF (268 pages) | direct curl fetch (browser UA) + pdftotext -layout | fetched 2026-08-12; PDF itself dated/created August 2024, contains stale REDLINED dollar figures this pack did not rely on (see Finding 0) |
| Rhode Island DHS, Online Purchasing & Restaurant Meals Program page | direct curl fetch (browser UA) | fetched 2026-08-12 |
| Rhode Island DHS, Elderly & Disabled Simplified Application Project (ESAP) page | WebSearch corroboration only, page URL identified but summary-level content used | fetched via search summary 2026-08-12 |
| Rhode Island Department of State, 218-RICR-20-00-1 table of contents | WebFetch (JS-rendered) | fetched 2026-08-12 |
| Rhode Island General Laws § 40-6-8 | direct curl fetch (browser UA) + WebFetch cross-check | fetched 2026-08-12, most recently amended eff. 6/29/2025 |
| USDA FNS/FNA, ABAWD Time Limit Waivers FY 2025-2029 index | direct curl fetch (browser UA), clean HTTP 200 | fetched 2026-08-12 |
| WebSearch corroboration only (2-vehicle-cap secondary confirmation; $4,650 FMV threshold claim, unconfirmed; RIBridges December 2024 breach and 2025 relaunch, resolved historical context) | WebSearch, not independently fetched as primary text | see freshness.json for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (RI guide questions), `eval/answer-eval.ts` (RI_GOLD, spread into
ALL_GOLD). Rhode Island is deliberately NOT added to any `engine-citations.ts` per-state constant
map — Rhode Island has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("RI", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Rhode Island policy — this matches the precedent already set by
Nebraska's, North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's,
Maryland's, Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, Oklahoma's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, New Mexico's, and New
Hampshire's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Rhode Island `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.

**Five-agent parallel batch:** Rhode Island was built in parallel with Montana (MT), Delaware (DE),
South Dakota (SD), and North Dakota (ND) — five separate agents in the same window, each on its own
branch (`feat/demeter-ri-corpus` for this one). All five states register in the same four shared
files (`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and
therefore all five PRs are expected to conflict with each other on merge. The rule to follow when
resolving that conflict is to always COMBINE every state's additions (StateCode union members,
REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never to
drop another state's entry to resolve a conflict — matching the precedent this roster's prior
same-window batch tiers (Mississippi/Kansas/New Mexico/Nebraska; Florida/Massachusetts/Nevada/Arizona;
Idaho/West Virginia/Hawaii/New Hampshire/Maine) already set.
