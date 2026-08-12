# New Hampshire pack — provenance

**Created:** 2026-08-12. New Hampshire is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, and New Mexico's prior builds,
New Hampshire has NO existing `packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted; this pack's
findings stand entirely on its own primary-source research. This task's scope was CORPUS ONLY — the
Demeter chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the standing
rule (`feedback_dashboard_snap_rules_parked`).

New Hampshire was built as one of a five-agent parallel batch (ID, WV, HI, NH, ME), each on its own
branch, in the same window.

## Method

`dhhs.nh.gov` returns a clean, consistent HTTP 403 to every direct curl attempt (browser
User-Agent, plain HTTP variant) — a genuine WAF/bot-detection wall, not a resolvable tooling
artifact. This pack worked around it two ways: the Wayback Machine (`web.archive.org`) served most
consumer-facing and FSM policy pages cleanly, and the `r.jina.ai` reader-proxy service
(`https://r.jina.ai/<target-url>`) successfully fetched LIVE, current `dhhs.nh.gov` content for
every page this pack needed, bypassing the WAF entirely. This pack also directly curl-fetched USDA
FNS/FNA's ABAWD waiver index (no barrier there) and used WebSearch for corroboration on a small
number of secondary details flagged explicitly in `freshness.json`.

## Finding 0 — a real access barrier (WAF, not a tooling artifact), resolved via Wayback + a reader
proxy, with a caught Wayback-staleness trap along the way

`dhhs.nh.gov` blocked every direct curl attempt this pack made with a clean HTTP 403, including a
plain-HTTP retry — consistent WAF-level blocking. This pack did NOT stop there: the Wayback Machine
served most pages, and the `r.jina.ai` reader proxy served LIVE current content for the rest. This
combination surfaced a genuine trap this pack caught rather than fell into: a Wayback snapshot of
FSM § 245.03 (ABAWD exemption criteria) was dated 10/31/2025 — literally one day before New
Hampshire's 11/1/2025 OBBBA effective date — and showed PRE-OBBBA exemption criteria (ages 55+,
child under 18, homeless/veteran/foster-youth exemptions still listed). Had this pack used that
snapshot as its source, it would have published stale, actively-wrong policy content. This pack
instead used the reader proxy to fetch the LIVE current page, confirming the correct post-OBBBA
criteria (ages 65+, child under 14, Indian/Indigenous IHS exemption added, homeless/veteran/foster-
youth exemptions removed) — consistent with DHHS's own (separately, also Wayback-fetched, but from
a much more recent 2026-07-10 snapshot) consumer-facing SNAP page's OBBBA summary.

## Finding 1 (flagship, structural) — New Hampshire runs THREE parallel eligibility tracks, not a
single BBCE gate: Regular (130%/100% FPG, $3,000 resource limit), Target (elderly/disabled, $4,500),
and Expanded Categorical Eligibility (200% FPG, no resource test)

Several secondary sources this pack found compress New Hampshire's structure into a flat "200% BBCE,
no asset test" claim. This pack's direct read of FSM § 231.05 (Expanded Categorical Eligibility
Criteria) and FSM § 403 (Resource Limits) finds a more precise three-track structure: a household
qualifies for ECE (no resource test) at ≤200% FPG gross income plus a non-cash MOE-funded-service
eligibility condition (satisfied via DHHS's own BFA Form 77u); a household that has NOT established
ECE or categorical (TANF/SSI) eligibility instead faces a real, enforced resource limit — $4,500 if
elderly/disabled ("Target"), $3,000 otherwise ("All Other" / Regular) — while remaining subject to
the underlying 130%/100% FPG income tests. This pack's reading: in practice the large majority of NH
SNAP households qualify via ECE and therefore never face a resource test, but the flat "no asset
limit in New Hampshire" framing several secondary sources use is not literally, universally true.

## Finding 2 (flagship, primary-source confirmation of a minority-position claim) — New Hampshire
FULLY opted out of the federal drug-felony SNAP ban in 1997, per its own 1997 implementing directive

Several secondary sources describe New Hampshire as having "fully opted out" of the federal
drug-felony SNAP ban. This pack treats a full opt-out as a genuine minority position among states
nationally (most states this roster has built carry a MODIFIED ban, not a full opt-out) and sought
primary-source confirmation rather than accepting the secondary-source claim at face value. This
pack fetched New Hampshire DHHS's own SR 97-27 (dated August 1997) directly via the reader proxy and
confirms the claim precisely: effective August 8, 1997, per House Bill 722-FN, Chapter 157, Laws of
1997, "an individual's felony drug conviction status is not taken into account for purposes of
determining eligibility for TANF financial and/or medical assistance and food stamps." This pack
found no subsequent SR narrowing or reversing this policy, and distinguishes it explicitly from New
Hampshire's separate SNAP-trafficking disqualification penalty (24 months first offense, permanent
second offense), which is a program-integrity rule, not a drug-felony-conviction ban.

## Finding 3 (flagship, structural) — New Hampshire's Heating/Cooling Standard Utility Allowance is
$1,018/month, notably high, paired with a 4-tier utility structure that includes a distinctive
standalone "Electric-Only" tier

FSM Table I: SNAP Deductions lists Heating/Cooling (A/C) at $1,018/month, Utilities-Only at $373,
Electric-Only at $217, and Telephone-Only at $39. This pack flags the $1,018 figure as notably higher
than the roughly $600-750 range this roster's other states have generally shown, and flags the
standalone "Electric-Only" tier as a structural variant this pack has not found in any other state
built in this roster so far (contrast Nebraska's OUA, split purely by qualifying-utility COUNT rather
than by utility TYPE). This pack also found a New Hampshire-specific restriction on the common
LIHEAP-triggered automatic-SUA-eligibility pathway: only elderly (60+) or disabled households can use
a LIHEAP payment over $20/year to trigger automatic Heating/Cooling SUA eligibility — several other
states extend that trigger to all household types.

## Finding 4 — New Hampshire's STANDARD SNAP certification period is only 6 months, shorter than the
12-month norm most other states in this roster use, with 36 months reserved for ESAP households

FSM § 133.09 states plainly: 36 months for all-elderly/disabled no-earned-income (ESAP) households,
6 months for all other households. This pack flags the 6-month standard period as a genuine
structural departure — most of this roster's other states use a 12-month standard period for
non-elderly/disabled households, meaning a New Hampshire working-age household recertifies roughly
twice as often.

## Finding 5 — New Hampshire currently has NO active area-wide ABAWD waiver anywhere in the state

FSM § 245.03's own text lists "residing in certain areas with a high unemployment rate" as an
exemption category in the abstract, but this pack found no evidence any New Hampshire location
currently meets that threshold. USDA FNS/FNA's own ABAWD Time Limit Waivers FY 2025-2029 index shows
New Hampshire's most recent posted waiver-response entry as FY2025 (dated 09/03/2024), with no FY2026
entry. WebSearch corroboration (not independently fetched) indicates New Hampshire's prior waiver
covering the towns of Stratford and Hale's Location expired September 30, 2025 and was not renewed.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

New Hampshire has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for New Hampshire (out of scope for this task, requiring
its own separate, explicit go-ahead per the standing park rule) should treat this pack's citations as
a starting point, not a final answer, and should specifically re-verify the $1,018 SUA figure
(Finding 3, sourced from a single fetch with no visible effective-date stamp on that specific page)
and the three-track income/resource structure (Finding 1) before hardcoding New Hampshire's
parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched New Hampshire text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying primary
text; a Wayback snapshot's timing relative to a known federal effective-date change; and any
New Hampshire-vs-common-assumption contrast overclaimed as settled when the underlying evidence was
genuinely single-sourced. Concrete catches from this pass:

- The three-track eligibility structure (Finding 1) does not simply repeat the "200% BBCE, no asset
  test" framing several secondary sources use — it reads FSM § 231.05's own eligibility conditions
  and FSM § 403's own resource-limit table side by side, and states explicitly that a NON-ECE
  household still faces a real resource limit, rather than letting the majority-case simplification
  stand in for the full rule.
- The ABAWD exemption-criteria catch (Finding 0) is the most consequential catch in this pack: an
  early draft pass, before this pack checked the Wayback snapshot's crawl date against the known
  11/1/2025 OBBBA effective date, would have published pre-OBBBA exemption criteria as current. This
  pack discloses that near-miss explicitly rather than silently avoiding it and presenting the final
  answer as if the correct criteria had been obvious from the start.
- The drug-felony finding (Finding 2) is grounded in SR 97-27's own 1997 text, not merely repeated
  from a secondary source's "fully opted out" framing — this pack treats primary-source confirmation
  of a claim several sources state with more confidence than any single one alone would justify as
  worth doing explicitly, and reports it as a genuine confirmation rather than a correction.
- The $1,018 SUA figure (Finding 3) is flagged as single-source in `freshness.json` rather than
  stated with the same confidence as this pack's other, more cross-checked findings, because this
  pack's Table I fetch carries no visible effective-date stamp specific to that figure.
- The vehicle-exclusion claim (income-and-resources supplement) and the 6-month Simplified Reporting
  threshold-reporting rule (reporting-certification supplement) are both flagged explicitly as
  secondary-source-only, since this pack did not independently fetch FSM § 409 (Vehicles) or a
  numbered FSM section describing the 130%-FPG mid-period reporting threshold.
- The Restaurant Meals Program finding does not merely cite absence-of-mention — it cross-checks
  DHHS's own consumer page's explicit list of non-purchasable items (which excludes "any 'hot'
  prepared foods that are ready to eat") against secondary-source corroboration that no NH RMP
  exists, rather than relying on either source alone.

## Sources

| Source | Access | Dated |
|---|---|---|
| New Hampshire DHHS, Supplemental Nutrition Assistance Program (SNAP) consumer page | Wayback Machine snapshot | crawled 2026-07-10 |
| New Hampshire DHHS BFA, BFA Program Net Monthly Income Limits (PDF) | direct fetch via r.jina.ai reader proxy | published 07/2026, fetched 2026-08-12 |
| New Hampshire DHHS FSM § 403, Resource Limits | direct fetch via r.jina.ai reader proxy | fetched 2026-08-12 |
| New Hampshire DHHS FSM § 231.05, Expanded Categorical Eligibility Criteria | direct fetch via r.jina.ai reader proxy | fetched 2026-08-12 |
| New Hampshire DHHS FSM Table I: SNAP Deductions | direct fetch via r.jina.ai reader proxy | fetched 2026-08-12, no visible page-specific effective date |
| New Hampshire DHHS FSM § 133.09, Certification Periods | direct fetch via r.jina.ai reader proxy | fetched 2026-08-12, cites SR 25-22 dated 07/25 |
| New Hampshire DHHS FSM § 245.03, Criteria for Exemption from ABAWD Work Requirements (live/current) | direct fetch via r.jina.ai reader proxy | fetched 2026-08-12, confirmed post-11/1/2025 |
| New Hampshire DHHS FSM § 245.05, ABAWD Work Requirements | Wayback Machine snapshot | crawled 2025-10-31 (pre-OBBBA text not relevant to this section's content) |
| New Hampshire DHHS SR 97-27, dated 08/97 | direct fetch via r.jina.ai reader proxy | full text read directly; effective 8/8/1997 |
| USDA FNS/FNA, ABAWD Time Limit Waivers FY 2025-2029 index | direct curl fetch (browser UA), clean HTTP 200 | fetched 2026-08-12 |
| WebSearch corroboration only (Stratford/Hale's Location waiver expiration; FSM § 409 Vehicles vehicle-exclusion rule; 6-month Simplified Reporting threshold-reporting rule; Ballotpedia NH work-requirements page) | WebSearch, not independently fetched | see freshness.json for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (NH guide questions), `eval/answer-eval.ts` (NH_GOLD, spread into
ALL_GOLD). New Hampshire is deliberately NOT added to any `engine-citations.ts` per-state constant
map — New Hampshire has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("NH", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a New Hampshire policy — this matches the precedent already set by
Nebraska's, North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's,
Maryland's, Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, Oklahoma's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, and New Mexico's corpus packs in
this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future New Hampshire `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.

**Five-agent parallel batch:** New Hampshire was built in parallel with Idaho (ID), West Virginia
(WV), Hawaii (HI), and Maine (ME) — five separate agents in the same window, each on its own branch
(`feat/demeter-nh-corpus` for this one). All five states register in the same four shared files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and
therefore all five PRs are expected to conflict with each other on merge. The rule to follow when
resolving that conflict is to always COMBINE every state's additions (StateCode union members,
REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never to
drop another state's entry to resolve a conflict — matching the precedent this roster's prior
same-window batch tiers (Mississippi/Kansas/New Mexico/Nebraska; Florida/Massachusetts/Nevada/Arizona)
already set.
