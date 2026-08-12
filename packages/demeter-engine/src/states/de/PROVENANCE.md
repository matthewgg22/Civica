# Delaware pack — provenance

**Created:** 2026-08-12. Delaware is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, New Mexico's, and New
Hampshire's prior builds, Delaware has NO existing `packages/snap-rules` entry and NO oracle
fixture coverage at all. No discrepancy-checking against an existing engine constant was possible
or attempted; this pack's findings stand entirely on its own primary-source research. This task's
scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully
parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Delaware was built as one of a five-agent parallel batch (RI, MT, DE, SD, ND), each on its own
branch, in the same window.

## Method

Unlike this roster's New Hampshire and Maine packs, `dhss.delaware.gov` and
`regulations.delaware.gov` returned clean HTTP 200 to every direct curl attempt this pack made with
a standard browser User-Agent — no WAF/bot-detection barrier. The one genuine access wrinkle was
`regulations.delaware.gov`'s human-facing `/AdminCode/titleNN/NNNN` pages being a client-side
JavaScript SPA with no server-rendered content; this pack located and used the underlying
`/api/AdminCode/titleNN/NNNN/<uuid>` PDF endpoints instead (found via WebSearch results pointing to
a specific document UUID). This pack used `pdftotext -layout` on the resulting 114-page DSSM 9000
manual and the archived DSSM 2000 manual. `usda.gov` (a separate host from `fns.usda.gov`, serving
the FY26 SUA methodology memo) returned a clean HTTP 403; resolved via the `r.jina.ai` reader proxy.

## Finding 0 — Delaware's own regulatory text (DSSM) is genuinely behind currently-operative
policy in at least three separately-confirmed places, none of which required an external access
workaround to discover

This is the pack's structural flagship finding, and unlike New Hampshire's and Maine's
Wayback-staleness catches, it was found entirely within Delaware's OWN currently-served regulatory
text, not an archived snapshot:

1. **Resource limits (DSSM 9045):** states $2,000 general / $3,000 elderly-disabled, traced to at
   least a 2009-era baseline with no visible newer amendment, while the current federal FY2026
   COLA-adjusted floor is $3,000/$4,500. This pack could not confirm which figure is actually
   operative in practice and declines to guess — flagged explicitly rather than resolved.
2. **ABAWD age exemptions (DSSM 9018.2/9018.3):** last amended 2013, states the pre-OBBBA
   thresholds (under 18, age 50+). Delaware's own LIVE SNAP Alert consumer page confirms the
   current, correct post-11/1/2025 OBBBA thresholds (under 18, age 65+, child-under-14 not
   child-under-18, new Indian/Urban Indian/California Indian exemption). This pack used the live
   SNAP Alert page as authoritative for currently-operative ABAWD exemption criteria.
3. **Drug-felony cross-reference (DSSM 9013.2):** still lists "ineligible because of a drug-related
   felony conviction per DSSM 2027" as a household-exclusion category, even though DSSM 2027 was
   fully repealed in 2018 (see Finding 1) and SNAP's own categorical-eligibility exclusion list
   (DSSM 9042.2) has no drug-felony category at all.

This pack's approach throughout: treat DHSS's live, actively-maintained consumer pages and the
Delaware Register of Regulations' own dated final orders as authoritative over the DSSM's own
stale, unamended cross-references and dollar figures, and flag every specific instance rather than
silently picking a number or pretending the manual is internally consistent.

## Finding 1 (flagship, primary-source correction reached by chasing a specific repealed citation)
— Delaware FULLY repealed its drug-felony SNAP/Cash Assistance restriction in 2018; several
secondary sources describing a "modified" ban are working from pre-2018 information

Several secondary sources this pack found describe Delaware as having a "modified" drug-felony ban
conditioned on sentence compliance — language traceable to DSSM 2027's own pre-2018 text. This pack
fetched Delaware's current DSSM 2000-series manual directly and found DSSM 2027 marked plainly
`[Repealed - See 21 DE Reg. 722 (03/01/18)]`, then fetched 21 DE Reg. 722's own Final Order text
directly: it confirms Delaware struck the drug-felony restriction from Cash Assistance/General
Assistance entirely, effective March 11, 2018, implementing House Bill No. 11 (2017) and 31 Del. C.
§524. DSSM 9042.2 (SNAP's own categorical-eligibility exclusion list) independently confirms no
drug-felony exclusion category exists in the SNAP-specific rules either. This pack's reading:
Delaware has FULLY opted out of the federal drug-felony SNAP ban, not merely modified it — a
correction of what this pack judges to be stale secondary-source information, reached specifically
by fetching the cited regulation's own current text rather than accepting a paraphrase.

## Finding 2 (flagship, structural) — Delaware's SNAP categorical-eligibility gate is 200% FPL
gross income, triggered by a TANF-funded pregnancy-prevention-information service embedded in the
application itself; households that clear it face no resource test, but a non-categorical household
still faces DSSM 9045's real (and possibly stale) resource limit

DSSM 9042 defines categorical eligibility precisely: any household with gross income at or below
200% FPL is categorically eligible because Delaware uses TANF funds to provide non-cash
pregnancy-prevention information, with an authorization line for this information embedded directly
in the Delaware SNAP application form. DSSM 9045 confirms categorically eligible households "do not
have to meet the resource limits or definitions" at all. This pack reads Delaware's structure
precisely rather than compressing it into a flat "no asset test" claim several secondary sources
use: a household excluded from categorical eligibility under DSSM 9042.2/9042.3 (ineligible alien,
student-provision ineligibility, fleeing-felon/probation-violator status, non-exempt
institutionalization, work-requirement noncompliance) still faces DSSM 9045's resource limit — see
Finding 0 for why that specific figure is itself flagged as possibly stale.

## Finding 3 — Delaware currently has NO active area-wide ABAWD waiver; the prior
Wilmington/Kent/Sussex waiver expired 9/30/2025, and a separate one-month, shutdown-driven national
pause covered November 2025 only

USDA FNS's own ABAWD Time Limit Waivers FY2025-2029 index lists Delaware's most recent posted
waiver-response entry as the FY2025 waiver, approved 09/19/2024 for Wilmington city plus the
combined Kent/Sussex County area (5.8% and 4.3% average unemployment respectively over the 24-month
period ending January 2024), effective October 1, 2024 through September 30, 2025 — with no FY2026
entry as of this pack's fetch. Separately, this pack found and cross-checked a genuinely
time-sensitive detail: Delaware's own SNAP Alert page states USDA-FNS waived the ABAWD work
requirement nationwide for November 2025 specifically due to the federal government shutdown — an
already-lapsed, one-month event distinct from the area-specific waiver track.

## Finding 4 — Delaware's own DSSM does not hardcode Standard Deduction or utility-allowance dollar
figures; this pack could not locate Delaware's own FFY2026 COLA notice and discloses this gap rather
than fabricating a number

DSSM 9060 explicitly defers the Standard Deduction and all four utility-allowance tiers
(HCSUA/LUA/one-utility/telephone) to "the current October Cost-of-Living Adjustment Administrative
Notice" — a separate document this pack could not locate at a working URL (a 2022-vintage URL
pattern now 404s). USDA FNS's own FY2026 SUA guidance memo (fetched via reader proxy after a direct
403) confirms these figures are calculated per-state via a 2.7% CPI-U self-adjustment from each
state's FY2025 baseline, not published in one uniform national table — meaning Delaware's specific
current dollar figures are genuinely state-specific and this pack did not locate them. DSSM 9060's
own hardcoded figures ($143.00 Homeless Shelter Deduction, $35.00 Excess Medical Deduction
threshold) are flagged separately as possibly stale (see Finding 0's pattern; the Homeless Shelter
Deduction subsection's amendment footer shows no revision newer than 09/01/14, while USDA's current
national FY2026 maximum is $198.99).

## Finding 5 — Delaware's standard certification period is 12 months, matching the national norm,
with 24 months for all-elderly/disabled no-earned-income households

DSSM 9068 caps certification periods at 12 months for most households (DSSM 9068.1, interim report
in month 6) and assigns 24 months to all-elderly/disabled no-earned-income households (DSSM 9068.2,
interim report in month 12) — consistent with the 12-month norm most of this roster's other states
use, in contrast to this roster's New Hampshire pack's genuinely shorter 6-month standard period.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

Delaware has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Delaware (out of scope for this task, requiring
its own separate, explicit go-ahead per the standing park rule) should treat this pack's citations
as a starting point, not a final answer, and should specifically re-verify DSSM 9045's resource
limit against Delaware's actual current operative practice (Finding 0) and locate Delaware's own
current COLA notice for exact utility-allowance dollar figures (Finding 4) before hardcoding
Delaware's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Delaware text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying primary
text; DSSM amendment-footer dates checked against known federal effective-date changes (OBBBA
11/1/2025, the 2018 drug-felony repeal); and any Delaware-vs-common-assumption contrast overclaimed
as settled when the underlying evidence was genuinely single-sourced or internally inconsistent.
Concrete catches from this pass:

- The categorical-eligibility structure (Finding 2) does not simply repeat the flat "200% BBCE, no
  asset test" framing several secondary sources use — it reads DSSM 9042's own eligibility
  conditions and DSSM 9045's own resource-limit table side by side, and states explicitly that a
  NON-categorical household still faces a real resource limit, rather than letting the
  majority-case simplification stand in for the full rule.
- The drug-felony finding (Finding 1) is grounded in the repeal order's (21 DE Reg. 722) own 2018
  text, not merely repeated from a secondary source's "modified ban" framing — this pack chased the
  specific DSSM 2027 citation those secondary sources rely on and found it repealed, which is a more
  consequential correction than simply restating a secondary source with more confidence.
- The three internal-DSSM-staleness catches (Finding 0) were not obvious from any single fetch —
  they required directly comparing DSSM 9045/9018/9013's own amendment-footer dates against (a) the
  known federal FY2026 COLA resource-limit figure, (b) DHSS's own live SNAP Alert page's OBBBA
  summary, and (c) the repeal order's own effective date, respectively. An early draft pass that
  simply summarized DSSM 9018.2's ABAWD exemption list without cross-checking it against the live
  SNAP Alert page would have published the pre-OBBBA age thresholds as current — this pack caught
  that specifically rather than letting the older, more "official-sounding" regulatory text win by
  default.
- The Homeless Shelter Deduction figure ($143.00) and Delaware's FY2026 utility-allowance dollar
  figures are both flagged explicitly as possibly-stale / not-located rather than stated with the
  same confidence as this pack's more cross-checked findings, since this pack's DSSM 9060 fetch
  carries an amendment footer no newer than 2014 for the former, and the state's own COLA notice
  could not be located at all for the latter.
- The Restaurant Meals Program finding does not merely cite absence-of-mention — it cross-checks
  DHSS's own consumer page's explicit purchase-restriction list (which lists "Hot or prepared foods"
  under items you cannot buy) against secondary-source corroboration that no DE RMP exists, rather
  than relying on either source alone.

## Sources

| Source | Access | Dated |
|---|---|---|
| Delaware DHSS, SNAP consumer page | direct fetch, clean HTTP 200 | fetched 2026-08-12; income table published 10/1/2025-9/30/2026 |
| Delaware DHSS, SNAP Alert page | direct fetch, clean HTTP 200 | fetched 2026-08-12; live/current post-OBBBA content |
| Delaware Administrative Code, Title 16, DSSM 9000 (Food Stamp Program), full 114-page manual | direct fetch, regulations.delaware.gov API PDF endpoint | fetched 2026-08-12; internal section amendment dates vary, oldest 2005, newest 2014 |
| Delaware Administrative Code, Title 16, DSSM 2000 (Case Processing Procedures) | direct fetch, archived PDF | fetched 2026-08-12 |
| Delaware Register of Regulations, 21 DE Reg. 722 (03/01/18), Final Order | direct fetch, archived PDF | effective 3/11/2018 |
| USDA FNS, SNAP ABAWD Time Limit Waivers FY2025-2029 index | direct curl fetch (browser UA, extended timeout), clean HTTP 200 | fetched 2026-08-12 |
| USDA FNS, Delaware FY2025 ABAWD Waiver Response letter | direct fetch, clean HTTP 200 | approved 09/19/2024, effective 10/1/2024-9/30/2025 |
| USDA FNS/USDA.gov, SNAP FY2026 Simplified Process for SUA Values memo | fetched via r.jina.ai reader proxy after direct HTTP 403 | dated 08/15/2025, fetched 2026-08-12 |
| WebSearch corroboration only (Restaurant Meals Program absence; general BBCE framing this pack found imprecise) | WebSearch, not independently fetched | see freshness.json for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (DE guide questions), `eval/answer-eval.ts` (DE_GOLD, spread into
ALL_GOLD). Delaware is deliberately NOT added to any `engine-citations.ts` per-state constant map —
Delaware has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("DE",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build
adds a Delaware policy — this matches the precedent already set by every prior blank-slate corpus
pack in this roster, including New Hampshire's and Maine's most recent builds.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Delaware `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Five-agent parallel batch:** Delaware was built in parallel with Rhode Island (RI), Montana (MT),
South Dakota (SD), and North Dakota (ND) — five separate agents in the same window, each on its own
branch (`feat/demeter-de-corpus` for this one). All five states register in the same four shared
files (`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and
therefore all five PRs are expected to conflict with each other on merge. The rule to follow when
resolving that conflict is to always COMBINE every state's additions (StateCode union members,
REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never to
drop another state's entry to resolve a conflict — matching the precedent this roster's prior
same-window batch tiers already set.
