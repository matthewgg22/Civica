# Vermont pack — provenance

**Created:** 2026-08-12. Vermont is a genuine BLANK SLATE in this roster — like Delaware's,
Nebraska's, Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, New Mexico's, and
New Hampshire's prior builds, Vermont has NO existing `packages/snap-rules` entry and NO oracle
fixture coverage at all. No discrepancy-checking against an existing engine constant was possible
or attempted; this pack's findings stand entirely on its own primary-source research. This task's
scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully
parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Vermont was built as one of a six-agent parallel batch (AK, VT, WY, DC, Guam, USVI) closing out the
standard 50-state Demeter corpus roster, each on its own branch, in the same window.

## Method

`dcf.vermont.gov`, `legislature.vermont.gov`, and `law.cornell.edu` all returned clean HTTP 200 to
direct curl attempts with a standard browser User-Agent (one transient `dcf.vermont.gov` 403
succeeded cleanly on an immediate retry — likely simple rate-limiting, not a persistent wall, since
every other `dcf.vermont.gov` fetch succeeded on the first attempt). `regulations.justia.com`,
hosting an identical copy of the Code of Vermont Rules text also mirrored on Cornell's Legal
Information Institute, returned a hard Cloudflare "Just a moment..." bot-detection challenge to both
a direct curl attempt and an `r.jina.ai` reader-proxy retry; this pack worked around it by using the
Cornell LII mirror instead, which served the same underlying text without a bot-detection wall.
`pdftotext -layout` was used on two dated DCF legislative PDFs fetched directly.

## Finding 0 (access, not content) — Vermont's own primary "3SquaresVT Program Manual" (a
MadCap/RoboHelp JS application) could NOT be productively fetched, and this pack disclosed the gap
rather than guessing at its content

Unlike Delaware's `regulations.delaware.gov` SPA (where this roster's Delaware pack found and used a
working underlying `/api/AdminCode/...` PDF endpoint), Vermont's `ahsnet.ahs.state.vt.us` manual
host rendered no server-side content and this pack's attempts to guess its RoboHelp
`Data/Toc.js`/search-index asset paths all returned HTTP 404. WebSearch results independently
describe at least some content on this host as restricted to authorized AHS/DCF users, consistent
with this pack's inability to retrieve it. This pack substituted DCF's own live, actively-maintained
public consumer pages and DCF's own dated legislative testimony/slide decks — both genuine primary
sources, authored and dated by DCF's own Deputy Commissioner and Program Director, submitted
directly to the Vermont Legislature — as the operative substitute, and discloses this specific gap
explicitly in freshness.json rather than fabricating manual section citations to fill it.

## Finding 1 (flagship, structural) — Vermont runs TWO distinct categorical-eligibility routes: the
standard 185% FPL BBCE gate AND a separate, state-specific Vermont-EITC-linked route for households
with children

Vermont DCF's own live consumer page states plainly that a household is categorically eligible
(clearing BOTH the gross and net income test entirely) through either: (1) gross household income at
or below 185% FPL — the standard BBCE mechanism most secondary sources describe — OR (2) the
household has children AND received the Vermont Earned Income Tax Credit in the 12 months before
applying. This pack confirmed route (2) is a genuinely distinct, state-specific mechanism (not merely
a restatement of route 1) via WebSearch corroboration describing it as a specific policy: "Families
with children who received the Vermont Earned Income Tax Credit in the 12 months before applying for
3SquaresVT are 'categorically eligible.'" This is structurally the same BBCE-family pattern this
roster's Delaware pack found (there, triggered by a TANF-funded pregnancy-prevention-information
service), but implemented through Vermont's own state EITC program instead — a second, independent
confirmation that this roster's states are finding genuinely varied categorical-eligibility trigger
mechanisms, not a single uniform BBCE implementation. A household that clears neither route can still
qualify with resources considered only if it includes a member 60+ or disabled; that narrower track's
resource limit ($4,500) matches the current federal FY2026 COLA-adjusted ceiling exactly — a contrast
with Delaware's own pack, which found Delaware's regulatory text citing a stale, below-federal-floor
figure.

## Finding 2 (flagship, primary-source statutory confirmation) — Vermont fully opted out of the
federal drug-felony SNAP ban by statute in 2009, independently corroborated by a specialized
secondary source

This pack fetched Vermont's own statute directly: 33 V.S.A. § 1203a states in full, "An individual
domiciled in Vermont shall be exempt from the disqualification provided for in 21 U.S.C. § 862a,"
added by 2009 No. 1 (Sp. Sess.), § E.323.2 — a complete, unconditional, one-sentence opt-out on the
books since 2009, notably earlier than this roster's Delaware pack's own 2018 repeal-based opt-out.
This pack independently corroborated this reading against the Collateral Consequences Resource
Center's specialized 50-state drug-felony survey, which categorizes Vermont as "Fully Opted Out" for
both SNAP and TANF — a case where a minority-position claim (a clean, unconditional full opt-out is
less common among the states surveyed) is confirmed by BOTH the primary statutory text this pack
fetched directly AND a specialized secondary source, rather than resting on either alone.

## Finding 3 (flagship, correction of an incomplete flat "no RMP" framing) — Vermont has NO formal
Restaurant Meals Program, but is one of only five states nationally with a SNAP cash-out option, and
43% of Vermont's entire 3SquaresVT caseload already receives benefits as cash usable at restaurants

This pack fetched DCF's own dated 2/19/2025 legislative report directly and confirms Vermont
currently operates no RMP (DCF opposed 2024's S.215, citing an estimated $125,082/year staffing cost
plus $105,192 one-time and $682.40/month EBT-vendor programming costs). But the same report discloses
a structural fact several flat "Vermont has no restaurant option" secondary-source summaries this
pack found omit: Vermont is one of only FIVE states nationally authorized to issue SNAP benefits as
unrestricted CASH (not EBT) to households where every member is 65+ and/or receiving SSI — narrower
eligibility than RMP's own 60+/homeless-inclusive criteria, but functionally broader, since cash-out
benefits can be spent anywhere, restaurants included, with no restaurant-approval process at all. Per
DCF's own figures, 43% of Vermont's entire 3SquaresVT caseload (16,823 of 39,112 households)
currently receives benefits this way. This pack's reading: "no restaurant meals program" is
technically accurate but meaningfully incomplete without this context — a genuine correction of an
incomplete framing this pack found, reached specifically by fetching DCF's own dated implementation
report rather than accepting a flat secondary-source summary.

## Finding 4 (legacy-manual-mirror trap, confirmed not a fetch-tooling artifact) — the widely-linked
Cornell LII "Code of Vermont Rules" mirror serves clean HTTP 200 but is a stale, generic pre-2010s
7 CFR 273 base-rule reprint with no Vermont-specific current figures anywhere in its full text

This pack fetched the full ~663,000-character Cornell LII mirror of CVR 13-170-005 directly. It cites
"the Food Stamp Act of 1977," carries internal effective-date markers no later than "November 1,
1998," states a base $3,000 general resource limit with no visible Vermont-specific COLA-adjusted
update, and contains NO trace anywhere of Vermont's own 185% FPL BBCE gate, the VT-EITC
categorical-eligibility mechanism, the cash-out option, or current OBBBA-era ABAWD criteria — despite
serving a completely clean HTTP 200 with well-formatted, official-looking regulatory text and no HTTP
error signal of any kind. This is exactly the "legacy-manual-mirror trap" this pack was specifically
briefed to watch for: a plausible-looking, well-formatted source that is silently a year (or in this
case, decades) stale. This pack treats DCF's own live consumer pages and dated legislative testimony
as authoritative over this mirror wherever they diverge, and flags the mirror's staleness explicitly
in freshness.json and authorities.json rather than citing it as a source of current Vermont-specific
dollar figures.

## Finding 5 — Vermont's ABAWD status: no waiver anywhere in the state at all (not even a lapsed
one), current post-OBBBA criteria cross-confirmed by two separate DCF primary sources

DCF's own live Understanding 3SquaresVT Work Rules page and DCF's own dated 10/30/2025 legislative
slide deck INDEPENDENTLY confirm the same current post-OBBBA ABAWD criteria (18-64 age range,
child-under-14 exemption narrowed from under-18, new Indian/Urban Indian/California Indian
exemption, homeless/veteran/foster-care-aged-out exemptions removed) — a stronger evidentiary basis
than this roster's Delaware pack had for the equivalent finding, which relied on a single live page.
USDA FNS's own ABAWD Time Limit Waivers FY2025-2029 index shows NO Vermont entry anywhere, in
contrast to this roster's Delaware, New Hampshire, and Maine packs, each of which found at least one
past (if since-lapsed) entry — this pack reads this as Vermont enforcing the ABAWD time limit
statewide with no waived area at all, corroborated by WebSearch.

## Finding 6 — Vermont's current SUA/utility-allowance dollar figures ARE confirmed and dated, a
contrast with Delaware's own disclosed gap, though sourced from a single primary document

DCF's own dated 10/30/2025 slide deck states three current utility-allowance figures effective
10/1/2025: $1,096/month Standard Utility Allowance, $311/month Basic Utility Allowance, $37/month
telephone-only allowance — plus the OBBBA-era "heat and eat" restriction (now limited to
elderly/disabled households only). This pack flags this as a genuine, dated confirmation, unlike this
roster's Delaware pack, which could not locate Delaware's own specific figures at all — but also
flags that these three figures rest on a single primary document (DCF's own slide deck) rather than
being independently cross-checked against a second, fully separate published source, and discloses
this single-sourcing explicitly in freshness.json.

## Finding 7 — Vermont's certification-period structure is genuinely more generous at its long end
than this roster's other built states: up to a full 3 years (36 months) with no interim report for
the age-60+/disability simplified track

Vermont's standard certification period is 12 months (interim report due around month 5, slightly
earlier than Delaware's own month-6 timing). But Vermont's "3SquaresVT in a SNAP!" simplified
process, for households where everyone applying is 60+ or disability-benefit-receiving with no
job/self-employment income, extends to a full 36 months with NO interim report at all — notably
longer than this roster's Delaware pack's own 24-month elderly/disabled maximum.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

Vermont has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Vermont (out of scope for this task, requiring its
own separate, explicit go-ahead per the standing park rule) should treat this pack's citations as a
starting point, not a final answer, and should specifically attempt direct access to the internal
3SquaresVT Program Manual (Finding 0), independently cross-verify the SUA dollar figures against a
second published source (Finding 6), and confirm the EITC categorical-eligibility mechanism's exact
statutory or regulatory basis (this pack relied on DCF's own live page plus WebSearch corroboration,
not a located CVR or statute section number specific to that mechanism) before hardcoding Vermont's
parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Vermont text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying primary
text; the Cornell LII CVR mirror's own internal date markers checked against known federal
effective-date changes (OBBBA 7/4/2025 signed, 10/1/2025 implemented; the 2009 drug-felony opt-out);
and any Vermont-vs-common-assumption contrast overclaimed as settled when the underlying evidence was
genuinely single-sourced. Concrete catches from this pass:

- The categorical-eligibility structure (Finding 1) does not simply repeat the flat "185% BBCE, no
  asset test" framing several secondary sources use — it separately identifies and confirms the
  VT-EITC-linked route as a DISTINCT mechanism (not a restatement), and states explicitly that a
  household clearing neither route with an elderly/disabled member still faces a real $4,500 resource
  test, rather than letting the majority-case simplification stand in for the full rule.
- The drug-felony finding (Finding 2) is grounded in the statute's own current 2026-fetched text (33
  V.S.A. § 1203a), not merely repeated from a secondary source's framing — this pack fetched
  legislature.vermont.gov directly and independently cross-checked the reading against a specialized
  secondary source (the Collateral Consequences Resource Center) rather than relying on either alone.
- The restaurant-meals/cash-out finding (Finding 3) does not stop at "Vermont has no RMP" — it
  specifically chased DCF's own dated implementation-cost report to find the cash-out option's actual
  scale (43% of caseload, a concrete household count) rather than letting the RMP-absence framing
  stand as the complete answer.
- The Cornell LII mirror staleness catch (Finding 4) was not obvious from any single content fetch —
  it required directly comparing the mirror's own internal effective-date markers and dollar figures
  against DCF's own live consumer pages and dated legislative testimony. An early draft pass that
  cited CVR 13-170-005 for a Vermont-specific resource limit or categorical-eligibility trigger
  without this cross-check would have published stale, pre-2010s federal-base-rule text as
  Vermont-current — this pack caught that specifically rather than treating the CVR's official-sounding
  formatting as evidence of currency.
- The SUA/utility-allowance figures (Finding 6) are flagged explicitly as single-document-sourced
  rather than stated with the same confidence as the independently-cross-checked income-limit
  figures, since this pack could not locate a second, fully separate published DCF COLA notice to
  corroborate them against.
- The internal Program Manual access gap (Finding 0) is disclosed as a genuine, unresolved gap rather
  than silently worked around with a guessed citation — this pack's guessed RoboHelp asset paths all
  404'd, and this pack did not fabricate a manual section number to fill the gap.

## Sources

| Source | Access | Dated |
|---|---|---|
| Vermont DCF, 3SquaresVT main consumer page | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| Vermont DCF, 3SquaresVT in a SNAP! page | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| Vermont DCF, 3SquaresVT Income Guidelines page | direct fetch, clean HTTP 200 | fetched 2026-08-12; table published "October 2025" |
| Vermont DCF, Understanding 3SquaresVT Work Rules page | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| Vermont Statutes Online, 33 V.S.A. § 1203a | direct fetch, clean HTTP 200 | fetched 2026-08-12; statute added 2009 |
| Code of Vermont Rules 13-170-005, Cornell LII mirror | direct fetch, clean HTTP 200 | fetched 2026-08-12; confirmed stale, internal markers no later than 1998 |
| Vermont DCF, "3SquaresVT Program Changes" legislative slide deck | direct fetch of PDF, clean HTTP 200, pdftotext -layout | dated 10/30/2025, fetched 2026-08-12 |
| Vermont DCF, "Restaurant Meals Program Implementation Analysis" legislative report | direct fetch of PDF, clean HTTP 200, pdftotext -layout | dated 2/19/2025, fetched 2026-08-12 |
| USDA FNS, SNAP ABAWD Time Limit Waivers FY2025-2029 index | direct curl fetch (browser UA), clean HTTP 200 after 301 redirect | fetched 2026-08-12; no Vermont entry |
| Vermont Legislature, "BBCE Households" handout (2019) | direct fetch of PDF, clean HTTP 200 | dated 8/29/2019; used only as historical context for a PROPOSED (never-enacted) 2019 federal BBCE rule change, not as a current-figure source |
| regulations.justia.com (identical CVR text to Cornell LII mirror) | blocked — Cloudflare bot-detection challenge to both direct curl and r.jina.ai reader-proxy retry | not used; Cornell LII mirror substituted |
| ahsnet.ahs.state.vt.us (3SquaresVT Program Manual) | blocked — client-side JS app, no server-rendered content, guessed API paths 404'd | not used; disclosed as a genuine access gap, see freshness.json |
| Collateral Consequences Resource Center, national SNAP/TANF drug-felony survey | WebSearch, not independently fetched | secondary corroboration only, cross-checked against the primary statute |
| WebSearch corroboration only (VT-EITC categorical-eligibility mechanism description; general BBCE framing; secondary-source income-limit figure this pack found and corrected) | WebSearch, not independently fetched | see freshness.json for the specific disclosed correction |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (VT guide questions), `eval/answer-eval.ts` (VT_GOLD, spread into
ALL_GOLD). Vermont is deliberately NOT added to any `engine-citations.ts` per-state constant map —
Vermont has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("VT",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build
adds a Vermont policy — this matches the precedent already set by every prior blank-slate corpus pack
in this roster, including Delaware's, New Hampshire's, and Maine's most recent builds.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Vermont `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Six-agent parallel batch:** Vermont was built in parallel with Alaska (AK), Wyoming (WY), the
District of Columbia (DC), Guam, and the U.S. Virgin Islands (USVI) — six separate agents in the same
window, each on its own branch (`feat/demeter-vt-corpus` for this one), closing out the standard
50-state Demeter corpus roster. All six jurisdictions register in the same four shared files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and
therefore all six PRs are expected to conflict with each other on merge. The rule to follow when
resolving that conflict is to always COMBINE every jurisdiction's additions (StateCode union members,
REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never to
drop another jurisdiction's entry to resolve a conflict — matching the precedent this roster's prior
same-window batch tiers already set.
