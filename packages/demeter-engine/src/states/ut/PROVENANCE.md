# Utah pack — provenance

**Created:** 2026-08-12. Utah is a genuine BLANK SLATE in this roster — like Oklahoma's,
Kentucky's, Louisiana's, and Alabama's prior builds, Utah has NO existing `packages/snap-rules`
entry and NO oracle fixture coverage at all. No discrepancy-checking against an existing engine
constant was possible or attempted; this pack's findings stand entirely on its own primary-source
research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does
not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which
stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Utah is the first state built in this roster's new **batch tier** — smaller-population states now
built 3-5 at a time in parallel, rather than the prior one-at-a-time individual tier that ended
with Oklahoma. Connecticut, Iowa, and Arkansas were built concurrently by separate agents; this
pack was drafted expecting (and did hit) a merge conflict on the four shared registration files.

## Method

Direct `curl` fetch (browser User-Agent) of DWS's own numbered-chapter online eligibility policy
manual (`jobs.utah.gov/infosource/eligibilitymanual/...`) — including Table 2 ("SNAP Monthly Income
Limits and Maximum Assistance Amounts," effective 10/1/2025, current FFY2026 figures), Policy 342
("SNAP Work Requirements," effective 5/1/2026), and Policy 342-1A ("Federal Exemptions," effective
2/1/2026) — all clean HTTP 200. Also directly fetched: DWS's own consumer-facing SNAP pages
(deductions, requirements, application basics, EBT card instructions, reviews), all clean HTTP 200;
the Utah Legislature's own current compiled Utah Code § 35A-3-311 (`le.utah.gov`, clean HTTP 200,
current version effective 5/6/2026); Utah Administrative Code R986-900-901 and R986-900-902 via the
Cornell Legal Information Institute's regulatory mirror (clean HTTP 200); USDA FNA's own SNAP Food
Restriction Waiver approval letter for Utah and DWS's own December 2025 press release on the
identical soft-drink demonstration project; USDA FNA's current Restaurant Meals Program state list
and Time Limit (ABAWD) Waivers FY2025-2029 state-response index (both clean HTTP 200, Utah absent
from both). WebSearch was used throughout to locate exact manual-chapter URLs before every direct
primary-source fetch, and to identify — then confirm or reject — several widely-repeated
secondary-source claims about Utah's BBCE and vehicle-resource-treatment status.

## Finding 0 — no primary-source access barrier encountered; the genuine gap here is
discoverability, not blocking

Unlike this roster's Oklahoma, Louisiana, Virginia, Indiana, Missouri, Maryland, Colorado, South
Carolina, Alabama, and Kentucky packs — each of which hit at least one HTTP 403 on a primary
administrative-code host — every DWS, Utah Legislature, Cornell LII, and USDA FNA URL this pack
attempted returned a clean HTTP 200 to direct curl with a browser User-Agent. The genuine research
gap this pack found instead was DISCOVERABILITY: Utah's current Standard Utility Allowance (SUA)
dollar figure could not be located on any DWS-hosted public page during this pack's research
window, despite Utah's own regulation (R986-900-902(1)(d)) directly confirming the figures exist,
are mandatory, and are "updated annually" — the regulation states plainly that Utah's three utility
standards are "available upon request," meaning DWS appears not to publish them inline on a public
page this pack's systematic search located, rather than blocking access to a page that exists. This
pack explicitly did NOT reuse a stale $376 figure (effective 10/1/2021) found repeated by several
secondary aggregator sites, and does not fabricate a current figure (see freshness.json).

## Finding 1 (flagship, structural) — Utah's SNAP-specific Administrative Code is genuinely thin;
the operative policy detail lives in a separately-published online manual instead

Utah Admin. Code R986-900 (the state's SNAP-specific Administrative Code chapter) contains only TWO
sections total: R986-900-901 ("Authority for Food Stamps and Applicable Rules," which incorporates
7 CFR 271 through 283 by reference and applies the general R986-100 provisions "except where
specifically noted otherwise") and R986-900-902 ("Options and Waivers," a short enumerated list of
federal options Utah has elected). This pack directly confirmed, via a Cornell LII fetch of both
sections in full, that neither contains the kind of detailed, numbered eligibility mechanics this
roster's Oklahoma pack found densely populating OAC 340:50's dozens of sections, or Kentucky's MS
numbering scheme. Instead, R986-900-901's own text states: "The state maintains a policy manual
describing the benefits and eligibility requirements for receipt of food stamps. The policy manual
is available on the Department's Internet web site" — and this pack independently located and
directly fetched that separate manual (`jobs.utah.gov/infosource/eligibilitymanual/...`), confirming
it is where Utah's actual day-to-day SNAP eligibility policy lives (income tables, ABAWD age ranges,
work-requirement exemptions, review cycles) rather than in the Administrative Code chapter itself.
This is a genuine, directly-confirmed structural departure from this roster's established pattern,
not an assumption based on Utah's chapter simply being shorter than others.

## Finding 2 (flagship, positive) — Utah's OWN current policy manual already states the correct
post-OBBBA ABAWD age range (18-64) — a genuine contrast with several other states in this roster

DWS's own Policy 342 (SNAP Work Requirements, effective May 1, 2026, fetched directly) states in
its own words: "ABAWD – An ABAWD is defined as a person able to work, between the ages of 18-64 and
in a household with no dependent children." This directly and correctly reflects the current
federal standard set by the One Big Beautiful Bill Act (OBBBA), signed July 4, 2025, effective
immediately upon enactment. This is a genuine, checked-for POSITIVE finding worth stating plainly —
a direct contrast with this roster's Oklahoma pack, which found THREE different, all-stale ABAWD
age figures across Oklahoma's own primary sources, none matching the current federal standard. This
pack specifically checked Utah's consumer-facing pages for a second, possibly-stale figure the way
Oklahoma's consumer page diverged from its own statute and regulation, and found none — Utah's
Able-Bodied Adults Without Dependents (ABAWD) consumer page (`work_able.html`, fetched directly)
does not state a numeric age range at all, so this pack found no internal Utah inconsistency to
disclose, unlike Oklahoma's three-way conflict.

## Finding 3 (flagship, structural, current, time-sensitive) — Utah is running an active federal
demonstration project that bars SNAP from buying soft drinks — with no precedent anywhere else in
this roster

Effective January 1, 2026, Utah SNAP recipients cannot use benefits to buy "soft drinks," under a
two-year USDA FNA demonstration waiver approved May 16, 2025, implementing Utah H.B. 403 (2025
General Session). This pack fetched USDA FNA's own approval letter directly (clean HTTP 200) and
independently cross-checked it against DWS's own December 29, 2025 press release, both of which
state the same effective date, the same precise "soft drink" definition (carbonated, sugar- or
artificially-sweetened, explicitly excluding milk/milk-substitute drinks and any drink more than
half real juice by volume), and the same explicit disclaimer that this is a purchase restriction,
not a benefit-amount reduction. This is a genuinely novel structural feature with no precedent in
this roster's 29 previously-verified states — none of them carries an active SNAP food-purchase
restriction beyond the ordinary federal exclusions (alcohol, tobacco, hot prepared food, non-food
items). This pack flags the demonstration's two-year window (expiring around January 1, 2028) in
freshness.json as a genuine time-sensitivity a future update must re-check.

## Finding 4 — CONFIRMED, not overclaimed: Utah has NOT adopted Broad-Based Categorical Eligibility

DWS's own current Table 2 (SNAP Monthly Income Limits, effective October 1, 2025, fetched directly)
publishes the plain federal 130%/100% FPL gross/net income tests with no third, higher
percentage-of-FPL band, and Utah Admin. Code R986-900-902's own enumerated list of adopted federal
options does not include a BBCE election. This pack treats this as a CONFIRMATION of a
widely-repeated secondary-source claim this pack found during research (rather than a correction),
directly verified against Utah's own current primary sources rather than assumed true because the
secondary sources agreed with each other.

## Finding 5 — CORRECTING a widely-repeated secondary-source claim: Utah's own DWS page states a
car usually does NOT count toward the resource limit, despite Utah's non-BBCE status

Several secondary SNAP-eligibility aggregator sites this pack found during research assert that
Utah counts vehicle fair-market value against the resource limit, reasoning from Utah's non-BBCE
status alone (grouping Utah with Kansas, Mississippi, Missouri, South Dakota, Tennessee, and
Wyoming as states where "vehicle value may directly affect your SNAP eligibility"). This pack did
NOT repeat that inference uncritically. DWS's own consumer page (`deductions.html`, fetched
directly) states plainly: "your car and any other motorized vehicles you own are usually not
counted toward the resource limit." Utah Admin. Code R986-900-902(1)(h) confirms the specific
mechanism: "The Department has opted to use Utah's TANF vehicle allowance rules in conjunction with
the Food Stamp Program vehicle allowance regulations at 7 CFR 273.8, as authorized by Pub. L.
No. 106-387 of the Agriculture Appropriations Act 2001." BBCE status and the vehicle-exclusion
election are two independently-elected federal options — Utah elected the vehicle exclusion despite
not electing BBCE, and this pack corrects the aggregator inference rather than assuming a state's
non-BBCE status necessarily implies it counts vehicles.

## Finding 6 — Utah's EBT card has a distinctive, directly-confirmed name: the Utah Horizon Card

DWS's own EBT Card Basic Instructions page (fetched directly, clean HTTP 200) states plainly: "Your
Utah Horizon EBT card is how you get your food assistance (SNAP) or cash benefits," and the page
title itself reads "EBT Card (Horizon Card) Basic Instructions." This is a direct primary-source
confirmation, not a secondary-source guess this pack chose to trust uncritically — the same standard
of verification this roster's Kentucky and Oklahoma packs applied to their own EBT-card-name
findings (Kentucky: no distinctive name found; Oklahoma: ACCESS Oklahoma Card).

## Finding 7 — a precise statutory-scoping nuance in Utah's drug-felony opt-out: the treatment
condition appears tied to cash assistance, not SNAP

Utah Code § 35A-3-311(2)(b), read directly from the Legislature's own current compiled text,
extends the state's opt-out to "cash assistance and SNAP benefits" together. But subsection (2)(c),
which imposes a substance-abuse-treatment condition on "a drug dependent person," is textually
scoped to "cash assistance under this part" — not repeating the "and SNAP benefits" language from
(2)(b). This pack reads this as meaning the treatment condition applies to Family Employment
Program (FEP) cash assistance specifically, not to SNAP eligibility, but flags this precise scoping
question in freshness.json as worth independent confirmation with DWS before treating it as fully
settled, since the statute's own drafting does not resolve the ambiguity with total clarity — a
genuine, disclosed close reading rather than an assumed clean generalization.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Utah has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine constant
this pack could confirm or contradict — every finding above is a first-pass primary-source finding.
A future `packages/snap-rules` build for Utah (out of scope for this task, requiring its own
separate, explicit go-ahead per the standing park rule) should treat this pack's citations as a
starting point, not a final answer, and should specifically re-verify the soft-drink demonstration's
continued force (Finding 3, time-limited to two years), the drug-felony treatment-condition scoping
question (Finding 7), and locate Utah's actual current SUA dollar figures (Finding 0) before
hardcoding Utah's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Utah source text, checking
specifically for: claims inferred from a search-result summary rather than a direct primary-source
read; dollar figures not traceable to a specific dated source; and any Utah-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- An early WebSearch summary asserted Utah's ABAWD consumer page states "ages 18 to 53." This pack
  directly fetched that exact page (`work_able.html`) and found NO age figure stated on it at all —
  the WebSearch summarizer's claim was not traceable to the actual page content and was DISCARDED
  rather than written into this pack. This is the same failure mode this roster's Kentucky pack
  caught for a fabricated EBT card name, applied here to a fabricated statistic instead of a name.
- The "Utah counts vehicles" secondary-source claim (Finding 5) was checked against Utah's own
  primary source specifically because it looked like an inference from Utah's non-BBCE status
  rather than a stated Utah-specific fact — and the inference turned out to be wrong when checked
  directly.
- The certification-period claim was NOT narrowed to a single figure (e.g., picking "6 months" or
  "12 months") despite secondary sources stating one or the other with apparent confidence — DWS's
  own primary source states a range ("6 to 12 months"), and this pack preserves that range rather
  than silently picking an endpoint (see freshness.json).
- The medical-deduction mechanism (flat shortcut vs. actual-expense-minus-$35) was left UNASSERTED
  (see freshness.json) rather than assumed to match any other state's pattern, because this pack
  could not locate a Utah-specific primary source confirming either mechanism.
- The SUA dollar figure was NOT filled in with the stale $376 (FY2021) figure several secondary
  aggregators still repeat — this pack explicitly disclosed the current figure could not be located
  rather than presenting outdated data as current (Finding 0).
- The drug-felony treatment-condition scoping (Finding 7) does not claim a settled reading of
  ambiguous statutory text — it states the textual basis for its reading plainly and flags the
  ambiguity rather than resolving it by assumption.

## Sources

| Source | Access | Dated |
|---|---|---|
| DWS, Eligibility Policy Manual, Table 2 (SNAP Monthly Income Limits and Maximum Assistance Amounts) | direct curl fetch (browser UA) | effective 10/1/2025, FFY2026 figures |
| DWS, Eligibility Policy Manual, Policy 342 (SNAP Work Requirements) | direct curl fetch (browser UA) | effective 5/1/2026 |
| DWS, Eligibility Policy Manual, Policy 342-1A (Federal Exemptions) | direct curl fetch (browser UA) | effective 2/1/2026 |
| DWS, SNAP consumer pages (deductions, requirements, application basics, EBT instructions, reviews) | direct curl fetch (browser UA) | fetched 2026-08-12 |
| Utah Legislature, Utah Code § 35A-3-311, official compiled text (le.utah.gov) | direct curl fetch (browser UA) | current version effective 5/6/2026 |
| Cornell LII, Utah Admin. Code R986-900-901, R986-900-902 | direct curl fetch (browser UA) | accessed 2026-08-12 |
| USDA FNA, Utah SNAP Food Restriction Waiver approval letter | direct curl fetch (browser UA) | approved 5/16/2025, effective 1/1/2026 |
| DWS, press release, "New rules for SNAP/EBT purchasing of soft drinks" | direct curl fetch (browser UA) | 12/29/2025 |
| USDA FNA, SNAP Restaurant Meals Program state list | direct curl fetch (browser UA) | Utah absent |
| USDA FNA, Time Limit (ABAWD) Waivers FY2025-2029 state-response index | direct curl fetch (browser UA) | Utah absent |
| Ute Indian Tribe of the Uintah and Ouray Reservation, Food Distribution page | WebFetch | confirms FDPIR operation in Utah |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (UT guide questions), `eval/answer-eval.ts` (UT_GOLD, spread
into ALL_GOLD). Utah is deliberately NOT added to any `engine-citations.ts` per-state constant
map — Utah has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("UT", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Utah policy — this matches the precedent already set by
Oklahoma's, Kentucky's, Louisiana's, and Alabama's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Utah `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.
