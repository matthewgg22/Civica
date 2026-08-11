# Wisconsin pack — provenance

**Created:** 2026-08-11 (Wave 3 — `docs/plans/mae-state-corpus-framework.md` §7 picks Wisconsin first
among the two remaining county-administered states specifically because "its versioned handbook is the
best supersession-tracking teacher in the roster" — every FoodShare Wisconsin Policy Handbook section
carries its own per-release history page, e.g. `.../fsh/history/25-03/25-03_<section>.htm`, a genuinely
different provenance-tracking affordance than any other state built so far.).

**Method:** direct WebFetch of the FoodShare Wisconsin Policy Handbook at `emhandbooks.wisconsin.gov/fsh`
— mostly clean HTML, a real contrast with Oregon's PDF-only host from the prior pack. Every dollar figure
was cross-checked against the handbook's own numbered dollar-table sections (8.1.1 income/asset limits,
8.1.3 deductions) rather than accepted from a secondary aggregator site, continuing the discipline the
Oregon pack established after its own AI-summarization mishaps. USDA FNA's Restaurant Meals Program page
was fetched via direct `curl` (not WebFetch, which timed out twice on this exact URL — same failure mode
Oregon hit) to resolve a real conflict in secondary sources.

## Why Wisconsin matters to the schema

- **The best-versioned source in the roster — a real supersession-tracking test case.** Every section has
  its own numbered release history; a future refresh pass can diff exact section text across releases
  instead of re-reading the whole handbook from scratch, something no other state in this roster supports
  as cleanly.
- **A genuinely three-tier county administration model**, distinct from both "every county for itself"
  (CA, NY) and "one state agency" (most of this roster): 71 counties MUST form 11 multi-county Income
  Maintenance consortia, while Milwaukee County alone is served by a directly state-staffed unit (MilES) —
  neither a county agency nor a consortium.
- **EBD households with gross income over 200% FPL face NO gross income limit at all** (only a 100% net
  test plus an EBD asset test) — a genuinely different BBCE shape from Oregon's or Nevada's flat screens,
  where BBCE simply raises the SAME limit for everyone.
- **A 7-tier utility allowance ladder** (HSUA/LUA/EUA/WUA/FUA/PUA/TUA) — the most granular in this roster;
  every other state built so far collapses water, cooking fuel, and trash into a single "limited" bucket.
- **A hard 5-year sunset on the drug-felony provision, with a ONE-TIME (not recurring) drug test** — a
  fourth distinct shape for this roster, alongside IL/NV's full opt-outs, FL/AZ's modified bans, and OR's
  opt-out-with-narrow-suspension-path.
- **A genuinely significant live finding**, not a hypothetical one — see below.

## Sources

| Source | Access | Dated |
|---|---|---|
| FSH 4.2.1, Categorical and Broad-Based Categorical Eligibility | WebFetch, emhandbooks.wisconsin.gov | current (undated release stamp on this fetch) |
| FSH 8.1.1, Income Limits / Asset Limits (incl. 8.1.1.3) | WebFetch, emhandbooks.wisconsin.gov | effective 10/1/2025-9/30/2026 |
| FSH 8.1.3, Deductions (dollar tables) | WebFetch, emhandbooks.wisconsin.gov | effective 10/1/2025 |
| FSH 3.17.1, FoodShare Work Requirements for ABAWDs | WebFetch, emhandbooks.wisconsin.gov | Release 26-01, effective 10/1/2025 — see Finding 1 |
| FSH 3.20.1, Drug Related Felonies | WebSearch-corroborated secondary summary, not independently WebFetch-verified this pass | not independently dated this pass — see Finding 2 |
| FSH 4.6.5, Support Payment Deductions | WebSearch-corroborated secondary summary | not independently dated this pass — see Finding 2 |
| FSH 2.1.4, Expedited Service at Application | WebSearch-corroborated secondary summary | not independently dated this pass — see Finding 2 |
| FSH 2.2.1, Certification Periods | WebFetch, emhandbooks.wisconsin.gov | current (undated release stamp on this fetch) |
| USDA FNA Restaurant Meals Program state list | direct `curl` (WebFetch timed out twice) | fetched 2026-08-11 |
| WI Legislative Fiscal Bureau, OBBBA impact memo | WebSearch snippet, docs.legis.wisconsin.gov | 2025-07-28 |

## Findings a maintainer must know

1. **Wisconsin's own current handbook has NOT been updated for the federal OBBBA ABAWD age expansion —
   this is the single most important finding in this pack.** FSH 3.17.1.1 (Release 26-01, effective
   10/1/2025) still reads "from October 1, 2024 and going forward, the age range is 18 to 54 years old,"
   citing the 2023 Fiscal Responsibility Act. It makes NO mention of OBBBA (enacted 7/4/2025), which raised
   the national ABAWD age ceiling to 64 and which every OTHER state's pack in this roster already reflects.
   Wisconsin's own Legislative Fiscal Bureau documented a DHS rulemaking deadline of June 1, 2026 to
   implement this change — a deadline already past as of this pack's build date (2026-08-11). This pack
   does NOT repeat the stale 18-54 figure as Mae's answer for Wisconsin; the abawd-work-requirement
   supplement explicitly instructs Mae to defer to the federal 18-64 band, which controls regardless of
   what a lagging state handbook page says. The freshness.json entry is a forward-looking recheck date
   (next likely handbook release, Oct 2026), not a claim that this conflict itself has an expiration —
   `pack-freshness.test.ts` fails the build on any ALREADY-past "expires" date by design, so an
   already-past deadline could not be encoded directly; the load-bearing warning lives in the supplement
   text and here instead. A maintainer re-running this pack's build should re-fetch FSH 3.17.1 and confirm
   whether a newer release has finally caught up.
2. **Three sections were drafted from WebSearch-corroborated secondary summaries, not independently
   WebFetched and read directly this pass** — FSH 3.20.1 (drug felonies), FSH 4.6.5 (child support), and
   FSH 2.1.4 (expedited service). Given the Oregon pack's demonstrated failure mode for exactly this
   pattern (AI-summarized fetches producing wrong dollar figures), a maintainer should re-pull these three
   sections directly via WebFetch or curl before treating their citations as fully load-bearing — though
   none of the three carries a dollar figure this pack could not independently sanity-check against the
   federal-standard shape every other state in this roster already confirms (expedited: $150/$100/7-day;
   child support: ordinary deduction, not exclusion).
3. **A real secondary-source conflict on the Restaurant Meals Program, resolved by going to the primary
   federal list directly.** Multiple secondary aggregator sites claimed Wisconsin operates an RMP for
   elderly/disabled/homeless recipients. A direct `curl` fetch of USDA FNA's own "States that Operate a
   Restaurant Meals Program" list (WebFetch timed out twice on this URL, requiring the same curl fallback
   Oregon's pack needed) does NOT include Wisconsin. The likely source of the secondary-source error: a
   genuinely different FoodShare provision — paying for prepared meals at group meal sites, shelters, or
   via Meals-on-Wheels — that is not the federal Restaurant Meals Program (an individual buying a
   commercial restaurant meal directly with a QUEST card). The supplement text explicitly distinguishes
   these two provisions to prevent Mae from conflating them.
4. **Asset limits could not be fetched at their originally-guessed URL** (`8.1.1.2.htm` / `8.1.1.3.htm`
   both 404'd) — the actual dollar figures live as anchored subsections inside the parent `8.1.1.htm` page,
   not as separate URLs. Worth remembering for a future WI refresh: FSH's numbered-subsection citations
   don't always map 1:1 to separate URLs the way Florida's or Illinois' manuals do.
5. **`packages/snap-rules` has no Wisconsin `StatePolicy` entry.** Consistent with every state built this
   session that lacked pre-existing engine constants (NV, AZ, OR) — a pre-existing authoring gap, not a
   finding from this pack. No new issue filed since the pattern is already tracked (issues #719, #720).

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched source text, specifically checking for
claims inferred from a section title rather than body text, dollar figures not traceable to a specific
subsection, and any state-vs-federal contrast overclaimed as settled when the evidence was genuinely mixed.
Two things caught and corrected before commit:

- An earlier WebSearch result claimed a "$200 unverified medical expense fallback" for Wisconsin. A direct
  WebFetch of FSH 4.6.4/8.1.3 found no such provision. Rather than assert it exists (or silently drop the
  possibility), the medical-deduction supplement explicitly names the claim, states it could not be
  confirmed, and falls back to describing the standard verification-postponement pattern this roster's
  other states use — disclosed uncertainty, not a guess presented as fact.
- The RMP finding (Finding 3 above) started from secondary sources asserting Wisconsin DOES operate an
  RMP. Before drafting the supplement, this was checked directly against USDA's own list rather than
  accepted at face value — the same discipline the FL pack established for RMP findings, applied here to
  catch the same failure mode in the OPPOSITE direction (secondary sources over-claiming a program exists,
  rather than under-claiming one doesn't).
