# Alaska pack — provenance

**Created:** 2026-08-12. Alaska is a genuine BLANK SLATE in this roster — like this roster's
Delaware, Nebraska, Connecticut, and other prior blank-slate builds, Alaska has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking against
an existing engine constant was possible or attempted; this pack's findings stand entirely on its
own primary-source research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content
layer — and does not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`,
both of which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Alaska was built as one of a six-agent parallel batch (AK, VT, WY, DC, Guam, USVI), each on its own
branch, in the same window — the FINAL batch closing out the standard 50-state-plus-territories
roster.

## Method

Alaska DOH's current site, `health.alaska.gov`, returned clean HTTP 200 to every direct curl attempt
this pack made with a standard browser User-Agent — no WAF/bot-detection barrier of the kind this
roster's New Hampshire, Maine, and Hawaii packs encountered for at least one of their citations. This
pack fetched the SNAP consumer page, the dedicated "H.R. 1 - AK Impacts" FAQ page, and three DOH PDFs
(the "Alaska SNAP Standards" income/deduction table, the BBCE FAQ, and the SNAP Subsistence guide),
converting PDFs with `pdftotext -layout`. USDA FNS's FY2026 Maximum Allotments and Deductions PDF was
fetched cleanly and cross-checked directly against Alaska's own SNAP Standards PDF — every
overlapping figure matched exactly. AS 47.27.015's exact statutory text could not be fetched directly
(`law.justia.com` and `codes.findlaw.com` both returned HTTP 403 to every direct attempt); this pack
cross-corroborated the text across three independent secondary sources instead. `dpaweb.hss.state.ak.us`,
Alaska's older RoboHelp-generated policy manual, returned a clean HTTP 200 with no error signal at
all — this pack deliberately tested it for staleness (per this task's specific warning about
legacy-manual mirrors) and found its own broadcast/addendum index shows no update newer than December
2021, so it was used only for one narrow, cross-corroborated structural feature (the PFD Hold Harmless
mechanism) and not for any dollar figure.

## Finding 0 (structural, directly confirming — not correcting — this task's own framing) — Alaska's
SNAP program runs on THREE genuinely separate geographic/regional axes, not one shared zone table

This pack confirmed, rather than had to correct, the task brief's own caution not to assume a single
shared zone structure:

1. **Income eligibility** (130%/100%/165%/200%-BBCE FPL tests) is STATEWIDE and uniform — it does not
   vary by zone or region at all.
2. **Maximum/minimum SNAP allotment** dollar amounts vary by THREE geographic zones: Urban, Rural I,
   Rural II — confirmed directly from Alaska DOH's own current SNAP Standards PDF and cross-checked
   exactly against USDA's national FY2026 table.
3. **Standard Utility Allowance** (both heating and non-heating) varies by a COMPLETELY SEPARATE
   six-region system — Central, Northern, Northwest, South Central, Southeastern, Southwestern — named
   by borough/census-area groupings that do NOT map 1:1 onto the Urban/Rural I/Rural II allotment
   zones.

A household's allotment zone and utility region are determined independently. This pack flags this
explicitly since several secondary/aggregator sources this pack found collapse all three axes into a
single "zones" concept.

## Finding 1 (flagship, recent and dateable state policy change) — Alaska adopted BBCE only as of
July 1, 2025; earlier secondary sources or cached pages describing only a two-column 130%/100% FPL
test predate this change

DOH's own BBCE FAQ (dated 06/26/25) confirms BBCE applies only to SNAP households that apply or
recertify on or after July 1, 2025, raising the gross-income gate to 200% FPL for most households and
removing the separate resource test for them. This is a genuinely recent Alaska policy change, not a
longstanding feature — this pack flags that any source (including a stale cache of Alaska DOH's own
site) describing only the older two-column income structure is working from pre-July-2025 information.

## Finding 2 (flagship, primary-source confirmation of a minority-position, modified-ban structure) —
Alaska's drug-felony SNAP ban is MODIFIED (a rehabilitation-pathway carve-out under AS 47.27.015), not
the unmodified federal default — DPA's own BBCE FAQ language, read alone, could be misread otherwise

DPA's BBCE FAQ lists a household member "Convicted after 08/22/96 of a federal or state felony for
possession, use or distribution of illegal drugs" as one of several BBCE-exclusion categories — read
in isolation, this could suggest Alaska applies the unmodified federal lifetime ban. This pack instead
fetched (via cross-corroborated secondary sources after a direct 403) the underlying statute, AS
47.27.015, and confirmed a genuine rehabilitation-pathway carve-out: disqualification does not apply
if the person demonstrates satisfactory probation/parole completion, drug/alcohol treatment
participation, other rehabilitation action, or reentry-plan compliance. Being excluded from BBCE for
this reason means falling back to the standard (non-BBCE) eligibility track plus this statutory
condition — not permanent exclusion. Structurally similar to this roster's Hawaii, Nebraska, and
Kentucky modified-ban findings.

## Finding 3 — internal inconsistency caught WITHIN Alaska's own live, currently-served site (not an
archived-vs-current comparison) — the ABAWD age range

Two Alaska DOH pages fetched the SAME DAY (2026-08-12) directly conflict: the general SNAP consumer
page states the pre-OBBBA ABAWD age range (18-54), while DOH's own dedicated "H.R. 1 - AK Impacts" FAQ
page states the current, correct post-11/1/2025 OBBBA range (18-64) explicitly. This pack treats the
H.R. 1 FAQ page as authoritative, since it directly and explicitly addresses the OBBBA transition the
general page has evidently not yet been updated to reflect. Unlike this roster's Delaware pack (where
the stale text was in an unamended regulatory manual, distinct from the live consumer page), this
inconsistency exists between two currently-live, currently-served Alaska DOH pages.

## Finding 4 — Alaska currently has an ACTIVE, unusually broad ABAWD waiver (near-statewide, all
areas except the Municipality of Anchorage), a genuine contrast with this roster's Hawaii pack

FNS approved Alaska's "Good Faith Exemption" waiver, effective November 1, 2025 through October 31,
2026, exempting every Alaska census area and borough from the ABAWD time-limit criteria EXCEPT the
Municipality of Anchorage — confirmed directly from DOH's own H.R. 1 FAQ page. This waiver also
restores, specifically within Alaska, protection for several categories OBBBA removed from the
national default exemption list (ages 56-64, veterans, homelessness, former foster youth 18-24,
households with children 14-17). Alaska and Hawaii are the only two states with OBBBA authority to
request waivers at a lower 1.5x-national-unemployment threshold; this roster's Hawaii pack separately
confirmed Hawaii itself has NO active waiver, making Alaska's active, near-statewide waiver a genuine,
worth-flagging contrast between the two noncontiguous states.

## Finding 5 (tooling/legacy-mirror trap caught, per this task's specific warning) —
`dpaweb.hss.state.ak.us` is a stale legacy manual mirror with NO HTTP error signal

This pack deliberately tested `dpaweb.hss.state.ak.us`, Alaska's older RoboHelp-generated SNAP policy
manual, for staleness before relying on it for anything. It returns a clean HTTP 200 with no
WAF/bot-detection/error signal of any kind — the exact trap this task's brief warned about. This pack
caught it only by checking the manual's OWN internal broadcast/addendum index, which shows no entry
newer than December 2021 — predating BBCE (7/2025), OBBBA (11/2025), and at least four annual COLA
cycles. This pack used the manual for exactly ONE narrow, structural, non-dollar-figure feature (the
PFD Hold Harmless mechanism, cross-corroborated against DOH's live consumer page's own PFD
cross-reference) and explicitly disclosed the lower confidence this implies (see freshness.json).

## Finding 6 — Alaska's confirmed resource limit and several deduction figures already match the
current federal FY2026 COLA floor; NO internal staleness found in these specific figures (unlike this
roster's Delaware pack)

Cross-checked directly between Alaska DOH's own live consumer page, its SNAP Standards PDF, and USDA's
national FY2026 table (all three matching exactly): the $3,000/$4,500 resource limit, the
$358/$374 standard deduction, the $1,189 excess shelter cap, and the $198.99 homeless shelter
deduction are all current and internally consistent — a genuinely different outcome than this roster's
Delaware pack found for its own resource-limit and homeless-shelter-deduction figures.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Alaska text, checking specifically
for: claims inferred from a secondary-source summary rather than the underlying primary text; whether
a "recent policy change" claim (BBCE, ABAWD age/waiver) was dated precisely rather than stated as a
settled fact; and whether any Alaska-vs-common-assumption contrast was overclaimed as settled when the
underlying evidence was genuinely single-sourced or internally inconsistent. Concrete catches from this
pass:

- The three-axis zone/region finding (Finding 0) does not simply repeat the flat "Alaska has three
  zones" framing several secondary sources use — it reads Alaska's own SNAP Standards PDF precisely
  and states explicitly that income eligibility, allotments, and utility allowances use THREE
  DIFFERENT regional structures, not one shared table.
- The BBCE finding (Finding 1) is dated precisely (7/1/2025 for applications/recertifications) rather
  than stated as a flat "Alaska has BBCE" claim, specifically so a reader can judge whether an older
  cached source predates the change.
- The drug-felony finding (Finding 2) is grounded in the statute's own conditional language (four
  specific rehabilitation pathways), not merely restated from DPA's own FAQ's flatter
  BBCE-exclusion-category framing, which alone could mislead a reader into assuming an absolute ban.
- The ABAWD age finding (Finding 3) is presented as an INTERNAL inconsistency between two live pages
  fetched the same day, not as an archived-vs-current staleness catch — a genuinely different, and in
  some ways more concerning, failure mode than this roster's other packs have found, since neither
  page carries any visible "last updated" signal a reader could use to judge which is current.
  This pack resolved it by content (the H.R. 1 FAQ page directly and explicitly addresses the OBBBA
  transition) rather than by any timestamp, since none was available.
- The PFD Hold Harmless mechanism (permanent-fund-dividend supplement) is explicitly flagged as
  resting on the disclosed-stale legacy manual for its mechanism-level detail, even though the
  live consumer page corroborates the mechanism's continued existence — this pack did not let the
  live page's brief, generic cross-reference stand in for genuine primary-source confirmation of the
  mechanism's current specifics.
- The Restaurant Meals Program and Subsistence-program findings are both flagged as resting on
  secondary corroboration / an unrenewed 2023 PDF respectively, rather than stated with the same
  confidence as this pack's more cross-checked, multiply-corroborated findings (income limits,
  deductions, allotments, utility allowances — all confirmed against two independent primary sources
  that matched exactly).

## Sources

| Source | Access | Dated |
|---|---|---|
| Alaska DOH, SNAP consumer page | direct fetch, clean HTTP 200 | fetched 2026-08-12; flagged internally stale on ABAWD age |
| Alaska DOH, H.R. 1 - AK Impacts FAQ page | direct fetch, clean HTTP 200 | fetched 2026-08-12; current, addresses OBBBA directly |
| Alaska DOH, "Alaska SNAP Standards" PDF (FSP 77) | direct fetch, clean HTTP 200 | rev 09/25, effective 10/1/2025-9/30/2026 |
| Alaska DOH, BBCE FAQ PDF | direct fetch, clean HTTP 200 | dated 06/26/25 |
| Alaska DOH, SNAP Subsistence Benefits guide PDF | direct fetch, clean HTTP 200 | PDF creation date 2023, not re-verified for FY2026 |
| USDA FNS, SNAP FY2026 Maximum Allotments and Deductions PDF | direct curl fetch, clean HTTP 200 | effective 10/1/2025-9/30/2026; cross-checked, matches AK's own PDF exactly |
| USDA FNS, ABAWD Time Limit Waivers FY2025-2029 index | direct curl fetch, clean HTTP 200 | fetched 2026-08-12; confirms AK FY2026 waiver zip exists |
| AS 47.27.015 (Disqualifying conditions) | WebSearch cross-corroboration (FindLaw/Justia/CLASP) after direct 403 on law.justia.com and codes.findlaw.com | secondary-corroborated only, not primary-fetched |
| 7 AAC 46.021 (State options), via Cornell LII mirror | direct fetch, clean HTTP 200 | effective 12/26/1986, amended 4/10/1991 |
| dpaweb.hss.state.ak.us legacy manual §605-7 (PFD processing) | direct fetch, clean HTTP 200 (DISCLOSED STALE — last update Dec 2021) | used only for one narrow structural feature |
| WebSearch corroboration only (Restaurant Meals Program absence) | WebSearch, not independently fetched | see freshness.json for disclosed gap |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (AK guide questions), `eval/answer-eval.ts` (AK_GOLD, spread into
ALL_GOLD). Alaska is deliberately NOT added to any `engine-citations.ts` per-state constant map —
Alaska has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("AK",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build adds
an Alaska policy — this matches the precedent already set by every prior blank-slate corpus pack in
this roster, including Delaware's most recent build.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Alaska `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Six-agent parallel batch, final batch of the standard roster:** Alaska was built in parallel with
Vermont (VT), Wyoming (WY), District of Columbia (DC), Guam, and the U.S. Virgin Islands (USVI) — six
separate agents in the same window, each on its own branch (`feat/demeter-ak-corpus` for this one).
All six states/territories register in the same four shared files (`states/index.ts`, `packs.ts`,
`apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and therefore all six PRs are expected to
conflict with each other on merge. The rule to follow when resolving that conflict is to always
COMBINE every state's additions (StateCode union members, REGISTRY entries, QUESTIONS entries, and
`_GOLD` arrays spread into the aggregate export), never to drop another state's entry to resolve a
conflict — matching the precedent this roster's prior same-window batch tiers already set.
