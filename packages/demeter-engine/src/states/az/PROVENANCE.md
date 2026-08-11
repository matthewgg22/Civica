# Arizona pack — provenance

**Created:** 2026-08-11 (Wave 2 continued — `docs/plans/mae-state-corpus-framework.md`; roster designates Arizona
"MED" ingestion cost with the note "Current-values page is directly fetchable" — a claim this pack tested and
found only PARTIALLY true; see "Access method" below).
**Method:** `des.az.gov` and the CNAP manual's real content host, `dbmefaapolicy.azdes.gov`, both sit behind a
Cloudflare bot-verification challenge. Confirmed blocked by TWO independent non-browser fetch approaches (plain
curl with multiple realistic browser user agents and full headers; the WebFetch tool, a completely separate
network path) before falling back to a real rendered browser (the Claude Browser tool), which passed the
Cloudflare challenge after a short wait and reached genuine CNAP content. Every fact in this pack traces to a
specific `dbmefaapolicy.azdes.gov` page reached this way, with its own live "last revised"/"effective" date.

## Access method — the part a future refresh job needs to know

1. `curl` (plain, and with a full realistic Chrome UA + Accept/Accept-Language/Accept-Encoding/Referer/
   Sec-Fetch-* headers) returns **HTTP 403** from both `des.az.gov` and `dbmefaapolicy.azdes.gov`.
2. `WebFetch` (a separate network path from this session's Bash tool) also returns **HTTP 403** from both hosts —
   ruling out "it's just this session's IP reputation on one path."
3. A real rendered browser (`preview_start` + `navigate`) hits Cloudflare's actual "Just a moment..." challenge
   page, which resolves automatically after a few seconds of real JS execution — confirming this is a genuine
   JS-challenge/bot-mitigation gate (matching Arizona's own site notice about requiring cookies/JavaScript), not a
   simple header check. Once through, `dbmefaapolicy.azdes.gov` renders a MadCap-Flare-style frameset: the visible
   page is a navigation shell, and the actual policy text loads inside a same-origin `<iframe>`. Content was
   extracted via `frame.contentDocument.body.innerText` in the rendered DOM — a raw `fetch()`/`curl` of the same
   URL returns only the navigation shell, not the content, even once past Cloudflare.
4. This means an automated October-refresh job for Arizona CANNOT use plain HTTP fetching at all — it needs a
   headless-browser step that (a) waits out the Cloudflare challenge and (b) reads the iframe's rendered DOM, not
   the top-level document. This is a materially different failure mode from the framework's documented 403-to-bots
   cases (mass.gov, hhs.texas.gov, policies.ncdhhs.gov) — those return real content to browser-header curl; Arizona
   does not, at any header combination tried.
5. The originally-flagged `https://des.az.gov/sites/default/files/media/SNAP-CAN-Program-Policy-Manual.pdf` lead
   also 403'd on every fetch attempt this session (both curl and WebFetch) — this pack did not end up needing it,
   since the actual CNAP manual (a superset covering general eligibility, not just the E&T "CAN" component) was
   reachable via the browser-navigation method above.

## Why Arizona matters to the schema

- **Arizona ENFORCES the federal drug-felony SNAP ban — a genuine, load-bearing contrast with this roster's other
  built states.** Illinois (305 ILCS 5/1-10(c)) and Nevada (NRS 422A.345) are both VERIFIED FULL OPT-OUTS. This
  pack found no Arizona opt-out statute; Arizona's own CNAP manual states plainly that a felony conviction for
  actual possession/use/distribution of a controlled substance, committed and convicted on or after 8/23/1996,
  disqualifies — with a real but CONDITIONAL removal pathway (sign a drug-testing agreement + meet one of five
  treatment/compliance conditions), not an unconditional restoration. This is the first state in this roster where
  the answer to "can I still get SNAP with a drug felony?" is genuinely "it depends, and here's the pathway" rather
  than a flat yes.
- **A flat 200% BBCE screen with NO conferring document** — unlike Illinois's Guide to Services, Michigan's DVPS,
  Georgia's TCOS, or Nevada's "This Is Your Copy" page (all TANF-funded informational brochures that are the
  actual legal conferral mechanism), Arizona's Expanded Categorical Eligibility is a pure income comparison.
- **Vehicles are excluded from the NA resource test entirely** — simpler than every other state built so far
  (Nevada's two-part FMV-disregard/equity test, the federal default's exemption list, etc.). Confirmed via a
  direct, unambiguous quote, not inferred.
- **A genuinely different certification-period shape**: 12-month default (not 6, like several other roster
  states), 24-month for elderly/disabled-only households with no earned income, 36-month for ESAP/AZSNAP
  participants, and a distinct 5-month Transitional Benefit Assistance category this pack hadn't seen elsewhere.
- **Size-banded SUA/LUA** ($323/$438 and $149/$201 by household-size band) — every other utility-allowance value
  seen in this roster so far is a single flat statewide figure regardless of household size.
- **An exact, dated fixed ABAWD clock** (01/01/2025–12/31/2027) — the same fact this pack could NOT confirm for
  Nevada, found here with a clean, unambiguous, dated quote plus the manual's own worked example.

## Sources

| Source | Access | Dated |
|---|---|---|
| CNAP Manual FAA2 (Application/Interview — expedited service, ABAWD, disqualifications), FAA4 (Financial Eligibility — resources, vehicles, lottery income), FAA5 (Work Registration/Program Determinations — categorical eligibility, deductions, approval periods, RMP, EBT), FAA6 (Case Maintenance — dollar tables, Simplified Reporting) | real rendered browser, Cloudflare-gated, iframe-DOM extraction (see Access method) | each page carries its own live "last revised"/"effective" date, individually cited in supplements.json |
| Arizona Revised Statutes (ARS) 46-215 | WebFetch, `azleg.gov` | current codified law |
| FNS national Restaurant Meals Program page | plain curl, `fns.usda.gov` (reused from the same fetch made for the Nevada pack this session — same page, same date) | "Page updated: August 07, 2026" |

## packages/snap-rules status

**No Arizona entry exists in `packages/snap-rules/src/constants/states.ts`** — confirmed by grepping the full
state list in that file (`CA, MA, TX, WA, GA, FL, IL, PA, OH, MI, KS, AK`; no `AZ`, no `NV`). Same situation as the
Nevada pack built earlier this session: nothing to cross-check a dated engine claim against, and no discrepancy to
find or file an issue for. `packages/snap-rules` remains untouched by this PR per the parked-package rule.

## Findings a maintainer must know

1. **Arizona is a drug-felony ENFORCEMENT state with a real removal pathway — the opposite structural finding from
   Illinois and Nevada.** See "Why Arizona matters to the schema" above; the full mechanics (expunged convictions
   still count, juvenile/tribal-court convictions don't, five removal conditions, parole excluded from removal)
   are in the `criminal-justice-disqualifications` supplement.
2. **Arizona's SUA/LUA ladder has an unresolved gap for a household with exactly ONE non-heating, non-telephone
   utility expense** (e.g. water-only). LUA requires TWO qualifying non-heat expenses; TUA requires telephone-only.
   This pack did not find a rule covering the one-non-heat-utility case and explicitly declines to guess which
   tier (if any) such a household falls into — flagged in the supplement text and left unresolved rather than
   invented. This may be the SAME kind of "undermodeled tier" gap Illinois's Single Utility Standard and Nevada's
   IUA exist specifically to close, or Arizona may simply not offer a utility allowance in that scenario; only a
   direct re-fetch of a currently-missing page (if one exists) could resolve this.
3. **A "Legal Authorities" citation is not automatically evidence for the claim it's attached to.** The
   Disqualified Participants page cites ARS 46-215 alongside the drug-felony provision. Fetched directly, ARS
   46-215 covers general welfare-fraud disqualification procedures and does NOT mention controlled substances —
   it is very likely cited on that page for the disqualification-TRACKING mechanism broadly, not the drug-felony
   criterion specifically. The pack does not attribute the drug ban to this statute.
4. **Arizona's 200% FPL table (categorical eligibility + Simplified Reporting) runs on a different effective-date
   cycle (3/1/2026) than every other Arizona dollar figure in this pack (10/1/2025 or 10/1/2024)** — confirmed
   directly from each page's own "effective" line, not assumed to be a single unified COLA cycle the way most
   other states in this roster present it.

## Refresh triggers

- **Oct 2026 COLA** → successor pages to every 10/1/2025-effective CNAP dollar table (income standards, standard
  deduction, SUA/LUA/TUA, shelter cap, homeless deduction) — freshness entry.
- **Arizona's separate 200% FPL cycle** → re-check its own successor date independently of the October COLA.
- **ABAWD waived-area list** → re-verify against a current CNAP ABAWD Exemptions fetch or the FNS waiver status
  page; this list changes on FNS approval cycles independent of any Civica release schedule.
- **12/31/2027** → Arizona's fixed ABAWD 3-year window rolls; new window begins 1/1/2028 — freshness entry.
- New CNAP revisions touching FAA2.A.09 (disqualifications), FAA5.I.01.B (categorical eligibility), FAA2.M.09
  series (ABAWD), or FAA6.J series (dollar tables) → update the affected supplement.

## Verification log

- **Draft-time source discipline:** every dollar figure and eligibility rule traces to its own CNAP page, reached
  through the browser-navigation method documented above — never a curated secondary extract. The Restaurant Meals
  Program state-list cross-check reused an already-fetched, already-dated FNS page from the same session (not
  re-fetched, and not stale — same date, same source).
- **Self-conducted adversarial refute pass (2026-08-11, no Agent/Workflow spawned):** re-read every claim in
  `supplements.json` against the originally captured CNAP page text before committing. 1 correction found and
  applied, plus 1 pre-draft catch worth logging even though it never made it into a committed error:
  1. **`sua-values` fabricated a resolution to a gap that doesn't exist in the source.** First draft claimed a
     household with exactly one non-heating, non-telephone utility expense "still qualifies for the FULL LUA" and
     framed this as a "more generous" design than other states' undermodeled tiers. Re-reading the literal source
     text — "The budgetary unit is eligible for LUA when obligated to pay AT LEAST TWO non-heating or
     non-cooling utility expenses" — shows this claim was simply wrong: LUA requires two qualifying expenses, not
     one. Corrected to state the gap explicitly and decline to guess which tier (if any) applies, rather than
     inventing a resolution.
  2. **The ARS 46-215 misattribution was caught before drafting, not after.** While reading the "Legal
     Authorities" list on the Disqualified Participants page, an initial instinct was to describe ARS 46-215 as
     Arizona's version of a drug-felony statute (parallel to NRS 422A.345 or 305 ILCS 5/1-10(c)). Before writing
     that into the corpus, the statute was fetched directly (WebFetch, `azleg.gov`) and found to address general
     welfare-fraud disqualification, not controlled substances — the claim was never drafted into `supplements.json`
     in the first place. Logged here for the same reason the framework's fetch-discipline rule exists: a citation
     appearing on the right page is not the same as that citation supporting the specific claim next to it.
  No fabricated citations were found, and no claim was drawn from a section title without its body text having
  been fetched — both items above are a claim invented to fill a perceived gap (caught by re-reading the literal
  source) and a citation-adjacency assumption (caught by insisting on the primary statute text before drafting),
  matching the same failure-mode categories the framework's #8 gate targets. Structural tests, the retrieval-recall
  probe, and the frontdoor eval were re-run clean after the one committed fix (see the PR description for the
  final numbers).
