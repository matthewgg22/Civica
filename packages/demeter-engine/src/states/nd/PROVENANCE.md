# North Dakota pack — provenance

**Created:** 2026-08-12. North Dakota is a genuine BLANK SLATE in this roster — like
this roster's prior blank-slate builds (Nebraska, Connecticut, Utah, Iowa, Arkansas,
Mississippi, Kansas, New Mexico, New Hampshire), North Dakota has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted;
this pack's findings stand entirely on its own primary-source research. This task's
scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of
which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

North Dakota was built as one of a five-agent parallel batch (RI, MT, DE, SD, ND),
each on its own branch, in the same window.

## Method

Neither `hhs.nd.gov` nor `nd.gov/dhs/policymanuals` presented any WAF or bot-detection
barrier to this pack — every direct `curl` attempt with a standard browser User-Agent
returned a clean HTTP 200. The genuine research hazard this pack found was different
in kind from most other states in this roster: a STALE-BUT-LIVE legacy manual mirror.

## Finding 0 — a stale-content trap (not an access barrier), caught by cross-referencing
dollar figures against the state's own dated Release Log

`nd.gov/dhs/policymanuals/43005/` (the legacy `430-05-xx-xx`-numbered SNAP manual host)
returns clean, well-formatted, plausible-looking policy content with no HTTP-level
signal of staleness. This pack initially fetched this host's income-limit tables and
found a 130% FPG gross-income limit for household size 1 of $1,632, revised "10/1/2024
ML 3858." Cross-checking this figure against WebSearch-surfaced FFY2026 figures
($3,483 for household size 4, matching neither the legacy host's $3,380 figure)
revealed a discrepancy. This pack then discovered North Dakota's SNAP manual has been
substantially RENUMBERED and re-platformed onto a new host, `nd.gov/dhs/policymanuals/SNAP/`,
which carries a public, dated Release Log (currently Release 26.5, last published
06/15/2026) — a genuinely different manual structure (plain-numbered chapters "100
Application" through "1200 EBT" plus an Appendix, replacing the old "430-05-xx-xx"
convention). Fetching the SAME topics from the new host produced materially different,
internally-consistent, dated figures: the legacy host's ABAWD exemption criteria
(revised 11/1/2024) also turned out to predate the OBBBA effective date (11/1/2025) by
exactly one year, showing pre-OBBBA exemption categories (55+ age threshold, homeless/
veteran/foster-youth exemptions still listed) — a near-miss this pack caught before
drafting any supplement text. This pack used ONLY the new SNAP/ host's content for
every dollar figure and current-eligibility-rule claim in this pack.

## Finding 1 (flagship, structural) — North Dakota SNAP is delivered through 19
state-supervised "Human Service Zones," a 2019 legislative restructuring distinct
from both single-state-office and plain-county-administered models

The 2019 Legislature's SB 2124 (North Dakota Century Code Chapter 50-01.1) dissolved
North Dakota's prior 47 county-run social service offices (across 53 counties) and
re-formed them, effective January 1, 2020, into 19 mostly-multicounty "Human Service
Zones," each administratively hosted by one lead county. This pack flags this
structure explicitly: North Dakota sits between a single centralized state office
(like this roster's New Hampshire) and a plain independent-county model (like this
roster's California, New York, Minnesota, Wisconsin, and Virginia) — state policy
supervision, zone-level delivery, and operative practice can still vary by zone.

## Finding 2 (flagship, secondary-source correction) — North Dakota's current SNAP
resource limit is $3,000 / $4,500, not the lower $2,250/$3,250 figure several
secondary aggregator sites repeat

This pack fetched North Dakota HHS's own current SNAP Manual § 601, Resources
Overview (revised 5/16/2025), directly from the current SNAP/ manual host and found
$4,500 for households with an elderly or disabled member, $3,000 for all other
households — matching the FFY2026 national baseline this roster's New Hampshire pack
has also confirmed. This pack found multiple secondary SNAP-eligibility aggregator
sites (povertylevelcalculator.com, snapbenefitshelp.com, and similar) repeating a
lower $2,250/$3,250 figure, which appears to reflect an older, un-updated figure these
sites have not corrected against North Dakota's current COLA-adjusted policy.

## Finding 3 (flagship, primary-source confirmation of a minority-position claim) —
North Dakota fully opted out of the federal drug-felony SNAP ban via state statute

North Dakota Century Code § 50-06-05.1 states plainly (per Public Health Law Center's
secondary-source quotation of the statute, which this pack did not independently
re-fetch from ndlegis.gov directly — see freshness.json) that HHS "may not deny
assistance under the supplemental nutrition assistance program to any individual who
has been convicted of a felony offense that has as an element the possession, use, or
distribution of a controlled substance" — a full opt-out, effective 2017. This pack
cross-checked this claim against HHS's own SNAP manual disqualification-rules text
(§ 430-05-77-55, Other Disqualifications, legacy host) and found only SNAP-program-
integrity-specific disqualifications (sale of a controlled substance or firearms
INVOLVING SNAP BENEFITS, fleeing-felon/parole-violator status, trafficking $500+) with
NO general drug-felony-conviction ban at all — consistent with, though not an
independent confirmation of, the statutory full-opt-out claim.

## Finding 4 (flagship, time-sensitive) — North Dakota will exclude candy, soft
drinks, and energy drinks from SNAP purchases starting September 1, 2026 — a rare
USDA demonstration-project waiver, NOT YET IN EFFECT as of this pack's research date

This pack fetched USDA FNS's own approval letter directly: Secretary Brooke Rollins
approved North Dakota HHS's request on December 10, 2025, for a 2-year pilot
(extendable), effective September 1, 2026, amending the federal statutory definition
of "food" for SNAP purchasing purposes within North Dakota specifically to exclude
soft drinks, energy drinks, and candy. This pack flags explicitly that this
restriction is NOT YET ACTIVE as of this pack's research date (2026-08-12) — barely
three weeks before the effective date — and this pack's supplement text is written to
disclose the current (unrestricted) state alongside the imminent change rather than
presenting the restriction as already operative.

## Finding 5 (flagship, secondary-source correction, directly tied to this pack's
tribal/reservation disclosure requirement) — North Dakota's Rolette County/Turtle
Mountain Reservation ABAWD waiver ENDED 10/31/2025, contradicting a secondary-source
claim of an active statewide waiver through mid-2026

This pack fetched North Dakota HHS's own Policy Release 25.7 (effective 11/1/2025,
amended 11/13/2025) directly and found explicit confirmation: North Dakota's prior
ABAWD Geographic Waiver, covering the Turtle Mountain Reservation and Rolette County
under a 7/1/2025-6/30/2026 waiver period, was ENDING effective 10/31/2025, with
affected individuals mailed notice on 10/10/2025. This pack cross-checked this
directly against USDA FNS/FNA's own ABAWD Time Limit Waivers FY 2025-2029 index, which
lists North Dakota's most recent posted waiver-response entry as FY2025 (dated
6/18/2025) with NO FY2026 entry — corroborating no renewal. This pack found a
WebSearch-surfaced secondary source (an aggregator site) stating North Dakota "holds
an active statewide waiver through June 30, 2026" and explicitly CORRECTS this claim:
this pack's primary-source reading, confirmed by both HHS's own dated release document
and USDA's own tracker, is that North Dakota currently has NO active ABAWD geographic
waiver anywhere in the state as of 11/1/2025 onward.

## Tribal/reservation disclosure (task-required check)

This pack actively researched whether North Dakota's SNAP manual carries any
state-specific notes on FDPIR interaction or reservation-specific administration, per
this task's explicit instruction (North Dakota has significant tribal land — Turtle
Mountain Band of Chippewa Indians, Standing Rock Sioux Tribe, Spirit Lake Tribe, Three
Affiliated Tribes/MHA Nation at Fort Berthold, and the Sisseton-Wahpeton Oyate). This
pack found THREE genuine, narrow, primary-sourced findings, and explicitly did NOT
find a fourth, broader one:

1.  **Found:** A longstanding choice-of-program rule (legacy host, § 430-05-05-50 and
    § 430-05-05-50-05) — a household on or near a reservation may participate in
    EITHER SNAP OR the Food Distribution Program (Commodities/FDPIR), never both
    simultaneously, switching only at review-period boundaries.
2.  **Found:** A narrow, current-host-confirmed vehicle-licensing accommodation
    (§ 604 Vehicles): "On Indian reservations that do not require vehicles driven by
    tribal members to be licensed, such vehicles must be treated as licensed vehicles"
    for the standard $4,650 resource-exclusion purpose.
3.  **Found:** A current-host-confirmed, tribal-land-tied ABAWD provision: the
    Rolette County/Turtle Mountain Reservation geographic waiver (Finding 5 above),
    and the separate "Indians, Urban Indians, or California Indians" (IHS-eligible)
    ABAWD exemption category added as part of the OBBBA rollout.
4.  **NOT found:** This pack found NO evidence of any broader, distinct SNAP
    administrative structure specific to reservation residents beyond these three
    rules — no separate application process, no separate income/resource standard,
    and no reservation-specific certification-period rule. This pack states this
    explicitly as a genuine negative result rather than a research gap: it looked and
    did not find a fourth structural difference, rather than not looking.

## Confirmed — no discrepancy found against an existing engine constant (no engine
constant existed to check against)

North Dakota has no prior `packages/snap-rules` `StatePolicy` entry, so there is no
existing engine constant this pack could confirm or contradict — every finding above
is a first-pass primary-source finding. A future `packages/snap-rules` build for North
Dakota (out of scope for this task, requiring its own separate, explicit go-ahead per
the standing park rule) should treat this pack's citations as a starting point, not a
final answer, and should specifically re-verify the food-restriction-waiver product
categories (Finding 4, not yet in effect and product-category-granularity gap
disclosed in freshness.json) and the certification/review-period length (which this
pack was UNABLE to confirm from a primary source at all — see freshness.json) before
hardcoding North Dakota's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched North Dakota text,
checking specifically for: claims inferred from a secondary-source summary rather than
the underlying primary text; a stale-content trap's timing relative to a known federal
effective-date change; and any North-Dakota-vs-common-assumption contrast overclaimed
as settled when the underlying evidence was genuinely single-sourced or ambiguous.
Concrete catches from this pass:

- The stale-legacy-host trap (Finding 0) is the most consequential catch in this pack:
  an early pass, before this pack cross-checked the legacy host's income-limit figures
  against WebSearch-surfaced FFY2026 figures, would have published a full fiscal
  year's stale dollar figures and pre-OBBBA ABAWD criteria as current. This pack
  discloses that near-miss explicitly.
- The resource-limit correction (Finding 2) is grounded in a direct fetch of HHS's own
  current § 601 text, not merely a rejection of the secondary-source figure on
  suspicion alone — this pack verified the CURRENT figure affirmatively before
  asserting the secondary sources were wrong.
- The ABAWD Veteran/Homeless/Former-Foster-Care exemption-removal claim is flagged
  explicitly as resolved via the release document's summary line rather than an
  unambiguous read of the redlined body text (see freshness.json) — this pack did not
  overstate its confidence in the body-text reading itself.
- The drug-felony statute's exact quoted text and 2017 effective date are flagged
  explicitly as secondary-source-sourced (Public Health Law Center's quotation, not an
  independently fetched ndlegis.gov session-law text) — this pack's confirmation rests
  on HHS's own manual text lacking a conflicting general ban, which IS independently
  fetched, but the statute's own precise wording is not.
- The LIHEAP-SUA-trigger restriction and the tribal-programs supplement's Food
  Distribution Program rules are both flagged explicitly as sourced from a Release Log
  summary line or the legacy manual host respectively, not independently re-confirmed
  against the current SNAP/ host's full current section text.
- This pack explicitly declined to fabricate a certification/review-period length
  figure when it could not find one in a primary North Dakota source — WebSearch
  results conflicted with each other (6 months vs. 6-12 months vs. up to 24 months),
  and this pack states this as a genuine, disclosed research gap in freshness.json
  rather than picking the most-repeated secondary-source figure and presenting it with
  unearned confidence.
- The tribal/reservation disclosure explicitly states a negative result (no fourth,
  broader reservation-specific administrative structure found) rather than treating
  silence as ambiguous or implying more research would surely turn something up.

## Sources

| Source | Access | Dated |
|---|---|---|
| North Dakota HHS SNAP Policy Manual (current SNAP/ host), § 505 BBCE | direct fetch via r.jina.ai reader proxy, clean | revised 5/16/2025, fetched 2026-08-12 |
| North Dakota HHS SNAP Policy Manual (current SNAP/ host), § 601 Resources Overview | direct fetch via r.jina.ai reader proxy, clean | revised 5/16/2025, fetched 2026-08-12 |
| North Dakota HHS SNAP Policy Manual (current SNAP/ host), § 604 Vehicles | direct fetch via r.jina.ai reader proxy, clean | fetched 2026-08-12 |
| North Dakota HHS SNAP Policy Release 25.7 (ABAWD OBBBA rollout) | direct PDF fetch, clean | effective 11/1/2025, amended 11/13/2025, fetched 2026-08-12 |
| North Dakota HHS SNAP Policy Release 25.6 (FFY2026 COLA figures) | direct PDF fetch, clean | effective 10/1/2025, fetched 2026-08-12 |
| North Dakota HHS SNAP Policy Release 26.2/Appendix B (SUA increase, full income tables) | direct PDF fetch, clean | effective 4/1/2026, fetched 2026-08-12 |
| North Dakota HHS SNAP Policy Manual Release Log | direct fetch via r.jina.ai reader proxy, clean | through Release 26.5, last published 6/15/2026, fetched 2026-08-12 |
| North Dakota HHS, Apply for Help — SNAP FAQ page | direct curl fetch, clean | fetched 2026-08-12 |
| USDA FNS/FNA, North Dakota SNAP Food Restriction Waiver approval letter | direct fetch via r.jina.ai reader proxy, clean | approved 12/10/2025, effective 9/1/2026, fetched 2026-08-12 |
| USDA FNS/FNA, ABAWD Time Limit Waivers FY 2025-2029 index | direct curl fetch, clean HTTP 200 | fetched 2026-08-12 |
| North Dakota HHS SNAP Policy Manual (LEGACY 43005 host) — used ONLY for the Food Distribution Program/tribal-choice-of-program topic and the § 430-05-77-55 disqualifications cross-check, explicitly NOT used for any dollar figure or post-OBBBA rule | direct curl fetch, clean HTTP 200 (content flagged stale for other topics) | revision dates vary by section, fetched 2026-08-12 |
| WebSearch/secondary corroboration only — Public Health Law Center SNAP Ban Opt-Out States Map (ND); Bismarck Tribune and North Dakota Association of Counties coverage of the 2019 Human Service Zone restructuring; multiple SNAP-eligibility aggregator sites (resource-limit correction target, ABAWD-waiver correction target) | WebSearch, not independently fetched as primary text | see freshness.json for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (ND guide questions), `eval/answer-eval.ts` (ND_GOLD,
spread into ALL_GOLD). North Dakota is deliberately NOT added to any
`engine-citations.ts` per-state constant map — North Dakota has no `packages/snap-rules`
`StatePolicy` entry at all to mirror. `formatEngineParams("ND", ...)` will throw
`UnknownStateError` until a future, separately-gated `packages/snap-rules` build adds a
North Dakota policy — this matches the precedent already set by this roster's other
blank-slate corpus packs (Nebraska, North Carolina, Ohio, New Jersey, Virginia,
Tennessee, Indiana, Missouri, Maryland, Colorado, South Carolina, Alabama, Louisiana,
Kentucky, Oklahoma, Connecticut, Utah, Iowa, Arkansas, Mississippi, Kansas, New Mexico,
Idaho, West Virginia, Hawaii, Maine, and New Hampshire).

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not
request an unfreeze. A future North Dakota `packages/snap-rules` build is out of scope
here and would need its own separate, explicit go-ahead.

**Five-agent parallel batch:** North Dakota was built in parallel with Rhode Island
(RI), Montana (MT), Delaware (DE), and South Dakota (SD) — five separate agents in the
same window, each on its own branch (`feat/demeter-nd-corpus` for this one). All five
states register in the same four shared files (`states/index.ts`, `packs.ts`,
`apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and therefore all five PRs
are expected to conflict with each other on merge. The rule to follow when resolving
that conflict is to always COMBINE every state's additions (StateCode union members,
REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate
export), never to drop another state's entry to resolve a conflict — matching the
precedent this roster's prior same-window batch tiers have already set.
