# Idaho pack — provenance

**Created:** 2026-08-12. Idaho is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, and Arkansas's prior builds, Idaho has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking against
an existing engine constant was possible or attempted; this pack's findings stand entirely on its
own primary-source research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content
layer — and does not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`,
both of which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Idaho was built in parallel with West Virginia, Hawaii, New Hampshire, and Maine — four separate
agents in the same window, each on its own branch. See the Registration section below for how any
resulting merge conflict on shared files should be resolved.

## Method

Direct `curl` fetch (browser User-Agent) of Idaho DHW's consumer-facing About SNAP, Apply for SNAP,
and SNAP Retailer Information / Candy and Soda Restrictions pages (all clean HTTP 200), plus the full
text of IDAPA 16.03.04 ("Idaho Food Stamp Program," Idaho's SNAP administrative code) fetched directly
from adminrules.idaho.gov and converted locally with `pdftotext -layout`. WebSearch/WebFetch
cross-checks (USDA FNS's Idaho waiver page, Covington & Burling LLP's legal-analysis summary of
Aragon et al. v. Rollins et al.) corroborated the specific list of states whose food-restriction
waivers a June 2026 federal court order vacated — Idaho was not among them.

## Finding 0 — no real access barrier found; one trivial 301-redirect tooling wrinkle, resolved

`healthandwelfare.idaho.gov` returned clean HTTP 200 to every direct curl attempt across three
separate consumer/retailer pages. `adminrules.idaho.gov` returned a 301 redirect on the first fetch
attempt of the IDAPA 16.03.04 PDF — resolved trivially by following the redirect (`curl -L`), landing
on a clean HTTP 200 and a readable 1.2MB, 70-page PDF. This pack found no bot-detection wall anywhere
in its Idaho research, consistent with this roster's most recently built state, Nebraska, and a
contrast with this roster's Connecticut, Arkansas, and several other prior packs' Justia/Radware
patterns.

## Finding 1 (flagship, structural correction) — Idaho's BBCE does NOT waive the resource test; it
RAISES the limit to a flat $5,000 — directly contradicting a widely-repeated secondary-source claim

Multiple secondary/aggregator sources this pack found in its initial web-search pass describe Idaho
as having "adopted BBCE with no resource limit," concluding a car's value doesn't affect eligibility
for any Idaho household. Idaho's own administrative code says the opposite in as many words. IDAPA
16.03.04.010.09 defines Broad-Based Categorical Eligibility (BBCE) and states BBCE-eligible households
are "also subject to resource, gross, and net income eligibility standards" — not exempt. IDAPA
16.03.04.305 then sets that standard: "The Food Stamp resource limit is five thousand dollars ($5,000)
for Broad-Based Categorically Eligible households." This pack independently cross-checked the $5,000
figure against DHW's own separate consumer-facing Apply for SNAP page ("For most households, resources
must be under $5,000 to qualify for SNAP"), which also lists "Household and recreational vehicles"
among counted resource types — itself a second, independent contradiction of the "car value doesn't
matter" claim. This pack's own preliminary web-search synthesis, before primary-source verification,
initially reproduced the incorrect "no resource limit" framing — this pack discloses that self-
correction explicitly rather than presenting the final $5,000 answer as if it had been obvious from
the start.

## Finding 2 (flagship, time-sensitive) — Idaho's candy/soda restriction was NOT vacated by the same
court order that struck down Nebraska's soda/energy-drink waiver — Idaho remains actively enforcing

This pack found and flags a genuinely important contrast with this roster's Nebraska pack, built
immediately prior. Nebraska's SNAP soda/energy-drink waiver was vacated by a federal court on June 22,
2026 in Aragon et al. v. Rollins et al. (D.D.C.) — a reader encountering that finding first could
reasonably, but wrongly, assume every state's similar waiver met the same fate. Idaho's candy-and-soda
restriction (Idaho House Bill 109, implementation date approved to move from 1/1/2026 to 2/15/2026)
was not vacated: this pack fetched Idaho DHW's own retailer-facing Candy and Soda Restrictions page
directly and found it dated April 27, 2026 — five weeks AFTER the court order — describing the
restriction as actively in force with no medical exemptions, and no mention of any court order or
rollback. Covington & Burling LLP's own legal-analysis summary of the order names the specific vacated
states: Colorado, Iowa, Nebraska, Tennessee, and West Virginia. Idaho is not on that list, and
secondary reporting corroborates Idaho officials asserting the ruling does not apply to Idaho's
restriction because Idaho was not a party to the suit. This pack's operative answer for an Idaho SNAP
applicant is that candy and soda remain NOT purchasable with SNAP as of this pack's fetch date — the
opposite operative answer from Nebraska's, despite both states having pursued structurally similar
waivers around the same time.

## Finding 3 (flagship, structural) — Idaho's drug-felony ban is conditioned on ONGOING SENTENCE
COMPLIANCE, not conviction count or treatment-program participation — a genuine mechanism difference
from Nebraska's modified ban

IDAPA 16.03.04.287 states individuals convicted of a controlled-substance possession, use, or
distribution felony "can receive Food Stamps when they comply with the terms of a withheld judgment,
probation, or parole" and are ineligible only while NOT complying. This pack flags the precise
structural contrast with Nebraska's modified ban (Neb. Rev. Stat. § 68-1017.02(1)(b)), which this
roster's Nebraska pack documented as scoped by conviction COUNT (permanent ineligibility only for
three-or-more possession/use felonies, or any sale/distribution felony) and conditioned on
participation in a substance-abuse TREATMENT PROGRAM for lesser convictions. Idaho's rule contains no
conviction-count threshold and no explicit treatment-program requirement — eligibility instead turns
on whether the person is currently meeting the terms of their own sentence. Two states with
structurally different "modified ban" mechanisms, both correctly described as modified rather than a
full lifetime ban or a full opt-out.

## Finding 4 (freshness gap, disclosed not fabricated) — Idaho's own IDAPA 16.03.04.257 ABAWD-exemption
text is stale relative to OBBBA and does not reflect current federal law

IDAPA 16.03.04.257 (dated 7-1-24) still states the pre-OBBBA ABAWD age exemption range (under 18, or
53/55 and older) and still lists veteran, homeless, and foster-youth exemption categories that OBBBA
removed nationally effective October 20, 2025, alongside raising the nationwide ABAWD age ceiling to
64. This pack found no evidence Idaho has formally amended Section 257 to reflect either change as of
this pack's fetch date — a genuine administrative-code lag caught by reading the rule's own
effective-date stamp rather than assuming a state's own official code text is automatically current.
This pack discloses this explicitly in `freshness.json` rather than either quoting the stale text as
current or silently substituting the correct federal figures without flagging the discrepancy.

## Finding 5 (structural match, not a departure) — Idaho's four-tier utility-allowance system
(SUA/LUA/MUA/TUA) structurally matches this roster's Nebraska pack's own four-tier finding

IDAPA 16.03.04.543 confirms Idaho splits the shelter deduction's utility component into four tiers —
Standard (heating/cooling), Limited (2+ non-heating utilities), Minimum (exactly 1 non-heating,
non-telephone utility), and Telephone (phone only) — the same four-way split this roster's Nebraska
pack documented (SUA/LUA/OUA/Telephone Allowance) as a departure from the more common three-tier
structure most other states in this roster use. This pack flags this as a confirmation that the
four-tier pattern is not unique to Nebraska, worth remembering for future state builds rather than
assuming a three-tier structure is the norm without checking. This pack could NOT, however, locate
Idaho's current dollar figures for any of the four tiers from a directly-fetched, dated DHW source —
disclosed as a genuine sourcing gap in `freshness.json` rather than reused from an unverified secondary
source.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

Idaho has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine constant
this pack could confirm or contradict — every finding above is a first-pass primary-source finding. A
future `packages/snap-rules` build for Idaho (out of scope for this task, requiring its own separate,
explicit go-ahead per the standing park rule) should treat this pack's citations as a starting point,
not a final answer, and should specifically re-verify the candy/soda restriction's status (Finding 2,
the most volatile fact in this pack), the current SME and utility-allowance dollar figures (disclosed
gaps, Findings 5 and the medical-deduction supplement), and IDAPA 16.03.04.257's ABAWD text against
any post-OBBBA amendment (Finding 4) before hardcoding Idaho's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Idaho text, checking specifically
for: claims inferred from a section heading rather than its own body text; dollar figures not
traceable to a specific dated source; and any Idaho-vs-common-assumption contrast overclaimed as
settled when the underlying evidence was genuinely ambiguous or still in motion. Concrete catches from
this pass:

- The BBCE resource-limit correction (Finding 1) is the most consequential catch in this pack: this
  pack's OWN first-pass web-search synthesis, before primary-source verification, produced exactly the
  "no resource limit" overclaim this pack is now correcting. This pack discloses that self-correction
  explicitly, and backs the correction with TWO independent primary sources (IDAPA 16.03.04's own rule
  text AND DHW's separate consumer-facing page) rather than resting on one.
- The candy/soda-restriction finding (Finding 2) does not merely assert Idaho's restriction survived —
  it grounds the claim in the retailer page's own dated timestamp (4/27/2026, five weeks post-order)
  and cross-checks the vacated-state list against a named legal-analysis source rather than assuming
  "Idaho wasn't mentioned in the Nebraska coverage" means "Idaho was unaffected."
- The drug-felony mechanism comparison (Finding 3) was checked against the DISTINCTION between "no
  treatment-program requirement stated in the text" and "Idaho affirmatively prohibits a
  treatment-program alternative" — this pack's reading is the former (Idaho's rule is simply silent on
  treatment programs, conditioning eligibility on sentence compliance instead), not the latter, and the
  supplement text is worded to reflect that distinction rather than overclaiming a prohibition that
  isn't in the rule.
- The ABAWD freshness flag (Finding 4) does not quote IDAPA 16.03.04.257's stale age range and
  exemption list as Idaho's current policy — it states plainly that federal law (OBBBA) controls
  regardless of whether the state's own rule text has caught up, and directs a reader to check for an
  amended version rather than asserting one exists or doesn't.
- The SME dollar figure ($144) and the four utility-allowance dollar figures are explicitly flagged as
  secondary-source-corroborated or entirely unlocated, not silently presented with the same confidence
  as this pack's directly-fetched IDAPA-sourced mechanism findings.
- The EC-household-to-24-month-certification link is flagged as an inference from Section 120's
  interview-frequency rule, not a direct quote of a certification-period-assignment section this pack
  located and read.

## Sources

| Source | Access | Dated |
|---|---|---|
| Idaho DHW, About SNAP consumer page | direct curl fetch (browser UA), clean HTTP 200 | page dated 3-12-2026, fetched 2026-08-12 |
| Idaho DHW, Apply for SNAP consumer page (income limits, resource limit, application channels) | direct curl fetch (browser UA), clean HTTP 200 | page dated 4-14-2026, effective October 2025 income figures, fetched 2026-08-12 |
| Idaho DHW, SNAP Retailer Information Page / Candy and Soda Restrictions | direct curl fetch (browser UA), clean HTTP 200 | page dated 4-27-2026, fetched 2026-08-12 |
| IDAPA 16.03.04, Idaho Food Stamp Program (full 70-page administrative code) | direct curl fetch via adminrules.idaho.gov (301 redirect followed with curl -L), clean HTTP 200, converted with pdftotext -layout | effective 7-1-24, fetched 2026-08-12 |
| USDA FNS, Idaho SNAP Food Restriction Waiver page | WebSearch/WebFetch corroboration | approval/implementation-date history, fetched 2026-08-12 |
| Covington & Burling LLP, legal-analysis summary of Aragon v. Rollins | WebSearch/WebFetch corroboration | June 22, 2026 order, naming CO/IA/NE/TN/WV as vacated states |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (ID guide questions), `eval/answer-eval.ts` (ID_GOLD, spread into
ALL_GOLD). Idaho is deliberately NOT added to any `engine-citations.ts` per-state constant map — Idaho
has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("ID", ...)` will
throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build adds an Idaho
policy — this matches the precedent already set by Nebraska's, North Carolina's, Ohio's, New Jersey's,
Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's, Colorado's, South Carolina's, Alabama's,
Louisiana's, Kentucky's, Oklahoma's, Connecticut's, Utah's, Iowa's, and Arkansas's corpus packs in this
same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Idaho `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Parallel-agent merge conflict:** Idaho was built in parallel with West Virginia, Hawaii, New
Hampshire, and Maine (five separate agents in the same window, each on its own branch:
`feat/demeter-id-corpus` for this pack). All five states register in the same four shared files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`). Whoever
resolves the resulting merge conflict should always COMBINE every state's additions (StateCode union
members, REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export),
never drop another state's entry to resolve a conflict — the same rule this roster's Nebraska/
Mississippi/Kansas/New Mexico batch-tier build already established.
