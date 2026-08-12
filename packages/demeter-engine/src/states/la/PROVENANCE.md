# Louisiana pack — provenance

**Created:** 2026-08-12. Louisiana is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, and Alabama's prior builds, Louisiana has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking
against an existing engine constant was possible or attempted; this pack's findings stand
entirely on its own primary-source research. This task's scope was CORPUS ONLY — the Demeter
chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the
standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (browser User-Agent) of Louisiana's Economic Stability/Economic
Independence (ES/EI) SNAP Policy Manual. Unlike most states in this roster, Louisiana's manual
is NOT hosted as one bundled per-chapter PDF — it is hosted as dozens of individually-numbered
documents on `public.powerdms.com/LADCFS`, discovered largely via targeted WebSearch queries
against that domain and fetched individually as PDFs, converted with `pdftotext -layout`:
B-650-SNAP (Deductions, 22 pages), B-1010/B-1020/B-1040-SNAP (Resources), C-660/C-661-SNAP
(Expedited Service), C-720-SNAP (Redeterminations), E-220/E-221/E-222-SNAP (Disqualified
Members and Households), E-280-SNAP (Categorical/Broad-Based Categorical Eligibility),
J-300-SNAP (current FFY2026 Income Eligibility Chart), and S-110-SNAP (Simplified Reporting).
Every PowerDMS fetch returned a clean HTTP 200 with no login wall or rate limiting. Also fetched
directly: LDH's October 1, 2025 press release confirming SNAP's transfer from DCFS to LDH;
LDH's July 20, 2026 Tropical Storm Arthur hot-foods waiver announcement; DCFS's September 30,
2024 ABAWD-waiver-expiration announcement; USDA FNA's current Restaurant Meals Program state
list; and ABAWDMap.us's Louisiana entry. WebSearch cross-checks were used to locate La. R.S.
46:233.3 (Justia returned HTTP 403 on direct fetch — a now-familiar pattern in this roster),
resolved via convergent secondary corroboration cross-checked against Louisiana's own
primary-source manual, which independently confirms the same substantive rule by omission.

## Finding 0 — no HTTP access barrier encountered on any Louisiana government host, but a
genuinely undiscoverable/unbundled manual structure

`public.powerdms.com/LADCFS`, `ldh.la.gov`, and `dcfs.louisiana.gov` all returned clean HTTP 200
responses to direct curl with a browser User-Agent on every fetch attempt — no login wall, no
rate limiting, no 403. The access complication this pack found is structural rather than a
blocked fetch: unlike Alabama's or South Carolina's single-PDF-per-chapter manuals, Louisiana's
manual is split into dozens of individually-numbered PowerDMS documents with no single
browsable table-of-contents page this pack could locate — each document had to be found via a
targeted WebSearch query against the PowerDMS domain, and several searches returned no usable
result at all (see Finding 6, the disclosed B-1030-SNAP gap). This made comprehensive coverage
genuinely harder to achieve than in prior single-PDF-manual states, though every document this
pack DID find was current, unambiguous, and access-barrier-free.

## Finding 1 (flagship) — Louisiana's SNAP program changed ADMINISTERING AGENCY on October 1,
2025 — DCFS to LDH — and the outgoing agency's own website has not caught up

Under "Project One Door" legislation (2025 Regular Session Acts 477 and 478), Louisiana's SNAP
program moved from the Department of Children and Family Services (DCFS) to the Louisiana
Department of Health (LDH) on October 1, 2025. LDH's own press release states the change
plainly: "Today marks the first day the Louisiana Department of Health (LDH) officially
administers the Supplemental Nutrition Assistance Program (SNAP)... There are no changes to
eligibility as part of this move. The shift simply brings SNAP under LDH so that nutrition
assistance can be better aligned with other services under the Department, such as Medicaid."
LDH simultaneously acquired Louisiana's TANF cash-assistance program (the Family Independence
Temporary Assistance Program, FITAP), Kinship Care Subsidy Program (KCSP), Disability
Determination Services (DDS), the Electronic Healthy Incentives Project (eHIP), and SUN Bucks
from DCFS in the same transfer, now organized under LDH's own "Office of Economic Stability."
This pack found the outgoing agency's own website had NOT caught up more than ten months
later: `dcfs.louisiana.gov` still hosts extensive, actively-maintained-looking SNAP content
(a "SNAP Eligibility" page, a "SNAP - How To Apply" page, and more), and this content still
surfaces FIRST in an ordinary "Louisiana SNAP eligibility" web search — ahead of any LDH page.
Nothing on DCFS's own SNAP pages that this pack found prominently flags the October 2025
agency change. The underlying policy manual is caught in the same transition: it continues to
be hosted on a DCFS-branded PowerDMS instance (`public.powerdms.com/LADCFS`) even though LDH is
now the administering agency, and individual manual documents show inconsistent branding — some
recent documents (e.g. the Rev. 07/26 Form OFS 4MR) are explicitly headed "Louisiana Department
of Health," while others retain "Office of Family Support (OFS)" or plain "Family Support"
labeling with no agency name at all.

## Finding 2 (flagship, structural) — Louisiana's manual is ALSO mid-rename internally, from
"Economic Stability (ES)" to "Economic Independence (EI)" — including one document with BOTH
names in the same header

Independently of the DCFS-to-LDH agency transfer, this pack found Louisiana's manual chapter
name itself is inconsistent across documents by EFFECTIVE DATE: documents effective before
roughly May 2026 consistently header themselves "Chapter No./Name: 4 – Economic Stability
(ES)" (e.g. E-280-SNAP, effective October 1, 2025; J-300-SNAP, effective October 1, 2025;
E-220-SNAP, effective August 1, 2024). Documents effective May 2026 or later instead header
themselves "Chapter No./Name: 4 – Economic Independence (EI)" (C-720-SNAP, effective May 15,
2026; S-110-SNAP, effective May 1, 2026; B-650-SNAP, effective June 1, 2026). Most tellingly,
B-650-SNAP's OWN header carries BOTH names simultaneously and unresolved: "Division/Section:
Economic Stability" directly above "Chapter No./Name: 4 – Economic Independence (EI)" — an
internal inconsistency this pack found directly in the primary source text, not inferred from
context. This pack could not locate an external press release, legislative bill, or LDH/DCFS
announcement explicitly confirming an "Economic Stability" to "Economic Independence" rename;
the timing loosely tracks LDH Secretary Bruce Greenstein's own October 1, 2025 quote about
"helping move individuals from dependence to independence" in the SNAP-transfer announcement,
but this pack does NOT claim that connection as confirmed — it is a plausible but unverified
association, stated as such.

## Finding 3 — Louisiana's Restaurant Meals Program status is TWO SEPARATE questions this pack
found conflated in secondary sources: no standing RMP, but an active, expiring disaster waiver

USDA FNA's own current Restaurant Meals Program state list (fetched directly, page dated
updated August 7, 2026) names Arizona, Maryland, New York, California, Massachusetts, Rhode
Island, Illinois (Cook and Franklin Counties only), Michigan, and Virginia — Louisiana is
ABSENT. This pack's initial WebSearch results surfaced a genuinely confusing, apparently
self-contradicting picture ("Louisiana participates in the Restaurant Meals Program" alongside
"Louisiana does not currently operate a broad Restaurant Meals Program" in the same search
summary) — resolved by reading USDA's own authoritative, dated primary source directly: no
standing RMP exists. SEPARATELY, and genuinely time-sensitive: LDH announced (July 20, 2026) a
temporary, STATEWIDE hot-foods waiver for ALL SNAP participants (not RMP-style elderly/
disabled/homeless-only, and NOT extending to restaurant purchases) following Tropical Storm
Arthur, stated as effective through August 13, 2026 — one day after this pack's own fetch date.
See `freshness.json` for the disclosed, near-certain-to-be-stale expiration date.

## Finding 4 — a genuine stale-duplicate-article trap: a live 2021 Hurricane Ida "hot foods"
article on dcfs.louisiana.gov, easily confused with the current 2026 storm waiver

While researching Finding 3, this pack found `dcfs.louisiana.gov` hosts a still-live article
titled "'Hot Foods' Waiver Extended Through October 28" — a headline that, read on its own,
could plausibly describe the CURRENT 2026 Tropical Storm Arthur situation. Reading the article's
actual byline reveals it is dated **September 28, 2021**, and describes an unrelated,
long-expired Hurricane Ida hot-foods waiver extension (also through an "October 28," but of
2021). Nothing about the headline itself signals its true vintage. This pack explicitly did NOT
rely on this 2021 article for any current fact — this is the same category of finding as this
roster's Alabama pack's stale-duplicate-PDF discovery (Finding 3 in that pack), applied here to
a stale news article rather than a stale manual PDF.

## Finding 5 — Louisiana's EBT card is the "Louisiana Purchase Card," NOT the "Bayou Card" —
correcting a name that appears confidently across multiple secondary/AI-aggregator sites but
no Louisiana government primary source

This pack's research repeatedly surfaced the name "Bayou Card" for Louisiana's SNAP EBT card,
stated with apparent confidence across several SEO/AI-summary sites. Every Louisiana government
PRIMARY source this pack checked — Louisiana's own DCFS/LDH policy manual (a DSNAP benefit-info
handout, form DIS 15, titled "LOUISIANA PURCHASE CARD (EBT)"), the state's own official EBT-
processor client brochure (connectebt.com's "Your Louisiana Purchase Card"), and LDH's own EBT
FAQ pages — consistently and exclusively uses "Louisiana Purchase Card." This pack found no
Louisiana government page using "Bayou Card" at all. This is stated as a genuine correction:
"Bayou Card" appears to be a name that has propagated across AI-generated or SEO-optimized
third-party benefits sites without a traceable Louisiana government origin, the kind of
confidently-stated but ungrounded claim this roster's build process is specifically watching
for.

## Finding 6 — a disclosed gap, not a fabricated citation: Louisiana's own B-1030-SNAP
(resource limits) could not be independently located

Louisiana's B-1040-SNAP document ("Types of Resources") itself cites "B-1030-SNAP" by name as
the section governing "required resource limits" for non-categorically-eligible households.
This pack could not locate that specific document at a stable, independently-discoverable
`public.powerdms.com/LADCFS` URL despite multiple targeted search attempts and adjacent-
document-ID probing (Louisiana's PowerDMS document IDs are not sequentially organized by manual
section in any pattern this pack could exploit). The $3,000 (standard) / $4,500 (elderly-or-
disabled) resource-limit figures this pack states in `supplements.json` are corroborated
instead via B-1040-17-SNAP's OWN worked numerical example ("Ms. Smith is below the household's
$3000 resource limit after subtracting the amount of the federal tax refund from the checking
account balance") plus independent secondary confirmation (a DCFS/LDH SNAP-eligibility page
search snippet, and consistency with the current national FFY2026 figure this roster's Alabama
pack also independently confirmed) — not a direct read of B-1030-SNAP's full text. This is
disclosed explicitly in `freshness.json` rather than presented as a confirmed direct citation.

## Finding 7 — Louisiana's drug-felony SNAP ban: a FULL opt-out, confirmed with confidence as
the minority position

Louisiana is among a minority of states — per CLASP's "No More Double Punishments" report,
alongside North Dakota — that FULLY opted out (not merely modified) the federal drug-felony
SNAP ban: La. R.S. 46:233.3 (2017 Regular Session House Bill 681, effective October 1, 2017)
exempts ALL individuals domiciled in Louisiana from the federal 21 U.S.C. 862a(a)(2)
prohibition. This pack independently corroborates the FULL-opt-out reading — a stronger claim
than this roster's most recent prior finding, Alabama's MODIFIED/conditional pathway — by
reading Louisiana's own current disqualification manual directly: E-220-SNAP and E-222-SNAP
enumerate every category of SNAP member disqualification Louisiana's program currently applies
(SSN/alien/ABAWD-related issues, Intentional Program Violation, work-registration
non-compliance, fleeing-felon status, probation/parole violation, and a narrow post-February-
2014 felony list limited to Adam Walsh Act-style crimes), and a drug-related felony conviction,
by itself, appears on NEITHER list. This is a genuine confirmation-with-confidence finding, not
a correction — this pack states it plainly because it is the less-commonly-emphasized position
among the secondary sources this pack's initial research surfaced.

**Access caveat:** Justia returned HTTP 403 on direct fetch of La. R.S. 46:233.3's own text —
resolved via convergent secondary corroboration (CLASP, the Public Health Law Center's opt-out
map, a Louisiana Legislature bill-history search confirming HB 681's 2017 passage) cross-checked
against Louisiana's own primary-source manual, which independently confirms the same
substantive rule by omission. This pack did not read the Louisiana Legislature's own codified
statute text directly — see `freshness.json`.

## Finding 8 — Louisiana's ABAWD waivers are DOUBLE-locked-out: a 2024 Louisiana statute barred
them before OBBBA eliminated the federal mechanism nationwide

Louisiana's own 2024 Regular Legislative Session Act 308 states: "DCFS cannot seek or renew
waivers or offer state-provided exemptions to these work requirements unless required by
federal law" — a Louisiana-specific policy choice that predates the federal One Big Beautiful
Bill Act (OBBBA, enacted July 2025) by roughly a year. As a direct result, Louisiana's last 33
parish-level ABAWD waivers (more than half the state's 64 parishes, covering historically
high-unemployment areas including several rural and post-hurricane-recovery parishes) expired
October 1, 2024, and were not renewed — DCFS's own contemporaneous announcement states: "For
the first time in years, no time-limit waivers will be in effect in any of Louisiana's 64
parishes." OBBBA then independently eliminated the federal ABAWD-waiver mechanism nationwide
(effective November 2025) and raised the ABAWD age ceiling to 64. ABAWDMap.us's independent
aggregator confirms Louisiana holds zero ABAWD waivers statewide as of its last review (June
16, 2026). This pack specifically checked for any lingering post-hurricane exemption given
Louisiana's disaster history and found none currently in effect for ABAWD purposes (the
Tropical Storm Arthur hot-foods waiver, Finding 3, is a separate and unrelated mechanism).

## Finding 9 — Louisiana's BBCE income ceiling is a flat 200% FPL for every household — simpler
than this roster's most recent prior finding, Alabama's dual-track structure

Louisiana's Broad-Based Categorical Eligibility (BBCE) mechanism (E-280-SNAP) is structurally
SIMPLER than Alabama's: Louisiana households authorized to receive a non-cash TANF/MOE-funded
service via FITAP are subject to a flat 200% FPL gross income test REPLACING the ordinary 130%
test — with no additional condition that every household member be elderly or disabled, unlike
Alabama's dual-track 130%/200% structure. BBCE households have their resources excluded
entirely, and Louisiana's manual instructs staff not to even request resource verification for
these households. This is a genuine structural departure worth flagging precisely because this
roster's immediately-prior state (Alabama) documented a more complex dual-track version of
superficially the same policy area — Louisiana shows that BBCE's real-world implementation
varies meaningfully state to state even where the "200% FPL" headline figure is the same.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Louisiana has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding. A future `packages/snap-rules` build for Louisiana (out of scope for
this task, requiring its own separate, explicit go-ahead per the standing park rule) should
treat this pack's citations as a starting point, not a final answer, and should specifically
re-verify the flat 200% FPL BBCE ceiling (Finding 9), the full drug-felony opt-out (Finding 7),
the double-locked-out ABAWD waiver status (Finding 8), and — most importantly — directly locate
and read B-1030-SNAP (Finding 6) before hardcoding Louisiana's resource-limit figures into engine
constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Louisiana manual text,
checking specifically for: claims inferred from a section heading rather than its own body
text; dollar figures not traceable to a specific dated source; and any Louisiana-vs-common-
assumption contrast overclaimed as settled when the underlying evidence was genuinely ambiguous
or access-blocked. Concrete catches from this pass:

- The drug-felony finding (Finding 7) does NOT claim this pack read the statute's own text
  directly — it states plainly that Justia 403'd, and grounds the FULL-opt-out characterization
  in Louisiana's own manual's disqualification list by omission, which is independently
  verifiable primary-source evidence even without the statute text itself.
- The agency-transfer finding (Finding 1) does NOT claim DCFS no longer has any role in SNAP —
  it states specifically that the manual is still DCFS-PowerDMS-hosted and that DCFS's website
  still surfaces prominently, while the CURRENT administering agency is LDH, exactly as LDH's
  own primary-source press release states.
- The manual-rename finding (Finding 2) does NOT claim a confirmed causal link to Secretary
  Greenstein's "dependence to independence" quote — it states the timing correlation and
  explicitly flags that no external announcement of the rename was found, rather than asserting
  the connection as fact.
- The resource-limit finding (Finding 6) does NOT present the $3,000/$4,500 figures as read
  directly from B-1030-SNAP — it states plainly that B-1030-SNAP could not be located, and that
  the figures come from a worked example in a different document plus secondary corroboration.
- The BBCE finding (Finding 9) was checked against E-280-SNAP's FULL text (not just its section
  heading) to confirm the flat-200%-for-everyone structure, specifically because this roster's
  immediately-prior Alabama finding documented a more complex dual-track version of the same
  policy area and this pack wanted to avoid pattern-matching Alabama's structure onto Louisiana
  without verification.
- The "Bayou Card" correction (Finding 5) does not claim the name is never used anywhere — it
  states specifically that no Louisiana GOVERNMENT primary source this pack found uses it, while
  multiple non-government secondary sources do.
- The Restaurant Meals Program finding (Finding 3) does not claim Louisiana will never adopt a
  standing RMP — it states the current absence, sourced to USDA's own dated list, while
  separately and distinctly documenting the active-but-expiring disaster hot-foods waiver so the
  two are not conflated.

## Sources

| Source | Access | Dated |
|---|---|---|
| LA ES/EI Manual (`public.powerdms.com/LADCFS`), B-650, B-1010, B-1020, B-1040, C-660, C-661, C-720, E-220, E-221, E-222, E-280, J-300, S-110-SNAP | direct curl fetch (browser UA) | fetched 2026-08-12, current, no access barrier |
| LDH, "Louisiana Department of Health acquires Supplemental Nutrition Assistance Program from DCFS" | direct curl fetch (browser UA) | dated October 1, 2025 |
| LDH, Tropical Storm Arthur hot-foods waiver announcement | direct curl fetch (browser UA) | dated July 20, 2026, effective through August 13, 2026 |
| DCFS, "'Hot Foods' Waiver Extended Through October 28" | direct curl fetch (browser UA) | dated September 28, 2021 — STALE, Hurricane Ida, not relied on for current facts |
| DCFS, "Changes to SNAP Work Requirements Effective October 1" | direct curl fetch (browser UA) | dated September 30, 2024 |
| USDA FNA, SNAP Restaurant Meals Program state list | direct curl fetch (browser UA) | page updated August 7, 2026 — Louisiana absent |
| ABAWDMap.us, Louisiana state entry | direct curl fetch (browser UA) | fetched 2026-08-12 — "No waiver — rule applies," last reviewed June 16, 2026 |
| WorkWorldApp, state vehicle-rule reference | WebFetch | cross-check for the all-vehicles-excluded finding |
| connectebt.com, Louisiana client EBT brochure | WebSearch/cross-check | cross-check for the "Louisiana Purchase Card" finding |
| La. R.S. 46:233.3 (2017 Regular Session HB 681) | Justia HTTP 403 on direct fetch; resolved via secondary corroboration | not read directly — see freshness.json |
| CLASP, "No More Double Punishments" | WebSearch | secondary corroboration only, for the drug-felony opt-out finding |
| Public Health Law Center, SNAP Ban Opt-Out States Map | WebSearch | secondary corroboration only, for the drug-felony opt-out finding |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (LA guide questions), `eval/answer-eval.ts` (LA_GOLD, spread
into ALL_GOLD). Louisiana is deliberately NOT added to any engine-citations.ts per-state
constant map — Louisiana has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("LA", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Louisiana policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's,
Maryland's, Colorado's, South Carolina's, and Alabama's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Louisiana `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.
