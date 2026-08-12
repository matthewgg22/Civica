# Guam pack — provenance

**Created:** 2026-08-12. Guam is a genuine BLANK SLATE in this roster — like Delaware's,
Nebraska's, Connecticut's, Utah's, Iowa's, Arkansas's, Mississippi's, Kansas's, and New
Hampshire's prior builds, Guam has NO existing `packages/snap-rules` entry and NO oracle fixture
coverage at all. No discrepancy-checking against an existing engine constant was possible or
attempted; this pack's findings stand entirely on its own primary-source research. This task's
scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully
parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Guam was built as one of a six-agent parallel batch (AK, VT, WY, DC, GU, USVI) closing out the
standard 50-state-plus-territories roster, each on its own branch, in the same window.

## Threshold question, verified before any other work: does Guam run SNAP or NAP?

The task brief flagged this explicitly: `packages/demeter-engine/src/packs.ts`'s own
`NAP_JURISDICTIONS` comment block states that Puerto Rico, American Samoa, and the CNMI run the
Nutrition Assistance Program (NAP) block grant INSTEAD of SNAP, and explicitly notes "Guam and the
US Virgin Islands DO run SNAP" as the reason those two are deliberately absent from that exclusion
list. This pack independently verified that claim rather than trusting the existing comment at face
value: USDA's own FY2026 SNAP COLA memorandum (fetched directly, see Method below) explicitly lists
Guam among the jurisdictions its COLA figures govern, grouped with the 48 contiguous states, D.C.,
Alaska, Hawaii, and the U.S. Virgin Islands, and gives Guam its own dedicated income-eligibility and
benefit tables — the same treatment every other SNAP-operating jurisdiction receives, and structurally
incompatible with a NAP block-grant jurisdiction (Puerto Rico, American Samoa, and the CNMI do not
appear anywhere in this memo at all, since USDA does not administer NAP the way it administers SNAP).
**This pack confirms `packs.ts`'s existing comment was and remains accurate: Guam currently operates
standard federal SNAP, not NAP.** No correction to that existing codebase comment was needed.

## Method

Unlike this roster's mainland states, Guam has NO citable, numbered administrative-code SNAP manual
this pack could locate online (no DSSM/FSM/He-W-style manual). `dphss.guam.gov`, `go.opengovguam.com`
(the Government of Guam's official document-hosting portal, used for DPHSS's own numbered press
releases and FAQs), `mybenefits.guam.gov`, and `guamlegislature.gov` all returned clean HTTP 200 to
every direct curl attempt with a standard browser User-Agent. The canonical `usda.gov` host, by
contrast, returned a PERSISTENT Cloudflare-managed-challenge HTTP 403 to every direct-fetch attempt
AND to the `r.jina.ai` reader-proxy technique that resolved a similar 403 in this roster's Delaware
pack (here the proxy itself received the same Cloudflare interstitial, not the underlying PDF) — a
genuinely harder access barrier than Delaware's. This pack resolved the FY2026 COLA memo specifically
by locating a content-verified third-party mirror of the identical USDA-authored, digitally-signed PDF
(`primarynewssource.org`), and resolved the SNAP State Options Report by locating a working, newer
Azure Front Door CDN mirror URL for the current 17th edition after the canonical `fns-prod.azureedge.us`
URL 404'd specifically for that edition (the same host correctly served the older 16th edition,
indicating a stale/incorrect URL rather than a live access barrier, not a WAF issue).

## Finding 0 (flagship, structural) — Guam's income ELIGIBILITY limits are NOT territory-elevated,
but its BENEFIT-CALCULATION figures genuinely ARE — an asymmetric structure no secondary source this
pack found describes precisely

The task brief specifically warned that Guam's SNAP program "may have territory-specific COLA/allotment
adjustments similar to Alaska/Hawaii — verify, don't assume mainland figures apply." This pack verified
directly from USDA's own FY2026 COLA memorandum and found the true structure more precise than a flat
"yes, Guam gets AK/HI-style adjustments" or "no, mainland figures apply everywhere" answer:

- **Income ELIGIBILITY limits (net 100% FPL, gross 130% FPL, gross 165% FPL elderly/disabled-separate)**
  are IDENTICAL for Guam and the 48 states/D.C./Virgin Islands — NOT elevated the way Alaska's and
  Hawaii's own separate income tables are.
- **Asset limits** ($3,000 general / $4,500 elderly-disabled) are likewise flat and uniform across every
  SNAP jurisdiction including Guam — no territory adjustment at all.
- **Maximum allotment** IS genuinely elevated for Guam ($1,465/month for a household of 4, vs. $994
  mainland) — Guam gets its own dedicated benefit table, the same mechanism family Alaska and Hawaii
  use, reflecting a higher regional Thrifty Food Plan cost basis.
- **Standard deduction** and **maximum excess shelter deduction** are likewise genuinely elevated for
  Guam ($420-$598 vs. $209-$299 standard deduction; $873 vs. $744 shelter cap).
- **Maximum homeless shelter deduction** ($198.99) is flat and uniform everywhere, no territory
  adjustment for anyone.

This pack treats this asymmetric income-limits-flat/benefit-figures-elevated structure as its flagship
finding — verified directly from a primary USDA table, not inferred or assumed from the AK/HI pattern
the task brief itself flagged as a starting hypothesis to check.

## Finding 1 — Guam enforces the OBBBA ABAWD work requirement on its own, LATER territory-specific
timeline (January 1, 2026, not the November 1, 2025 date most mainland states used), and an older
USDA data point showing a statewide waiver is likely superseded

DPHSS's own live, dated "SNAP FAQ_001" press release (January 23, 2026) confirms Guam's OBBBA ABAWD
enforcement became effective January 1, 2026, with a three-month compliance grace period to April 1,
2026 — roughly two months later than the November 1, 2025 date this roster's other recent packs (e.g.
Delaware) cite for the mainland. This pack cross-checked this against independent secondary reporting
(Marianas Business Journal), which corroborates the date and adds that ~7,000 Guam residents were newly
identified as ABAWDs. Separately, USDA's own SNAP State Options Report (17th Edition, data reference
period October 2024) shows Guam holding a "Statewide ABAWD time limit waiver" as of that earlier
reference period — this pack treats DPHSS's own later, live FAQ as authoritative for CURRENT status and
reads the State Options Report entry as likely superseded, but flags explicitly that it could not
locate a document stating in so many words that the prior waiver was formally ended (see freshness.json).

## Finding 2 — Guam applies a "Modified" drug-felony disqualification per USDA's own current State
Agency Profile; this pack could not locate Guam's own enabling statute defining the exact terms

USDA's SNAP State Options Report (17th Edition) lists Guam's own reported policy selection plainly as
"Modified disqualification." This pack made a genuine effort to locate Guam's own underlying legal
citation (attempting to fetch a specific referenced bill, Bill No. 20-37, which 404'd) and found other
web sources making MUTUALLY CONTRADICTORY, unreliable claims about Guam's drug-felony policy — one
claiming a full opt-out, another claiming Guam is one of only two U.S. jurisdictions keeping the full
lifetime ban. This pack judges neither claim reliable (neither traces to a primary Guam-authored legal
text) and does not repeat either. The pack's authoritative answer rests on USDA's own characterization
("Modified disqualification") while explicitly disclosing the exact modification terms as an
unresolved gap — genuinely more disclosed-gap-heavy than this roster's Delaware pack, which found and
verified a specific, dated repeal order for the equivalent Delaware finding.

## Finding 3 — Guam does NOT currently operate a Restaurant Meals Program; a bill remains pending

Bill No. 78-38 (COR), the "Meals for At-Risk Households Act of 2025," is still in SESSION status in
the Guam Legislature with no Public Law number, per this pack's direct fetch of the Legislature's own
bill-tracking page. Not enacted, not dead — a genuinely live pending item.

## Finding 4 — Guam's own soda/candy SNAP-purchase-restriction waiver status could not be confirmed
either way

Secondary reporting describes DPHSS actively discussing a food-purchase-restriction waiver request,
quoting Director Theresa C. Arriola directly, but this pack could not confirm from a DPHSS-authored
primary document whether Guam formally submitted or received USDA approval, and a cross-check of
USDA's own approved-waiver list as of this pack's research date did not include Guam. Disclosed as
genuinely unresolved rather than assumed either approved or not-submitted.

## Finding 5 — Guam's own SUA (utility-allowance) dollar figure was not locatable, though this pack
DID independently confirm Guam's elevated standard-deduction and shelter-cap figures

USDA's SNAP State Options Report confirms Guam uses "Mandatory SUAs" (a flat allowance, not itemized
actual costs), and this pack confirmed Guam's own elevated Standard Deduction and Maximum Excess
Shelter Deduction figures directly from the FY2026 COLA memo — but the specific Heating/Cooling
Standard Utility Allowance dollar figure itself was not locatable in any source this pack found.
Structurally the same kind of disclosed gap this roster's Delaware pack found for its own utility
figures.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Guam-specific text, checking
specifically for: claims inferred from a secondary-source summary rather than the underlying primary
document; the task brief's own specific caution about territory COLA adjustments checked against the
actual asymmetric structure found rather than assumed; and any Guam-vs-mainland-assumption contrast
overclaimed as settled when the underlying evidence was genuinely single-sourced, contradictory, or
access-constrained. Concrete catches from this pass:

- The income-and-benefit-cola supplement does NOT simply state "Guam gets AK/HI-style territory
  adjustments" (the naive reading of the task brief's own hint) — it reads USDA's own COLA memo table
  by table and finds the ELIGIBILITY tables flat while the BENEFIT tables are elevated, a genuinely
  more precise and non-obvious finding than either "yes elevated" or "no, mainland figures apply."
- The drug-felony finding does NOT pick either of the two mutually contradictory secondary-source
  claims this pack found (full opt-out vs. full lifetime ban) — it explicitly declines both and states
  the one figure this pack could verify from a primary USDA characterization ("Modified"), disclosing
  the unresolved specific-terms gap rather than papering over it with an invented citation.
- The ABAWD finding does not simply repeat USDA's State-Options-Report waiver entry as current — it
  specifically checked that entry's OWN October-2024 data-reference-period date against DPHSS's own
  later, live FAQ, and flagged the likely supersession explicitly rather than letting the older,
  more "official-sounding" federal report win by default — the same discipline this roster's Delaware
  pack applied to its own DSSM-vs-live-consumer-page conflicts.
- The soda/candy waiver and restaurant-meals-program findings were BOTH treated as genuinely unresolved
  pending items rather than assumed either settled-approved or settled-dead, since this pack's searches
  turned up active, in-motion legislative/regulatory processes for both rather than a final resolution
  either way.
- Every dollar figure in the income-and-benefit-cola and utility-deduction supplements traces to a
  specific line in USDA's own FY2026 COLA memo table this pack fetched and read directly (not a
  WebSearch-summarized approximation) — the ONE dollar-figure area this pack explicitly did NOT resolve
  with the same confidence (Guam's specific BBCE gross-income percentage) is flagged precisely as
  unresolved with both conflicting secondary claims disclosed rather than either one picked.

## Sources

| Source | Access | Dated |
|---|---|---|
| USDA FNS/USDA.gov, SNAP Fiscal Year 2026 COLA memorandum | fetched via content-verified mirror after canonical host's persistent 403 | signed 08/14/2025; effective 10/1/2025-9/30/2026 |
| USDA FNS, SNAP State Options Report, 17th Edition | fetched via working Azure CDN mirror after canonical URL 404'd | published August 2025; data reference period October 2024 |
| Guam DPHSS, press release PR26-025 (SNAP/shutdown FAQ) | direct fetch, clean HTTP 200 | dated 10/31/2025 |
| Guam DPHSS, press release "SNAP FAQ_001" (ABAWD/OBBBA) | direct fetch, clean HTTP 200 | dated 01/23/2026 |
| Guam DPHSS, SNAP services landing page | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| Guam Legislature, Bill No. 78-38 bill-tracking page | direct fetch, clean HTTP 200 | fetched 2026-08-12 |
| Marianas Business Journal reporting (secondary, cross-checked against DPHSS primary sources) | WebFetch | fetched 2026-08-12 |
| WebSearch corroboration only (population/participation-rate framing; BBCE percentage — explicitly NOT resolved, see freshness.json) | WebSearch, not independently fetched | see freshness.json for specific disclosed gaps |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (GU guide questions), `eval/answer-eval.ts` (GU_GOLD, spread into
ALL_GOLD). Guam is deliberately NOT added to any `engine-citations.ts` per-state constant map — Guam
has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("GU", ...)` will
throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build adds a Guam
policy — this matches the precedent already set by every prior blank-slate corpus pack in this roster.

`packages/snap-rules` and `apps/dashboard` stay fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify either and does not request an
unfreeze. A future Guam `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Six-agent parallel batch:** Guam was built in parallel with Alaska (AK), Vermont (VT), Wyoming (WY),
the District of Columbia (DC), and the U.S. Virgin Islands (USVI) — six separate agents in the same
window, each on its own branch (`feat/demeter-gu-corpus` for this one), closing out the standard
roster. All six states/territories register in the same four shared files (`states/index.ts`,
`packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`) and therefore all six PRs are
expected to conflict with each other on merge. The rule to follow when resolving that conflict is to
always COMBINE every jurisdiction's additions (StateCode union members, REGISTRY entries, QUESTIONS
entries, and `_GOLD` arrays spread into the aggregate export), never to drop another jurisdiction's
entry to resolve a conflict — matching the precedent this roster's prior same-window batch tiers
already set.
