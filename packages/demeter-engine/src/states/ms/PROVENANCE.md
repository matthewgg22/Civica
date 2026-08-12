# Mississippi pack — provenance

**Created:** 2026-08-12. Mississippi is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, and Connecticut's prior builds,
Mississippi has NO existing `packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted; this pack's
findings stand entirely on its own primary-source research. This task's scope was CORPUS ONLY —
the Demeter chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the standing
rule (`feedback_dashboard_snap_rules_parked`).

Mississippi is part of this roster's BATCH TIER — smaller-population states built 3-4 at a time
in parallel. Kansas, New Mexico, and Nebraska were built concurrently by separate agents in the
same window; see the Registration section below for how any resulting merge conflict on shared
files was resolved.

## Method

Direct `curl` fetch (browser User-Agent) of Mississippi Department of Human Services (MDHS)'s
current SNAP Policy Manual PDF (Title 18, Part 14, revised May 1, 2026, 166 pages,
`mdhs.ms.gov/wp-content/uploads/2026/07/SNAP-Policy-Manual-May-2026-1.pdf`) — a clean HTTP 200
with no access barrier of any kind, converted to plain text with `pdftotext -layout` and read
chapter-by-chapter. Also directly fetched MDHS's SNAP landing, Applying for SNAP, and EBT Card
consumer pages (via curl and WebFetch), and USDA FNA's current Restaurant Meals Program state
list (clean HTTP 200). WebSearch cross-checks corroborated the Mississippi Code Ann. §43-12-71
drug-felony opt-out (raw statute text blocked by law.justia.com's Cloudflare challenge, but quoted
and dated directly inside MDHS's own manual) and the current FFY2026 national dollar figures this
roster's other packs have independently confirmed (Mississippi's own manual defers to USDA's
annually-posted national standards rather than republishing them). USDA FNA's national FY2026
Standard Utility Allowance values PDF returned a live Akamai bot-detection block to every direct
fetch attempt — disclosed as an unresolved sourcing gap rather than resolved by fabrication.

## Finding 0 — Mississippi's own primary source (MDHS) had NO access barrier at all — a genuine
departure from this roster's now-familiar pattern

Unlike Connecticut's portaldir.ct.gov bot-detection wall or the Justia-403 pattern this roster has
repeatedly documented for state statute lookups, `mdhs.ms.gov` returned a clean HTTP 200 to every
direct curl attempt with a browser User-Agent — including the full 1.16MB current Policy Manual
PDF itself and every consumer-facing SNAP page this pack fetched. The access barriers this pack
DID find were both on third-party hosts, not MDHS's own site: `law.justia.com` (HTTP 403,
Cloudflare challenge, blocking the raw text of Miss. Code Ann. §43-12-71) and `usda.gov`'s
guidance-documents subdomain (HTTP 403, Akamai block, blocking the national FY2026 SUA-values
PDF). Both are disclosed explicitly in the relevant supplement and in `freshness.json`.

## Finding 1 (flagship, structural, CORRECTED framing) — Mississippi does NOT operate Broad-Based
or Expanded Categorical Eligibility in any form — CONFIRMING a secondary-source claim rather than
correcting it

MDHS's own current manual, Rule 15.1, limits categorical eligibility strictly to households where
every member receives or is eligible for TANF and/or SSI (7 CFR §273.2(j)(2)) — there is no
income-based BBCE track raising the effective gross-income ceiling for other households the way
the large majority of this roster's other states document (Kentucky's and Connecticut's dual-track
ECE/RCE structures, for instance). This pack found and CONFIRMS a claim several secondary sources
make about Mississippi specifically: "Mississippi does not use Broad-Based Categorical
Eligibility." This is worth stating precisely because most of this roster's prior corrections have
run the other direction (a secondary source overclaiming a BBCE feature that turned out to be
narrower or absent); here the secondary-source claim was accurate, and this pack's job was to
verify it against MDHS's own primary text rather than assume accuracy.

## Finding 2 (flagship, structural) — Mississippi's ABAWD waiver authority is gated to a formal
natural-disaster declaration with the Governor's approval, NOT the federal unemployment-rate
criteria — a Mississippi-specific statutory departure this pack traces to Miss. Code Ann. §43-12-19

MDHS's own current manual, Rule 13.12, states: "MDHS may seek a waiver of the ABAWD time limits
with the Governor's approval only during a formal state or federal declaration of a natural
disaster," citing Miss. Code Ann. §43-12-19. This is structurally different from the federal
unemployment-rate-based waiver criteria (10%+ county unemployment) most other states' packs in
this roster describe as the operative mechanism. This pack found secondary-source confirmation
(ABAWDMap.us) that Mississippi currently has no active ABAWD waiver anywhere in the state,
including in several historically waiver-eligible Mississippi Delta counties (Bolivar, Coahoma,
Humphreys, Issaquena, Leflore, Quitman, Sharkey, Sunflower, Tallahatchie, Tunica, Washington).
This pack's reading, grounded in MDHS's own current Rule 13.12: that current absence of any active
waiver is explained by Mississippi's own disaster-only statutory gate, independent of — and
potentially compounding — any general nationwide OBBBA tightening of federal waiver criteria.
This pack could NOT independently confirm whether Miss. Code Ann. §43-12-19's disaster-only
framing is itself a recent change or has read this way for longer; flagged for re-verification in
`freshness.json`.

## Finding 3 (flagship, CONFIRMED not corrected) — Mississippi fully opted out of the federal
drug-felony SNAP ban effective July 1, 2019 — an unconditional opt-out, matching secondary-source
claims this pack found

MDHS's own current manual, Rule 22.14, states unconditionally: "Mississippi has opted out of the
law that denies assistance and benefits after drug-related convictions... Mississippi statute as
of July 1, 2019 provides that individuals convicted of drug-related felonies are eligible to
receive SNAP benefits," citing Miss. Code Ann. §43-12-71. This pack found no qualifying language
in MDHS's own text — no treatment-program requirement, no probation-compliance condition — unlike
Connecticut's three-path MODIFIED opt-out this roster's Connecticut pack documents. This is a
CONFIRMATION of secondary-source consensus (Public Health Law Center, Collateral Consequences
Resource Center, 2019 contemporaneous news coverage of then-HB 1352), not a correction — worth
stating because this roster has found several other states where an equivalent "full opt-out"
secondary-source framing needed refinement.

## Finding 4 — Mississippi's own manual does NOT republish national dollar figures; it defers
directly to USDA's annually-posted standards, and this pack found stale FFY2025 figures repeated
as current by several secondary sources

Unlike most of this roster's other states' current-standards pages, Mississippi's manual (Rule
16.1) states plainly that MDHS "will apply uniform national resource standards of eligibility that
are published every October 1st by USDA" — it prints no Mississippi-specific dollar figure
anywhere in its 166 pages for resource limits, and Rule 18.9 (utility allowances) similarly
describes only structure, not dollar amounts. This pack treats the current FFY2026 national
standard resource limits ($3,000 / $4,500, effective October 1, 2025) as controlling, matching
this roster's Connecticut and Arkansas packs' independently-confirmed figures — and found several
secondary sources reporting stale FFY2025 figures ($2,750 / $4,250) as if current, which this pack
does not repeat.

## Finding 5 — Mississippi's vehicle exclusion is broader than several of this roster's other
states: MOST vehicles are excluded entirely, with no fair-market-value threshold

Rule 16.1.E states MDHS "exempts most vehicles to align with MS TANF policy," and Rule 16.4.H
confirms this in full: licensed or unlicensed vehicles used for regular on-road transportation
(cars, trucks, vans, motorcycles) and any vehicle used as the household's home are excluded from
resources ENTIRELY — no per-vehicle dollar-threshold or equity test applies to them at all. Only
recreational vehicles, ATVs, and other off-road/industrial vehicles not used as income-producing
property are counted, and only above a $4,650 excess-fair-market-value (or equity value, whichever
is higher) threshold (Rule 16.5).

## Finding 6 — Mississippi's ESAP requires EVERY household member to be 65 or older — narrower
than the 60+/disabled ESAP structure this roster's other states document

Chapter 28 (Elderly Simplified Application Project) requires ALL household members to be age 65 or
older with no earned income anywhere in the household — not the 60+/disabled threshold this
roster's Connecticut and Kentucky packs document for their own states' ESAP-equivalent tracks.
Mississippi's ESAP households are MANDATORY for the ESAP track (ineligible for regular SNAP
processing if they qualify) and get a 36-month certification period with an annual interim-contact
form rather than a full recertification. Mississippi also runs a separate 36-month-certification
MSCAP track (Chapter 29) and the Choctaw Food Distribution Program (Chapter 19) — an
alternative-benefit choice available to Mississippi Band of Choctaw Indians reservation residents,
which this pack flags as a genuine, distinctively Mississippi structural feature not present in
most of this roster's other states.

## Finding 7 — a genuine, disclosed access barrier: USDA's own national FY2026 SUA-values PDF is
blocked, and Mississippi's specific SUA dollar figure could not be recovered

USDA FNA's national FY2026 Standard Utility Allowance values PDF
(`usda.gov/sites/default/files/guidance-documents/fns.snap-simplifiedProcess-fy26sua-values.pdf`)
returned a live Akamai bot-detection block (HTTP 403) to every direct curl attempt regardless of
User-Agent — a genuine bot-detection wall, not a tooling artifact. Combined with MDHS's own manual
not publishing a Mississippi-specific SUA dollar figure (Finding 4), this pack could NOT recover
Mississippi's current SUA/BUA/telephone-allowance dollar amounts through any route attempted
within this pack's fetch window (unlike Connecticut's equivalent gap, which the Internet Archive
Wayback Machine successfully resolved). This is disclosed explicitly rather than resolved by
fabrication or extrapolation from other states' figures.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Mississippi has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding. A future `packages/snap-rules` build for Mississippi (out of scope for
this task, requiring its own separate, explicit go-ahead per the standing park rule) should treat
this pack's citations as a starting point, not a final answer, and should specifically re-verify
the ABAWD disaster-only waiver gate (Finding 2, the most consequential and least-precedented
finding in this pack), the current ABAWD waiver status, and Mississippi's specific SUA dollar
figure (Finding 7, still unresolved) before hardcoding Mississippi's parameters into engine
constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Mississippi text, checking
specifically for: claims inferred from a section heading rather than its own body text; dollar
figures not traceable to a specific dated source; and any Mississippi-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- The categorical-eligibility finding (Finding 1) does not merely repeat the secondary-source
  claim — it verifies the claim against Rule 15.1's own text (TANF/SSI membership test, no
  income-percentage track) and Rule 15.2 (which tests are waived) before presenting it as
  confirmed, the same standard this pack applies to findings it corrects.
- The ABAWD waiver-gate finding (Finding 2) does not overclaim that Mississippi's disaster-only
  framing is NEW or caused by OBBBA — it states plainly that this pack could not determine when
  this statutory gate took its current form, and flags the open question in `freshness.json`
  rather than asserting a causal story it cannot support.
- The drug-felony finding (Finding 3) does not claim to have read Miss. Code Ann. §43-12-71's raw
  text — it states explicitly that law.justia.com blocked that fetch, and that this pack instead
  relies on MDHS's own manual quoting and dating the statute's effect, a materially different (but
  still primary-source, state-agency) evidentiary basis, disclosed as such.
- The resource-limit finding (Finding 4) does not claim MDHS's $3,000/$4,500 figures come from
  Mississippi's own manual text — it states plainly that MDHS's manual defers to USDA's national
  standard without republishing a figure, and that this pack's $3,000/$4,500 numbers are drawn from
  cross-referencing this roster's other independently-verified packs, not from Mississippi-specific
  text.
- The SUA gap (Finding 7) does not paper over the missing dollar figure with an estimate or another
  state's number — it states plainly that Mississippi's specific SUA amount was NOT recovered
  through any route attempted, and the corresponding supplement and freshness entry say so as
  directly as the pack's other findings state their confirmed facts.
- The ESAP age-65 finding (Finding 6) was checked against Rule 28.2's own eligibility list
  specifically (not just the Chapter 28 heading) to confirm "65 or over" is the actual gating test,
  not a summary paraphrase this pack assumed.

## Sources

| Source | Access | Dated |
|---|---|---|
| MDHS SNAP Policy Manual (Title 18, Part 14), revised May 1, 2026 | direct curl fetch (browser UA), clean HTTP 200, converted with `pdftotext -layout` | fetched 2026-08-12; manual revised through May 1, 2026 |
| MDHS SNAP landing, Applying for SNAP, EBT Card consumer pages | direct curl fetch and WebFetch, clean HTTP 200 | fetched 2026-08-12 |
| USDA FNA, SNAP Restaurant Meals Program state list | direct curl fetch, clean HTTP 200 | Mississippi absent, page metadata dated August 7, 2026 |
| Mississippi Code Ann. §43-12-71 (drug-felony opt-out) | quoted/dated inside MDHS's own manual (Rule 22.14); raw statute text blocked by law.justia.com's Cloudflare challenge (HTTP 403); WebSearch-corroborated | opt-out effective July 1, 2019 (formerly HB 1352) |
| Mississippi Code Ann. §43-12-19 (ABAWD waiver authority) | cited inside MDHS's own manual (Rule 13.12); raw statute text not independently fetched | current as of manual's May 2026 revision |
| USDA FNA, SNAP Simplified Process FY2026 SUA values PDF | direct curl fetch returned a live Akamai bot-detection block (HTTP 403); Mississippi-specific figure NOT recovered | disclosed gap, see `freshness.json` |
| FFY2026 national standard-deduction / resource-limit / excess-shelter-cap figures | WebSearch cross-checked against this roster's other independently-verified FFY2026 packs (Connecticut, Arkansas); NOT Mississippi-specific text | effective October 1, 2025 |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (MS guide questions), `eval/answer-eval.ts` (MS_GOLD, spread
into ALL_GOLD). Mississippi is deliberately NOT added to any `engine-citations.ts` per-state
constant map — Mississippi has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("MS", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Mississippi policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, and Connecticut's corpus packs in
this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Mississippi `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.

**Batch-tier merge conflict:** Mississippi was built in parallel with Kansas, New Mexico, and
Nebraska (this roster's batch tier). All four states registered in the same four shared files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`). See the
top-level commit history for how any resulting merge conflict was resolved — the rule followed was
to always COMBINE every state's additions (StateCode union members, REGISTRY entries, QUESTIONS
entries, and `_GOLD` arrays spread into the aggregate export), never to drop another state's entry
to resolve a conflict, rebasing as many times as needed to pick up other batch members' merges
before the final push.
