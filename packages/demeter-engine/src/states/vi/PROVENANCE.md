# U.S. Virgin Islands pack — provenance

**Created:** 2026-08-12. This is the final closing batch of the standard Demeter 50-state
roster — built alongside Alaska (AK), Vermont (VT), Wyoming (WY), the District of Columbia
(DC), and Guam (GU) as a six-agent parallel round, each on its own branch. USVI has NO
existing `packages/snap-rules` entry and NO oracle fixture coverage — a genuine blank slate,
like this roster's Nebraska, Connecticut, Delaware, and several other prior state builds.
This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not
touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of
which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Step 0 — independently re-verified the SNAP-vs-NAP distinction before building anything

This codebase's `packages/demeter-engine/src/packs.ts` already carries a comment asserting
that Guam and the U.S. Virgin Islands "DO run SNAP" (unlike Puerto Rico, American Samoa, and
CNMI, which run the NAP block grant instead). Rather than trusting that existing in-repo
comment at face value, this pack independently re-confirmed it from two separate PRIMARY
USDA sources before writing a single line of USVI content:

1. USDA FNS/FNA's own SNAP state directory entry for the Virgin Islands
   (`fns.usda.gov/snap-directory-entry/virgin-islands`), whose page title reads "Virgin
   Islands Supplemental Nutrition Assistance Program (SNAP)."
2. USDA FNS/FNA's 17th-edition State Options Report (December 2025, using FFY2025 State
   Plan data as of October 1, 2024), whose own introductory text states plainly: "SNAP
   State agencies include all 50 States, the District of Columbia, Guam, and the Virgin
   Islands." The same report devotes a full state-summary page (pp. 135-136) to the Virgin
   Islands' own SNAP policy options — a jurisdiction that ran NAP instead would not appear
   in this report at all, the same way Puerto Rico, American Samoa, and CNMI do not.

**Conclusion: the existing packs.ts comment is accurate. USVI currently runs standard
federal SNAP, not NAP.** This pack proceeded to build a standard state-style corpus pack.

## Method

`fns.usda.gov`, `dhs.vi.gov`, and `vi.gov` all returned clean HTTP 200 to every direct curl
and WebFetch attempt this pack made with a standard browser User-Agent — no WAF or
bot-detection barrier of the kind this roster's New Hampshire, Maine, or Delaware
(`usda.gov` specifically) packs encountered. This was a genuinely EASIER access profile than
several mainland packs in this roster; no Wayback Machine fallback or reader-proxy
workaround was needed for any USVI-specific source. All PDFs (the FY2026 COLA/deductions
table, the FY2026 simplified-reporting requirements, the ABAWD webpage and flyer PDFs, and
the 114-page/5.8MB 17th-edition State Options Report) fetched cleanly and converted cleanly
with `pdftotext -layout`.

One naming wrinkle noted for future packs' awareness: USDA's site now displays "Food and
Nutrition Administration (FNA)" rather than "Food and Nutrition Service (FNS)" — the site
itself discloses a rename effective June 1, 2026 via a banner notice. This pack cites the
historical `fns.usda.gov` hostnames since those are what currently resolve and were
successfully fetched.

## Finding 0 (flagship, confirmation) — USVI's BBCE gross-income gate is 175% FPL with NO
resource/asset limit for ANY household, confirmed directly on USDA's own current official
BBCE page, not merely repeated from a secondary source

Several secondary/aggregator sources this pack found (snapscreener.com, generic BBCE
explainer sites) describe the Virgin Islands as having "no asset limit" and a "175%"
gross-income gate — claims this pack specifically chased to USDA's own current, live Broad-
Based Categorical Eligibility policy page rather than accepting at face value. USDA's own
page confirms it independently, in USDA's own words: the Virgin Islands is listed with "All
households" categorically eligible (the broadest BBCE implementation tier), "No limit on
assets," and a gross income limit of "175%." A second, independent USDA-sourced compilation
(Food Research & Action Center) cross-checks the identical figures. A `vi.gov` official
press release, directly quoting DHS Commissioner Averil George, confirms the underlying
policy CHANGE and its effective date: the gross-income threshold rose from 130% to 175% of
the Federal Poverty Guidelines effective October 1, 2024 — meaning 175% is a genuinely
recent USVI-specific policy choice, not a static, long-standing federal default a casual
reader might assume.

This pack also found and disclosed (rather than silently resolved) an internal ambiguity:
DHS-VI's OWN FY2026 income table shows both a "175%" and a "200%" gross-income column side
by side with no explanatory text distinguishing them. This pack treated USDA's own singular,
unambiguous 175% BBCE-page figure as authoritative and flagged the table's second column as
an unresolved question rather than guessing at its purpose — see freshness.json.

## Finding 1 (flagship, confirmation) — USVI has FULLY opted out of the federal drug-felony
SNAP disqualification

USDA's own most current State Options Report (17th edition, Dec 2025) states the Virgin
Islands' "Drug Felony Disqualifications" policy option plainly as "No disqualification" —
the fullest opt-out tier, the same category this roster's Delaware and North Dakota packs
independently confirmed for their own jurisdictions via different primary sources. This pack
disclosed, rather than guessed at, a genuine gap: it could not locate the specific USVI Code
section or DHS regulation implementing this opt-out, since DHS-VI's own public materials do
not cite it and this pack found no codified, section-numbered USVI SNAP policy manual
publicly posted (unlike, e.g., Delaware's DSSM or New Hampshire's FSM). The POLICY OUTCOME is
confirmed via a primary federal source; the underlying territorial statutory citation is a
disclosed, unresolved gap — see freshness.json.

## Finding 2 (flagship, structural/timing) — USVI's post-OBBBA ABAWD work rules take effect
March 1, 2026, roughly four months after the mainland's November 1, 2025 OBBBA date

USVI DHS's own current (2026-dated) ABAWD webpage and consumer flyers state that new
post-OBBBA ABAWD work rules take effect in the territory starting March 1, 2026, with the
current three-year window running March 1, 2026 through February 28, 2029. This roster's
mainland packs (e.g., Delaware) confirm the OBBBA ABAWD changes took effect nationally on
November 1, 2025. This pack flags the roughly-four-month gap between USVI's own effective
date and the mainland's as a genuine, disclosed, territory-specific implementation-timing
difference — and explicitly discloses that it could NOT find an authoritative explanation
for WHY the dates differ (a formal territory phase-in provision vs. the natural expiration of
USVI's own prior area-wide waiver vs. another cause), rather than fabricating a reason.
Separately, USDA's own State Options Report (Dec 2025, but using PRE-OBBBA data as of
10/1/2024) still lists USVI's ABAWD waiver status as "Statewide ABAWD time limit waiver" — a
snapshot that predates OBBBA's own changes to waiver eligibility and should NOT be read as
evidence of a currently active waiver under the post-3/1/2026 regime; this pack flags that
distinction explicitly rather than letting the older federal snapshot stand in for USVI's
own current, dated consumer materials.

## Finding 3 — USVI does NOT operate a Restaurant Meals Program, confirmed by absence from
USDA's own current published participating-jurisdictions list

USDA's own current, live SNAP Restaurant Meals Program page lists its participating
states/territories explicitly (Arizona, California, Illinois — Cook and Franklin Counties
only, Maryland, Massachusetts, Michigan, New York, Rhode Island, and others); the Virgin
Islands is absent. This pack found no USVI DHS page or press release describing a pending or
planned RMP, and treats this as a direct confirmation from USDA's own current list, not a
weaker absence-of-evidence inference from silence alone.

## Finding 4 — genuine structural difference from every prior pack in this roster: USVI has
NO online self-service SNAP application portal

Every prior state pack in this roster (Delaware ASSIST, California BenefitsCal, and others)
names a working online self-service application portal. This pack found none for USVI —
DHS-VI's own Family Assistance Programs page describes only paper-application channels:
pick up a physical application at a local SNAP office, have one mailed by calling the local
office, or print the form from the DHS website, then submit it in person, by mail, by email,
by fax, or via a district-office drop box. This pack treats this as a disclosed, genuine
access-model finding rather than a research gap — DHS-VI's own page lists these specific
channels and names no digital-submission alternative.

## Finding 5 — apparent internal tension between USVI's "SUAs not mandatory" federal
utility-treatment option and its own hardcoded shelter/telephone-deduction dollar figures

USDA's State Options Report lists USVI's utility-expense treatment as "SUAs not mandatory,"
while DHS-VI's own FY2026 table hardcodes a $586.00 maximum shelter deduction and a $34.00
telephone deduction as if they function as standard allowances. This pack discloses the
apparent tension rather than resolving it with false confidence, since it could not confirm
whether a specific USVI household's shelter/utility costs are calculated via these table
figures or via actual documented costs — see freshness.json.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

USVI has no prior `packages/snap-rules` `StatePolicy` entry, so there was no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding, deliberately cross-checked between USDA's own current live pages
(BBCE, RMP, State Options Report) and USVI DHS's own current, dated materials wherever both
existed.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched USVI text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying
primary text; the specific 175%-vs-200% column ambiguity in DHS-VI's own table (resolved by
deferring to USDA's own singular BBCE-page figure, not by picking whichever number "sounded
more generous"); and any USVI-vs-mainland-assumption contrast overclaimed as settled when
the underlying evidence was genuinely single-sourced or unconfirmed. Concrete catches from
this pass:

- The BBCE finding (Finding 0) does not just repeat the "175%, no asset limit" secondary-
  source framing — it traces the claim to USDA's own current official BBCE page AND a
  second, independently-sourced FRAC compilation, AND discloses the unresolved 175%-vs-200%
  table ambiguity explicitly rather than silently picking a number.
- The drug-felony finding (Finding 1) is grounded in USDA's own most current State Options
  Report rather than a secondary aggregator, and explicitly discloses that the underlying
  USVI statutory citation implementing the opt-out remains unlocated — an early draft that
  simply stated "no drug felony ban in USVI" without that caveat would have overclaimed
  precision this pack does not actually have.
- The ABAWD timing finding (Finding 2) does not simply restate USVI's own March 1, 2026 date
  as if it were self-explanatory — it explicitly contrasts it against the mainland's
  November 1, 2025 OBBBA date this roster's other packs confirm, flags the roughly-four-month
  gap as a genuine open question, and separately catches that the State Options Report's
  "Statewide ABAWD time limit waiver" line is PRE-OBBBA data that must not be read as
  evidence of a currently active waiver.
- The "no online portal" finding (Finding 4) was cross-checked against a second WebSearch
  pass specifically looking for a USVI online application system before concluding none
  exists — an early instinct to assume one exists (since nearly every prior state pack in
  this roster has one) was checked against DHS-VI's own page text rather than assumed by
  roster-pattern-matching.
- The Restaurant Meals Program finding does not rely on absence-of-mention alone — it cross-
  checks USDA's own CURRENT, LIVE published participating-jurisdictions list directly, the
  same standard this roster's Delaware and North Dakota packs applied to their own RMP
  findings.

## Sources

| Source | Access | Dated |
|---|---|---|
| USDA FNS/FNA, Virgin Islands SNAP state directory entry | direct fetch, clean HTTP 200 | fetched 2026-08-12; page updated 11/14/2025 |
| USDA FNS/FNA, SNAP State Popup for Virgin Islands | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| USDA FNS/FNA, Broad-Based Categorical Eligibility policy page | direct fetch, clean HTTP 200 | fetched 2026-08-12; current live page |
| USDA FNS/FNA, SNAP State Options Report, 17th Edition | direct fetch, clean HTTP 200 | published Dec 2025; data as of 10/1/2024 |
| USDA FNS/FNA, SNAP Restaurant Meals Program page | direct fetch, clean HTTP 200 | fetched 2026-08-12; current live list |
| USVI DHS, Family Assistance Programs page | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| USVI DHS, FY2026 Monthly Allotments and Deductions table | direct fetch, clean HTTP 200 | published for 10/1/2025-9/30/2026 |
| USVI DHS, FY2026 Simplified Reporting Requirements | direct fetch, clean HTTP 200 | published for 10/1/2025-9/30/2026 |
| USVI DHS, ABAWD Webpage PDF and "SNAP Benefits Are Changing" flyer | direct fetch, clean HTTP 200 | 2026-dated documents |
| Government of the U.S. Virgin Islands (vi.gov), official press release | direct fetch, clean HTTP 200 | dated ~10/2024 (references 10/1/2024 effective date) |
| Food Research & Action Center (FRAC), BBCE compilation PDF | direct fetch, clean HTTP 200; secondary but USDA-sourced | accessed by FRAC June 12, 2026 per its own footer |
| WebSearch corroboration only (general BBCE/asset-limit framing cross-checked, not independently fetched beyond the primary sources above) | WebSearch | see freshness.json for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (VI guide questions), `eval/answer-eval.ts` (`USVI_GOLD`,
spread into `ALL_GOLD`). **Naming collision avoided deliberately:** this codebase's
`eval/answer-eval.ts` already exports a `VI_GOLD` constant for Vietnamese-language gold
cases (part of the ES_GOLD/VI_GOLD/ZH_GOLD language-eval trio, unrelated to any state) — this
pack's Virgin Islands gold array is named `USVI_GOLD`, not `VI_GOLD`, specifically to avoid
that collision, while the `StateCode` union member itself remains the literal string `"VI"`
(a string value, not a variable name, so no collision risk there). Virgin Islands is
deliberately NOT added to any `engine-citations.ts` per-state constant map — USVI has no
`packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("VI", ...)`
will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build
adds a USVI policy — this matches the precedent already set by every prior blank-slate
corpus pack in this roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request
an unfreeze. A future USVI `packages/snap-rules` build is out of scope here and would need
its own separate, explicit go-ahead.

**Six-agent parallel closing batch:** USVI was built in parallel with Alaska (AK), Vermont
(VT), Wyoming (WY), the District of Columbia (DC), and Guam (GU) — six separate agents in the
same window, each on its own branch (`feat/demeter-usvi-corpus` for this one). This is
explicitly the FINAL batch closing out the standard roster. All six states register in the
same four shared files (`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`,
`eval/answer-eval.ts`) and therefore all six PRs are expected to conflict with each other on
merge. The rule to follow when resolving that conflict is to always COMBINE every
jurisdiction's additions (StateCode union members, REGISTRY entries, QUESTIONS entries, and
`_GOLD` arrays spread into the aggregate export), never to drop another jurisdiction's entry
to resolve a conflict — matching the precedent this roster's prior same-window batch tiers
already set.
