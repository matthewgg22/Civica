# Pennsylvania pack — provenance

**Created:** 2026-08-11 (retry). A prior session flagged "Pennsylvania is a known dead end, never
attempted" for corpus-building, with no further detail on why. This pack's build reversed that
assessment: the primary source is fully readable, well-organized, and unusually rich (it publishes
its own multi-year dollar-figure history inline, exactly as `docs/plans/mae-state-corpus-framework.md`
§6 predicted — "HTML handbook, publishes prior-year tables inline," rated EASY-MED).

## Why the prior "dead end" almost certainly happened, and what actually broke it

Pennsylvania's SNAP Handbook is hosted at `services.dpw.state.pa.us` — a legacy Adobe RoboHelp 2022
content-management system. **This host serves plain HTTP only.** A direct TLS connection attempt to
port 443 on this host **times out** (confirmed twice in this pass, with and without `-k`), and this
pack's own `WebFetch` tool call against an `http://` URL on this host failed immediately with
`connect ECONNREFUSED` — because `WebFetch` silently upgrades `http://` to `https://` before fetching
(a documented behavior of the tool), which this host cannot serve at all. **A `curl` fetch over plain
`http://`, however, returns full, well-formed, readable content in under a second per page.** This
is almost certainly what a prior session hit and reasonably (if too quickly) concluded was a dead
host — a bare `WebFetch` call on any `http://` URL from this domain fails every time, with an error
message (`ECONNREFUSED`) that gives no hint the fix is "use plain HTTP." Confirming this wasn't a
guess: Pennsylvania's OWN current `https://www.pa.gov` DHS resource page links to the SNAP Handbook
via the exact same `http://services.dpw.state.pa.us/...` URL as its "Open Handbook" pointer — the
state's own current web presence has the identical HTTP-only limitation, so this is a genuine,
confirmed state-side infrastructure characteristic, not a transient failure on this pass's end.

**Practical consequence for this pack's schema conformance:** the state-pack structural test
(`state-packs.test.ts`) requires every topic's `source_url` to match `/^https:\/\//` — a reasonable
default given every other state's manual host serves HTTPS. Pennsylvania breaks that assumption.
This pack points `source_url` at `https://www.pa.gov/agencies/dhs/resources/snap/snap-policies-procedures`
(and the parallel `pa.gov` SNAP page) — Pennsylvania's own stable, HTTPS, official front door, which
itself links to the HTTP-only Handbook — rather than fabricating a fake `https://` URL for the
actual content host. The exact `http://` section URL used for each specific citation is recorded in
the Sources table below for reproducibility. This is disclosed here rather than silently routed
around.

## Method

Direct `curl` (plain HTTP, no `WebFetch`) fetch of ~20 individual SNAP Handbook section pages,
plus the RoboHelp TOC data files (`whxdata/toc*.js`) to enumerate every chapter and section URL
before selecting which to fetch — a full-TOC approach rather than guessing section names, which
surfaced the "Criminal History Desk Guide" and the ABAWD waived-areas appendix that a narrower,
topic-guided search might have missed. Every dollar figure and policy rule in this pack traces to a
specific numbered Handbook section, each with its own visible `Updated <date>, replacing <date>`
issue-date stamp printed directly in the fetched HTML — not to a secondary summary or AI-generated
paraphrase. Cross-checked against WebSearch results and against `pa.gov`'s own current DHS SNAP
pages before drafting.

## Why Pennsylvania matters to the schema

- **The clearest demonstration yet that "access barrier" and "content barrier" are different
  things.** The prior "dead end" flag was about ACCESS (a generic fetch tool's protocol assumption),
  not CONTENT (which turned out to be extensive, current, and well-organized). This pack's central
  finding is methodological: before writing off a state as unbuildable, retry its content host with
  a plain `curl` fetch, not just a `WebFetch` call, when the tool's own error is a bare connection
  failure rather than a 403/bot-challenge page (contrast Minnesota's genuine Radware bot-detection
  wall, which IS a real content barrier, or Texas's genuine host-level bot 403).
- **A four-tier SUA ladder** (Heating / Non-heating / Limited / Homeless), distinct from Minnesota's
  single combined allowance and Wisconsin's seven-tier ladder in this same roster.
- **The most granular certification-period structure in the roster**: four tiers (36/24/12/6 months),
  and distinctively inverted from what a reader might assume — the LONGEST period (36 months) goes to
  zero-income elderly/disabled households, not the shortest.
- **A definitive, dated, PRIMARY-SOURCE confirmation of ABAWD waiver status** — Pennsylvania's own
  Handbook states outright, in bold text dated September 3, 2025, that FNS has not approved any
  Pennsylvania geographic waiver and all counties are subject to the time limit. This is a stronger
  and more useful finding than several other 2026-built packs in this roster (Minnesota, Oregon)
  could achieve, where ABAWD waiver status had to be left explicitly UNCONFIRMED after real access
  barriers blocked a primary-source check.
- **A homeless-only, currently-non-operational restaurant-meal provision** — legally live but with
  zero authorized restaurants statewide as of a September 17, 2025 Handbook update, and narrower in
  eligible population (homeless only, not elderly/disabled) than every other RMP state in this roster.
- **A genuinely faster expedited-service target** (5 calendar days per PA's own Handbook text) than
  the 7-day federal ceiling this roster's other states describe.
- **Two real, disclosed gaps found by this pass's adversarial refute step** — see Findings 3 and 4
  below.

## Sources

| Source | Access | Dated |
|---|---|---|
| PAH 512.1, General Policy (Categorical Eligibility) | direct `curl` http:// fetch | updated 3/13/2026 |
| PAH 540.1, General Policy (Resources) | direct `curl` http:// fetch | updated 3/13/2026 |
| PAH 540.3, Countable Resources; PAH 540.5, Excluded Resources | direct `curl` http:// fetch | updated 3/13/2026 |
| PAH 560 Appendix A, Tables of Maximum Allowable Deductions | direct `curl` http:// fetch | effective 10/1/2025, updated 9/9/2025 — see Finding 3, 4 |
| PAH 560.6, Child Support Deduction | direct `curl` http:// fetch | reissued 3/1/2012 |
| PAH 560.7, Homeless Shelter Deduction | direct `curl` http:// fetch | updated 9/30/2024 — see Finding 3 |
| PAH 536.1, General Policy (ABAWD); PAH 536.2, ABAWD Exemptions | direct `curl` http:// fetch | 536.1 updated 4/18/2024 |
| PAH 536 Appendix A, Current Geographical Areas Waived by FNS | direct `curl` http:// fetch | updated 9/3/2025 — see Finding 1 |
| PAH 503 Appendix B, Criminal History Desk Guide | direct `curl` http:// fetch | updated 3/11/2026 |
| PAH 503.3, Included and Excluded Items | direct `curl` http:// fetch | updated 3/11/2026 |
| PAH 511.2, Homeless Persons; PAH 511.24, Meal Providers for the Homeless | direct `curl` http:// fetch | revised 9/17/2025 — see Finding 2 |
| PAH 506.3, Determining Entitlement to Expedited Service | direct `curl` http:// fetch | updated 3/12/2016 |
| PAH 506.4, Time Frame for Issuing Benefits | direct `curl` http:// fetch | updated 3/12/2026 |
| PAH 571.1, General Policy (SAR) | direct `curl` http:// fetch | updated 2/16/2023 |
| PAH 575.2, Guidelines for Assigning Certification Periods | direct `curl` http:// fetch | updated 4/10/2026 |
| Pennsylvania DHS SNAP program pages (pa.gov) | WebFetch, https | fetched 2026-08-11 |
| USDA FNS Restaurant Meals Program state list | reused from this session's other state-pack fetches (WI/MN passes, same session) | fetched 2026-08-11 |

## Findings a maintainer must know

1. **Pennsylvania is confirmed STATEWIDE UNWAIVED for ABAWD as of September 1, 2025** — a rare case
   in this roster where the state's own Handbook states its current waiver status outright rather
   than requiring inference from a stale secondary source or an out-of-date federal list. Do not
   assume this has changed without re-checking PAH 536 Appendix A directly (see freshness.json).
2. **Pennsylvania's restaurant-meal provision is homeless-only and currently has zero live
   participants.** PAH 503.31 momentarily describes the provision using the familiar
   "homeless, elderly, or disabled" language, but PA's own OPERATIONAL rule (same section, next
   sentence) restricts it to homeless individuals only via a controlled PA 2SP document — and PAH
   511.2 (revised 9/17/2025) states plainly there are currently no authorized restaurants at all.
   Both narrowing facts are easy to miss if a reader stops at the first sentence of §503.31.
3. **A genuine, dated internal disagreement inside the Handbook itself.** PAH 560.7's narrative text
   ("the standard homeless shelter deduction of $190...") is dated "Updated September 30, 2024" and
   was NOT refreshed when PAH 560 Appendix A's dollar table was updated on September 9, 2025 to show
   $199 for the same deduction — the two sections of the same Handbook currently state different
   dollar figures for the identical benefit. This is disclosed in the sua-values supplement and in
   freshness.json rather than silently resolved by picking one number without comment.
4. **An unresolved, unexplained multi-year jump in one dollar figure.** The "Phone" standard
   deduction in PAH 560 Appendix A's historical table sits at $33-$34 every year from at least 2013
   through FFY25 (eff. 10/1/2024), then jumps to $107 for FFY26 (eff. 10/1/2025) — over a 3x
   increase in a single year, breaking the smooth year-over-year pattern every other figure in the
   same table shows. This pack could not find a DHS Bulletin, Operations Memo, or second source
   explaining the jump in the time available. Rather than silently repeating the $107 figure with
   unwarranted confidence, or discarding it as presumed error, this pack states it as what PA's
   current table shows while flagging the anomaly explicitly in both the supplement text and
   freshness.json — the same "disclosed gap over confident guess" discipline this roster's other
   2026-built packs (Minnesota's unconfirmed SUA, Oregon's unconfirmed SUA) already established.
5. **No widely-repeated FALSE secondary-source claim was found and corrected for Pennsylvania
   specifically** — unlike Illinois' ABAWD-waiver correction or Minnesota's drug-felony correction.
   General secondary sources checked during this pass (SNAP eligibility calculator sites, legal-aid
   summaries) already correctly describe Pennsylvania as running Expanded Categorical Eligibility at
   200% FPIG with no drug-felony ban — this pack's criminal-justice-disqualifications supplement
   documents the PRIMARY-SOURCE CONFIRMATION of that already-accurate secondary consensus, not a
   correction of an error. Flagged explicitly so a reviewer doesn't go looking for a correction that
   isn't there.
6. **`packages/snap-rules` has no Pennsylvania `StatePolicy` entry.** Consistent with the established
   per-state gating rule (`feedback_dashboard_snap_rules_parked` / this session's engine-vs-corpus
   closure note) — `packages/snap-rules` and `apps/dashboard` stay FULLY PARKED (ask before ANY work,
   every time) now that the 6-state engine-parity closure landed. This pack does not touch
   `packages/snap-rules` and does not request an unfreeze; a 7th-state engine build is explicitly
   out of scope here and would need its own separate go-ahead.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Handbook section text, checking
specifically for: claims inferred from a section title rather than body text; dollar figures not
traceable to a specific numbered subsection with its own issue-date stamp; and any
Pennsylvania-vs-federal contrast overclaimed as settled when the evidence was genuinely uncertain.
Concrete catches from this pass:

- The SUA supplement does NOT quote the $107 Phone figure without flagging it — the year-over-year
  jump from $34 broke this pass's own sanity check against every other figure in the same table,
  which moves smoothly. Disclosed as Finding 4 rather than silently repeated.
- The 560.7-vs-Appendix-A Homeless Shelter Deduction figures were checked against EACH OTHER, not
  just against the federal figure — the $9 discrepancy would have been invisible if only one section
  had been fetched. Disclosed as Finding 3.
- The expedited-service supplement does NOT assert PA's 5-day figure is definitely stricter than (as
  opposed to merely faster in practice than) the federal 7-day ceiling — the Handbook text was
  checked for an explicit "internal safety margin" framing and none was found, so the claim is stated
  as PA's own operational standard rather than as a settled legal-interpretation claim.
- The restaurant-meals supplement does NOT stop at PAH 503.31's first, broader-sounding sentence
  ("homeless, elderly, or disabled") — the narrower operational sentence immediately following it,
  and the separate zero-restaurants confirmation in PAH 511.2, were both checked and included before
  drafting, to avoid overclaiming Pennsylvania has an elderly/disabled-eligible RMP the way Arizona
  or Michigan do.
- The child-support "4.0 conversion" mechanic is explicitly NOT explained with invented arithmetic —
  the Handbook sections fetched for this pass state the existence of the conversion but not its
  exact formula, and this pack says so directly rather than guessing a plausible-sounding calculation.
