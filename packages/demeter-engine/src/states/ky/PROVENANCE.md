# Kentucky pack — provenance

**Created:** 2026-08-12. Kentucky is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, and Louisiana's prior builds, Kentucky has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking
against an existing engine constant was possible or attempted; this pack's findings stand
entirely on its own primary-source research. This task's scope was CORPUS ONLY — the Demeter
chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the
standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (browser User-Agent) of Kentucky's Division of Family Support Operation
Manual, Volume 2 (`chfs.ky.gov/agencies/dcbs/dfs/Documents/OMVOLII.pdf`, 197 pages, current
through R. 8/1/26/OMTL-704) and Volume IIA (`OMVOLIIA.pdf`, SNAP Work Requirements/ABAWD,
individual sections current through R. 10/25/25/OMTL-683), converted with `pdftotext -layout`.
Also directly fetched: Kentucky's current consumer-facing SNAP page
(`chfs.ky.gov/agencies/dcbs/dfs/nab/Pages/snap.aspx`); the `benefind.ky.gov`/"kynect benefits"
application portal landing page; KRS 205.2005 read directly from Kentucky's own
`apps.legislature.ky.gov` statute database; USDA FNA's current Restaurant Meals Program state
list and Kentucky Disaster Nutrition Assistance page; ABAWDMap.us's Kentucky entry; and — to
independently verify a going-in assumption about manual structure — Kentucky's Volume 3
(`OMVOLIII.pdf`) and Volume IIIA (`OMVOLIIIA.pdf`). WebSearch cross-checks corroborated the
ABAWD-waiver and drug-felony-opt-out timelines against independent secondary reporting.

## Finding 0 — no HTTP access barrier encountered on any Kentucky government host, including a
direct, successful read of the drug-felony opt-out statute itself

`chfs.ky.gov`, `apps.legislature.ky.gov`, and `benefind.ky.gov` all returned clean HTTP 200
responses to direct curl with a browser User-Agent on every fetch attempt — no login wall, no
rate limiting, no 403. Distinctively for this roster: KRS 205.2005 (Kentucky's drug-felony SNAP
opt-out statute) was fetched and read directly from Kentucky's own legislature database with no
access barrier at all — a genuine departure from the Justia-403 pattern this roster has
documented repeatedly for equivalent statutes in Louisiana, Virginia, Indiana, Missouri,
Maryland, Colorado, South Carolina, and Alabama.

## Finding 1 (flagship, structural) — Kentucky's SNAP manual is Volume 2, not "Volume III" —
Volume III is Kentucky's KTAP (TANF) manual, a different program entirely

Going into this build, the working assumption (stated in this pack's own task brief) was that
"Kentucky's SNAP manual is traditionally organized as 'Volume III' of the broader Family Support
manual series." This pack fetched `OMVOLIII.pdf` directly to verify this and found its own title
page reads: "Division of Family Support, Operation Manual Volume 3 ... Kentucky Transitional
Assistance Program (KTAP), Table of Contents" — Kentucky's TANF cash-assistance program, an
entirely separate program with its own time limits, sanctions, and technical-eligibility rules.
The companion volume, IIIA, is similarly not SNAP-related: its title page reads "Kentucky Works
Program (KWP)," KTAP's work-activity component. Kentucky's ACTUAL, current SNAP manual is
**Volume 2** ("Volume II — Supplemental Nutrition Assistance Program (SNAP)"), current through
revision 8/1/26 (OMTL-704) — fetched directly and confirmed via its own title page and the "SNAP"
keyword appearing throughout (Volume III's own text, by contrast, contains only 28 incidental
mentions of "SNAP," all in a KTAP-vs-SNAP cross-reference context, never as its own subject).
ABAWD/work-requirement policy lives in a companion volume, **Volume IIA** ("SNAP Work
Requirements"), also fetched and confirmed directly. This is a genuine, disclosed correction of a
premise this pack was built to test, not an assumption carried through uncorrected.

## Finding 2 — Kentucky's own consumer-facing SNAP page states resource limits one federal COLA
cycle out of date relative to its own current policy manual

Kentucky's current policy manual (MS 5000, revised October 1, 2024) sets the SNAP resource limit
at $3,000 (standard) / $4,500 (household with a disabled member or a member 60+) — matching the
current national FFY2026 figure this roster's Louisiana, Alabama, Missouri, Maryland, and
Colorado packs have each independently confirmed, and internally consistent with the FFY2026
income-eligibility table (MS 5200, also fetched the same day). Kentucky's own
`chfs.ky.gov/agencies/dcbs/dfs/nab/Pages/snap.aspx` consumer page — fetched directly the same
day, clean HTTP 200, with no visible "last updated" staleness marker — instead states "$2,250 in
cash and bank account assets" and "$3,500 in resources" for a household with a member 60+, figures
that match an OLDER federal resource-limit cycle (approximately FFY2019-2020), not the current
one. This pack treats the policy manual's more recently and more specifically dated figures as
authoritative and discloses the consumer page's apparent staleness explicitly as a genuine finding
worth flagging to a reader who might otherwise land on the consumer page first.

## Finding 3 — Kentucky's drug-felony SNAP ban: a FULL opt-out (2021), confirmed with confidence
— alongside two disclosed, stale internal-manual artifacts that predate/narrowly precede it, and
a genuinely distinct, ACTIVE child-support-arrearage disqualification

Kentucky is among the minority of states that FULLY opted out (not merely modified) the federal
drug-felony SNAP ban: KRS 205.2005, effective June 29, 2021 (2021 Ky. Acts ch. 182, sec. 4),
reads in full: "Pursuant to 21 U.S.C. sec. 862a(d)(1), all individuals residing in Kentucky shall
be exempt from the application of 21 U.S.C. sec. 862a(a)." This pack read the statute directly
(see Finding 0) and independently corroborates the full-opt-out reading via Kentucky's own
CURRENT disqualification lists (MS 3455*, revised August 1, 2026; MS 5520, revised April 1,
2021): neither carries a drug-felony category among the reasons a member can be disqualified.
**Disclosed, not concealed:** this pack also found two internal manual artifacts that still
reference drug-felony language and were not scrubbed after KRS 205.2005 took effect — MS 5040
("Resources - Excluded"), dated August 1, 2010 (over a decade before the opt-out), which mentions
a "drug-related felony disqualification," and MS 7070 ("Household Failure to Cooperate"), dated
April 1, 2021 (three months before the opt-out took effect), which lists "Drug felons" among
household-member cooperation categories. Both are treated in this pack as stale artifacts inside
an otherwise current manual, not evidence of an active ban — the manual's own most-recently-dated
disqualification lists control, and they match the statute. **Separately and distinctly:**
Kentucky DOES actively disqualify SNAP members who are $500 or more delinquent on legally
obligated child support they OWE (MS 2380/2385, both revised June 1, 2026), identified via an
automated match against the Kentucky Automated Support and Enforcement System (KASES) — an
entirely different mechanism from the federal drug-felony ban, optional under federal law, and
not something this pack found explicitly documented in this roster's prior states' packs.

## Finding 4 (flagship, time-sensitive) — Kentucky's current ABAWD waiver status: all 120
counties subject as of Nov. 1, 2025, but a narrow 5-Appalachian-county waiver took effect Dec. 1,
2025 — a conflict this pack found against a third-party aggregator

Kentucky's own current consumer SNAP page states two dated facts in direct sequence: "Effective
November 1, 2025, Able-Bodied Adults without Dependents (ABAWDs) in all 120 counties will be
subject to the ABAWD requirements to remain eligible for SNAP benefits," followed by "Effective
December 1, 2025, the counties of Elliott, Lewis, Magoffin, Martin and Wolfe will be exempt from
ABAWD requirements." All five counties sit in Kentucky's Appalachian east — exactly the region
this pack's own build guidance flagged as worth checking carefully. This pack found a genuine,
disclosed conflict: ABAWDMap.us, an independent third-party aggregator (fetched directly, clean
HTTP 200, "last verified June 16, 2026" — five to seven months after Kentucky's own December 2025
announcement), states "No waiver — rule applies" statewide, with its own text reading, "The
statewide waiver was reinstated only through Nov 30, 2025 and has since expired" — apparently
describing only the END of Kentucky's much broader, prior (117-county) waiver, without picking up
the narrower successor waiver CHFS's own page separately describes. This pack treats Kentucky's
own, more recently and more specifically dated primary source as authoritative for this pack's
gold cases, and discloses the aggregator conflict explicitly rather than silently picking a side —
see `freshness.json` for the disclosed re-verification window, since a narrow 5-county waiver like
this is exactly the kind of fact that can lapse or expand on short notice.

## Finding 5 — Kentucky's EBT card has no distinctive branded name — a fabricated "Kentucky
Purchase EBT Card" name surfaced in this pack's own initial research and was rejected

This pack's own initial WebSearch-generated summary confidently asserted Kentucky's EBT card is
officially called the "Kentucky Purchase EBT Card." Direct primary-source verification (Kentucky's
own policy manual, 2,000+ occurrences of "EBT card" with no distinctive branding anywhere, and the
consumer SNAP page, same) found no support for this name at all. This pack treats it as a likely
AI-summarizer artifact — probably pattern-matched off this roster's own Louisiana finding (the
genuinely, repeatedly documented "Louisiana Purchase Card") without a Kentucky-specific basis —
and explicitly does not repeat it as fact, unlike Louisiana's case where the distinctive name IS
real and independently corroborated across multiple sources.

## Finding 6 — Kentucky's ECE (its term for BBCE) is a genuine third variant: dual-track income
ceiling PLUS a universal resource-test waiver, distinct from both this roster's flat-200%
(Louisiana) and its described dual-track (Alabama) patterns

Kentucky calls its categorical-eligibility expansion mechanism "Expanded Categorical Eligibility"
(ECE) rather than "Broad-Based Categorical Eligibility" (BBCE), though the underlying federal
authority (7 CFR 273.2(j)) is the same. Kentucky's own manual (MS 3160, MS 3175, MS 5200) states
the mechanism precisely: non-elderly/non-disabled ECE households remain capped at the ORDINARY
130% FPL gross-income ceiling — no income expansion at all — while only households in which ALL
members are elderly or disabled get the elevated 200% FPL ceiling. BOTH tracks, however, get the
resource/asset test waived entirely. This means ECE's real, universal benefit for most Kentucky
households is the asset-test waiver, not a higher income door — a genuinely different shape from
this roster's Louisiana pack (flat 200% FPL for every ECE household, resources also waived) and
worth stating precisely rather than assuming Kentucky mirrors either pattern this roster has
already documented.

## Finding 7 — Kentucky's expedited-service processing standard is 5 calendar days, faster than
the federal 7-day floor most SNAP guidance cites

MS 6400/6430/6450 (all revised May 31, 2026) confirm Kentucky processes expedited SNAP
applications within 5 calendar days (in practice, disposed of by the 4th calendar day after
filing), not the federal 7-calendar-day ceiling. This pack verified this is Kentucky's own
internal processing standard, exceeding rather than merely meeting the federal floor, and applies
this precisely rather than defaulting to the generic "7 days" figure this roster's other packs
have generally cited.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Kentucky has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding. A future `packages/snap-rules` build for Kentucky (out of scope for this
task, requiring its own separate, explicit go-ahead per the standing park rule) should treat this
pack's citations as a starting point, not a final answer, and should specifically re-verify the
current ABAWD 5-county waiver status (Finding 4, the most volatile fact in this pack), the dual-
track ECE income ceiling (Finding 6), and whether Kentucky's own consumer SNAP page has since
corrected its stale resource-limit figures (Finding 2) before hardcoding Kentucky's parameters
into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Kentucky manual text,
checking specifically for: claims inferred from a section heading rather than its own body text;
dollar figures not traceable to a specific dated source; and any Kentucky-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- The Volume-2-not-Volume-III finding (Finding 1) does not merely assert the correction — it is
  grounded in this pack directly fetching AND reading both Volume III's and Volume IIA's own
  title pages, not inferred from a search-result snippet or file name alone.
- Initial review of MS 2350 ("Criminals") noticed language referencing "a high misdemeanor under
  the law of New Jersey" inside Kentucky's own current manual and flagged it as a possible
  copy-paste artifact worth a finding. On closer reading, this phrasing tracks the federal
  regulation's own text (7 CFR 273.11(m), which carries a New-Jersey-specific carve-out for that
  state's distinct "high misdemeanor" crime classification, applicable whenever the underlying
  fleeing-felon warrant originated in New Jersey, regardless of which state's SNAP office is
  applying the rule) — this is expected federal boilerplate every state's manual would replicate
  verbatim, not a Kentucky-specific drafting error, and this pack does NOT present it as a
  finding.
- The drug-felony finding (Finding 3) does not claim the two stale manual artifacts (MS 5040, MS
  7070) prove an active ban — it states plainly that Kentucky's own MOST RECENTLY DATED
  disqualification lists control and match the statute, while disclosing the stale artifacts as a
  genuine, unresolved inconsistency rather than silently omitting them.
- The ABAWD 5-county-waiver finding (Finding 4) does not simply prefer Kentucky's own page over
  ABAWDMap.us without disclosure — it states the specific dates and the aggregator's own
  "last verified" date side by side, so a reader can judge the conflict's likely resolution
  (Kentucky's page is more specific and more recently timestamped relative to the fact in
  question) rather than presenting a false consensus.
- The resource-limit-stale finding (Finding 2) does not claim the consumer page is definitively
  wrong forever — it is disclosed with an explicit re-verification date in `freshness.json`,
  since CHFS could correct the page at any time.
- The "Kentucky Purchase EBT Card" correction (Finding 5) does not claim NO state calls its card
  something distinctive — it states specifically that Kentucky's own primary sources use no
  distinctive name, in direct contrast to this roster's Louisiana finding, where the distinctive
  name IS real and corroborated.
- The ECE dual-track finding (Finding 6) was checked against MS 3160's, MS 3175's, AND MS 5200's
  full text together (not just one section) specifically because MS 5200's own phrasing in
  isolation ("200 Percent FPL - This applies to households meeting ECE requirements") could be
  misread as flat-200%-for-everyone if read without MS 3160's explicit dual-track carve-out.

## Sources

| Source | Access | Dated |
|---|---|---|
| KY DCBS Operation Manual, Volume 2 (SNAP), `OMVOLII.pdf` | direct curl fetch (browser UA) | fetched 2026-08-12, cover TOC R. 8/1/26/OMTL-704, individual sections through 7/15/26 |
| KY DCBS Operation Manual, Volume IIA (SNAP Work Requirements), `OMVOLIIA.pdf` | direct curl fetch (browser UA) | fetched 2026-08-12, individual sections through R. 10/25/25/OMTL-683 |
| KY DCBS Operation Manual, Volume 3 (KTAP) and Volume IIIA (KWP) | direct curl fetch (browser UA) | fetched 2026-08-12, specifically to disprove the Volume-III-is-SNAP assumption |
| KY CHFS, Supplemental Nutrition Assistance Program (SNAP) consumer page | direct curl fetch (browser UA) | fetched 2026-08-12, current ABAWD dates; resource-limit figures found stale — see Finding 2 |
| KRS 205.2005, Opt-out of 21 U.S.C. sec. 862a(a) | direct curl fetch (browser UA), full text read directly, no access barrier | effective June 29, 2021 |
| benefind.ky.gov / "kynect benefits" portal | direct curl fetch (browser UA) | fetched 2026-08-12 |
| USDA FNA, SNAP Restaurant Meals Program state list | direct curl fetch (browser UA) | page updated August 7, 2026 — Kentucky absent |
| USDA FNA, Kentucky Disaster Nutrition Assistance | direct curl fetch (browser UA) | fetched 2026-08-12 — no active disaster response efforts |
| ABAWDMap.us, Kentucky state entry | direct curl fetch (browser UA) | "last verified June 16, 2026" — apparent conflict with CHFS's own current page, see Finding 4 |
| KY CHFS, "ABAWD Changes in Eight Counties" press release | direct curl fetch (browser UA) | dated April 22, 2016 — historical context only, NOT relied on for current facts |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (KY guide questions), `eval/answer-eval.ts` (KY_GOLD, spread
into ALL_GOLD). Kentucky is deliberately NOT added to any `engine-citations.ts` per-state
constant map — Kentucky has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("KY", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Kentucky policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's,
Maryland's, Colorado's, South Carolina's, Alabama's, and Louisiana's corpus packs in this same
roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Kentucky `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.
