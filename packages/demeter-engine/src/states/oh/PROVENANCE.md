# Ohio pack — provenance

**Created:** 2026-08-11. Ohio is an unusual case in this roster: unlike every other 2026-built
state, Ohio ALREADY had a full, independently-verified `StatePolicy` entry in
`packages/snap-rules/src/constants/states.ts` (bbce_threshold_pct=130, asset_waiver=true,
sua_by_tier HCSUA=766/LUA=479/phone=46, drug_felony_ban=false — verified full opt-out per Ohio
Rev. Code § 5101.84 — abawd_waiver_avail=true, rmp_operated=false, allotment_tier=48) AND full
92-profile oracle-fixture coverage in `data-ops/sample/civica-test-profiles/v0.6.json`, verified
129/0/0 against the real engine. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A
content layer — and did not touch `packages/snap-rules` or the oracle fixture, both of which stay
fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct fetch of individual Ohio Administrative Code (OAC) Division 5101:4 rule pages at
`codes.ohio.gov`, Ohio Revised Code (ORC) sections at the same host, and ODJFS's own Food
Assistance Change Transmittal No. 105 (the FFY26 dollar-figure source, fetched as a PDF and read
directly). Ohio's `codes.ohio.gov` host is native HTTPS with no access barrier — unlike
Pennsylvania's plain-HTTP-only legacy CMS elsewhere in this roster, every fetch here worked on the
first attempt via the normal tool chain, EXCEPT one case described in Finding 0 below, where a
summarizing fetch tool gave two contradictory paraphrases of the same rule on two separate passes
and had to be resolved by pulling the raw authenticated PDF and reading it directly.

## Finding 0 — a paraphrase-tool reliability lesson, resolved by reading the primary text directly

Two separate fetches of the SAME rule (OAC 5101:4-2-02, the categorical-eligibility rule) through a
summarizing tool gave DIRECTLY CONTRADICTORY answers to the same question — "does the Ohio
careline pathway waive the 130% gross income test, or only the resource and net-income tests?" —
on two consecutive passes within the same session. The first pass said all three factors (130%
gross, net income, resource) are waived for Careline households, matching the OWF/SSI/PRC
pathway's waived-factors list. The second pass said the 130% gross test specifically was NOT
waived for Careline, contradicting the first. Rather than trusting either paraphrase, this pack
pulled the authenticated, LSC-stamped PDF of OAC 5101:4-2-02 directly (`curl` to
`codes.ohio.gov/assets/laws/administrative-code/authenticated/5101/4/2/5101$4-2-02_20241001.pdf`)
and read the raw text. The primary source resolves the ambiguity unambiguously: paragraph (C)
("What eligibility factors are waived for assistance groups determined categorically eligible?")
lists all three factors — the 130% gross income limit, the net income limit, and the resource
limit — with NO carve-out distinguishing Ohio careline households from OWF/SSI/PRC households. All
three factors are waived for ALL categorically eligible pathways defined in the rule, Ohio careline
included. This is disclosed here as a methodological lesson for future corpus builds in this
roster: when a summarizing tool gives an answer that would materially change a flagship finding,
re-verify against the raw primary text before drafting, exactly as this roster's Pennsylvania and
Minnesota builds already established for different kinds of access problems.

## Two discrepancies against the ALREADY-VERIFIED snap-rules OH entry — disclosed, not resolved

Per this task's explicit instruction, these are stated plainly rather than silently reconciled.
`packages/snap-rules` is out of scope for this task; a human needs to decide what, if anything,
changes there.

### 1. BBCE threshold: states.ts says 130%; this pack found a genuine 200% FPL pathway

`states.ts`'s comment for Ohio reads: *"Ohio is BBCE at the FEDERAL 130% — categorical eligibility
that waives the asset test without raising the income screen, the same archetype as Georgia."* This
pack's direct read of OAC 5101:4-2-02 (effective October 1, 2024) found a DIFFERENT pathway,
"Ohio careline," that the states.ts comment does not mention: any assistance group with gross
income at or below 200% of the federal poverty level that receives a notice-plus-text-message
about Ohio Careline's crisis-support services (delivered routinely on the approval notice, at
BOTH application and recertification — not something the household must separately seek out) is
categorically eligible, with the SAME three factors waived as the OWF/SSI/PRC pathway: the 130%
gross test, the net income test, AND the resource limit (OAC 5101:4-2-02(C), confirmed via the raw
PDF per Finding 0). This is structurally the SAME conferral-vehicle family this roster already
documents for Georgia's TCOS pamphlet, Michigan's DVPS enrollment, Minnesota's Domestic Violence
Information Brochure, Nevada's TANF brochure, Oregon's Information and Referral pamphlet, and
Wisconsin's Job Center notice — a universal, low-barrier, non-cash TANF-funded service that
converts SNAP's federal categorical-eligibility rule (7 CFR 273.2(j)) into a de facto 200% FPL
broad-based screen. Independently corroborated by secondary sources checked during this pass
(legalclarity.org, multiple SNAP-eligibility-calculator sites) that already describe Ohio as
running a 200% FPL broad-based categorical eligibility program via Ohio Careline — this is not a
novel claim invented by this pack, but it does appear to be missing from, or contradicted by, the
states.ts OH comment's characterization. This pack does NOT assert which figure (130% or 200%) the
engine SHOULD carry — that is an engine-layer decision outside this task's corpus-only scope — it
states the primary-source finding and flags the apparent conflict for a human to resolve.

### 2. ABAWD waiver availability: states.ts says true; this pack found a statutory prohibition

`states.ts` records `abawd_waiver_avail: true` for Ohio with no accompanying rationale comment (the
comment block above the OH entry covers SUA sourcing and the drug-felony verification, but says
nothing about the ABAWD-waiver-availability finding specifically). This pack found Ohio Revised
Code § 5101.548, enacted via House Bill 96 (Ohio's FY2026-2027 state operating budget, signed by
Governor DeWine June 30, 2025) and effective September 30, 2025. Subsection (B) states verbatim:
the department of job and family services "shall not request, apply for, or renew a waiver
authorized by section 6(o)(4) of the 'Food and Nutrition Act of 2008,' 7 U.S.C. 2015(o)(4)" — the
exact federal provision an ABAWD geographic time-limit waiver runs through. This is a direct,
current, statutory prohibition on ODJFS ever requesting an ABAWD waiver going forward, not merely
an unconfirmed or lapsed waiver status. Independently corroborated via two additional sources
during this pass: (1) USDA's own current ABAWD waiver tracking, searched directly, shows no active
Ohio waiver; and (2) abawdmap.us (an independent third-party ABAWD-waiver tracker, data current as
of June 22, 2026 per its own build-date stamp) shows Ohio under "No waiver — rule applies" with
"No statewide ABAWD waiver verified; the time limit applies," no county-level relief noted. This
pack's abawd-work-requirement supplement and freshness.json both state this finding plainly. As
with the BBCE-threshold discrepancy, this pack does not modify or recommend a specific new value
for the engine's `abawd_waiver_avail` constant — that decision belongs to whoever next works in
`packages/snap-rules`, under that package's own gating rule.

## Finding 3 — the FACT 105 "165% of poverty" table is a household-composition rule, not a third income screen

Food Assistance Change Transmittal No. 105 publishes a fourth income table, "Separate AG Income
Standards — Elderly and Disabled AGs Only (165% of poverty)," alongside the 100%/130%/200% tables.
This could easily be misread as a THIRD categorical-eligibility income screen sitting between the
130% general test and the 200% Ohio careline screen. It is not. OAC 5101:4-6-29 (confirmed via
WebSearch summary of the codified rule, corroborated by a second independent legal-summary source)
implements the standard federal "separate household" provision for an elderly (60+) AND disabled
individual living with others who cannot purchase and prepare their own meals (7 CFR 273.1(b)(2)):
if the OTHER people that person lives with have their OWN gross income at or below 165% of poverty
for their own group size, the elderly/disabled individual (and spouse) is carved out as a separate
one- or two-person assistance group rather than folded into the larger household's SNAP case. The
165% figure governs who counts as a separate ASSISTANCE GROUP, not a household's own income
eligibility ceiling — this pack's income-pathways supplement documents the distinction explicitly
so a reader does not mistake the FACT 105 table for a fourth BBCE tier.

## Confirmed — no discrepancy found

- **SUA figures.** Food Assistance Change Transmittal No. 105 (effective 10/1/2025) shows Standard
  Utility Allowance $766, Limited Utility Allowance $479, Single Telephone Allowance $46 — an EXACT
  match to the already-verified `states.ts` sua_by_tier constants. No discrepancy.
- **Drug-felony opt-out.** Ohio Revised Code § 5101.84, fetched and read directly, confirms the
  unconditional full statutory opt-out already documented in states.ts (verified full opt-out, no
  treatment or testing condition attached). No discrepancy.
- **Restaurant Meals Program.** USDA FNS's current RMP participant list does not include Ohio.
  Matches the already-verified `rmp_operated: false` constant. No discrepancy.
- **The states.ts author's own documented 4th-tier SUA gap** (a "Single Standard Utility Allowance"
  of $108 that the engine's `{HCSUA, LUA, phone}` shape has no slot for) was independently
  confirmed by this pack's own primary-source read of the same Change Transmittal — this pack's
  finding CONFIRMS rather than corrects that existing engine-side documentation.

## No widely-repeated FALSE secondary-source claim corrected

Unlike Illinois' ABAWD-waiver correction, Minnesota's drug-testing correction, or this session's own
prior AZ/OR/WI/MN engine-parity work, this pack did not find a widely-repeated FALSE secondary-source
claim about Ohio to correct. The two discrepancies documented above (BBCE threshold, ABAWD waiver
availability) are against this REPO's OWN already-verified engine constant, not against a general
secondary-source claim circulating outside this codebase — flagged explicitly so a reviewer does not
go looking for an external-source correction that isn't the actual finding here.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched rule/statute text, checking
specifically for: claims inferred from a rule's title or a secondary paraphrase rather than its own
body text; dollar figures not traceable to the specific dated Change Transmittal; and any
Ohio-vs-engine contrast overclaimed as settled when the underlying discrepancy genuinely needs a
human decision rather than a pack-level resolution. Concrete catches from this pass:

- The Ohio careline finding (Finding 0 above) was NOT accepted on a single tool paraphrase — the
  contradiction between two separate fetches of the same rule was caught specifically because this
  pass cross-checked the claim against a second, independent method (raw authenticated-PDF read)
  before drafting the income-pathways supplement's flagship claim.
- The BBCE-threshold and ABAWD-waiver discrepancies are stated as FINDINGS against the engine's own
  constants, not as this pack unilaterally overriding them — `packages/snap-rules` stays untouched,
  and neither freshness.json entry nor the corresponding supplement text asserts which value the
  engine SHOULD carry.
- The vehicle-exclusion supplement does NOT invent a specific vehicle count or per-vehicle dollar
  exclusion figure — OAC 5101:4-4-03(A)(6) defers to Ohio's TANF state plan without restating the
  mechanics, and this pack says so directly (matching Pennsylvania's "don't guess a plausible-
  sounding calculation" discipline for its own unexplained "4.0 conversion" gap) rather than
  assuming Ohio's rule mirrors Pennsylvania's one-vehicle-per-household exclusion just because both
  cite the same federal authority (Pub. L. 106-387 § 847).
- The Annual Reporter / 36-month certification-tier interaction is explicitly flagged as unconfirmed
  rather than asserted with invented mechanics, since the certification-period rule fetch did not
  itself define that status.
- The restaurant-meals and drug-felony supplements were checked against the engine's own
  already-verified constants specifically to confirm — not merely assume — no discrepancy, since
  this pack's central methodological point is that agreement and disagreement both need to be
  independently checked, not just disagreement.

## Sources

| Source | Access | Dated |
|---|---|---|
| OAC 5101:4-2-02, Categorically eligible assistance groups | direct fetch + raw authenticated-PDF re-read (Finding 0) | effective 10/1/2024 |
| OAC 5101:4-4-01, Resource eligibility | direct fetch | effective 12/1/2023 |
| OAC 5101:4-4-03, Resource exclusions (vehicles) | direct fetch | effective 12/1/2023 |
| OAC 5101:4-4-23, Deductions from income | direct fetch | effective 4/1/2026 |
| OAC 5101:4-5-03, Certification periods | direct fetch | effective 4/1/2026 |
| OAC 5101:4-6-09, Expedited service | direct fetch | effective 4/1/2026 |
| Ohio Revised Code § 5101.84, drug-felony opt-out | direct fetch | effective 10/16/2009 |
| Ohio Revised Code § 5101.548, ABAWD waiver-request prohibition | direct fetch | effective 9/30/2025 |
| ODJFS Food Assistance Change Transmittal No. 105, Oct 1 2025 Mass Change | direct PDF fetch + read | issued 8/29/2025 |
| USDA FNS Restaurant Meals Program state list | WebFetch | fetched 2026-08-11 |
| abawdmap.us current ABAWD waiver status (independent tracker) | WebFetch | data current as of 6/22/2026 |
| Ohio HB 96 (FY26-27 state operating budget) legislative summaries | WebSearch, secondary corroboration only | fetched 2026-08-11 |
| Secondary corroboration of "Ohio careline" 200% FPL pathway (legalclarity.org and others) | WebSearch, secondary corroboration only | fetched 2026-08-11 |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES), `engine-citations.ts`
BBCE_PCT (OH: 130, matching the ALREADY-VERIFIED states.ts constant even though this pack's own
Finding 1 flags that constant as possibly incomplete — the engine-citations.ts file mirrors
snap-rules' constant by design and this task does not touch either), `apps/web/lib/guide-questions.ts`.

`packages/snap-rules` stays fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`)
— this pack does not modify it and does not request an unfreeze. Both discrepancies above are filed
here, in this pack's own provenance trail, for a human to act on with a separate, explicit go-ahead.
