# South Carolina pack — provenance

**Created:** 2026-08-11. South Carolina is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
and Colorado's prior builds, South Carolina has NO existing `packages/snap-rules` entry and NO
oracle fixture coverage at all. No discrepancy-checking against an existing engine constant was
possible or attempted; this pack's findings stand entirely on its own primary-source research.
This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not
touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which
stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (browser User-Agent) of South Carolina's own current, formally published
SNAP Policy Manual — Volume 70, dated June 2026, hosted directly on `dss.sc.gov`
(`dss.sc.gov/media/25ug5rk1/snap-manual-volume-70-final-version.pdf`), a ~3.7MB, ~23,000-line
PDF converted with `pdftotext -layout`. Every fetch in this pack's research returned a clean
HTTP 200 with NO access barrier of any kind — a genuine contrast with several states already
built in this roster. Also fetched directly: SCDSS's current SNAP page and SNAP FAQ page
(`dss.sc.gov`), the DSS mini-SNAP eligibility summary PDF, USDA FNA's South Carolina SNAP Food
Restriction Waiver page (containing the Secretary's Dec. 10, 2025 approval letter and Aug. 3,
2026 modification notice), USDA FNA's Restaurant Meals Program state list, and ABAWDMap.us's
South Carolina entry. WebSearch cross-checks corroborated the drug-felony finding against two
independent secondary aggregators (Prison Policy Initiative, February 2026; Network for Public
Health Law's 50-state SNAP felony-ban survey).

## Finding 0 — no access barrier encountered anywhere in this pack's research

Unlike several states already built in this roster (Colorado's `cdhs.colorado.gov` 403s on
WebFetch, Missouri's password-walled resource section, Justia/Casetext 403s/410s documented
for multiple other states), this pack encountered NO access barrier at any point. `dss.sc.gov`
and `fna.usda.gov` both returned clean HTTP 200 responses to direct curl with a browser
User-Agent on every single fetch attempt. South Carolina's own SNAP Policy Manual is hosted
directly as a public PDF with no login wall, no rate limiting, and no stale-cache mismatch
found between different mirrors (there was only one source to check — SCDSS's own host).

## Finding 1 (flagship) — South Carolina's Broad-Based Categorical Eligibility caps out at
130% FPL, NOT the 200% FPL ceiling common to most other BBCE states in this roster — a genuine
correction to a common secondary-source assumption

Secondary sources describing BBCE states in general terms commonly assume a 200% FPL income
ceiling — the figure this roster's Colorado and Maryland packs independently confirmed for
THEIR states, and the figure most national SNAP explainer sites cite as the typical BBCE
number. South Carolina's own SNAP Manual states something narrower: § 4.1(D) grants expanded
categorical eligibility only to households "whose income falls at or below 130% of the Federal
Poverty Level (FPL)" via a mechanism South Carolina calls "Family Independence Information and
Referral Services." Because South Carolina's ORDINARY SNAP gross income test (§ 13.6(2)(B)) is
ALSO 130% FPL — the plain federal floor, with no state-elected increase — this pathway does
NOT expand who is income-eligible for SNAP in South Carolina at all. What it actually does is
waive the resource/asset test (and the separate net income test) for households already within
the ordinary gross income limit. This pack independently checked this claim by reading § 4.1(D)
directly (not a search-result summary), cross-referencing it against § 13.6(2)(B)'s income
table, and confirming the two percentages are identical — the practical effect is a
resource-test waiver bundled into ordinary income-eligible applications, not a genuine BBCE
income-limit expansion. A South Carolina applicant hearing that "BBCE states go up to 200% FPL"
from a generic secondary source should be corrected: South Carolina's own mechanism does not.

## Finding 2 (flagship) — South Carolina is one of only two U.S. jurisdictions (with Guam) that
retains the FULL, UNMODIFIED lifetime federal drug-felony SNAP ban — confirmed, not corrected,
and notably achieved through legislative SILENCE rather than an enacted state statute

21 U.S.C. § 862a(a)(2) sets a federal default: anyone convicted of a state or federal felony for
possessing, using, or distributing a controlled substance is permanently ineligible for SNAP,
unless a state enacts legislation opting out or modifying the ban under § 862a(d)(1). The large
majority of states have done so. This pack's direct read of South Carolina's SNAP Manual found
§ 2.3(7) restates the plain federal rule verbatim as SCDSS policy, limited only to conduct after
August 22, 1996, with the sole listed exception being a verified expungement or pardon. No
separate South Carolina statute implementing, narrowing, or opting out of this rule could be
located anywhere in this pack's research — and TWO independent secondary aggregators
corroborate this directly. The Network for Public Health Law's 50-state survey explicitly codes
South Carolina's ban type as "Explicit disqualification [None – kept full federal ban]" with NO
statute citation listed (in contrast to, e.g., Missouri's RSMo § 208.247 or Tennessee's Tenn.
Code Ann. § 71-5-308, both of which this pack's prior roster entries were able to cite to a real
enacted statute). This pack states this finding as a CONFIRMATION, not a correction — the
minority "South Carolina/Guam = full unmodified ban" secondary-source claim checks out against
South Carolina's own primary text — but flags the state-statute-absence as itself the
distinctive, citable fact: South Carolina's continued full ban is a product of the legislature
NOT acting, not a legislature affirmatively voting to keep it.

## Finding 3 (flagship, time-sensitive) — South Carolina's approved candy/soda/energy-drink SNAP
restriction is real and imminent (effective Aug. 31, 2026), but NOT YET IN EFFECT as of this
pack's fetch date — the mirror image of this roster's Colorado finding

USDA's Food and Nutrition Administration approved South Carolina's Sept. 23, 2025 request to
exclude candy, energy drinks, soft drinks, and sweetened beverages from SNAP-eligible purchases
in South Carolina, via a letter Secretary Brooke Rollins signed Dec. 10, 2025, addressed to
Governor Henry McMaster and SCDSS Director Tony Catone. The approval is a 2-year demonstration
project, effective **August 31, 2026** — twenty days after this pack's fetch date — and was
further modified Aug. 3, 2026 to adjust the definition of "restricted soft drink." South
Carolina was one of six states (with Hawai'i, Missouri, North Dakota, Virginia, Tennessee)
whose "Make America Healthy Again"-branded waivers were approved together. This pack's direct
check of South Carolina's own CURRENT manual and web materials confirms the restriction has not
yet been reflected anywhere in South Carolina's operative SNAP policy text as of the fetch date
— the ordinary federal "Eligible Foods" definition (excluding only alcohol, tobacco, and hot
prepared foods) still governs today. This is the mirror image of this roster's Colorado pack's
finding (an approved restriction later DISCONTINUED, never taking effect): South Carolina's
restriction is real, approved, and actively counting down to its effective date, not abandoned.
This pack disclosed the imminent date plainly in `freshness.json` as a `not-yet-effective`
entry rather than either ignoring it or prematurely treating it as already governing.

## Finding 4 — South Carolina's vehicle-resource rule is genuinely distinctive: ONE exempt
vehicle PER LICENSED DRIVER (not per household), conditioned on South Carolina registration

Every vehicle-resource rule this roster has documented so far falls into one of two patterns:
blanket all-vehicles-exempt (Missouri, Maryland, Colorado) or a household-level one-vehicle
exemption with a harsher rule for additional vehicles (Indiana's hybrid rule: ordinary vehicles
exempt, boats/campers counted). South Carolina's rule, read directly from § 10.3(B)(vii) and
§ 10.7(AA), is neither: it exempts "one licensed, registered vehicle per licensed driver in the
household," meaning a two-driver household can exclude TWO vehicles — but only if "both the
license and registration are issued in South Carolina." Additional exemptions apply for
income-producing vehicles, vehicles necessary for long-distance work travel, vehicles used as a
household's home, vehicles necessary to transport a physically disabled household member, and
vehicles whose sale would net $1,500 or less. Any OTHER vehicle is counted at the HIGHER of fair
market value in excess of $4,650 or full equity value — a distinctly two-part valuation test not
found elsewhere in this roster's prior states. This is a genuine structural departure worth
flagging even though it does not correct or confirm any specific widely-repeated secondary
claim — this pack found no prior secondary-source characterization of South Carolina's vehicle
rule specifically to check it against.

## Finding 5 — South Carolina's own current SNAP Manual is genuinely CURRENT, not stale — a
useful contrast given this roster's repeated findings of state-specific staleness elsewhere

South Carolina's SNAP Policy Manual Volume 70 is dated June 2026, roughly two months before this
pack's fetch date. Every dollar figure this pack checked — the Standard Deduction
($209/$209/$209/$223/$261/$299), the Excess Shelter Deduction cap ($744), the resource limits
($3,000/$4,500), and the full gross/net income-eligibility table — matches the current national
FFY2026 cycle exactly. South Carolina's ABAWD provisions (§ 8.12, § 8.15) already reflect the
full 2025 OBBBA changes: the 18-64 age range, the under-14 dependent-child caregiver exception,
the removed homelessness/veteran/foster-care exemptions, and the added Indian/Urban
Indian/California Indian exemption — with no internal contradiction found anywhere in the text,
in direct contrast to this roster's Colorado pack, which found its regulation's ABAWD section
still reciting the pre-OBBBA 18-54 range despite a header claiming current effectiveness. This
pack states this positive finding plainly rather than only cataloguing gaps: South Carolina's
manual-revision cadence appears to track the federal fiscal year closely.

## Finding 6 — South Carolina does NOT operate a Restaurant Meals Program for elderly/disabled
SNAP recipients, only a narrower federal-baseline homeless-meal-provider option

USDA FNA's own current Restaurant Meals Program state list (cross-checked against this roster's
Missouri and Indiana packs' own independent fetches of the same list, page updated Aug. 7, 2026)
names Arizona, Maryland, New York, California, Massachusetts, Rhode Island, Illinois (Cook and
Franklin Counties only), Michigan, and Virginia — South Carolina is absent. South Carolina's own
manual Glossary defines "Eligible Foods" to exclude hot, immediately-consumable prepared foods
with no RMP-style exception, and describes only a narrower "Homeless Meal Provider" mechanism
(a restaurant contracting with SCDSS to serve homeless SNAP recipients at concessional prices)
— limited specifically to homeless households, not the broader elderly/disabled population an
RMP typically covers. This pack could not confirm any such contract is currently active with a
specific South Carolina restaurant — disclosed as a gap in `freshness.json`.

## Finding 7 — South Carolina is STATE-administered, not independently county-governed, and
"Family Independence"/TANF is a commonly-confused separate program name

SCDSS's own Agency Overview describes a single statewide agency with "offices in each county"
staffed by SCDSS's own state employees, "guided by a state office which provides centralized
management, support, and accountability functions" — matching this roster's Georgia/Indiana/
Tennessee/Missouri/Maryland state-agency-with-local-offices archetype, not Virginia/North
Carolina/Colorado's independently-governed-county archetype. Separately, "Family Independence"
is SCDSS's own internal name touching its TANF cash-assistance program (the source of the name
"Family Independence Information and Referral Services" for the BBCE-analog mechanism) — TANF
is a SEPARATE program from SNAP, though TANF receipt is one qualifying benefit conferring
categorical eligibility for SNAP.

## Finding 8 — South Carolina has a flat $175 medical-deduction shortcut, and treats child
support as an ORDINARY deduction, not an income exclusion

Two smaller structural findings, each matching a pattern this roster has documented elsewhere in
different combinations: (a) § 12.8 provides a flat $175 Standard Medical (SM) Deduction
shortcut for verified medical expenses between $35.01 and $210, matching this roster's Missouri
($135 for $35.01-$170) and Colorado ($165 for $35.01-$200) flat-shortcut pattern rather than
Maryland's or Indiana's actual-expense-only rule — with its own distinct dollar figures; (b)
§ 12.7's child support deduction is applied at Step (F) of the net-income calculation in
§ 13.6(1), AFTER the household's gross income has already been established — an ORDINARY
DEDUCTION mechanism (7 CFR 273.9(d)(5)) matching this roster's Maryland/Indiana/Tennessee
pattern, NOT the income-exclusion-before-the-gross-test mechanism (7 CFR 273.9(c)) this roster's
Virginia/New Jersey/Illinois/Missouri/Colorado packs document.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

South Carolina has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing
engine constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding. A future `packages/snap-rules` build for South Carolina (out of scope
for this task, requiring its own separate, explicit go-ahead per the standing park rule) should
treat this pack's citations as a starting point, not a final answer, and should specifically
re-verify the food-restriction-waiver's post-Aug.-31-2026 operative status (Finding 3), the
130% FPL BBCE ceiling (Finding 1), and the per-licensed-driver vehicle exemption (Finding 4)
against South Carolina's own primary text before hardcoding any of them into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched South Carolina manual text
and USDA waiver-page text, checking specifically for: claims inferred from a section heading
rather than its own body text; dollar figures not traceable to a specific dated source; and any
South Carolina-vs-common-assumption contrast overclaimed as settled when the underlying evidence
was genuinely ambiguous. Concrete catches from this pass:

- The BBCE/FIIRS finding (income-pathways) was checked against the ACTUAL § 4.1(D) text (not
  just a search-result summary claiming "130% FPL, no asset test") and specifically
  cross-referenced against § 13.6(2)(B)'s ordinary income table to confirm the two percentages
  are identical BEFORE concluding this is a real income-ceiling non-expansion, rather than
  assuming the mismatch existed. The initial WebSearch results on this topic were themselves
  internally conflicted (one summary claimed 130% is current policy, another described a 200%
  "proposal" that had "not appeared to be implemented") — this pack resolved the ambiguity by
  reading South Carolina's own primary text directly rather than trusting either search summary.
- The drug-felony finding (Finding 2) is stated as a CONFIRMATION with two independently
  corroborating secondary sources cited by name and checked against each other (both explicitly
  state NO South Carolina statute exists), rather than treating one source's claim as
  sufficient on its own.
- The food-restriction-waiver finding (Finding 3) does NOT claim the restriction is either
  already in effect OR permanently abandoned — it states the precise effective date found in
  USDA's own approval letter (Aug. 31, 2026) and explicitly notes it postdates this pack's fetch
  date by twenty days, with a `not-yet-effective` freshness entry rather than a same-day
  assumption either direction.
- The vehicle-rule finding (Finding 4) is checked against the FULL two-section text (§ 10.3(B)
  (vii)'s valuation rule AND § 10.7(AA)'s exemption-criteria list) rather than either section
  alone, to avoid stating an incomplete picture of when a vehicle actually counts as a resource.
- The manual-currency finding (Finding 5) does not claim EVERY South Carolina dollar figure is
  necessarily current going forward — it states what this pack specifically verified (Standard
  Deduction, Excess Shelter cap, resource limits, income table) as of the June 2026 manual, and
  freshness.json still carries a routine FFY2027 COLA reminder rather than treating currency as
  a permanently settled fact.
- The Restaurant Meals Program finding (Finding 6) does not claim South Carolina will never
  adopt one — it states the current absence, sourced to USDA's own dated list, and separately
  flags (rather than assumes away) the unconfirmed operational status of the narrower
  homeless-meal-provider mechanism South Carolina's manual does describe.

## Sources

| Source | Access | Dated |
|---|---|---|
| SC SNAP Policy Manual, Volume 70 (June 2026) — full text | direct curl fetch (browser UA), dss.sc.gov | current, no access barrier |
| SC DSS mini-SNAP eligibility summary PDF | direct curl fetch (browser UA), dss.sc.gov | current, no access barrier |
| SCDSS, Supplemental Nutrition Assistance Program (SNAP) page | direct curl fetch (browser UA) | fetched 2026-08-11, current, states OBBBA impact directly |
| SCDSS, SNAP FAQ page | direct curl fetch (browser UA) | fetched 2026-08-11 |
| USDA FNA, South Carolina SNAP Food Restriction Waiver page (approval letter + modification notice) | direct curl fetch (browser UA) | approval Dec. 10, 2025; modification Aug. 3, 2026; effective Aug. 31, 2026 (not yet effective as of fetch date) |
| USDA FNA, SNAP Restaurant Meals Program state list | cross-checked via this roster's Missouri pack's independent fetch | page updated Aug. 7, 2026; South Carolina absent |
| ABAWDMap.us, South Carolina state entry | direct curl fetch (browser UA) | fetched 2026-08-11 — "No waiver — rule applies" |
| Prison Policy Initiative, "Hunger as punishment: How states restrict SNAP benefits for people on probation" (Feb. 2026) | WebFetch | secondary corroboration only, for the drug-felony finding |
| Network for Public Health Law, 50-State Survey of SNAP Felony Drug Bans (updated) | direct curl fetch (browser UA) | secondary corroboration only, for the drug-felony finding — explicitly codes SC as "kept full federal ban," no statute cited |
| South Carolina Attorney General opinion (McClendon, 2013) on defining "drug-related felony conviction" | direct curl fetch (browser UA) | background/context only; confirms SC's controlled-substance statutes (Title 44, Ch. 53) but does NOT itself impose the SNAP disqualification, which is purely a SCDSS manual policy choice |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (SC guide questions), `eval/answer-eval.ts` (SC_GOLD,
spread into ALL_GOLD). South Carolina is deliberately NOT added to any engine-citations.ts
per-state constant map — South Carolina has no `packages/snap-rules` `StatePolicy` entry at all
to mirror. `formatEngineParams("SC", ...)` will throw `UnknownStateError` until a future,
separately-gated `packages/snap-rules` build adds a South Carolina policy — this matches the
precedent already set by North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's,
Indiana's, Missouri's, Maryland's, and Colorado's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request
an unfreeze. A future South Carolina `packages/snap-rules` build is out of scope here and would
need its own separate, explicit go-ahead.
