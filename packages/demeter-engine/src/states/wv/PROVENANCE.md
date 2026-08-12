# West Virginia pack — provenance

**Created:** 2026-08-12. West Virginia is a genuine BLANK SLATE in this roster — like Connecticut's,
Nebraska's, Utah's, Iowa's, and Arkansas's prior builds, West Virginia has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking against
an existing engine constant was possible or attempted; this pack's findings stand entirely on its
own primary-source research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content
layer — and does not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`,
both of which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

West Virginia was built as one of FIVE PARALLEL AGENTS in this roster's round, alongside Idaho,
Hawaii, New Hampshire, and Maine, each on its own branch (`feat/demeter-wv-corpus` here). See the
Registration section below for how a resulting merge conflict on shared files should be resolved.

## Method

Direct `curl` fetch (browser User-Agent) of West Virginia Bureau for Family Assistance's (bfa.wv.gov)
live SNAP program page — a genuinely CURRENT agency page carrying its own dated income table and
asset-limit figures directly in HTML, a real departure from this roster's more common pattern of
PDF-only current figures. Also directly fetched W. Va. Code § 9-2-3a's full text from
code.wvlegislature.gov, West Virginia's ABAWD Requirements PDF from bfa.wv.gov, several West Virginia
Income Maintenance Manual (IMM) chapter PDFs from the legacy wvdhhr.org domain (used for procedural
structure only — flagged as stale, dated 2008-2013 in their page footers), and a live 2026 WV Board
of Review decision (26-BOR-1601) as direct corroboration that the drug-felony statute remains
operationally current. WebSearch/WebFetch cross-checks (WV MetroNews, Fayette Tribune, WV
Gazette-Mail, WV Center on Budget & Policy, Public Health Law Center's opt-out state map, Propel's
state EBT guide, abawdmap.us, USDA FNA) corroborated the HB2459 legislative history, the soda-waiver
rollout, the Restaurant Meals Program's absence, and current ABAWD waiver status.

## Finding 0 — no bot-detection wall found anywhere in West Virginia's primary sources; the SUA
dollar-figure gap is this pack's own coverage limitation, not a source-side barrier

`bfa.wv.gov` and `code.wvlegislature.gov` both returned clean HTTP 200 to every direct curl attempt
this pack made with a browser User-Agent. The legacy `wvdhhr.org` domain (hosting older Income
Maintenance Manual PDF chapters) also returned clean HTTP 200. The one gap this pack discloses
honestly is a COVERAGE limitation, not an access barrier: this pack did not converge on a
directly-fetched, dated primary-source table for West Virginia's current Standard Utility Allowance
(SUA) dollar figures within its research window — the IMM chapters this pack did fetch (9 and 11)
carry only procedural content dated 2008-2013, not a current deductions table (likely Chapter 12,
which this pack did not locate a working URL for). This pack disclosed this gap explicitly in
`freshness.json` and the shelter-utility-deductions supplement rather than estimating or fabricating a
dollar figure.

## Finding 1 (flagship, structural) — West Virginia's 200% FPL BBCE gross-income ceiling applies
BROADLY across household types — no elderly/disabled/separate-household carve-out narrowing it

West Virginia's Bureau for Family Assistance's own live SNAP page publishes a current 130%/200% FPL
gross-income table by household size, and this pack found the 200% figure applies broadly, without
the household-type carve-out this roster's Nebraska pack found narrowing Nebraska's own elevated
165% FPL column to elderly/disabled/separate-household/ERP households only. This pack reads West
Virginia's BBCE structure as the more TYPICAL shape this roster's other elevated-gross-income states
generally use, in explicit contrast with Nebraska's genuinely narrower pattern — worth naming
precisely rather than assuming every state's elevated BBCE percentage works the same way Nebraska's
does, or the way West Virginia's does.

## Finding 2 (confirmation of a minority-position claim) — West Virginia's modified drug-felony SNAP
opt-out (W. Va. Code § 9-2-3a) is confirmed CURRENT and OPERATIONALLY applied via a live 2026 case

Several secondary sources (Public Health Law Center's opt-out state map, CLASP's national
drug-felony survey) describe West Virginia as one of a minority of states with a genuinely modified
(not fully repealed) federal drug-felony SNAP ban, with more confidence than a single secondary
source alone would typically justify for a claim this specific. This pack independently verified
this TWICE: first, by fetching W. Va. Code § 9-2-3a's full text directly from code.wvlegislature.gov
and confirming its Bill History shows only the original 2019 HB2459 enactment with no subsequent
amendment; second, and more consequentially, by fetching a LIVE 2026 WV Board of Review decision
(26-BOR-1601, oig.wv.gov) — a real SNAP-denial appeal in which the hearing officer applied this exact
statutory rule to reverse a county DoHS office's denial, citing the same three-element test (SNAP
misuse, loss of life, physical injury) the 2019 statute establishes. This second source is direct
evidence the 2019 modification is not merely still on the books but ACTIVELY APPLIED in practice,
seven years after enactment — a genuinely stronger confirmation than this pack could have reached
from the statute text alone.

## Finding 3 (flagship, structural/time-sensitive) — West Virginia's historical statewide ABAWD
waiver appears to have LAPSED under OBBBA's tightened threshold — this pack's own inference, flagged
as such

West Virginia has a long history of holding a statewide ABAWD work-requirement waiver, reflecting
persistently high unemployment in its Appalachian coalfield counties. This pack found this historical
pattern still described in the present tense by several secondary sources, but this pack's direct
cross-check of `abawdmap.us` found West Virginia currently marked "No waiver — rule applies." This
pack traced the likely cause: the One Big Beautiful Bill Act (OBBBA, July 2025) raised the
area-waiver eligibility bar to require documented county-level unemployment ABOVE 10%, a threshold
even West Virginia's highest-unemployment county (McDowell County, ~9.1% as of mid-2026) currently
falls short of. This pack explicitly flags that this conclusion — the historical waiver has lapsed —
is THIS PACK'S OWN INFERENCE from cross-checking abawdmap.us against OBBBA's stated threshold and
current county unemployment data, not a directly-quoted DoHS or USDA statement, and recorded this
distinction explicitly in `freshness.json` rather than presenting the inference with the same
confidence as a directly-sourced fact.

## Finding 4 (flagship, structural) — West Virginia is the FIRST state to implement a USDA-approved
SNAP soda-purchase restriction, and — unlike Nebraska's parallel waiver — this pack found no
litigation affecting it

USDA approved West Virginia's SNAP "Healthy Choices" waiver on August 4, 2025, effective January 1,
2026, making West Virginia the first state in the nation to implement this kind of restriction. This
pack's most consequential finding here is a genuine, worth-flagging DIFFERENCE from this roster's
Nebraska pack, not a similarity: Nebraska's parallel soda/energy-drink waiver was vacated by a federal
court (Aragon et al. v. Rollins et al., D.D.C., June 22, 2026) roughly five and a half months after
taking effect, but this pack found NO comparable litigation, court challenge, or vacatur affecting
West Virginia's restriction as of this pack's fetch date (August 12, 2026), roughly seven and a half
months after it took effect. This pack explicitly does not assume West Virginia's waiver shares
Nebraska's litigation outcome merely because both rest on the same federal pilot-project authority the
Aragon court found deficient for Nebraska — this is flagged as a genuinely open legal question in
`freshness.json`, not treated as settled in either direction.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

West Virginia has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for West Virginia (out of scope for this task, requiring
its own separate, explicit go-ahead per the standing park rule) should treat this pack's citations as
a starting point, not a final answer, and should specifically re-verify the ABAWD waiver-lapse
inference (Finding 3, this pack's own inference rather than a directly-sourced statement), the
food-restriction-waiver litigation status (Finding 4, the most legally volatile fact in this pack),
and locate a current, dated SUA dollar-figure source (Finding 0's disclosed gap) before hardcoding
West Virginia's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched West Virginia text, checking
specifically for: claims inferred from a secondary source without primary-source verification; dollar
figures not traceable to a specific dated source; and any West Virginia-vs-Nebraska contrast
overclaimed as settled when the underlying evidence was genuinely ambiguous or still open. Concrete
catches from this pass:

- The drug-felony finding (Finding 2) does not stop at fetching the statute text — it deliberately
  sought and found a SECOND, independent corroborating source (the 2026 Board of Review decision)
  specifically because a statute's bare text does not by itself prove current operational practice;
  finding a live 2026 application of the rule is meaningfully stronger evidence than the statute text
  alone.
- The ABAWD-lapse finding (Finding 3) is explicitly labeled as THIS PACK'S OWN INFERENCE rather than
  a directly-quoted agency statement — this pack caught itself initially drafting this finding in a
  more confident register ("West Virginia's ABAWD waiver has lapsed") before revising to disclose the
  inferential chain (abawdmap.us status + OBBBA threshold + county unemployment data) explicitly,
  since no single source stated the lapse outcome directly.
- The food-restriction-waiver finding (Finding 4) does NOT extrapolate Nebraska's litigation outcome
  onto West Virginia, and does not assert the reverse (that West Virginia is litigation-immune)
  either — both directions were checked against this pack's own search results, which found no
  litigation for West Virginia as of the fetch date, and this is stated as a time-bound absence of
  evidence, not a permanent legal conclusion.
- The asset-rule supplement does not claim West Virginia's page uses the term "BBCE" — this pack
  checked the source text directly and found bfa.wv.gov's own page states its asset-limit waiver
  ("most households will not be subject to the asset limit") without using the BBCE acronym, and the
  supplement is worded to reflect that precisely rather than assuming BBCE terminology the source
  itself does not use.
- The shelter-utility-deductions supplement was rewritten during this pass to REMOVE a draft dollar
  figure this pack had initially pulled from a secondary aggregator site without independently
  verifying it against a dated primary source — replaced with an explicit disclosure of the sourcing
  gap instead, consistent with this roster's standing rule against citing unverified dollar figures.
- The income-pathways supplement's contrast with Nebraska (broad 200% BBCE vs. Nebraska's narrower,
  household-type-scoped 165%) was checked against Nebraska's own pack text directly (not from memory)
  before stating the contrast, to avoid mischaracterizing Nebraska's finding while describing West
  Virginia's.

## Sources

| Source | Access | Dated |
|---|---|---|
| West Virginia Bureau for Family Assistance, SNAP program page (income table, asset limits, medical deduction, reporting thresholds) | direct curl fetch (browser UA), clean HTTP 200, live HTML | current as of fetch, 2026-08-12 |
| W. Va. Code § 9-2-3a | direct curl fetch of code.wvlegislature.gov, clean HTTP 200, full text read directly | enacted 2019 (HB2459), confirmed unamended as of 2026-08-12 |
| West Virginia Bureau for Family Assistance, ABAWD Requirements PDF | direct curl fetch, clean HTTP 200 | current 36-month period 1/1/2025-12/31/2027 |
| West Virginia Bureau for Family Assistance press release, Healthy Choices soda waiver implementation; USDA FNA West Virginia food-restriction-waiver page | WebSearch/WebFetch corroboration | approved 8/4/2025, effective 1/1/2026, retailer deadline 4/1/2026 |
| WV Office of Inspector General, Board of Review Decision 26-BOR-1601 | direct curl fetch, clean HTTP 200 PDF | live 2026 SNAP appeal decision |
| West Virginia Income Maintenance Manual, Chapters 9 and 11 | direct curl fetch of wvdhhr.org PDFs, clean HTTP 200 | page-footer dates 2008-2013 (stale; used for procedural structure only) |
| WV MetroNews, Fayette Tribune, WV Gazette-Mail, WV Center on Budget & Policy, Public Health Law Center opt-out map, CLASP national survey | WebSearch corroboration only | HB2459's 2019 legislative history |
| Propel West Virginia state EBT guide | WebSearch/WebFetch corroboration only | Restaurant Meals Program absence |
| abawdmap.us | WebSearch/WebFetch corroboration only | current ABAWD waiver status, cross-checked 2026-08-12 |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (WV guide questions), `eval/answer-eval.ts` (WV_GOLD, spread into
ALL_GOLD). West Virginia is deliberately NOT added to any `engine-citations.ts` per-state constant map
— West Virginia has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("WV", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a West Virginia policy — this matches the precedent already set by
Nebraska's, North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's,
Maryland's, Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, Oklahoma's,
Connecticut's, Utah's, Iowa's, and Arkansas's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future West Virginia `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.

**Parallel-agent round:** West Virginia was built in the same round as Idaho, Hawaii, New Hampshire,
and Maine, each on its own branch. All five states register in the same four shared files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`). Any
resulting merge conflict on those shared files should be resolved by always COMBINING every state's
additions (StateCode union members, REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread
into the aggregate export) — never dropping another state's entry to resolve a conflict.
