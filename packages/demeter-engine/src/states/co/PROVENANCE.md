# Colorado pack — provenance

**Created:** 2026-08-11. Colorado is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, and
Maryland's prior builds, Colorado has NO existing `packages/snap-rules` entry and NO oracle
fixture coverage at all. No discrepancy-checking against an existing engine constant was
possible or attempted; this pack's findings stand entirely on its own primary-source research.
This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not
touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which
stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (browser User-Agent) of Colorado's own formally-promulgated administrative
regulation, 10 CCR 2506-1 ("RULE MANUAL VOLUME 4, SNAP"). Colorado's Secretary of State hosts a
generated PDF of the full regulation (`coloradosos.gov/CCR/GenerateRulePdf.do`), which fetched
cleanly (HTTP 200, ~1.9MB, converted with `pdftotext -layout`) but proved to be a STALE cached
version pinned to November 30, 2022 across all 226 pages. The CURRENT per-section text was
instead located and fetched directly via Cornell Law's Legal Information Institute mirror
(`law.cornell.edu/regulations/colorado/...`), every section a clean HTTP 200: Sections 4.000
(Definitions), 4.205.1 (Expedited Service), 4.206 (Categories of Eligibility), 4.207
(Allotments), 4.208/4.208.1 (Certification Periods), 4.311 (ABAWD Work Requirements), 4.402
(Household Income Eligibility), 4.407 and its sub-sections (Deductions and Exclusions), 4.408
(Resource Eligibility Standards), 4.409 (Countable Resources), and 4.410 (Exempt Resources).
Also fetched directly: CDHS's current SNAP page (`cdhs.colorado.gov/snap`), CDHS's current
ABAWD FAQ page (`cdhs.colorado.gov/snap/abawd`), CDHS's current SNAP Healthy Choice Waiver
status page (`cdhs.colorado.gov/snap-healthy-choice-waiver`), Colorado Revised Statutes §
26-2-305 (via FindLaw's mirror), and SB25-169's bill-status page on `leg.colorado.gov`.
WebSearch cross-checks were used against the independent `abawdmap.us` waiver aggregator and
USDA's own FY26 COLA memo, ABAWD waiver index, and Restaurant Meals Program list.

## Finding 0 — one access-tooling artifact, cleanly resolved: cdhs.colorado.gov 403'd on WebFetch, but returned clean HTTP 200 to direct curl every time

Every attempt to reach `cdhs.colorado.gov` pages through the WebFetch tool returned an HTTP 403.
Direct `curl` with a browser User-Agent string reached the same URLs cleanly (HTTP 200) on every
attempt, across at least four separate CDHS pages fetched over the course of this pack's
research — matching a pattern this roster has repeatedly documented for other states' agency
sites. This was a tooling artifact, not a real access barrier, and is disclosed here rather than
silently worked around. Separately, two WebFetch summarization calls in this pack's research
produced results this pack did NOT rely on without independent verification: one WebFetch
synthesis stated SB25-169's "effective date" as "August 12, 2026" without clear primary-source
support (the actual operative fact this pack verified and used is the January 1, 2026 USDA
application deadline, confirmed directly from the bill's own text via search results); another
early WebFetch synthesis of the Cornell Law mirror of Section 4.000 characterized the ABAWD age
range as "18 through the age of forty-nine (49)" — this pack traced that specific figure to the
STALE 2022 Secretary-of-State PDF this pack was cross-checking against, not the current section
text, and used the current Cornell-mirrored text (18-54, itself pre-OBBBA-stale — see Finding 3)
instead.

## Finding 1 (flagship) — Colorado's ENTIRE detailed SNAP policy lives directly inside its formally-promulgated administrative code, with no separate narrative manual — a genuine structural departure from every other state this roster has built

Every prior state in this roster maintains a two-tier structure: a fast-moving, administratively
published narrative policy manual (Missouri's SNAP Manual, Maryland's SNAP Manual, Indiana's
PPM, Virginia's SNAP Manual Part, etc.), separate from a slower-moving statute. This pack
searched specifically for a Colorado "Income Maintenance manual" or similar narrative document
(per this task's own research-source suggestions) and found none — Colorado's operative SNAP
policy, at every level of operational detail (income limits, deduction formulas, categorical
eligibility, resource exemptions, ABAWD work requirements), lives directly inside 10 CCR 2506-1,
a regulation formally promulgated under the Code of Colorado Regulations, subject to the State
Board of Human Services' quarterly rulemaking cycle. This pack's hypothesis, stated plainly as a
hypothesis rather than a confirmed causal claim: this one-tier structure is the likely
explanation for Findings 2 and 3 below — a formal rulemaking cycle is slower to update than an
internal transmittal or memo series, and Colorado's own CDHS website content (which does not
require formal rulemaking) has visibly outpaced its own regulation text on both the FFY2026 COLA
and the 2025 federal OBBBA changes.

## Finding 2 (flagship) — every dollar figure in Colorado's own current regulation is one full federal fiscal year stale

10 CCR 2506-1-4.207.3(D) (maximum/minimum monthly allotments), 4.407.1 (Standard Deduction),
4.407.3 (Excess Shelter Deduction cap and Homeless Shelter Deduction), and 4.407.31 (the
four-tiered Standard Utility Allowance: HCUA/BUA/OUA/Telephone) each state dollar figures
explicitly labeled "Effective October 1, 2024" — the FFY2025 COLA cycle. This pack independently
cross-validated the CURRENT national FFY2026 figures (Standard Deduction $209/$209/$209/$223/
$261/$299, Excess Shelter cap $744) via USDA's own FY26 COLA memo and this roster's Missouri and
Maryland packs' own independently-confirmed figures, and used those nationally-uniform figures
as the best available substitute for Colorado's Standard Deduction and Excess Shelter cap. The
four state-specific utility-allowance figures and the Homeless Shelter Deduction, however, are
NOT nationally uniform and could not be cross-validated the same way — this pack disclosed that
gap rather than guessing. Distinctively, CDHS's OWN current `/snap` page independently confirms
part of this finding with its own accurate disclosure: its maximum-allotment table is explicitly
labeled "Note: The values below have been updated to reflect SNAP increases on Oct. 1, 2024" —
Colorado's own consumer-facing government page discloses its own stale figure. (Separately, that
same page's income-limits table carries a stale "last updated Oct. 1, 2024" LABEL even though
the actual 200%-FPL dollar figures shown are correct for FFY2026 — because 200% FPL income
limits are set nationally, not state-by-state, and happen to match this roster's Maryland pack's
independently-confirmed current figures exactly. This pack disclosed this DATA-correct/
LABEL-stale distinction rather than treating the whole table as suspect.)

## Finding 3 (flagship) — a genuine, disclosed contradiction between Colorado's own ABAWD regulation text and Colorado's own current website, spanning THREE different statements on a single CDHS page

10 CCR 2506-1-4.311 (ABAWD Work Requirements), despite a section header reading "[Effective
1/4/2025]," still defines an ABAWD as aged 18 through 54 and still lists three exemptions that
H.R. 1 (2025)/OBBBA REMOVED at the federal level: a blanket homelessness exemption, veteran
status, and having aged out of foster care by 24. This directly contradicts CDHS's own dedicated,
current ABAWD FAQ page (`cdhs.colorado.gov/snap/abawd`) and its own February 2026 training desk
aid, both of which state the current federal 18-64 age range and the current exemption set
(including the OBBBA-added Indian/Urban Indian/California Indian exemption, absent from the
regulation text entirely). More strikingly, CDHS's own MAIN `/snap` page — fetched the same day —
contains a THIRD, internally-inconsistent statement: it describes ABAWDs as "between 18 and 56"
in one paragraph and "Between the ages of 18 and 64" in another paragraph further down the SAME
page, alongside a leftover stale 2023 notice about the Fiscal Responsibility Act's pre-OBBBA age
change. This pack treated 18-64 (the two most specific, most recently dated, most directly
OBBBA-responsive sources) as authoritative and disclosed the regulation-text and main-page
contradictions plainly in `freshness.json` rather than picking a number silently. Colorado holds
ZERO ABAWD waivers anywhere in the state — urban Front Range counties and rural mountain counties
alike — per the independent `abawdmap.us` aggregator and the absence of any Colorado entry on
USDA's own Time Limit Waivers FY 2025-2029 index; this part of the finding is clean and
unambiguous, unlike the age-range question.

## Finding 4 (flagship) — Colorado's drug-felony rule is materially NARROWER than the widely-repeated "modified ban" secondary-source characterization

Secondary sources broadly describe Colorado as a "modified ban" state for drug-felony SNAP
disqualification and note Colorado's 2022 legislative removal of a prior rehabilitation-steps
requirement. This pack's direct read of Colorado's own primary sources found the actual trigger
is narrower than "modified ban" suggests: C.R.S. § 26-2-305(1)(c) disqualifies a household member
for 2 years (first offense) or permanently (second offense) ONLY for a felony conviction directly
related to using SNAP/food-stamp benefits themselves to purchase controlled substances, where
that misuse is part of the court's own findings — not simply for having any drug-related felony
conviction. 10 CCR 2506-1-4.206(C) applies the identical narrow trigger to a separate,
categorical-eligibility consequence (loss of BCE/ECE, requiring Standard Eligibility's stricter
income/resource test). This pack disclosed, rather than resolved, exactly how the statute's
disqualification period and the regulation's categorical-eligibility consequence interact for the
same conduct — see `freshness.json`. Simple possession, or a drug felony unconnected to misusing
one's own SNAP benefits, triggers neither provision.

## Finding 5 — a genuinely time-sensitive, actively-reversing state policy: Colorado's approved soda/candy SNAP restriction was discontinued, correcting early-2026 news coverage

Multiple news outlets reported in January-March 2026 that USDA had approved Colorado's "Healthy
Choice Waiver," a pilot excluding sweetened soft drinks from SNAP-eligible purchases, scheduled
to take effect around April 30, 2026 (later pushed to October 30, 2026). This pack's direct fetch
of CDHS's own current, dedicated status page found the program discontinued: "CDHS is
discontinuing its efforts to implement the SNAP Healthy Choice Waiver, as federal policy
currently prohibits states from piloting programs that restrict SNAP food and beverage
purchases... SNAP products and eligibility requirements remain the same." CDHS's own main SNAP
page independently corroborates this in its "What foods can I buy?" list, which affirmatively
includes soft drinks, candy, cookies, snack crackers, and ice cream. This pack disclosed a minor
residual inconsistency: that same main page still carries an older alert banner describing this
as merely a "delayed final vote" rather than a full discontinuation — see `freshness.json`.

## Finding 6 — Colorado does NOT currently have a Restaurant Meals Program, but a 2025 state law is actively moving it toward one, with a status this pack could not confirm

Unlike this roster's Maryland pack (an already-operating, statutorily-codified RMP), Colorado's
own current SNAP page lists hot/on-premises-consumption foods as explicitly NOT SNAP-eligible,
with no RMP exception. SB25-169, signed May 13, 2025, required CDHS to submit a USDA application
by January 1, 2026 — a deadline that has passed as of this pack's fetch date without a locatable
public status update on submission, review, or approval. This pack disclosed the gap in
`freshness.json` rather than guessing at a status.

## Finding 7 — Colorado is state-supervised, COUNTY-administered, and "Colorado Works" is a commonly-confused separate program name

CDHS's own description states Colorado "operates as a state supervised, county administered
human services system," with each of Colorado's 64 counties' human services department directly
determining SNAP eligibility — matching this roster's Virginia/North Carolina independently-
governed-county archetype, not Georgia/Indiana/Tennessee/Missouri/Maryland's state-agency-with-
local-offices archetype. Separately, "Colorado Works" is Colorado's own name for its SEPARATE
TANF cash-assistance program, not another name for SNAP — though Colorado Works receipt is one
qualifying benefit for SNAP's Basic Categorical Eligibility pathway.

## Finding 8 — Colorado excludes ALL vehicles as resources, and treats child support as an income exclusion, and has a flat $165 medical-expense shortcut

Three smaller structural findings, each matching a pattern this roster has documented elsewhere
in different combinations, together forming a distinctively Colorado-specific combination: (a)
10 CCR 2506-1-4.410(A) excludes ALL vehicles regardless of type, matching Missouri's and
Maryland's blanket pattern rather than Indiana's hybrid rule; (b) 10 CCR 2506-1-4.407(D)/4.407.5
treats legally obligated child support as an INCOME EXCLUSION applied before the gross income
test, matching Virginia/New Jersey/Illinois/Missouri's mechanism rather than Maryland/Indiana/
Tennessee's ordinary-deduction mechanism; (c) 10 CCR 2506-1-4.407.61 provides a flat $165
Standard Medical Expense Deduction (SMED) shortcut for verified expenses between $35.01 and $200,
matching Missouri's flat-shortcut pattern ($135 for $35.01-$170) rather than Maryland's
actual-expense-only rule — with an explicit carve-out excluding medical marijuana from allowable
medical expenses, a small but genuinely Colorado-flavored clarification given the state's legal
marijuana market.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed to check against)

Colorado has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding. A future `packages/snap-rules` build for Colorado (out of scope for this
task, requiring its own separate, explicit go-ahead per the standing park rule) should treat this
pack's citations as a starting point, not a final answer, and should specifically re-verify the
FFY2026 dollar figures (Finding 2), the ABAWD age range (Finding 3), and the drug-felony
statute/regulation interaction (Finding 4) against Colorado's own primary text before hardcoding
any of them into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Colorado regulation/statute/
website text, checking specifically for: claims inferred from a section heading rather than its
own body text; dollar figures not traceable to a specific dated source; and any Colorado-vs-
common-assumption contrast overclaimed as settled when the underlying evidence was genuinely
ambiguous. Concrete catches from this pass:

- The BBCE/ECE finding (income-pathways) was checked against the ACTUAL 4.206 regulation text
  (not just a search-result summary) and cross-validated against CDHS's own income-limits table
  and this roster's Maryland pack's independently-confirmed FFY2026 figures — the secondary
  "200% FPL, no asset test" claims here happened to be accurate, and this pack states that
  plainly rather than manufacturing a false "correction" narrative for its own sake.
- The drug-felony finding (Finding 4) is stated as a NARROWER rule than the "modified ban"
  secondary characterization, with the exact statutory trigger language ("directly related to
  the misuse of food stamp benefits" and "part of the court's own findings") quoted rather than
  paraphrased loosely into a broader claim.
- The ABAWD finding (Finding 3) does NOT pick a single "correct" Colorado source and discard the
  others — it explicitly discloses THREE different statements found across two CDHS-controlled
  surfaces (the regulation and two different areas of the CDHS website) and states which one this
  pack chose to treat as authoritative and why, rather than presenting Colorado's ABAWD age range
  as a single settled fact.
- The FFY2026 staleness finding (Finding 2) does NOT claim Colorado's income limits are stale —
  this pack specifically checked whether the 200%-FPL table's actual DATA was current (it is,
  because it is nationally uniform) even though its LABEL is stale, and kept that distinction
  separate from the utility-allowance and deduction figures, which this pack found genuinely
  stale in both label and data.
- The Healthy Choice Waiver finding (Finding 5) is checked against BOTH of CDHS's own pages (the
  dedicated waiver page AND the main SNAP page's alert banner) rather than only the more dramatic
  "discontinuing" language, and the minor inconsistency between the two pages' framing is
  disclosed rather than smoothed over.
- The Restaurant Meals Program finding (Finding 6) does not claim RMP is coming on any particular
  date — it states plainly that this pack could not confirm the USDA application's current status
  despite the statutory deadline having passed, rather than assuming approval was likely.

## Sources

| Source | Access | Dated |
|---|---|---|
| 10 CCR 2506-1-4.000 (Definitions) | direct curl fetch (browser UA) via law.cornell.edu | current mirror |
| 10 CCR 2506-1-4.205.1 (Expedited Service) | direct curl fetch (browser UA) via law.cornell.edu | current mirror |
| 10 CCR 2506-1-4.206 (Categories of Eligibility) | direct curl fetch (browser UA) via law.cornell.edu | current mirror, no access barrier |
| 10 CCR 2506-1-4.207 (Allotments) | direct curl fetch (browser UA) via law.cornell.edu | STALE — dollar figures "Effective October 1, 2024" |
| 10 CCR 2506-1-4.208 / 4.208.1 (Certification Periods) | direct curl fetch (browser UA) via law.cornell.edu | current mirror |
| 10 CCR 2506-1-4.311 (ABAWD Work Requirements) | direct curl fetch (browser UA) via law.cornell.edu | STALE — pre-OBBBA age range/exemptions despite "[Effective 1/4/2025]" header |
| 10 CCR 2506-1-4.402 (Household Income Eligibility) | direct curl fetch (browser UA) via law.cornell.edu | current mirror |
| 10 CCR 2506-1-4.407 and sub-sections (Deductions/Exclusions) | direct curl fetch (browser UA) via law.cornell.edu | STALE — dollar figures "Effective October 1, 2024" |
| 10 CCR 2506-1-4.408/4.409/4.410 (Resources) | direct curl fetch (browser UA) via law.cornell.edu | current mirror |
| Colorado SOS cached PDF of 10 CCR 2506-1 (full regulation) | direct curl fetch (browser UA) | STALE — pinned to 11/30/2022 across all 226 pages, used only for structural orientation |
| CDHS, Supplemental Nutrition Assistance Program (SNAP) page | direct curl fetch (browser UA) | fetched 2026-08-11; contains internally-inconsistent ABAWD statements and a self-disclosed stale allotment table |
| CDHS, Able-Bodied Adults Without Dependents FAQ | direct curl fetch (browser UA) | fetched 2026-08-11, current, states 18-64 |
| CDHS, SNAP Healthy Choice Waiver status page | direct curl fetch (browser UA) | fetched 2026-08-11, discontinuation notice |
| Colorado Revised Statutes § 26-2-305 | WebFetch via codes.findlaw.com mirror | current |
| SB25-169 (Restaurant Meals Program), bill-status page | WebFetch via leg.colorado.gov | signed 5/13/2025; Jan 1, 2026 application deadline passed, status unconfirmed |
| abawdmap.us, Colorado state entry | direct curl fetch (browser UA) | fetched 2026-08-11 — "No waiver — rule applies" |
| USDA FNS/FNA, FY26 COLA memo | WebSearch cross-check | national FFY2026 figures |
| USDA FNS, Time Limit Waivers FY 2025-2029 index | WebSearch cross-check | no Colorado entry found |
| KKTV, "SNAP bans on soda, candy and other foods will not go into effect in Colorado" (April 2026) | WebFetch | secondary corroboration only, for the Healthy Choice Waiver discontinuation |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (CO guide questions), `eval/answer-eval.ts` (CO_GOLD,
spread into ALL_GOLD). Colorado is deliberately NOT added to any engine-citations.ts per-state
constant map — Colorado has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("CO", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Colorado policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, and
Maryland's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request
an unfreeze. A future Colorado `packages/snap-rules` build is out of scope here and would need
its own separate, explicit go-ahead.
