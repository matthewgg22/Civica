# Connecticut pack — provenance

**Created:** 2026-08-12. Connecticut is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, and Kentucky's prior builds, Connecticut
has NO existing `packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted; this pack's
findings stand entirely on its own primary-source research. This task's scope was CORPUS ONLY —
the Demeter chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the standing
rule (`feedback_dashboard_snap_rules_parked`).

Connecticut is also the FIRST state in this roster's new BATCH TIER — smaller-population states
now built 3-5 at a time in parallel, rather than the prior one-at-a-time individual tier. Utah,
Iowa, and Arkansas were built concurrently by separate agents in the same window; see the
Registration section below for how the resulting merge conflict on shared files was resolved.

## Method

Direct `curl` fetch (browser User-Agent) of Connecticut DSS's Uniform Policy Manual (UPM)
Word-document sections at `portal.ct.gov/dss/-/media/departments-and-agencies/dss/upms/`,
converted with macOS `textutil -convert txt`, covering UPM2 (Categorical Eligibility
Requirements), UPM4 (Treatment of Assets), and UPM5 (Treatment of Income), including
`P-5520.35` (the SNAP-specific income-eligibility-test procedure). Also directly fetched
Connecticut's SNAP Work Rules Pre-screener and ABAWD Work Rules pages, and the full text of
Connecticut General Statutes § 17b-112d from `cga.ct.gov`. Connecticut's separately-maintained
"Tables" page (`portaldir.ct.gov/dss/snap/Tables.html`), which carries the manual's actual
current dollar figures, returned an active bot-detection challenge to every direct curl attempt —
recovered via an Internet Archive Wayback Machine snapshot dated 2026-03-07 (after the cited
10/1/2025 effective date, so current). The same route recovered Connecticut's Categorical
Eligibility / RCE / ECE explainer pages (Wayback snapshots dated 2025-06-14). WebSearch
cross-checks corroborated the certification-period and Restaurant Meals Program legislative
status, both disclosed as lower-confidence findings below.

## Finding 0 — a genuine, disclosed access barrier: portaldir.ct.gov's live bot-detection block,
resolved via the Internet Archive rather than fabrication

Unlike this roster's now-familiar Justia-403 pattern for state statutes, Connecticut's own
statute database (`cga.ct.gov`) and main DSS site (`portal.ct.gov`) returned clean HTTP 200 to
every direct curl attempt, including a direct, successful read of CGS § 17b-112d's own text. The
genuine access barrier this pack found was different: `portaldir.ct.gov`, a separate legacy CT
DSS subdomain hosting the SNAP policy manual's numbered-index view AND (more consequentially) a
separately-maintained "Tables" page carrying the manual's actual current dollar figures, returned
an active Radware/TSPD bot-detection challenge page to every direct curl attempt regardless of
User-Agent — a genuine bot-detection wall, not a tooling artifact easily bypassed with a header
change. This pack resolved it via the Internet Archive Wayback Machine, which held a clean
snapshot dated 2026-03-07 (postdating the cited 10/1/2025 effective date, so current for this
pack's fetch date). This pack discloses the access route explicitly in every citation drawn from
that source and flags a re-verification window in `freshness.json` given the underlying live host
remains blocked.

## Finding 1 (flagship, structural) — Connecticut's Uniform Policy Manual is a single,
MULTI-PROGRAM manual organized by TOPIC, not a dedicated SNAP volume

Unlike Kentucky's single-program Volume 2, Louisiana's B-1040-SNAP chapter, or most of this
roster's dedicated SNAP manuals, Connecticut's Uniform Policy Manual (UPM) spans eight topical
chapters (UPM1 Rights/Eligibility Process through UPM9 Special Benefits) shared across FOUR
public-assistance programs at once — AFDC/TFA (cash assistance), AABD (aid to aged/blind/
disabled), MA (Medicaid), and FS (Food Stamps, the manual's own legacy internal program code for
SNAP, still visible in program tags on sections dating to the 1980s). Every numbered section
carries a "Program:" tag showing which of the four programs it governs — this pack fetched
several sections (e.g. `4005.15`, `2505`, `2510`) whose content turned out to be AFDC-only, not
SNAP-applicable, and had to be excluded on that basis. Reading a Connecticut SNAP citation
correctly requires checking the Program tag, not just the section number.

## Finding 2 — a stale worked-example inside the manual's own current SNAP procedure section,
distinguished from the manual's separately-maintained (and current) dollar-figure Tables page

`P-5520.35` ("Determining Eligibility for the Supplemental Nutrition Assistance Program"), the
manual's own numbered procedure describing how to run SNAP's gross/net income tests, is dated
10-1-11 (Transmittal UP-11-09) and its own worked-example dollar table (e.g. "$1,180" for a
household of 1 at 130% of the SNAP Applied Income Limit) is FFY2011-era — over a decade stale
relative to the current FFY2026 cycle. This pack does NOT cite those numbers. Connecticut's
current, correct dollar figures live on a SEPARATE, dedicated "Tables" resource (see Finding 0)
that DSS updates each federal COLA cycle independently of the numbered procedure sections — a
distinct pattern from this roster's other states, where the numbered policy section itself
typically carries the current figure. This pack treats the Tables page as authoritative for
dollar amounts and the numbered procedure sections as authoritative for structure/sequence only.

## Finding 3 (flagship, structural) — Connecticut's ECE is a flat 200% FPL gross ceiling for
every household, but does NOT waive the net income test — a genuine third variant distinct from
Kentucky's dual-track ECE

Connecticut recognizes RCE (Regular Categorical Eligibility — AABD/SAGA/SSI/TFA recipients,
waives asset limit, 130% gross test, AND net income limit entirely) and ECE (Expanded Categorical
Eligibility — gross income under 200% FPL via automatic TANF-funded referral, the same
brochure-notification mechanism Kentucky's ECE uses). Connecticut's ECE raises the gross ceiling
to a FLAT 200% FPL for every ECE household regardless of elderly/disabled composition — unlike
Kentucky's dual-track (130% for non-elderly/disabled, 200% only for all-elderly/disabled). But
Connecticut's own RCE/ECE explainer pages list only the asset limit and the 130% gross test as
excluded for ECE — the net (100% FPL) income limit is conspicuously absent from that exclusion
list, and IS explicitly listed as excluded for RCE. This pack reads this precisely: an
ECE-eligible Connecticut household can still fail on net income even though its gross income and
assets are never tested — a materially different, and more conditional, shape than a household
this pack might otherwise assume gets a full BBCE pass. This pack found and rejected a repeated
secondary-source claim that Connecticut's BBCE ceiling is "185% FPL" — DSS's own current Tables
page shows 200% FPL as the ECE column, and this pack treats 185% as likely confusion with the
genuinely distinct, adjacent 165% FPL column ("Elderly & Disabled Seeking Separate EDG Status").

## Finding 4 (flagship, time-sensitive) — Connecticut currently has NO ABAWD waiver anywhere in
the state, directly contradicting a "statewide ABAWD waiver" claim found in multiple secondary
sources

Connecticut's own SNAP Work Rules Pre-screener page (fetched directly, clean HTTP 200) states in
its own first line of visible content: "Starting December 1, 2025, all towns in Connecticut will
now follow special SNAP work rules for adults." This pack found several secondary sources and
AI-generated SNAP-calculator summaries confidently asserting the opposite — that Connecticut "has
a statewide ABAWD waiver" and that "work requirements are not being enforced anywhere in
Connecticut." This pack's reading is that those sources describe a PRIOR statewide waiver that
ended, consistent with the nationwide post-OBBBA (July 2025) ABAWD rollout timeline this roster
has documented in other 2025-2026-built packs — Connecticut's current page shows the December 1,
2025 transition to statewide work requirements, with no active waiver anywhere. DSS's own page
also discloses that this change had real consequences: a one-time $300 grocery card program,
distributed via Community Action Agencies starting August 4, 2026, specifically for people who
lost SNAP benefits because of these work-rule changes.

## Finding 5 — Connecticut's drug-felony SNAP policy is a MODIFIED opt-out with three independent
eligibility paths, not the simpler "full opt-out" or "treatment-completion-required" framings
found in different secondary sources

CGS § 17b-112d, read directly from `cga.ct.gov` (no access barrier), sets out three independent
paths to SNAP/TFA eligibility for a person convicted of a qualifying controlled-substance felony
on or after August 22, 1996: (1) the sentence has been completed; OR (2) the person is
satisfactorily serving probation; OR (3) the person is in the process of completing, or has
completed, a court-mandated substance-abuse treatment or testing program. This pack found two
different, each incomplete, secondary-source framings: one describing Connecticut as having
simply "opted out" (true but incomplete — it is a MODIFICATION, not Kentucky's unconditional
KRS 205.2005-style full opt-out), another describing Connecticut as requiring "drug treatment
program completion to regain eligibility" (also incomplete — treatment is only ONE of three
independent paths; sentence completion or probation compliance alone are equally sufficient).
This pack's reading, grounded directly in the statute's own text, is disclosed precisely in the
criminal-justice-disqualifications supplement rather than compressed to either oversimplified
framing.

## Finding 6 — Connecticut's flat SUA ($976) is more than double most of this roster's other
states' figures — disclosed, not silently normalized

Connecticut's Standard Utility Allowance is $976/month, flat regardless of household size,
sourced directly from DSS's own current Tables page (Wayback snapshot, effective 10/1/2025). This
is more than double Kentucky's $388 flat SUA and well above the roughly $400-500 range this
roster has generally documented. This pack found no internal inconsistency in the source and
plausibly attributes the figure to Connecticut's cold-climate heating-cost profile, but flags it
explicitly in `freshness.json` for independent cross-checking rather than silently treating it as
routine.

## Finding 7 — no Restaurant Meals Program currently, but 2025 state legislation (SB 1475)
directed DSS toward one — status unconfirmed

USDA FNA's current RMP state list (fetched directly, clean HTTP 200) does not include Connecticut.
This pack found 2025 Connecticut SB 1475, which as introduced would require DSS to develop an RMP
and apply to USDA by December 1, 2025, but could NOT confirm through direct primary-source
verification whether the bill was enacted or whether DSS met that deadline — the Connecticut
General Assembly's own bill-status system did not return a clear enacted/Public-Act status to this
pack's fetch attempts. This pack's operative answer treats USDA's own current list (Connecticut
absent, updated as recently as August 7, 2026 per its own metadata) as controlling for today, while
disclosing the pending-legislation gap explicitly in both the supplement and `freshness.json`.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Connecticut has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding. A future `packages/snap-rules` build for Connecticut (out of scope for
this task, requiring its own separate, explicit go-ahead per the standing park rule) should treat
this pack's citations as a starting point, not a final answer, and should specifically re-verify
the current ABAWD waiver status (Finding 4, the most volatile fact in this pack), the ECE
net-income-test nuance (Finding 3), and whether `portaldir.ct.gov`'s bot-detection block has
lifted enough to fetch the Tables page live (Finding 0/2) before hardcoding Connecticut's
parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Connecticut text, checking
specifically for: claims inferred from a section heading rather than its own body text; dollar
figures not traceable to a specific dated source; and any Connecticut-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- The stale-P-5520.35 finding (Finding 2) does not claim Connecticut's CURRENT figures are unknown
  or unavailable — it distinguishes precisely between the stale numbered-procedure worked example
  and the separately-maintained, genuinely current Tables page, and cites only the latter for
  dollar figures.
- The ECE net-income-test finding (Finding 3) was checked against BOTH the RCE and ECE explainer
  pages' own "Excluded Tests" lists side by side specifically because reading only the ECE page in
  isolation could miss that RCE's list explicitly includes "Net income limit" while ECE's list
  does not — the omission is the finding, and this pack confirms it is a real omission (RCE's list
  has three items, ECE's list has two) rather than an assumption.
- The drug-felony finding (Finding 5) does not compress CGS § 17b-112d's three independent
  eligibility paths into either of the two incomplete secondary-source framings this pack found —
  it quotes the statute's own disjunctive structure ("if such person has completed a sentence...
  shall ALSO be eligible... if satisfactorily serving... OR is in the process of completing...")
  precisely.
- The ABAWD-no-waiver finding (Finding 4) does not merely prefer Connecticut's own page over the
  secondary sources without disclosure — it states explicitly that the secondary sources appear to
  describe a PRIOR, now-ended waiver, giving a reader a plausible account of the discrepancy rather
  than presenting an unexplained contradiction.
- The SUA finding (Finding 6) does not claim the $976 figure is definitely correct forever — it is
  disclosed with an explicit re-verification note in `freshness.json`, flagging the outlier size
  rather than assuming government dollar tables are never mistyped.
- The Restaurant Meals Program finding (Finding 7) does not claim SB 1475 definitely failed to
  pass — it states plainly that this pack could not confirm enactment status either way, and
  defers to USDA's own current list as the operative answer for today.
- The 185%-vs-200% BBCE correction (Finding 3) is grounded in reading DSS's own Tables page column
  headers directly (200% FPL labeled "Expanded Categorical Eligibility (ECE)"), not merely in
  noting that a secondary source's number differed from this pack's own expectation.

## Sources

| Source | Access | Dated |
|---|---|---|
| CT DSS Uniform Policy Manual, UPM2 (Categorical Eligibility), UPM4 (Assets), UPM5 (Income Eligibility, incl. P-5520.35) | direct curl fetch (browser UA), converted with `textutil` | fetched 2026-08-12; P-5520.35 itself dated 10-1-11/UP-11-09 (stale worked example, structure only) |
| CT DSS SNAP Policy Manual Tables (current FFY2026 dollar figures) | Internet Archive Wayback Machine snapshot, after `portaldir.ct.gov` returned a live bot-detection block to direct curl | snapshot dated 2026-03-07, effective 10/01/2025 |
| CT DSS, Categorical Eligibility / RCE / ECE explainer pages | Internet Archive Wayback Machine snapshot, same access-barrier resolution | snapshot dated 2025-06-14 |
| CT DSS, SNAP Work Rules Pre-screener and ABAWD Work Rules pages | direct curl fetch (browser UA), clean HTTP 200 | fetched 2026-08-12; states Dec. 1, 2025 statewide work-rule effective date |
| Connecticut General Statutes § 17b-112d | direct curl fetch of cga.ct.gov, clean HTTP 200, full text read directly, no access barrier | effective July 1, 1997; amended 2009 |
| USDA FNA, SNAP Restaurant Meals Program state list | direct curl fetch, clean HTTP 200 | Connecticut absent, page metadata updated as recently as Aug. 7, 2026 |
| 2025 Connecticut SB 1475 (Restaurant Meals Program directive) | WebSearch corroboration only; enactment status NOT confirmed | introduced 2025; status unconfirmed as of this pack's fetch date |
| Certification-period / PRF / ESAP structure | WebSearch + DSS fair-hearing decision document corroboration only; NOT verified against a current UPM6 section | disclosed lower-confidence finding, see `freshness.json` |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (CT guide questions), `eval/answer-eval.ts` (CT_GOLD, spread
into ALL_GOLD). Connecticut is deliberately NOT added to any `engine-citations.ts` per-state
constant map — Connecticut has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("CT", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Connecticut policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, and Kentucky's corpus packs in this same
roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Connecticut `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.

**Batch-tier merge conflict:** Connecticut was built in parallel with Utah, Iowa, and Arkansas
(the first batch of this roster's new batch tier). All four states registered in the same four
shared files (`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`,
`eval/answer-eval.ts`). See the top-level commit history for how any resulting merge conflict was
resolved — the rule followed was to always COMBINE every state's additions (StateCode union
members, REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate
export), never to drop another state's entry to resolve a conflict.
