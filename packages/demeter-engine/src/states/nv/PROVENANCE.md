# Nevada pack — provenance

**Created:** 2026-08-11 (Wave 2 continued — `docs/plans/mae-state-corpus-framework.md`; roster designates Nevada
"MED" ingestion cost, "E&P Manual chapter PDFs w/ MTL revision stamps," and flags the DWSS→DSS agency rename and
unstable dated-filename URLs as the main hazards).
**Method:** direct fetch of ~10 DSS Eligibility and Payments (E&P) Manual chapter PDFs from `dss.nv.gov` (plain
curl and browser-header curl — `siteassets/dwss.nv.gov/...` static paths, no host blocking observed) →
`pdftotext -layout` extraction → cross-read against the Nevada Legislature's own codified NRS text (leg.state.nv.us,
plain curl, independently re-verified after a secondary source described conflicting statutory language), a live
FNS ABAWD waiver-response letter, and the FNS national Restaurant Meals Program page → draft → adversarial
refute pass.

## Why Nevada matters to the schema

- **A flat 200% BBCE conferred through paperwork every applicant already receives.** Nevada's Expanded Categorical
  Eligibility (ECE) is triggered by the "This Is Your Copy" page of the Application for Assistance — a TANF-funded
  informational brochure about a teen-pregnancy-prevention program (STARS) — the same conferral-vehicle family as
  Illinois's Guide to Services, Michigan's DVPS, and Georgia's TCOS, but functionally universal since every applicant
  gets the page as standard paperwork. `bbce_threshold_pct: 200` (flat, not tiered) puts Nevada alongside CA/WA/MI
  rather than IL's two-tier or GA's 130%-asset-only structure.
- **A vehicle rule with a genuine two-part test.** Non-exempt vehicles are counted at the GREATER of (a) fair market
  value minus a $4,650 disregard or (b) equity value — a specific, dated mechanism this pack initially mis-described
  in a first draft (see Verification log, correction #1) before re-reading the source's two-column table correctly.
- **A real production absence, not a gap: no engine constants and no Restaurant Meals Program.** Unlike Illinois or
  Michigan, Nevada is NOT in `packages/snap-rules/src/constants/states.ts` at all — there was nothing to cross-check
  or find a discrepancy in (see "packages/snap-rules status" below). Nevada also does not operate a Restaurant Meals
  Program, confirmed against FNS's own national RMP page rather than assumed from its absence in a search result.
- **A drug-felony finding that required going past a misleading secondary source.** An initial web search described
  Nevada's opt-out as conditioned on substance-abuse-treatment-program compliance. The actual, current statute
  (NRS 422A.345, independently fetched from leg.state.nv.us) has NO such condition — that language was removed by a
  2021 amendment (ch. 73, AB138). See Verification log.

## Sources

| Source | Access | Dated |
|---|---|---|
| E&P Manual Part A: A-100 (Application Processing — categorical eligibility, expedited service), A-500 (Resources), A-600 (Budgeting — deductions, utility allowance), A-700 (Income), A-1800 (Case Disposition — certification periods) | plain curl, static PDF | MTL 08/26, MTL 06/24, MTL 10/25, MTL 09/26, MTL 10/26 respectively (see authorities.json) |
| E&P Manual Part B: B-400 (Specialized Households — ABAWD B-470/472/473), B-600 (Changes — Simplified Reporting, the "10\*10\*13 rule"), B-900 (Program Violations/Sanctions — fleeing felon, parole/probation, certain felonies, SLGW), B-100 (Processing Time Limits) | plain curl, static PDF | MTL 11/26, MTL 11/25, MTL 13/26, MTL 07/26 respectively |
| E&P Manual Part C: C-200 (SNAP Charts/Tables — income standards, standard deduction, SUA/LUA/IUA/TUA, shelter cap, homeless deduction) | plain curl, static PDF | MTL 21/25 (18 Nov 2025), FFY26 COLA cycle |
| NRS 422A.345 (drug-felony opt-out) and the surrounding NRS 422A chapter text | plain curl, `leg.state.nv.us/nrs/NRS-422A.html` (Windows-1252 HTML, `iconv`-decoded) | current codified law, amendment history printed inline (2005 22nd Special Session ch.12; 2021 ch.73) |
| FNS ABAWD waiver-response letter, Nevada, Initial — Partial Approval | plain curl, `fns-prod.azureedge.us` | dated 03/14/2025; approval window 02/01/2025–01/31/2026 |
| FNS national Restaurant Meals Program page | plain curl, `fns.usda.gov` | "Page updated: August 07, 2026" — fetched same week |
| DSS "About Us" and "Electronic Benefits" pages | plain curl, `dss.nv.gov` | site footer "Last updated 04/20/2026" / undated (EBT page) |

## packages/snap-rules status

**No Nevada entry exists in `packages/snap-rules/src/constants/states.ts`** — confirmed by grepping the full state
list in that file (`CA, MA, TX, WA, GA, FL, IL, PA, OH, MI, KS, AK`; no `NV`). There was therefore nothing to
cross-check a dated claim against and no discrepancy to find or file an issue for — a genuinely different outcome
from the Illinois and Michigan passes, which each surfaced a real stale engine constant. This is worth a human's
attention as its own finding: Nevada's SNAP dollar math has no engine-side implementation at all yet, only this
corpus pack. `packages/snap-rules` remains untouched by this PR per the parked-package rule.

## Findings a maintainer must know

1. **The vehicle valuation rule has a $4,650 fair-market-value disregard most states' manuals no longer print.**
   Nevada evaluates a non-exempt vehicle two ways — FMV minus $4,650, or equity value — and charges the SNAP
   household the GREATER of the two. The manual's own worked example (FMV $5,000, $2,000 owed, so $3,000 equity;
   FMV test = $5,000 − $4,650 = $350; equity test = $3,000; charged amount = $3,000) is the only way to correctly
   parse a two-column table that reads as contradictory at a glance — see the refute-pass correction below.
2. **The current ABAWD waiver picture is a "before/after" snapshot taken mid-transition.** Nevada's statewide
   ABAWD waiver (02/01/2025–01/31/2026, itself a 12-month partial approval of a requested 24-month extension) had
   ALREADY EXPIRED by this pack's build date (2026-08-11) and was not statewide-renewed. The E&P Manual's own text
   (MTL 11/26, dated 09 July 2026) already reflects the narrower post-expiration waived-area list (specific
   tribal/reservation areas + Mineral County, effective 02/01/2026) — this pack captured the CURRENT state, not the
   now-expired statewide waiver, and flags both dates in `freshness.json`.
3. **Nevada's own manual text ties current ABAWD discretionary-exemption unavailability to the statewide waiver
   "being in place"** — worded in a way that reads oddly once you know the statewide waiver has since ended. Quoted
   verbatim rather than resolved or reworded, since this pack cannot determine whether that's a drafting lag in the
   MTL 11/26 text or an intentional carry-forward; flagged in `freshness.json` for re-verification rather than
   silently corrected.
4. **The exact calendar dates of Nevada's fixed 36-month ABAWD period were not found.** Unlike Washington
   (1/1/24–12/31/26) or Michigan (1/1/25–12/31/27), Nevada's E&P Manual confirms it uses ONE fixed statewide
   calendar (not individual rolling clocks) but never states the calendar's start/end dates in any of the sources
   fetched (B-470, B-472, B-473, or the public ABAWD partner toolkit). Left unconfirmed in `supplements.json` and
   `freshness.json` rather than guessed, per the corpus's own null-over-guess invariant (#436).
5. **FNS's own national RMP page (fetched fresh, updated same week as this pack) still lists Illinois as
   "Cook and Franklin Counties Only"** — contradicting Illinois's own manual (MR #25.26, already flagged in the IL
   pack's PROVENANCE as issue #704 against `packages/snap-rules`). This pack does not re-open that finding (it
   belongs to the IL pack), but the independent corroboration from a completely different fetch this session is
   worth noting: the federal RMP directory itself may be stale, not just Illinois's engine constant.

## Refresh triggers

- **Oct 2026 COLA** → successor to MTL 21/25 (income standards, standard deduction, SUA/LUA/IUA/TUA, shelter cap,
  homeless deduction, resource limits, max allotments) — freshness entry.
- **ABAWD waiver status** → re-verify against a current E&P MS B-472 fetch or the FNS ABAWD waiver status page;
  the current narrow waived-area list (eff. 02/01/2026) is itself subject to change at any FNS response.
- **ABAWD discretionary exemptions** → re-check once FNS issues the expected availability memo referenced in
  E&P MS B-470.1.2.
- New MTLs touching A-180 (categorical eligibility), A-520/521/550 (resources/vehicles), A-660 (deductions), B-470
  series (ABAWD), or B-900/941 series (disqualifications) → update the affected supplement.

## Verification log

- **Draft-time source discipline:** every dollar figure and eligibility rule traces to its own E&P Manual chapter
  PDF, the Nevada Legislature's own NRS text, a live FNS letter, or the FNS national RMP page — never a curated
  secondary extract. The drug-felony finding specifically required going PAST an initial misleading secondary
  source (see correction #2 below) to the primary statute text.
- **Self-conducted adversarial refute pass (2026-08-11, no Agent/Workflow spawned):** re-read every claim in
  `supplements.json` against the originally fetched E&P Manual/NRS/FNS text before committing. 2 corrections found
  and applied:
  1. **`asset-rule` initially mis-simplified the vehicle valuation rule.** First draft stated non-exempt vehicles
     are "counted at the GREATER of fair market value or equity value" with an example that didn't actually add up
     under that reading ($5,000 FMV vs. $3,000 equity would make FMV the greater value, not the manual's stated
     $3,000 outcome). Re-reading the source's two-column table closely revealed the FMV side of the test is
     FMV MINUS a $4,650 disregard, not raw FMV — under the correct reading ($350 vs. $3,000, greater = $3,000) the
     manual's own worked example is internally consistent. Corrected to state the two-part test precisely, with the
     $4,650 figure explicit.
  2. **The drug-felony finding required verifying past a secondary source, not correcting a fabrication in the pack
     itself.** An initial web search summary described Nevada's SNAP drug-felony treatment as conditioned on
     substance-abuse-treatment participation — sourced only secondarily. Before drafting anything into
     `supplements.json`, this pack fetched NRS 422A.345 directly from `leg.state.nv.us` (raw HTML, `iconv`-decoded)
     and confirmed the CURRENT statute (post-2021 amendment) carries no such condition — the conditional language
     the search summary described was accurate only for a version of the law that no longer exists. No incorrect
     claim was ever drafted into the corpus, but this is logged because it is exactly the "secondary sites agree,
     still not primary sourcing" failure mode this framework's fetch-discipline rule exists to catch, and the
     catch happened before drafting rather than after.
  No fabricated citations were found, and no claim was drawn from a section title without its body text having
  been fetched — the two corrections above are a valuation-mechanism misreading (caught by re-reading the literal
  source table) and a secondary-source trap (caught by insisting on the primary statute before drafting), not
  invented rules. Structural tests, the retrieval-recall probe, and the frontdoor eval were re-run clean after each
  fix (see the PR description for the final numbers).
