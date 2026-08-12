# Nebraska pack — provenance

**Created:** 2026-08-12. Nebraska is a genuine BLANK SLATE in this roster — like Connecticut's,
Utah's, Iowa's, and Arkansas's prior batch-tier builds, Nebraska has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking against
an existing engine constant was possible or attempted; this pack's findings stand entirely on its
own primary-source research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content
layer — and does not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`,
both of which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Nebraska is the second BATCH TIER build in this roster — built alongside Mississippi, Kansas, and
New Mexico by separate parallel agents in the same window; see the Registration section below for
how the resulting merge conflict on shared files was resolved.

## Method

Direct `curl` fetch (browser User-Agent) of Nebraska DHHS's current SNAP Program Standards and SNAP
Monthly Deductions guidance-document PDFs, converted locally with `pdftotext -layout` after
WebFetch's markdown converter returned unreadable binary content for both. Also directly fetched
Nebraska's 475 NAC SNAP policy manual's utility-allowance sections (general overview plus the LUA
and OUA subsections specifically), the full text of Neb. Rev. Stat. § 68-1017.02 from
nebraskalegislature.gov, DHHS's OBBBA/federal-requirements rollout pages, and USDA FNS's
Nebraska-specific food-restriction-waiver page. WebSearch/WebFetch cross-checks (Nebraska Examiner,
Nebraska Public Media, WOWT, the Nebraska Legislature's own Unicameral Update reporting service, and
Covington & Burling LLP's legal-analysis summary) corroborated the LB319 veto/override outcome and
the Aragon v. Rollins court vacatur of the food-restriction waiver, both disclosed as somewhat
lower-confidence findings (not fully documented on a single DHHS policy page) below.

## Finding 0 — no bot-detection wall found anywhere in Nebraska's primary sources; the only access
complication was a tooling-layer PDF-parsing limitation, resolved locally

Unlike this roster's now-familiar Justia-403 and Radware/TSPD bot-detection patterns for several
other states' statute or dollar-figure pages, `dhhs.ne.gov`, `public-dhhs.ne.gov`, and
`nebraskalegislature.gov` ALL returned clean HTTP 200 to every direct curl attempt this pack made,
including two PDF guidance documents (SNAP Program Standards, SNAP Monthly Deductions) that carry
Nebraska's actual current dollar figures. The only complication this pack found was that WebFetch's
built-in markdown converter could not parse either PDF (returning unreadable binary/compressed-
stream content), which this pack resolved by fetching the PDFs directly with `curl` and converting
them locally with `pdftotext -layout` — a tooling-layer limitation on this pack's own retrieval
path, not a source-side access barrier, and no external archive fallback was needed anywhere in
this pack's Nebraska research.

## Finding 1 (flagship, structural) — Nebraska's 165% FPL gross-income ceiling is scoped to
elderly/disabled/separate-household/ERP households only — NOT a blanket figure for every household

Nebraska DHHS's own current SNAP Program Standards table (effective 10/1/2025) lists the 165% FPL
column with the precise label "Maximum Gross Monthly Income for an Elderly, Disabled, Separate
Household and ERP Households" — a narrower scope than the flat BBCE percentage most of this
roster's other states apply to every categorically-eligible household regardless of composition. An
ordinary working-age household not separately enrolled in Nebraska's Expanded Resource Program
(ERP) remains subject to the plain federal 130% FPL gross test. This pack reads the table's own
column header literally rather than assuming Nebraska's headline "165% BBCE" figure (the framing
this pack found repeated in several secondary sources) applies universally.

## Finding 2 (flagship, structural) — Nebraska's ERP RAISES the resource limit to $25,000 rather
than waiving it outright, a genuine departure from most of this roster's BBCE-style asset-waiver
shape

Nebraska recognizes a narrower Categorical Eligibility (CE) pathway (TANF/ADC, SSI, or AABD
recipients) alongside its own, broader Expanded Resource Program (ERP). Unlike this roster's
Connecticut RCE/ECE, Kentucky, and most other BBCE-style states, where categorical eligibility
waives the resource test entirely, Nebraska's ERP instead sets a specific, still-enforced $25,000
liquid-resource ceiling — an elevated cap, not a full waiver. This pack fetched and confirmed this
figure directly from DHHS's own current SNAP Program Standards table, alongside the $4,500
(elderly/disabled) and $3,000 (all other, non-ERP) resource limits. The CE pathway's own resource
treatment (this pack's working assumption: a fuller waiver, consistent with its structural role) is
flagged as somewhat lower-confidence — see `freshness.json`.

## Finding 3 (flagship, structural) — Nebraska's ABAWD-waiver absence is a STATUTORY MANDATE, not a
policy choice: Neb. Rev. Stat. § 68-1017.02 bars DHHS from seeking an area-wide waiver except where
federal law requires it

This pack fetched and read Neb. Rev. Stat. § 68-1017.02 directly from `nebraskalegislature.gov` (no
access barrier) and found it contains TWO distinct provisions this pack cites separately: the
drug-felony modified ban (subsection (1)(b), see Finding 4) AND a separate provision barring DHHS
from seeking, applying for, accepting, or renewing an area-wide ABAWD work-requirement waiver except
where expressly required by federal law. This pack reads Nebraska's current lack of any active
ABAWD waiver as a legislative self-restriction on the agency's own waiver-request authority — a
structurally similar finding, in kind though not subject matter, to this roster's Oklahoma and
Arkansas packs' own statutory self-restriction findings — rather than merely a labor-market fact
about Nebraska's unemployment rate. This is distinct from DHHS's retained, federally-permitted
discretion over individual, case-by-case ABAWD exemptions, which the statute does not bar.

## Finding 4 (flagship, time-sensitive correction) — Nebraska did NOT opt out of the federal
drug-felony SNAP ban in 2025: a bill that would have done so (LB319) was VETOED and the veto was
SUSTAINED; the older, narrower modified ban remains current, unchanged law

This pack found LB319, a 2025 bill that would have replaced Nebraska's existing drug-felony SNAP
provision with a broader eligibility rule (dropping the treatment-program condition, replacing it
with sentence-completion-or-probation/parole/post-release-supervision eligibility). LB319 passed the
full Legislature 32-17 on May 14, 2025 — and Governor Jim Pillen vetoed it the SAME DAY. An override
motion failed 24-24 on May 19, 2025, six votes short of the 30-vote supermajority required. LB319
never became law. This pack explicitly discloses that its OWN preliminary web-search synthesis, before
primary-source verification, INITIALLY mischaracterized this as "Nebraska opts out of the federal
provision" — language drawn from LB319's own committee-statement summary, which describes the bill
AS INTRODUCED/ADVANCED, not as enacted law. Correcting this required tracing the bill's full
legislative history (committee advancement → floor passage → veto → failed override) rather than
stopping at the committee-statement stage. Nebraska's operative, current law remains Neb. Rev. Stat.
§ 68-1017.02(1)(b)'s pre-existing, narrower modified ban: permanent ineligibility only for three or
more possession/use felony convictions or any sale/distribution felony conviction, with 1-2
possession/use felony convictions remaining eligible while participating in or after completing a
substance-abuse treatment program.

## Finding 5 (flagship, time-sensitive) — Nebraska's SNAP soda/energy-drink restriction was
approved, took effect, and was then VACATED by a federal court four months before this pack's fetch
date; DHHS is actively unwinding it but retailer-level removal is not instantaneous

USDA approved Nebraska's request to exclude soda, "soft drinks," and energy drinks from SNAP
purchases on April 14, 2025, effective January 1, 2026, for a two-year demonstration period. This
pack found the waiver was then vacated: on June 22, 2026, the U.S. District Court for the District
of Columbia, in Aragon et al. v. Rollins et al., 1:26-cv-00861 (D.D.C.), ordered USDA's approval
vacated, finding USDA lacked statutory pilot-project authority for waivers of this kind and had
failed a required 30-day Federal Register notice. This pack found reporting from early July 2026
describing Nebraska DHHS as actively working with retailers to remove the restriction, explicitly
noting the removal is not instantaneous at the point-of-sale level. This pack's operative answer
discloses this as a live, evolving situation rather than a single flat yes/no.

## Finding 6 — Nebraska's utility-allowance system has FOUR tiers, not the typical three — a
genuine structural departure this pack traced to the precise qualifying-utility-count rule

475 NAC 3-003.01H lists Standard Utility Allowance (SUA, heating/cooling), Limited Utility Allowance
(LUA, 2+ non-heating utilities), One Utility Allowance (OUA, exactly 1 non-heating non-phone
utility), and Telephone Allowance (phone only) as four DISTINCT tiers with four distinct current
dollar figures ($615 / $321 / $63 / $54, effective 10/1/2025). This pack fetched 475 NAC's own LUA
and OUA subsections directly to resolve the precise qualifying-count distinction between them (LUA's
"at least two," OUA's "no more than one") rather than assuming OUA was a rounding artifact or
synonym for the Telephone Allowance.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

Nebraska has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Nebraska (out of scope for this task, requiring
its own separate, explicit go-ahead per the standing park rule) should treat this pack's citations
as a starting point, not a final answer, and should specifically re-verify the food-restriction-
waiver status (Finding 5, the most volatile fact in this pack), the drug-felony statute's current
text (Finding 4, in case a future legislative session revisits LB319-style legislation), and the
ERP/CE resource-treatment distinction (Finding 2) before hardcoding Nebraska's parameters into
engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Nebraska text, checking
specifically for: claims inferred from a section heading rather than its own body text; dollar
figures not traceable to a specific dated source; and any Nebraska-vs-common-assumption contrast
overclaimed as settled when the underlying evidence was genuinely ambiguous or still in motion.
Concrete catches from this pass:

- The 165% FPL scoping finding (Finding 1) does not merely repeat DHHS's table — it quotes the
  table's own column-header language precisely ("Elderly, Disabled, Separate Household and ERP
  Households") specifically because a reader skimming only the 165% dollar figures, without reading
  the column header, could easily assume the figure applies universally the way it does in most
  other BBCE states this roster has built.
- The drug-felony correction (Finding 4) is the most consequential catch in this pack: this pack's
  OWN first-pass web-search synthesis, before primary-source verification, produced exactly the
  overclaim this pack is now correcting ("Nebraska opts out of the federal provision"). This pack
  discloses that self-correction explicitly rather than silently fixing it and presenting the final
  answer as if it had been obviously correct from the start — the veto and failed override are not
  edge-case details, they are the entire reason the earlier synthesis was wrong.
- The ABAWD statutory-bar finding (Finding 3) was checked against the DISTINCTION between an
  area-wide waiver (barred by statute) and individual discretionary exemptions (not barred) — this
  pack found reporting describing Nebraska DHHS continuing to exercise discretionary individual
  ABAWD exemptions in some rural counties, and confirmed this does not contradict the statutory bar
  on area waivers specifically, rather than treating the two concepts as interchangeable.
- The food-restriction-waiver finding (Finding 5) does not state a flat "Nebraska SNAP can now buy
  soda" answer — it discloses the retailer-level rollout lag explicitly, based on July 2026 reporting
  describing the removal as still in progress at the point-of-sale level, four months into the
  window between the June 22, 2026 court order and this pack's August 12, 2026 fetch date.
- The OUA structural finding (Finding 6) is grounded in reading 475 NAC 3-003.01H2 and H3's own
  qualifying-count language side by side ("at least two" vs. "no more than one") directly, rather
  than inferring the distinction from the dollar-figure gap between LUA ($321) and OUA ($63) alone.
- The Restaurant Meals Program finding does not claim LB901's amended content is known — it states
  plainly that this pack could not confirm what AM2406 actually carried forward from LB920 into
  LB901, disclosing the gap in `freshness.json` rather than assuming the RMP directive survived or
  was dropped.
- The CE resource-waiver claim (asset-rule supplement) is flagged as lower-confidence rather than
  stated with the same certainty as this pack's other, more directly-sourced findings, because its
  source excerpt did not include an explicit "no resource limit" statement in as many words.

## Sources

| Source | Access | Dated |
|---|---|---|
| Nebraska DHHS, SNAP Program Standards (income/resource/allotment table) | direct curl fetch (browser UA), converted with `pdftotext -layout` | effective 10/1/2025, fetched 2026-08-12 |
| Nebraska DHHS, SNAP Monthly Deductions (Standard Deduction, SUA, LUA, OUA, Telephone Allowance, Maximum Shelter Deduction, Homeless Shelter Standard, medical/earned-income/dependent-care deductions) | direct curl fetch (browser UA), converted with `pdftotext -layout` | effective 10/1/2025, fetched 2026-08-12 |
| Nebraska DHHS, 475 NAC SNAP Policy Manual, § 3-003.01H (Utility Allowance) and subsections H2 (LUA), H3 (OUA) | direct curl fetch (browser UA), clean HTTP 200 | fetched 2026-08-12 |
| Neb. Rev. Stat. § 68-1017.02 | direct curl fetch of nebraskalegislature.gov, clean HTTP 200, full text read directly | current as codified; drug-felony provision since 2005-era modification |
| Nebraska DHHS, OBBBA/federal-requirements rollout pages | direct fetch, clean HTTP 200 | ABAWD age-range/exemption changes effective 10/20/2025 |
| USDA FNS, Nebraska SNAP Food Restriction Waiver page | direct fetch, clean HTTP 200 | approval 4/14/2025, effective 1/1/2026, vacated 6/22/2026 |
| Nebraska Examiner, Nebraska Public Media, WOWT, Nebraska Legislature Unicameral Update, Covington & Burling LLP | WebSearch/WebFetch corroboration only | LB319 veto (5/14/2025) and override failure (5/19/2025); Aragon v. Rollins court order (6/22/2026) |
| LegiScan (LB920 bill-status tracking) | WebSearch corroboration only | LB920 failed 4/17/2026; provisions amended into LB901 via AM2406, content not independently confirmed |
| Nebraska DHHS, SNAP Resource Tips; Nebraska Appleseed, LB108 fact sheet; WOWT/Nebraska Appleseed on LB192 | WebSearch corroboration only | ERP/CE resource-treatment distinction; 165% FPL legislative history (LB108 origin unverified, LB227 sunset, LB192 permanent removal confirmed 6/2/2025) |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (NE guide questions), `eval/answer-eval.ts` (NE_GOLD, spread into
ALL_GOLD). Nebraska is deliberately NOT added to any `engine-citations.ts` per-state constant map —
Nebraska has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("NE",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build
adds a Nebraska policy — this matches the precedent already set by North Carolina's, Ohio's, New
Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's, Colorado's, South Carolina's,
Alabama's, Louisiana's, Kentucky's, Oklahoma's, Connecticut's, Utah's, Iowa's, and Arkansas's corpus
packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Nebraska `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Batch-tier merge conflict:** Nebraska was built in parallel with Mississippi, Kansas, and New
Mexico (the second batch of this roster's batch tier). All four states registered in the same four
shared files (`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`,
`eval/answer-eval.ts`). See the top-level commit history for how any resulting merge conflict was
resolved — the rule followed was to always COMBINE every state's additions (StateCode union
members, REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export),
never to drop another state's entry to resolve a conflict.
