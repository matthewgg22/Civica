# New Jersey pack — provenance

**Created:** 2026-08-11. New Jersey is a genuine BLANK SLATE in this roster — like North
Carolina's and Ohio's prior builds, New Jersey has NO existing `packages/snap-rules` entry and
NO oracle fixture coverage at all. No discrepancy-checking against an existing engine constant
was possible or attempted; this pack's findings stand entirely on its own primary-source
research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and
does not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both
of which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (with a standard browser `User-Agent` header) of the current N.J.A.C. 10:87
NJ SNAP Manual PDF at nj.gov, extracted to text with `pdftotext -layout`, supplemented
section-by-section via Cornell LII's N.J.A.C. mirror for sections outside that particular PDF's
page range, plus direct fetches of USDA's official ABAWD waiver-approval letter for New Jersey
FY2026, USDA's official Restaurant Meals Program state list, USDA's official FY2026 Maximum
Allotments and Deductions table, DFD's own "Federal Changes to SNAP" page, and the New Jersey
Legislature's bill-tracking records for a repeatedly-introduced Restaurant Meals Program bill.

## Finding 0 — a genuine moved/broken link, NOT a bot-blocking tooling artifact (an important negative result)

This task's briefing anticipated a Pennsylvania/North-Carolina-style tooling artifact — a
generic fetch tool reporting "gone" for a source that is actually reachable with the right
technique. New Jersey's manual host presented a DIFFERENT failure mode worth recording
precisely because it looked identical at first glance: the originally search-indexed URL
(`nj.gov/humanservices/providers/rulefees/regs/NJAC%2010_87...pdf`) returned a bare HTTP 404 on
BOTH `WebFetch` and a raw `curl` fetch with a browser `User-Agent` header — the exact same 404,
not a UA-sensitive 403 that flips to 200 with the right header. This pack confirmed the failure
was a genuinely moved/broken link (not a bot mitigation) by fetching the SAME nj.gov domain's
root page (`nj.gov/humanservices/`), which returned a clean 200 via plain curl, proving the host
itself was reachable and not blocking bot traffic generally. A follow-up search located the
manual's CURRENT working URL at a different path
(`nj.gov/humanservices/notices/documents/rules-and-regulations/NJAC%2010_87...PDF`), which
returned a clean 200 via curl immediately. The methodological lesson from this pack's build is
the mirror image of North Carolina's and Pennsylvania's: not every fetch failure is a tooling
artifact to route around — some are genuinely broken links that require finding the resource's
new home, and the diagnostic step (does the SAME HOST's root page load?) is what tells the two
apart. Separately, this pack hit a genuine access barrier it could NOT resolve: Justia's and
FindLaw's New Jersey statute mirrors both returned HTTP 403 even via curl with a browser
User-Agent header — unlike nj.gov, these hosts appear to apply a more deliberate anti-bot
posture that the browser-UA technique does not defeat. This pack worked around it by using the
Collateral Consequences Resource Center's national survey (a specialized legal research
organization that quotes state statutes directly) as a near-primary corroborating source
instead — flagged explicitly in `freshness.json` as a remaining gap, not silently treated as
fully primary-source-confirmed.

## Finding 1 (flagship) — New Jersey currently holds an ABAWD waiver in two areas, nearly the opposite structural position from North Carolina's flagship finding

New Jersey's own DFD "Federal Changes to SNAP" page (fetched directly) states: "New Jersey was
under a waiver for all counties except Morris through January 31, 2026. As of February 1, 2026,
only Camden City and Cape May County are under a time limit waiver." This pack independently
fetched USDA's own approval letter for this waiver directly
(`nj-abawd-response-fy2026.pdf`, dated February 10, 2026, linked from USDA's official ABAWD
Waivers FY2025-2029 page, itself last updated July 22, 2026): DHS requested (November 14, 2025)
and FNS approved a waiver for Cape May County and Camden City, effective **February 1, 2026
through January 31, 2027**, based on three-month-average unemployment rates over 10 percent —
Cape May County at 10.8% (February-April 2025 BLS data) and Camden City at 10.5% (June-August
2025 BLS data). New Jersey's own ABAWD FAQ page (fetched directly) ties benefit-loss timing
directly to this waiver period: "Once we have counted 3 full months, you will lose your SNAP
benefits until January 31, 2027."

This is worth flagging as close to the OPPOSITE structural position from this roster's North
Carolina flagship finding: North Carolina is STATUTORILY BARRED from ever requesting an ABAWD
waiver (N.C. Gen. Stat. § 108A-51.1, in force since 2015); New Jersey, by contrast, actively
holds one right now, for two specific, narrowly-defined areas, based on ordinary
unemployment-rate evidence under the standard federal waiver mechanism (7 CFR 273.24(f)) — no
special statutory authority is involved on New Jersey's side, and the waiver is explicitly
time-bound (expiring January 31, 2027) rather than an indefinite feature of New Jersey's ABAWD
policy. This pack verified the claim through THREE independent, mutually-corroborating primary
sources (DFD's own page, USDA's own approval letter, and DFD's own ABAWD FAQ page) rather than
resting on any single source or a WebSearch summary alone.

## Finding 2 (flagship) — New Jersey is a full statutory opt-out from the drug-felony SNAP ban, confirmed by the state's own regulation-history text

N.J.A.C. 10:87-3.18's own official History note, fetched directly from the current (through the
New Jersey Register, June 16, 2025) codified manual, states that the FORMER N.J.A.C. 10:87-3.18
provision — titled, in the History note's own words, "Individuals convicted of use, possession,
or distribution of controlled substances" — "was repealed" by R.2012 d.031, effective February
6, 2012 (operative March 7, 2012); the section number was subsequently reused for an unrelated
duplicate-participation disqualification rule. This pack corroborated the underlying statutory
authority — N.J.S.A. 44:10-48(d)(1), the WorkFirst New Jersey Act's opt-out provision under 21
U.S.C. § 862a(d)(1)(A) — via the Collateral Consequences Resource Center's national 50-state
SNAP/TANF drug-conviction survey, which quotes the statute directly: "Pursuant to the
authorization provided to the states under 21 U.S.C. s.862a(d)(1), this State elects to exempt
from the application of 21 U.S.C. s.862a(a)," applying to both WFNJ/food-assistance recipients
with dependent children and single/childless individuals.

This pack checked whether this full-opt-out characterization is already correctly reported by
outside secondary sources before treating it as a finding worth flagging — it is (a WebSearch
summary independently returned "If you're eligible for food stamps, New Jersey won't disqualify
you because of a drug felony" from a legal-aid-adjacent source, though this pack could not
re-confirm that exact phrasing on a direct WebFetch of the specific page cited). New Jersey
imposes NO waiting period, NO treatment-compliance condition, and NO felony-class or
conviction-location carve-out of the kind this roster's North Carolina pack documents for its
own modified-ban state — this is a genuine full opt-out, structurally the cleanest of the three
drug-felony postures (full ban, modified ban, full opt-out) this roster has now documented.

## Finding 3 — a genuine secondary-source correction: New Jersey's "Restaurant Meals Program" is a bill that has died in committee three separate times, not a live program

USDA's current official Restaurant Meals Program (RMP) state list (fetched directly, page
updated August 7, 2026) names Arizona, Maryland, New York, California, Massachusetts, Rhode
Island, Illinois (Cook and Franklin Counties only), Michigan, and Virginia — New Jersey is not
on it, and this pack found no N.J.A.C. 10:87 section establishing an RMP. Several third-party
SNAP-benefit explainer sites checked during this pass describe New Jersey as operating an RMP,
using eligibility language ("elderly 60+, disabled, or homeless individuals... may use SNAP
benefits at approved food vendors... administered by the department in conjunction with the
State's county welfare agencies") that traces almost verbatim to a New Jersey bill that has been
introduced, and left to die, in THREE separate legislative sessions without ever being enacted:
Assembly Bill A2892 (2020-2021 session, official LegiScan status "Introduced - Dead"),
reintroduced as S1163/A1460 (2022 session), and currently pending as Senate Bill S3983
(introduced March 19, 2026 by Sen. Joseph Vitale, referred to the Senate Health, Human Services
and Senior Citizens Committee, still awaiting action as of this pack's build date per LegiScan's
tracked bill status). This pack traced the likely source of the confusion directly to the
bill's own descriptive language rather than assuming it — several explainer sites describe the
BILL's proposed program in the present tense, as though it were already operating law, a
"proposed-vs-enacted" conflation structurally analogous to (though mechanically different from)
North Carolina's Hurricane-Helene RMP conflation elsewhere in this roster.

## Finding 4 — New Jersey's own codified resource-limit dollar figures are stale, a genuine gap distinct from a live policy divergence

N.J.A.C. 10:87-4.11's own text (as fetched, current through the New Jersey Register June 16,
2025) sets maximum allowable resources at "$2,000 for the household; except that for households
including a member or members aged 60 or over, such resources shall not exceed $3,000" — these
are the PRE-2009 federal figures, not updated in New Jersey's own printed regulation text to
reflect the annual COLA indexing the 2008 Farm Bill introduced starting FFY09. This pack
independently fetched USDA's official FY2026 Maximum Allotments and Deductions table directly,
confirming the CURRENT federal standard (7 CFR 273.8(b), binding in every state regardless of
what a state's own un-amended regulation text says) is $3,000 standard / $4,500
elderly-or-disabled — the same figures this roster's North Carolina and Ohio packs cite for
FFY26. New Jersey's own public-facing DFD eligibility messaging and every secondary source this
pack checked already correctly state $3,000/$4,500 as the operative current figures. This pack
deliberately does NOT frame this as a "secondary-source correction" the way Findings 2 and 3
above are framed — the secondary sources are right, and New Jersey's OWN un-amended regulation
text is what lags. It is disclosed here and in `freshness.json` as a genuine codification gap: a
reader relying on N.J.A.C. 10:87-4.11's literal printed dollar figures would be quoting a stale
number, even though the actual operative New Jersey policy matches the current federal standard.

## Finding 5 — a genuine mechanism contrast: New Jersey excludes child support from income; most of this roster's other states deduct it afterward

N.J.A.C. 10:87-5.9, "Identification of income exclusions," places legally obligated/court-ordered
child support (including vendor payments and arrearages) in the INCOME EXCLUSION category (7 CFR
273.9(c)) — the same mechanism this roster's Illinois pack documents — rather than the ORDINARY
DEDUCTION mechanism (7 CFR 273.9(d)(5)) this roster's North Carolina, Ohio, Georgia, Michigan,
Minnesota, Oregon, Pennsylvania, and Wisconsin packs all document for their own states. This
matters practically, not just terminologically: an income exclusion lowers gross income itself
(potentially preserving eligibility under the gross-income test for a household otherwise near
the threshold), while an ordinary deduction only reduces net income after the gross test has
already been applied. This pack flags the contrast explicitly so a reader does not assume New
Jersey mirrors the "ordinary deduction" majority pattern this roster has mostly documented so
far.

## Finding 6 — a genuine contrast with North Carolina's vehicle-exclusion rule: New Jersey counts boats and motor homes

N.J.A.C. 10:87-4.3(a)4 and 4.8(a)3 exclude ordinary vehicles ("vehicles are excluded as a
resource, except for recreational vehicles, such as boats, motor homes and so forth") but COUNT
recreational vehicles at fair market value (NADA guide value, no low-mileage markup permitted)
unless the boat or motor home is the household's primary residence. This is a direct contrast
with North Carolina's pack in this same roster, which found ALL motor vehicles — explicitly
including boats — fully excluded as a resource, a broader exclusion than New Jersey's. This
pack flags the contrast explicitly rather than letting a reader assume every state in this
roster follows North Carolina's blanket rule; given the resource test reaches only a narrow
population of New Jersey households in the first place (see Finding 4's discussion of the
185% FPL expanded-categorical-eligibility screen), this affects few New Jersey applicants in
practice, but is worth stating precisely for the households it does reach.

## Confirmed — no discrepancy found (no engine constant existed to check against)

New Jersey has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing
engine constant this pack could confirm or contradict — every dollar figure, categorical-
eligibility rule, and disqualification rule above is a first-pass primary-source finding, not a
cross-check against prior engineering work. A future `packages/snap-rules` build for New Jersey
(out of scope for this task, requiring its own explicit go-ahead per the standing park rule)
should treat this pack's citations as a starting point, not a final answer, and re-verify
independently — particularly the SUA figure (Finding-adjacent gap, see `freshness.json`), which
this pack could only corroborate secondarily.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched N.J.A.C. section text or
statute, checking specifically for: claims inferred from a section title rather than its own
body text; dollar figures not traceable to a specific dated source; and any New-Jersey-vs-
common-assumption contrast overclaimed as settled when the underlying evidence was genuinely
ambiguous. Concrete catches from this pass:

- The ABAWD-waiver finding (Finding 1) was NOT accepted from DFD's page alone — USDA's own
  approval letter was independently fetched and its unemployment-rate evidence, waiver
  boundaries, and exact date range read directly, rather than trusting a WebSearch summary of
  the DFD page's claim.
- The drug-felony finding (Finding 2) rests on TWO independent sources specifically because
  this pack could not directly fetch the raw N.J.S.A. 44:10-48 text (Justia/FindLaw both 403'd)
  — rather than treating the CCRC secondary source as sufficient on its own, this pack sought
  and found the N.J.A.C. 10:87-3.18 History note as a genuinely independent corroborating
  primary source before drafting the finding, and still flags the statute-text gap in
  `freshness.json` rather than treating the finding as fully closed.
- The RMP finding (Finding 3) does NOT merely assert "New Jersey has no RMP" from USDA's list —
  it traces the SPECIFIC likely source of the third-party conflation (three separate legislative
  sessions of a never-enacted bill) and checked each bill's actual tracked status (LegiScan)
  rather than assuming a generic "pending legislation" summary was accurate.
- The stale-resource-limit finding (Finding 4) was deliberately NOT framed as a "secondary-source
  correction" the way Findings 2 and 3 are — this pack checked whether secondary sources
  actually get this wrong (they do not; DFD's own public messaging and every aggregator checked
  state $3,000/$4,500 correctly) before choosing the more precise "New Jersey's own codified text
  lags" framing instead of a needless correction narrative.
- The vehicle-treatment finding (Finding 6) is stated using ONLY the distinction N.J.A.C.
  10:87-4.3(a)4's own text draws (ordinary vehicles excluded, recreational vehicles counted at
  fair market value, primary-residence exception) — this pack does not invent a specific equity
  cap or valuation methodology beyond what the section itself states (NADA guide value, no
  low-mileage markup).
- The child-support mechanism finding (Finding 5) is stated as an income EXCLUSION specifically
  because N.J.A.C. 10:87-5.9's own section title ("Identification of income exclusions") and
  body text place it there — this pack did not infer the mechanism from the deduction amount
  alone, which would not distinguish an exclusion from an ordinary deduction.
- Where this pack could not confirm a detail (New Jersey-specific medical-expense itemization,
  LUA/UTA dollar figures, alimony's exact treatment under 10:87-5.9), it says so directly in
  `freshness.json` rather than defaulting silently to another state's pattern or inventing a
  New Jersey-specific rule.

## Sources

| Source | Access | Dated |
|---|---|---|
| N.J.A.C. 10:87-1.1A, Abbreviations/acronyms defined | direct curl fetch (browser UA) + pdftotext | current through NJ Register Vol. 57 No. 12, 6/16/2025 |
| N.J.A.C. 10:87-2.28, Expedited service | Cornell LII | current |
| N.J.A.C. 10:87-2.29, Expedited service processing standards | Cornell LII (WebSearch-indexed) | current |
| N.J.A.C. 10:87-2.32, Categorically eligible WFNJ/TANF/SSI households | direct curl fetch (browser UA) + pdftotext | current through NJ Register Vol. 57 No. 12, 6/16/2025 |
| N.J.A.C. 10:87-2.36, Expanded categorical eligibility | direct curl fetch (browser UA) + pdftotext; cross-checked via Cornell LII | current through NJ Register Vol. 57 No. 12, 6/16/2025 |
| N.J.A.C. 10:87-3.18, Disqualification due to duplicate participation (History note re: repealed drug-felony provision) | direct curl fetch (browser UA) + pdftotext | current through NJ Register Vol. 57 No. 12, 6/16/2025 |
| N.J.A.C. 10:87-4.1, Resource applicability | direct curl fetch (browser UA) + pdftotext | current through NJ Register Vol. 57 No. 12, 6/16/2025 |
| N.J.A.C. 10:87-4.3, Resources defined | direct curl fetch (browser UA) + pdftotext; cross-checked via Cornell LII | current through NJ Register Vol. 57 No. 12, 6/16/2025 |
| N.J.A.C. 10:87-4.8, Identification of resource exclusions | direct curl fetch (browser UA) + pdftotext | current through NJ Register Vol. 57 No. 12, 6/16/2025 |
| N.J.A.C. 10:87-4.11, Maximum allowable resources | direct curl fetch (browser UA) + pdftotext | current through NJ Register Vol. 57 No. 12, 6/16/2025 |
| N.J.A.C. 10:87-5.9, Identification of income exclusions | Cornell LII (WebSearch-indexed) | current |
| N.J.A.C. 10:87-5.10, income deductions | Cornell LII | current |
| N.J.A.C. 10:87-6.20, Certification periods | Cornell LII (WebSearch-indexed) | current |
| N.J.A.C. 10:87-7.7, Treatment of income and resources of non-household members | Cornell LII | current |
| N.J.A.C. 10:87-9.5, Simplified reporting and change reporting | Cornell LII (WebSearch-indexed) | current |
| N.J.A.C. 10:87-10.20, Mandatory work activity for ABAWDs | Cornell LII (WebSearch-indexed) | current |
| N.J.A.C. 10:87-12.1, Income deduction standards | Cornell LII | current |
| N.J.S.A. 44:10-48(d)(1), WorkFirst New Jersey Act drug-felony opt-out | secondary corroboration only (Collateral Consequences Resource Center national survey); direct fetch attempted at Justia/FindLaw, both 403'd | fetched 2026-08-11 |
| USDA FNS, New Jersey ABAWD Time Limit Waiver Response, FY2026 | direct curl fetch (browser UA) + pdftotext | approved 2/10/2026, waiver period 2/1/2026-1/31/2027 |
| USDA FNS Restaurant Meals Program state list | direct curl fetch (browser UA) | fetched 2026-08-11, page updated 8/7/2026 |
| USDA FNS SNAP FY2026 Maximum Allotments and Deductions table | direct curl fetch (browser UA) + pdftotext | effective 10/1/2025-9/30/2026 |
| NJ DHS DFD, "Federal Changes to SNAP" | direct curl fetch (browser UA) | fetched 2026-08-11 |
| NJ DHS DFD, NJ SNAP eligibility page | WebFetch | fetched 2026-08-11 |
| NJ DHS DFD, NJ SNAP ABAWD FAQ page | WebFetch | fetched 2026-08-11 |
| NJ DHS DFD, NJ SNAP program page (njsnap.gov / MyNJHelps portal) | WebFetch | fetched 2026-08-11 |
| NJ Medicaid Communication No. 25-07 (Adjusted Utility Allowance 2025) | secondary corroboration only via WebSearch; direct PDF fetch failed (404 at both URL variants tried) | referenced dated 10/8/2025 |
| Collateral Consequences Resource Center, national SNAP/TANF drug-felony state survey | WebFetch | fetched 2026-08-11 |
| New Jersey Legislature bill records: A2892 (2020-2021), S1163/A1460 (2022), S3983 (2026) | WebSearch (LegiScan-indexed bill status) | fetched 2026-08-11 |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES). New Jersey is
deliberately NOT added to `engine-citations.ts`'s `BBCE_PCT` map — that map mirrors
`packages/snap-rules`' per-state constant by design (see the comment above the map), and New
Jersey has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("NJ",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build
adds a New Jersey policy — this matches the precedent already set by New York's and North
Carolina's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`)
— this pack does not modify it and does not request an unfreeze. A future New Jersey
`packages/snap-rules` build is out of scope here and would need its own separate, explicit
go-ahead.
