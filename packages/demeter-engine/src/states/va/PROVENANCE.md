# Virginia pack — provenance

**Created:** 2026-08-11. Virginia is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, and New Jersey's prior builds, Virginia has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking
against an existing engine constant was possible or attempted; this pack's findings stand
entirely on its own primary-source research. This task's scope was CORPUS ONLY — the Demeter
chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the
standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (with a standard browser `User-Agent` header) of the complete, current
Virginia SNAP Manual (Volume V) PDF at dss.virginia.gov (8.1 MB, effective 10/01/2025, current
through Transmittal #36 dated 10/25), extracted to text with `pdftotext -layout` (33,131 lines),
searched section-by-section for every topic this pack covers. Cross-checked against Va. Code
§§ 63.2-505.2 and 63.2-801 (both fetched directly from law.lis.virginia.gov), USDA's official
ABAWD Time Limit Waivers FY2025-2029 index (fetched directly), VDSS's Restaurant Meals Program
public and eligibility pages (fetched directly), and WebSearch corroboration of SB1020/Chapter
321 (2025)'s legislative history.

## Finding 0 — a genuine negative result: no tooling barrier encountered anywhere in this build

Every dss.virginia.gov and law.lis.virginia.gov URL this pack tried returned a clean HTTP 200 on
the FIRST plain `curl` attempt with a browser User-Agent header — no moved link (unlike New
Jersey's pack in this roster), no bot-mitigation 403 (unlike North Carolina's manual host), no
plain-HTTP-only quirk (unlike Pennsylvania's Handbook). This is worth recording precisely because
it is the mirror image of the last three builds' most memorable methodological lesson: sometimes
the straightforward path really is available, and a build should not manufacture workaround
narrative where none was needed. The one soft exception: USDA's national FY2026 SUA values
rollup page (`fns.usda.gov/snap/admin/sua-fy26`) did not render its underlying data table in
fetchable inline HTML text — likely a downloadable-resource link this pack did not separately
chase down — but this did not block anything, since Virginia's own manual already states its SUA
figures directly and authoritatively (see Finding 3).

## Finding 1 (flagship) — Virginia currently has ZERO active ABAWD waivers anywhere, a genuine reversal from its own multi-year waiver history

Virginia SNAP Manual Appendix I ("Localities Whose Residents Are Exempted from the Work
Requirement") is a historical table tracking waived areas across four periods: a STATEWIDE
exemption from April 2020 through June 2023; a list of specific waived localities (Brunswick,
Buchanan, Danville, Franklin City, Greensville/Emporia, Hopewell, Nottoway, Petersburg,
Portsmouth, Prince George, Sussex, and Dinwiddie) from July 2023 through June 2024; a narrower
list (Brunswick, Buchanan, Danville, Dickenson, Dinwiddie, Greensville/Emporia, Hopewell,
Martinsville, Petersburg, Surry, Sussex) from July 2024 through June 2025; and, as of July 2025:
**"No exempt areas."** This pack independently fetched USDA's own official ABAWD Time Limit
Waivers FY2025-2029 index directly (updated July 22, 2026) and confirmed Virginia is ABSENT from
the list of states that submitted ANY waiver request in the FY2025 or FY2026 cycle — a list that
includes over 20 other states and DC. Two independent sources agree: Virginia's own manual and
USDA's own national index.

This is worth flagging clearly because a reader relying on Virginia's own multi-year waiver
history (or general awareness that Virginia has both dense Northern-Virginia/DC-suburb counties
and low-density rural Southside/Appalachian counties, several of which appear repeatedly on the
PRE-2025 waived-locality list above) could easily and reasonably assume some Virginia locality
is still covered. None is, as of this pack's build date — every Virginia locality is currently
subject to the standard 3-in-36-month ABAWD time limit with no waiver exception.

## Finding 2 — a genuine internal-document inconsistency: Virginia's own Appendix I footnote is stale relative to its own body text

Virginia SNAP Manual Part XV.A states directly, in its own current body text (Transmittal #36,
10/25), that the 36-month ABAWD tracking period applies to "any household member who is at least
18 and under 65 years of age" — the correct post-OBBBA 18-64 age range. But Appendix I's own
footnote, in the SAME manual, instructs staff to "track the work requirement for all household
members except those persons under 18 or over age 54" — the PRE-OBBBA 18-54 range, not updated
to match Part XV.A elsewhere in the same document. This is a codification-lag finding
structurally similar to this roster's New Jersey pack (which found a stale resource-limit figure
in N.J.A.C. 10:87-4.11's own un-amended text), but here the lag is between two sections of the
SAME single document rather than between a state regulation and current federal practice — worth
flagging distinctly since it means even a reader working entirely from Virginia's OWN manual
could land on two different age ranges depending on which section they read.

## Finding 3 — a genuine structural departure: Virginia's utility standard is size-scaled, but flatter than North Carolina's, with only two tiers total (not three)

Virginia SNAP Manual Part X.A.4.e sets the utility standard at $375/month for a residence of 1-3
persons and $476/month for 4 or more — SIZE-SCALED, a genuine departure from most flat-SUA states
this roster has documented (Ohio, Pennsylvania, Wisconsin, Minnesota, New Jersey's HCSUA figure).
This roster's North Carolina pack already documents a size-scaled SUA, but North Carolina scales
across FIVE bands (1, 2, 3, 4, 5+) with THREE separate tiers (SUA for heating/cooling households,
BUA for households with two or more non-heating utility expenses, TUA for telephone-only
households). Virginia's structure is flatter on BOTH axes: only TWO size bands, and — more
structurally distinctive — only TWO tiers total. Virginia's single "utility standard" already
bundles heat, cooling, electricity, gas, water, sewerage, septic maintenance, garbage collection,
AND the basic telephone service fee together (Part X.A.4.f explicitly folds the telephone
line into the utility standard for households that qualify for it) — there is no intermediate
"non-heating, multiple other utilities" tier the way North Carolina's BUA or a typical three-tier
state's LUA provides. A household not entitled to the utility standard either uses actual costs,
or — if its ONLY utility expense is a telephone — claims a separate flat $54/month telephone
standard. This pack flags the contrast explicitly: a reader should not assume every size-scaled
SUA state in this roster follows North Carolina's five-band, three-tier shape; Virginia's is a
genuinely different, simpler structure.

## Finding 4 — a genuine and unusual structural finding: Virginia's BBCE threshold and no-asset-limit rule are codified directly in STATUTE, not just agency manual policy

Virginia SNAP Manual Part II.G.3 documents the operative 200% FPL BBCE rule, but this pack traced
the rule to its statutory root: Va. Code § 63.2-801(B), fetched directly from
law.lis.virginia.gov, directs the State Board of Social Services to "(ii) set the gross income
eligibility standard for SNAP benefits at 200 percent of the federal poverty guidelines, and
(iii) not impose an asset limit for eligibility for SNAP benefits," "to the extent authorized by
federal law and regulations." Every other BBCE state this roster has documented so far sets its
threshold through agency policy/regulation alone (New Jersey's N.J.A.C. 10:87-2.36, for example,
is Executive-Branch regulation, not statute) — a future policy reversal in those states requires
only a regulatory change. In Virginia, reversing or narrowing BBCE would require the General
Assembly to amend Title 63.2 itself, a meaningfully higher bar. This same statute subsection (A)
also codifies Virginia's Restaurant Meals Program mandate (see Finding 5) and subsection (C) bars
requiring in-person appearance for SNAP application or renewal, "to the extent authorized by
federal law and regulations" — a beneficiary-facing access provision this pack did not find an
equivalent for in any other state this roster has built so far.

## Finding 5 — Virginia's Restaurant Meals Program is real, current, and statutorily MANDATORY for every locality — a direct contrast with New Jersey's dead bill

This roster's New Jersey pack documents a Restaurant Meals Program bill that has died in
committee three separate legislative sessions without ever being enacted. Virginia's own program
(VRMP) is the opposite case, confirmed through three independent sources: (1) Virginia's SNAP
Manual (Part I.C) instructs caseworkers to describe VRMP to households and explicitly carves VRMP
meals out of the general hot-foods purchase restriction; (2) Va. Code § 63.2-801(A), fetched
directly, states "[SNAP] program shall include participation in the Restaurant Meals Program" as
part of a program "in which each political subdivision in the Commonwealth shall participate" —
an unusually strong statutory MANDATE, not a local-option or agency-discretion program; (3) SB1020
(2025 session), enacted as Chapter 321, approved by the Governor March 21, 2025 and effective
July 1, 2025, separately required VDSS to report on VRMP's implementation to the Governor and
General Assembly by December 1, 2025 — confirming VRMP is a live, actively-monitored, and quite
RECENT program (about one year old as of this pack's build date), not a longstanding fixture a
reader might assume has been stable for years. This pack also checked USDA's official RMP state
list (referenced, but not independently re-fetched in this pass, per the New Jersey pack's own
citation) and confirms Virginia's inclusion is corroborated by the WebSearch summary used during
this pack's research, which separately lists Virginia among the nine RMP states nationally.

## Finding 6 — Virginia excludes child support from income entirely, like New Jersey and Illinois, with one internal wording quirk worth flagging

Virginia SNAP Manual Part XI.F.17 places legally obligated child support (including vendor
payments and arrearages, explicitly EXCLUDING alimony/spousal support) in the "Excluded Income"
chapter — the INCOME EXCLUSION mechanism (7 CFR 273.9(c)), the same mechanism this roster's
Illinois and New Jersey packs document, and a contrast with the ORDINARY DEDUCTION mechanism this
roster's North Carolina, Ohio, Georgia, Michigan, Minnesota, Oregon, Pennsylvania, and Wisconsin
packs document. Worth flagging separately: Virginia's own Part X.A.4 (Shelter Expense) informally
describes "the child support deduction" as one of several items subtracted to reach "adjusted net
income" — casual language that could mislead a reader into treating it as an ordinary Part X
deduction, when Part XI.F.17's formal treatment (and its placement in the Excluded Income chapter)
makes clear it operates earlier in the income calculation, as an exclusion. This pack states the
mechanism using Part XI.F.17's own formal placement and section title, not Part X.A.4's informal
phrasing.

## Finding 7 — Virginia is a full statutory drug-felony opt-out, amended into its current form in 2020

Va. Code § 63.2-505.2, fetched directly, states: "A person who is otherwise eligible to receive
food stamp benefits shall be exempt from the application of § 115(a) of the federal Personal
Responsibility and Work Opportunity Reconciliation Act of 1996... and shall not be denied such
assistance solely because he has been convicted of a drug-related felony." The statute's own
history note shows it originated in 2005 (c. 576) — likely a narrower, modified-ban version — and
was AMENDED in 2020 (cc. 221, 361) to its current full-opt-out form, matching contemporaneous
news coverage (Virginia Mercury, VPM) of 2020 legislation ending Virginia's SNAP and TANF
drug-felony bans effective July 1, 2020. Virginia's SNAP Manual contains no drug-felony
disqualification provision anywhere in the full text this pack fetched and searched, consistent
with the statute. This pack did not attempt to independently source the PRE-2020 (2005-2020)
"modified ban" text, since it is superseded and not the operative current rule — flagged as an
intentionally out-of-scope historical detail, not a gap in the current-law finding.

## Confirmed — no discrepancy found (no engine constant existed to check against)

Virginia has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every dollar figure, categorical-eligibility
rule, and disqualification rule above is a first-pass primary-source finding, not a cross-check
against prior engineering work. A future `packages/snap-rules` build for Virginia (out of scope
for this task, requiring its own explicit go-ahead per the standing park rule) should treat this
pack's citations as a starting point, not a final answer, and re-verify independently —
particularly the utility-standard national cross-check (Finding-adjacent gap, see
`freshness.json`), which this pack could only source from Virginia's own manual, not an
independent USDA rollup.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Virginia SNAP Manual text or
statute, checking specifically for: claims inferred from a section heading rather than its own
body text; dollar figures not traceable to a specific dated source; and any Virginia-vs-common-
assumption contrast overclaimed as settled when the underlying evidence was genuinely ambiguous.
Concrete catches from this pass:

- The ABAWD-waiver finding (Finding 1) was NOT accepted from Virginia's own manual table alone —
  USDA's own FY2025-2029 waiver-response index was independently fetched and checked for
  Virginia's presence/absence directly, rather than trusting the manual's own "No exempt areas"
  line as the sole source. Both agree.
- The stale-footnote finding (Finding 2) is stated narrowly as an internal-document
  inconsistency, NOT as a live compliance risk — this pack does not claim VDSS staff are actually
  using the wrong age range in practice, only that the manual's own text is internally
  inconsistent and a reader should rely on Part XV.A's body text, not Appendix I's footnote.
- The size-scaled-SUA finding (Finding 3) is stated as a comparison to North Carolina's
  SPECIFIC five-band/three-tier structure, not a blanket "Virginia is unique" claim — this pack
  checked North Carolina's own pack directly (rather than from memory) before drafting the
  contrast, to state the comparison precisely rather than approximately.
- The statutory-BBCE finding (Finding 4) does not merely note that Virginia's threshold happens
  to be stated in a statute this pack found — it explicitly reasons through the practical
  consequence (a future reversal requires legislative action, not just agency rulemaking) rather
  than treating the citation-family difference as cosmetic.
- The VRMP finding (Finding 5) is stated using THREE independent sources (Virginia's own manual,
  the Code of Virginia statute text, and the SB1020/Chapter 321 legislative history) rather than
  a single source, specifically because this roster's New Jersey pack shows how easy it is for a
  program's ACTUAL bill-status (introduced vs. enacted) to be misreported by secondary sources —
  this pack independently confirmed SB1020 was actually APPROVED (not merely introduced) via its
  Chapter 321 enactment number and Governor-approval date.
- The child-support mechanism finding (Finding 6) is stated using ONLY Part XI.F.17's own
  section title and chapter placement ("Excluded Income") to determine the mechanism, not
  Part X.A.4's informal "deduction" language — this pack did not let the more casual, more
  visible phrasing override the more precise, formally-titled section.
- Where this pack could not confirm a detail (Virginia's full itemized medical-expense category
  list, a current VRMP restaurant roster, an independent USDA SUA cross-check), it says so
  directly in `freshness.json` rather than defaulting silently to another state's pattern or
  inventing a Virginia-specific rule.

## Sources

| Source | Access | Dated |
|---|---|---|
| Virginia SNAP Manual (Volume V), complete PDF | direct curl fetch (browser UA) + pdftotext -layout | effective 10/01/2025, current through Transmittal #36 (10/25) |
| Virginia SNAP Manual Part I.C, Benefit Issuance and Use (VRMP) | direct curl fetch (browser UA) + pdftotext | Transmittal #35 (10/24) |
| Virginia SNAP Manual Part II.G.3, Categorical Eligibility for PA Households | direct curl fetch (browser UA) + pdftotext | Transmittal #35 (10/24) |
| Virginia SNAP Manual Part IV.A, Certification Periods | direct curl fetch (browser UA) + pdftotext | Transmittal #35 (10/24) |
| Virginia SNAP Manual Part V.A, C, Expedited Services | direct curl fetch (browser UA) + pdftotext | Transmittal #35 (10/24) |
| Virginia SNAP Manual Part IX.A-D, Resources | direct curl fetch (browser UA) + pdftotext | Transmittal #35 (10/24) |
| Virginia SNAP Manual Part X.A.1-6, Income Deductions | direct curl fetch (browser UA) + pdftotext | Transmittal #36 (10/25) |
| Virginia SNAP Manual Part XI.F.17, Legally Obligated Child Support Payments | direct curl fetch (browser UA) + pdftotext | Transmittal #35 (10/24) |
| Virginia SNAP Manual Part XV.A and Appendix I, Work Requirement/ABAWD | direct curl fetch (browser UA) + pdftotext | Transmittal #36 (10/25) |
| Va. Code § 63.2-505.2, Eligibility for food stamps; drug-related felonies | direct curl fetch (browser UA) | fetched 2026-08-11; enacted 2005 c.576, amended 2020 cc.221/361 |
| Va. Code § 63.2-801, SNAP benefits program | direct curl fetch (browser UA) | fetched 2026-08-11 |
| USDA FNS/FNA, Time Limit Waivers FY 2025-2029 index | direct curl fetch (browser UA) | fetched 2026-08-11, page updated 7/22/2026 |
| VDSS, Virginia Restaurant Meals Program (VRMP) public page | WebFetch | fetched 2026-08-11 |
| VDSS, VRMP index page (dss.virginia.gov/vrmp/index.cgi) | direct curl fetch (browser UA) | fetched 2026-08-11 |
| Virginia Regulatory Town Hall / rga.lis.virginia.gov record for SB1020 (2025)/Chapter 321 | WebSearch | fetched 2026-08-11 |
| VPM, "Virginia Repeals Benefits Ban for Drug Convictions" | WebSearch | 2020-07-03, referenced for corroboration only |
| Collateral Consequences Resource Center national SNAP/TANF drug-felony survey | WebSearch summary | fetched 2026-08-11, referenced for corroboration only |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (VA guide questions), `eval/answer-eval.ts` (VA_GOLD, spread
into ALL_GOLD). Virginia is deliberately NOT added to `engine-citations.ts`'s `BBCE_PCT` map —
that map mirrors `packages/snap-rules`' per-state constant by design, and Virginia has no
`packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("VA", ...)` will
throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build adds a
Virginia policy — this matches the precedent already set by New York's, North Carolina's, and New
Jersey's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Virginia `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.
