# Hawaii pack — provenance

**Created:** 2026-08-12. Hawaii is a genuine BLANK SLATE in this roster — like Nebraska's,
Connecticut's, Utah's, Iowa's, and Arkansas's prior builds, Hawaii has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking against
an existing engine constant was possible or attempted; this pack's findings stand entirely on its
own primary-source research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content
layer — and does not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`,
both of which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

Hawaii was built in a parallel round alongside Idaho, West Virginia, New Hampshire, and Maine — five
separate agents building five states in the same window, each on its own branch, expecting later
merge-conflict resolution on the shared registration files (see Registration section below).

## Method

Direct `curl` fetch (browser User-Agent) of Hawaii DHS BESSD's current SNAP consumer page (HTML,
converted directly), Hawaii Administrative Rules Title 17 Chapter 663 (Special SNAP Households) and
Chapter 676 (Income) PDFs — the Chapter 663 PDF required local `pdftotext -layout` conversion after
WebFetch's markdown converter returned a PDF-structure syntax error — and USDA FNA's FY2026 Maximum
Allotments and Deductions national table, ABAWD Time Limit Waivers FY2025-2029 state-response index,
SNAP Restaurant Meals Program state-operator list, and Hawaii-specific Food Restriction Waiver page.
Also fetched Hawaii DHS's own OBBBA/ABAWD FAQ page (posted Oct 9, 2025) directly. Haw. Rev. Stat.
§ 346-53.3's exact text is corroborated via WebSearch/Justia-excerpt only — the one citation in this
pack with an unresolved access barrier, disclosed below and in `freshness.json`.

## Finding 0 — genuine tooling-artifact vs. genuine access-barrier split: humanservices.hawaii.gov and
fna.usda.gov fetched cleanly; law.justia.com and capitol.hawaii.gov did not, and this pack could not
resolve that one

Unlike this roster's now-familiar pattern where an apparent access barrier turns out to be a tooling
artifact resolvable with a browser User-Agent, plain HTTP, or the Wayback Machine, this pack found a
genuine SPLIT: `humanservices.hawaii.gov` and `fna.usda.gov` (formerly `fns.usda.gov`) both returned
clean HTTP 200 to every direct curl attempt this pack made, including PDF documents that WebFetch's
built-in markdown converter could not parse directly (the HAR-17-663 PDF returned an "Illegal
character in hex string" / "Couldn't find trailer dictionary" syntax error through WebFetch — a
tooling-layer limitation on WebFetch's PDF parser specifically, resolved by fetching directly with
`curl` and converting locally with `pdftotext -layout`). But `law.justia.com` and
`capitol.hawaii.gov` (the Hawaii Legislature's own statute-text host) BOTH returned HTTP 403 to every
attempt this pack made — browser User-Agent curl, plain `http://` instead of `https://`, and a
Wayback Machine attempt that was itself blocked by an unrelated `archive.org` rate limit (`429 Too
Many Requests`) rather than resolving the underlying 403. This pack treats this as a genuine,
unresolved access barrier for exactly one citation (Haw. Rev. Stat. § 346-53.3's exact text) rather
than assuming, without re-testing, that it must also be a tooling artifact — the statute's text is
instead corroborated via a WebSearch/Justia-excerpt synthesis, disclosed explicitly rather than
presented with the same confidence as this pack's directly-fetched findings.

## Finding 1 (flagship, minority-position confirmation) — Hawaii's BBCE waives the NET income test
entirely, not merely the asset test — a more aggressive BBCE implementation than the typical shape

Hawaii DHS's own current SNAP consumer page states directly: "As of February 1, 2025, under BBCE
households are also not subject to the net income test." This pack reads this as a genuine minority
position worth confirming with more confidence than a single source alone would ordinarily justify,
since it directly quotes DHS's own current page rather than relying on an aggregator's paraphrase.
Most BBCE states this roster has built use the elevated gross-income ceiling as an ADDITIONAL
screening step before the household still must clear the 100% FPL net test after deductions —
Hawaii's own text states plainly that BBCE households clear the elevated 200% FPL gross screen AND
skip the net test that would otherwise apply, leaving deductions to matter only for the benefit-amount
calculation, not as a second eligibility gate.

## Finding 2 (flagship, secondary-source correction) — Hawaii's drug-felony ban is CONDITIONAL on
treatment compliance, not an unconditional full opt-out several secondary sources describe

This pack found and corrected a genuine secondary-source error: several aggregator sources describe
Hawaii as having "fully opted out" of the federal SNAP drug-felony ban with "no additional
requirements." This pack traced Haw. Rev. Stat. § 346-53.3's own text (via the WebSearch/Justia-
excerpt corroboration described in Finding 0) and found the carve-out is conditional: the federal
ban does not apply in Hawaii "to persons who are complying with treatment or who have not refused or
failed to comply with treatment" — meaning a person who HAS refused or failed treatment compliance
remains subject to the federal ban. This is a genuine correction, not a restatement of the obvious:
the "fully opted out, no conditions" framing this pack found in circulation would give an applicant
who has refused treatment compliance a false sense of eligibility.

## Finding 3 (flagship, structural) — despite a favorable noncontiguous-state waiver threshold, Hawaii
currently has NO active statewide ABAWD waiver anywhere in the islands

Federal law gives Alaska and Hawaii a more favorable ABAWD area-waiver threshold than the mainland's
flat unemployment-rate floor (1.5x the national average, rather than a flat 10% floor). This pack
fetched USDA FNA's own current ABAWD Time Limit Waivers FY2025-2029 state-response index directly and
found Hawaii ABSENT from the list of states that submitted a waiver request for FY2025 or FY2026 —
Alaska, using the same favorable threshold, appears on the same list with active FY2025 and FY2026
waiver responses. This pack reads Hawaii's absence as a genuine, state-specific fact distinct from
the favorable threshold Hawaii could invoke if it chose to request a waiver, and flags it for
quarterly re-verification since FNA's own page states the waiver index updates on that cadence.

## Finding 4 (flagship, secondary-source correction) — Hawaii does NOT currently operate a Restaurant
Meals Program, contrary to a secondary source this pack found listing it as an RMP state

This pack found and corrected a stale/wrong secondary-source claim naming Hawaii among RMP states
("Arizona, California, Florida, Hawaii, Michigan and Rhode Island"). USDA FNA's own current RMP
state-operator page (fetched directly, page updated August 7, 2026 — the same window as this pack's
research) lists nine states/jurisdictions with named RMP contacts: Arizona, Maryland, New York,
California, Massachusetts, Rhode Island, Illinois (Cook and Franklin Counties only), Michigan, and
Virginia. Hawaii is absent — and so is Florida, meaning the secondary source this pack found was
wrong on at least two counts, not merely one stale data point.

## Finding 5 (flagship, time-sensitive) — Hawaii's SNAP soft-drink purchase restriction is approved
but its implementation date has been pushed to April 1, 2027 — not yet in effect as of this pack's
fetch date

USDA approved Hawaii's request (submitted Oct. 10, 2025) to run a two-year demonstration project
excluding "soft drinks" specifically from SNAP-eligible purchases, originally effective August 1,
2026. This pack found a subsequent status update on USDA's own page: as of June 15, 2026, USDA
approved Hawaii's request to push the implementation date to April 1, 2027 — meaning that as of this
pack's August 12, 2026 fetch date, the restriction is approved but genuinely not yet in effect
anywhere in Hawaii. This pack's operative answer discloses this explicitly rather than stating a flat
"no, you cannot buy soda" answer that would be premature by several months.

## Finding 6 — user-flagged: Hawaii's COLA-adjusted maximum allotment schedule, confirmed directly
from USDA's own national table, with the sourcing distinction disclosed

The task instructions specifically asked this pack to confirm whether/how Hawaii's higher
cost-of-living-adjusted maximum allotment schedule interacts with any federal-benefit-calculation
citation, and to disclose if the pack could not independently verify the exact figures. This pack
CAN independently verify the exact figures — USDA FNA's own current FY2026 Maximum Allotments and
Deductions national table includes a Hawaii-specific column (household-of-4 maximum allotment
$1,689, versus $994 for the 48 contiguous states and D.C.) — but discloses explicitly that these
figures are drawn from USDA's national publication rather than a Hawaii-DHS-republished document,
since this pack did not find Hawaii DHS's own consumer page independently restating these exact
dollar figures in a form this pack could cross-check them against. The underlying benefit-calculation
MECHANISM (net income × 0.3, subtracted from the maximum allotment for household size, per 7 CFR §
273.10) is unchanged and identical to every other state; only the maximum-allotment INPUT to that
formula is Hawaii-specific and COLA-adjusted, structurally identical in kind to Alaska's own
COLA-adjusted schedule.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed
to check against)

Hawaii has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Hawaii (out of scope for this task, requiring its
own separate, explicit go-ahead per the standing park rule) should treat this pack's citations as a
starting point, not a final answer, and should specifically re-verify Haw. Rev. Stat. § 346-53.3's
exact text against a working `capitol.hawaii.gov` fetch (Finding 2, this pack's one unresolved
access barrier), the food-restriction-waiver implementation date (Finding 5, the most volatile fact
in this pack), and the individual SUA dollar amounts (structurally confirmed via HAR §17-676-73 but
not dollar-figure-confirmed, see `freshness.json`) before hardcoding Hawaii's parameters into engine
constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Hawaii text, checking
specifically for: claims inferred from a secondary source rather than a primary document; dollar
figures not traceable to a specific dated source; and any Hawaii-vs-common-assumption contrast
overclaimed as settled when the underlying evidence was genuinely ambiguous or access-barrier-limited.
Concrete catches from this pass:

- The net-income-test-waiver finding (Finding 1) is a direct quote from Hawaii DHS's own page, not
  this pack's own inference from the BBCE percentage alone — quoted verbatim specifically because a
  reader familiar with this roster's OTHER BBCE states' typical shape (elevated gross ceiling, net
  test still applies) could easily assume Hawaii works the same way without reading DHS's own
  February 2025 update sentence.
- The drug-felony correction (Finding 2) is explicitly flagged as resting on WebSearch/Justia-excerpt
  corroboration rather than a directly-fetched primary document — this pack did NOT silently treat a
  secondary-source quote of the statute's text as equivalent to a primary-source fetch, and disclosed
  the access barrier (HTTP 403 on both law.justia.com and capitol.hawaii.gov) explicitly in
  `pack.json`'s verification block, the supplement's own text, and `freshness.json`.
- The ABAWD-waiver-absence finding (Finding 3) was checked against the DISTINCTION between Hawaii's
  favorable THRESHOLD (which exists in federal statute regardless of whether Hawaii uses it) and
  Hawaii's actual current WAIVER STATUS (absent from FNA's own list) — this pack did not conflate
  "Hawaii could get a waiver more easily" with "Hawaii has a waiver."
- The RMP correction (Finding 4) does not merely say "this pack found no mention of Hawaii" — it
  names the specific wrong secondary-source claim it found (including Florida, also wrong) and cites
  USDA's own current nine-state list by name, giving a reader a concrete basis to trust the
  correction over the wrong aggregator claim.
- The food-restriction-waiver finding (Finding 5) does not state a flat "Hawaii doesn't restrict SNAP
  purchases" or "Hawaii restricts soda" answer — it discloses the approved-but-not-yet-effective
  status and the specific date (April 1, 2027) explicitly, plus the fact that this date has ALREADY
  moved once, as a signal that a further shift is plausible.
- The max-allotment-cola finding (Finding 6) does not claim Hawaii DHS republishes these exact
  figures — it explicitly discloses that USDA's national table is the source, distinct from most of
  this pack's other findings which are sourced from Hawaii-specific DHS/HAR documents, exactly per
  the task's own instruction to disclose if the pack cannot independently verify a Hawaii-specific
  republication of the adjusted figures.
- The SUA structural finding was checked against the temptation to assume Hawaii's granular
  per-utility-type structure implies specific dollar amounts this pack could estimate or infer from
  the national SUA table it attempted (but could not access — see Sources table) — this pack
  disclosed the missing dollar figures explicitly rather than estimating them from an unrelated
  national aggregate.

## Sources

| Source | Access | Dated |
|---|---|---|
| Hawaii DHS BESSD, SNAP consumer page (program identity, application process, income tables, BBCE description) | direct curl fetch (browser UA), clean HTTP 200 | effective 10/1/2025, fetched 2026-08-12 |
| Hawaii Administrative Rules Title 17, Chapter 676 § 17-676-73 (Standard Utility Allowance) | direct curl fetch (browser UA), clean HTTP 200, converted with `pdftotext -layout` | fetched 2026-08-12 |
| Hawaii Administrative Rules Title 17, Chapter 663 (Special SNAP Households) | direct curl fetch (browser UA), clean HTTP 200, converted with `pdftotext -layout` after WebFetch's markdown converter returned a PDF-structure syntax error | fetched 2026-08-12 |
| USDA FNA, SNAP Fiscal Year 2026 Maximum Allotments and Deductions (national table, Hawaii-specific column) | direct curl fetch (browser UA), clean HTTP 200 | effective 10/1/2025, fetched 2026-08-12 |
| USDA FNA, ABAWD Time Limit Waivers FY2025-2029 state-response index | direct curl fetch (browser UA), clean HTTP 200 | fetched 2026-08-12 (index updates quarterly per FNA's own page) |
| USDA FNA, SNAP Restaurant Meals Program state-operator list | direct curl fetch (browser UA), clean HTTP 200 | page updated 8/7/2026, fetched 2026-08-12 |
| USDA FNA, Hawaii SNAP Food Restriction Waiver page (approval letter + implementation-date status update) | direct curl fetch (browser UA), clean HTTP 200 | approval letter dated ~Dec 2025, status update 6/15/2026, fetched 2026-08-12 |
| Hawaii DHS, "Changes to Able-Bodied Adult Work Requirements for SNAP – FAQs" | direct curl fetch (browser UA), clean HTTP 200 | posted 10/9/2025, fetched 2026-08-12 |
| Haw. Rev. Stat. § 346-53.3 | WebSearch/Justia-excerpt corroboration only — both law.justia.com and capitol.hawaii.gov returned HTTP 403 to every direct-fetch attempt (browser UA, plain HTTP, and a rate-limited Wayback Machine attempt) | statute unchanged since a 1999 amendment per the excerpt found |
| Propel EBT Hawaii guide; aggregator SNAP-recertification guides (Civil Beat reporting on SB961) | WebSearch corroboration only | certification-period structure and SB961's failure to pass, both disclosed as lower-confidence findings |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (HI guide questions), `eval/answer-eval.ts` (HI_GOLD, spread into
ALL_GOLD). Hawaii is deliberately NOT added to any `engine-citations.ts` per-state constant map —
Hawaii has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("HI",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build
adds a Hawaii policy — this matches the precedent already set by Nebraska's, North Carolina's,
Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's, Colorado's, South
Carolina's, Alabama's, Louisiana's, Kentucky's, Oklahoma's, Connecticut's, Utah's, Iowa's, Arkansas's,
Mississippi's, Kansas's, and New Mexico's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Hawaii `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.

**Parallel-round merge conflict:** Hawaii was built in the same round as Idaho, West Virginia, New
Hampshire, and Maine (five separate agents on five separate branches, same window). All five states
register in the same four shared files (`states/index.ts`, `packs.ts`,
`apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`). The rule this pack follows for any
resulting merge conflict: always COMBINE every state's additions (StateCode union members, REGISTRY
entries, QUESTIONS entries, and `_GOLD` arrays spread into the aggregate export), never drop another
state's entry to resolve a conflict — the merge-conflict resolution itself is handled separately from
this pack's own build.
