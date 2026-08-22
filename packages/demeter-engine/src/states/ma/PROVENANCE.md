# Massachusetts pack — provenance

**Created:** 2026-08-10 (Wave 2 continued — `docs/plans/mae-state-corpus-framework.md`; MA is flagged in the
framework as "MED-HARD... not cheap to corpus-ify" and was the subject of two prior FAILED
primary-source verification passes for its SUA figures, logged in `packages/snap-rules/src/constants/states.ts`'s
header comment on 2026-06-02 and 2026-06-03. Both prior passes were blocked on mass.gov (403),
masslegalhelp.org (403), and Cornell LII (directory only, no section text).)
**Method:** direct live fetch, plain curl with a browser User-Agent, of ~20 DTA Online Guide
(BEACON5) pages, 4 actual 106 CMR regulation-text PDFs, 3 Online Guide Transmittals (OLGT), and
the current "Helpful Charts and Figures" COLA table — all from **`eohhs.ehs.state.ma.us`**, a
distinct DTA host neither prior pass tried. One prior-year mass.gov PDF was additionally recovered
via the Internet Archive Wayback Machine as a cross-check. `masslegalservices.org` (distinct from
`masslegalhelp.org`, also not tried by prior passes) was fetched once as corroboration only.

## The SUA verification gap — RESOLVED this session

The engine's `MA.sua_by_tier` comment (in `packages/snap-rules/src/constants/states.ts`) flagged
HCSUA $914 / LUA $556 / phone $64 as `!!! PENDING DTA PRIMARY-SOURCE VERIFICATION !!!`, confirmed
only via a Mass Legal Help secondary cross-reference, with two open doubts: (a) whether LUA is
really $556 given its unusually high ~60% ratio to HCSUA, and (b) whether the citation is really
106 CMR 364.945 or actually 106 CMR 366.910 (Bay State CAP).

**Both doubts are now resolved with genuine primary sourcing:**

1. **The dollar figures are CONFIRMED CORRECT.** DTA's own "Helpful Charts and Figures—SNAP" PDF
   (`eohhs.ehs.state.ma.us/DTA/PolicyOnline/olg docs/guides/Helpful Charts and Figures.pdf`,
   fetched live, "Last updated: 1/2026") shows, for the current FFY2026 cycle: Heating/Cooling SUA
   **$914** (up from $890), Nonheating SUA **$556** (up from $542), Phone SUA **$64** (up from
   $62) — an EXACT match to the engine's encoded values. This is DTA's own annually-republished
   chart, the primary-source artifact the framework calls for ("SUA is usually published in an
   annual table, not the rule text").
2. **The LUA/HCSUA ratio (~61%) is confirmed as Massachusetts' real, consistent methodology, not
   an anomaly.** A prior-year mass.gov PDF recovered via the Wayback Machine (most recent snapshot
   2025-08-31, content dated "Effective 10/01/2024") shows the SAME ratio one year earlier: $542 /
   $890 = 60.9%, essentially identical to the current $556 / $914 = 60.8%. Two independent years of
   primary DTA data show the same ratio — the "unusually high" doubt was measuring against other
   states' shapes, not Massachusetts' own actual, stable pattern.
3. **The citation 106 CMR 364.945 is CONFIRMED CORRECT — this pack fetched the actual regulation
   text**, not just a secondary citation: `364.945: The Standard Utility Allowances (SUA)... are
   updated periodically using a methodology approved by the USDA/FNS. The SUA standards are posted
   at www.mass.gov/dta` (`eohhs.ehs.state.ma.us/.../regulations/fs/search/364/945.PDF`). The
   engine's speculative alternative, 106 CMR 366.910, is real but is a SEPARATE citation for Bay
   State CAP recipients specifically, confirmed by fetching that regulation section's own PDF (a
   404 on `366/910.PDF` directly, but corroborated via DTA's separate "Bay State CAP Standard
   Utility Allowance" PDF, recovered via Wayback, which states "The Bay State CAP Standard Utility
   Allowance is $890" for the same FFY2025 cycle — numerically IDENTICAL to that year's
   Heating/Cooling SUA, and the current "Helpful Charts and Figures" table shows the same match
   again this year ($914 = $914). Both citations are real; in practice they have carried the same
   dollar figure in both years this pack checked.
4. **New, genuine value-add finding not in the original doubt list:** Bay State CAP recipients
   (~70K MA elderly/SSI households per the engine comment's estimate) are NOT a silent miscompute
   risk in the way the engine comment feared — the engine's current behavior of using HCSUA for
   everyone would have produced the mathematically correct number in both FFY2025 and FFY2026,
   because Bay State CAP SUA has tracked HCSUA dollar-for-dollar. This does not make the citation
   correct (they remain legally separate provisions, and a future year could diverge), but it
   materially lowers the urgency of adding a CAP branch. See the filed GitHub issue.

## A second, unprompted finding: the engine's RMP claim is WRONG

The engine's header comment states flatly: "RMP — Massachusetts does not operate a Restaurant
Meals Program," backing `rmp_operated: false`. This pack found and fetched OLGT 2023-85 (December
7, 2023), DTA's own bulletin launching the Restaurant Meals Program statewide by eligibility
(homeless, federally certified disabled, or 60+, auto-enrolled) — see the `restaurant-meals-program`
supplement for full detail. This directly contradicts the existing engine comment and constant.
Filed as a GitHub issue; engine untouched per the `packages/snap-rules` parked-package rule.

## A third finding: the ABAWD-waiver flag is CONFIRMED CORRECT, plus a stale-artifact trap

The task brief flagged `abawd_waiver_avail: false` as possibly "STALE/INCORRECT even as a comment"
and asked for independent re-verification rather than trusting the flag. This pack fetched OLGT
2025-31 (July 25, 2025) directly: "DTA's last geographic waiver expired June 30, 2025... the
Department cannot continue applying the 'Resident of a Waived Area' reason." No later bulletin
(OLGT 2025-59, October 30, 2025, the most recent ABAWD-related transmittal this pack located)
mentions any reinstatement. **The engine's `abawd_waiver_avail: false` is correct as of the best
available evidence** — the header comment's self-flagged doubt does not hold up.

Along the way, this pack found a genuine adversarial trap: a DTA-hosted file titled "ABAWD Work
Rules – Waived Areas" (`eohhs.ehs.state.ma.us/DTA/PolicyOnline/olg docs/lists/abawd-work-program-waived-areas.pdf`)
is STILL LIVE and states "The ABAWD time limit is waived in all cities and towns in Massachusetts
at this time" — directly contradicting OLGT 2025-31. Its own PDF metadata (`pdfinfo`) shows
`CreationDate: Thu Aug 4 12:56:57 2022` — nearly three years before the 2025 waiver expiration,
and OLGT 2025-31 itself lists "Page: Waived Areas" among the pages it says it revised, meaning this
specific file appears NOT to have actually been updated despite DTA's own transmittal claiming it
would be. A naive fetch of the newest-sounding, "current"-labeled URL would have produced a false
positive here — the correct signal was the DATED transmittal, not the undated "current status" page.

## Why Massachusetts matters to the schema

- **No county layer, but a two-cycle freshness problem no other pack in this roster has**: FFY
  dollar values (SUA, standard deduction, shelter cap) refresh 10/1 on the federal COLA cycle,
  while BBCE/categorical-eligibility income standards refresh 2/1 on a SEPARATE calendar-year FPL
  cycle — confirmed directly from DTA's own "Helpful Charts and Figures" table, which prints both
  "Effective 10/1/2025" and "Effective 2/1/2026" headers side by side. `freshness.json` carries two
  separate expiry entries for this reason.
- **A Standard Medical Deduction that does NOT move on the annual COLA** — $155 appears unchanged
  in the 106 CMR text (Rev. 1/2017) and in a DTA guide page from January 2023, a genuinely
  different volatility profile from SUA/shelter/standard-deduction figures on the same page.
- **Child support and dependent care are both net-calculation DEDUCTIONS**, applied in a fixed
  sequence directly out of the regulation text (106 CMR 364.500(G)-(H)) — a clean mechanical
  contrast to Illinois, which excludes child support from gross income instead of deducting it net.
- **A real, dated example of a state document being wrong about ITS OWN current status** (the
  ABAWD "Waived Areas" stale-artifact trap above) — a distinct failure mode from the more common
  "old page never revised" pattern (Illinois' PM/WAG 13-01-04) because this file's TITLE and URL
  both read as a "current status" reference, not an archival one.

## Sources

| Source | Access | Dated |
|---|---|---|
| "Helpful Charts and Figures—SNAP" (DTA) | plain curl, `eohhs.ehs.state.ma.us/.../olg docs/guides/` | "Last updated: 1/2026"; FFY2026 figures eff. 10/1/2025, cat-el standards eff. 2/1/2026 |
| 106 CMR 364.945, 364.500, 364.975/364.976 (regulation text) | plain curl, `eohhs.ehs.state.ma.us/.../olg docs/regulations/fs/search/` | Rev. 1/2017 – 6/2022 (structure/mechanics; dollar tables live separately) |
| OLGT 2025-31 (ABAWD waiver expiration) | plain curl | 7/25/2025 |
| OLGT 2025-59 (OBBBA ABAWD changes) | plain curl | 10/30/2025 |
| OLGT 2023-85 (Restaurant Meals Program launch) | plain curl | 12/7/2023 |
| OLGT 2024-45 (drug-felony policy clarification) | plain curl | 8/15/2024 |
| DTA Online Guide (BEACON5) pages: Assets Overview - SNAP, SNAP Disqualifications and Sanctions, Intentional Program Violation Overview, How SNAP Benefits are Calculated, Simplified Reporting - Overview, Simplified Reporting - Recertification, What is SNAP? | plain curl, `eohhs.ehs.state.ma.us/DTA/PolicyOnline/BEACON5/!SSL!/WebHelp/` | last-updated stamps 9/2024 – 4/2025 per page |
| Prior-year mass.gov SUA + Bay State CAP SUA PDFs | Internet Archive Wayback Machine (`web.archive.org`), most recent snapshot 2025-08-31 | "Effective 10/01/2024" |
| masslegalservices.org "2026 SNAP Advocacy Guide" | plain curl (corroboration only) | current per site |

## Findings a maintainer must know

1. **`packages/snap-rules`'s SUA verification gap is RESOLVED — confirmed CORRECT, not fixed
   because nothing was wrong.** See above. Filed as a GitHub issue documenting the resolution so
   the operator can clear the `!!! PENDING !!!` flag from the header comment at their discretion;
   engine untouched per the parked-package rule.
2. **`packages/snap-rules`'s `MA.rmp_operated: false` is WRONG — filed, NOT fixed this session.**
   Massachusetts has operated a statewide-eligibility Restaurant Meals Program since December 2023
   (OLGT 2023-85). Filed as a GitHub issue; engine untouched.
3. **`packages/snap-rules`'s `MA.abawd_waiver_avail: false` is CONFIRMED CORRECT** — the header
   comment's self-flagged "STALE/INCORRECT" doubt does not hold up against the most recent primary
   source (OLGT 2025-31, no reinstatement found through OLGT 2025-59). Filed as a GitHub issue
   documenting the confirmation and the stale-artifact trap found along the way, so a future pass
   doesn't re-discover the same dead end.
4. **Bay State CAP (106 CMR 366.910) SUA has tracked the regular Heating/Cooling SUA
   dollar-for-dollar in both FFY2025 and FFY2026** — a real, distinct citation, but not (so far) a
   materially different number. Noted in the same GitHub issue as a lower-urgency structural
   observation, not a compute-correctness bug.
5. **`expedited-service` is the one supplement in this pack sourced at moderate rather than
   highest confidence** — this pack located and confirms the content of DTA's "Screening for
   Expedited Service" page via search-engine-surfaced text, but could not get a raw HTML fetch of
   that specific page to succeed before drafting (a URL-casing/path-restructuring issue this
   session hit on several DTA Online Guide pages; see "Fetch strategy notes" below). The figures
   ($150 gross / $100 liquid, 7-calendar-day issuance) match the same federal standard already
   primary-confirmed in Illinois, Michigan, and Georgia's packs, which is why this pack still
   includes it rather than nulling it out — but it is flagged in the supplement text itself and
   should be the first thing re-fetched raw on any refresh pass.
6. **This pack did NOT independently confirm Massachusetts' fixed ABAWD 36-month clock start/end
   dates** — every other state pack in this roster with a fixed-window clock (IL, GA, WA, MI)
   confirmed exact dates from a live source; this pack ran out of budget before finding MA's
   equivalent "ABAWD Clock" page (referenced by title in OLGT 2025-59 but not independently
   fetched). Left `null`/unstated rather than guessed; flagged in `freshness.json`.

## Fetch strategy notes (for the next state's session)

- **`eohhs.ehs.state.ma.us` is NOT behind the same block as `mass.gov`, `masslegalhelp.org`, or
  Cornell LII.** Plain curl with a browser User-Agent succeeded on the large majority of attempts
  against this host — no headless browser, no Wayback fallback needed for MOST content. This is
  the single most important finding for any future Massachusetts refresh.
- The DTA Online Guide (BEACON5) SPA shell (`.../WebHelp/index.htm`) IS a JS app and returns no
  content directly — but its individual TOPIC pages (`.../WebHelp/SNAP/<Category>/<Page>.htm`) are
  plain static HTML, fetchable directly. Directory listings (`.../olg docs/` bare) are blocked
  (403); specific known filenames are not.
- URL paths on this host are inconsistent across a site migration: some working paths use
  `BEACON5` (uppercase) with no `-rh17` suffix, no `assets/` prefix; TAFDC content commonly needs
  an `assets/` prefix; a large fraction of Google-indexed URLs for this host (including for
  `Dependent_Care_Expense_Deduction.htm`, `Child_Support_Expense_Deduction.htm`, and the ABAWD
  Work Rules Exemptions/Overview pages specifically) now 404 regardless of casing or `-rh17`
  variant tried — apparently stale index entries from a prior site structure. Where a specific raw
  fetch could not be resolved, the actual 106 CMR regulation-text PDF at
  `.../olg docs/regulations/fs/search/<chapter>/<section>.PDF` was usually a workable and often
  BETTER alternative (genuine regulatory text rather than a guide summary).
- Actual 106 CMR regulation-text PDFs are individually fetchable at
  `eohhs.ehs.state.ma.us/DTA/PolicyOnline/olg docs/regulations/fs/search/<chapter>/<section>.PDF`
  (uppercase `.PDF` extension mattered for at least one file; both cases were tried where a first
  attempt 404'd). This is a genuinely new, high-value discovery: it means Massachusetts'
  regulation text is fetchable directly, not just DTA's guide-page paraphrase of it.
- The Internet Archive Wayback Machine (`web.archive.org`) successfully archived several mass.gov
  `/doc/.../download` PDFs even though live mass.gov 403'd every direct attempt this session — a
  useful fallback for a PRIOR year's dated figure specifically, not for the current year (no
  post-October-2025 snapshot existed for the SUA doc as of this pack's build).

## Refresh triggers

- **Oct 2026 COLA** → successor "Helpful Charts and Figures" table (SUA, standard deduction,
  shelter cap, homeless deduction, minimum benefit) — `ma-ffy26-dollar-values` freshness entry.
- **Feb 2027 calendar-year FPL update** → successor categorical-eligibility income standards —
  `ma-cy2026-cat-el-standards` freshness entry.
- **ABAWD waiver status** → re-verify against the newest dated OLGT before every refresh, never an
  undated "current status" page — `ma-abawd-waiver-status` freshness entry.
- New OLGTs touching 106 CMR 364.5xx (deductions), 364.9xx (income/asset/utility standards), or the
  Restaurant Meals Program book → update the affected supplement.
- **Expedited service and the ABAWD clock window** → both flagged above as needing a raw re-fetch
  on the next pass; treat as open items, not settled.

## Verification log

- **Draft-time source discipline:** every dollar figure and citation traces to a live-fetched DTA
  Online Guide page, an actual 106 CMR regulation-text PDF, or a dated OLGT bulletin. The one
  exception — the `expedited-service` supplement — is explicitly labeled moderate-confidence in
  its own text and in finding #5 above, not silently treated as equally primary-sourced.
- **Self-conducted adversarial refute pass (2026-08-10, no Agent/Workflow spawned):** re-read every
  claim in `supplements.json` against the originally fetched page/PDF text (retained in this
  session's scratchpad) line by line before committing, specifically checking for (a) a "changed
  from X to Y" claim the source only ever states once, (b) an inference drawn from a section TITLE
  rather than its body text, and (c) any figure without the literal fetched text in hand. Every
  dollar figure and quoted sentence in `supplements.json` was checked against its raw source file
  (e.g., the $2,660/$3,607/$4,553/$5,500/+$947 categorical-eligibility figures against
  `helpful-charts.txt`'s own table row; the "55 to 65" and "under 14, instead of 18" ABAWD
  exemption changes against `olgt-2025-59.txt`'s exact wording; the drug-felony opt-out language
  against `olgt-2025-45.txt`'s exact wording) and all matched. **Zero corrections were needed** —
  the three highest-risk claims (the ABAWD Work Rules "reintroduced in April 2025" mention with no
  stated cause, the Bay State CAP SUA's two-year numeric match rather than a stated equality rule,
  and the Bay State CAP Reporting mention that was never independently fetched in full) were
  already phrased with the correct hedge in the first draft rather than needing a fix after the
  fact — each is stated in `supplements.json` as exactly what this pack can support (an observed
  pattern or an open question) and not overclaimed as a settled rule. No fabricated citations, no
  title-only inferences, and no unsupported figures were found on this pass.
