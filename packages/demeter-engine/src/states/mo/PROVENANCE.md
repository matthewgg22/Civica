# Missouri pack — provenance

**Created:** 2026-08-11. Missouri is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, and Indiana's prior builds,
Missouri has NO existing `packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted; this
pack's findings stand entirely on its own primary-source research. This task's scope was
CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay
fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (with a standard browser `User-Agent` header) of eighteen current Missouri
DSS Manuals SNAP Manual subsections from `dssmanuals.mo.gov/food-stamps/` — 1100.000.00
(Overview), 1105.035.00 (ABAWD), 1105.015.10.35.10 (Felony Drug Conviction Exceptions),
1110.020.10 (Vehicles), 1115.035.05 (Standard/Earned Income Deductions), 1115.035.15.05
(Medical Deduction), 1115.035.20 (Child Support Exclusion), 1115.035.25.05 (Allowable Shelter
Costs), 1115.035.25.15 (Mandatory Utility Standards), 1115.095.00 (Income Eligibility Limits),
1115.099.00 (Maximum Allowable Monthly Income Limits and Allotment), 1125.010.00 (Expedited
Service Criteria), 1130.005.00 (Processing Time Frames), 1135.020.20 (Certification Periods),
and 1135.035.00 (Categorical Eligibility) — seventeen of eighteen fetches returned a clean
HTTP 200. Also fetched directly: the current DSS SNAP Program Changes Flyer (PDF, dated
10/2025 in its own footer, converted with `pdftotext -layout`), Missouri's own Revisor of
Statutes page for RSMo § 208.247 (full primary statutory text, clean HTTP 200 with **no**
access barrier), USDA's official States that Operate a Restaurant Meals Program list and Time
Limit Waivers FY2025-2029 index page, the independent abawdmap.us waiver aggregator's
Missouri-specific page, Missouri's own HR1-implementation page, and (for structural
corroboration only, never for dollar figures) a Missouri State Public Defender applicant guide
last revised November 2023.

## Finding 0 — a genuine, disclosed, PAGE-SPECIFIC access barrier: Missouri's own resource-limit manual subsection returned a password wall while its sibling subsections did not

Unlike every other DSS Manuals subsection this pack fetched (seventeen clean HTTP 200s),
`MO IM Manual 1110.005.00` (Maximum Resources Allowed) returned a password-protected wall on
every direct-fetch attempt — even though the sibling `1110.020.10` (Vehicles) subsection, in
the very SAME chapter, rendered cleanly with full content and no such wall. This is a
genuinely different failure mode from prior states in this roster's access barriers (Indiana's
client-side-JavaScript-SPA statute host, Tennessee's/North Carolina's third-party-mirror 403s):
here, Missouri's OWN primary-source host serves some subsections of its own manual openly and
gates others, with no evident pattern this pack could determine (possibly related to Missouri's
ongoing Combined IM Policy Manual migration, announced via IM-23 in April 2025). The
resource-limit finding in this pack (see Finding 4) instead rests on convergent secondary
corroboration from the Missouri Budget Project's own 2025 SNAP overview, cross-checked against
the current federal FFY2026 standard this roster's Indiana and Virginia packs already
independently confirmed.

## Finding 1 (flagship) — Missouri has NOT adopted Broad-Based Categorical Eligibility, directly CORRECTING an actively wrong, specific secondary-source claim

Several SNAP-benefit calculator/explainer sites this pack checked during research assert that
"Missouri uses Broad-Based Categorical Eligibility (BBCE) at 200% of the federal poverty level
with no asset limit for most households." This pack independently checked that claim against
Missouri's own primary source and found it FALSE. Missouri's own current income-limit table
(MO IM Manual 1115.099.00, cross-checked against the DSS SNAP Program Changes Flyer dated
10/2025) publishes exactly two income-limit columns — 130% FPL gross, 100% FPL net — with no
higher BBCE-style percentage anywhere. Independent secondary research surfaced during this
pack's drafting corroborates: Missouri is among a small minority of states that have not
adopted BBCE, per research referencing USDA's own BBCE state list. This is Missouri's own
analog to Indiana's no-BBCE flagship finding in this roster, but sharper: this pack found and
disproved an actively WRONG, specific, numbered secondary claim (200% FPL) rather than merely
confirming an already-accurate one. A chatbot answering a Missouri applicant's income-limit
question must NOT reach for a 200% FPL figure.

## Finding 2 — a genuine THIRD categorical-eligibility structural pattern: Missouri's services-based CE expansion

Missouri's own manual (1135.035.00) extends categorical eligibility beyond TANF/SSI/SAB/SP cash
recipients to households where a member receives or is authorized to receive specific
TANF-funded "special support services" (Child Care assistance, Community Partnerships
job-placement programs including the Missouri Mentoring program). This is broader than
Indiana's narrow Basic-CE-only pattern documented in this roster, but it is NOT the classic
BBCE mechanism (a TANF-funded informational pamphlet distributed to ALL applicants, raising the
effective income ceiling for everyone regardless of actual service receipt) most other states
in this roster document. Missouri's mechanism instead requires ACTUAL receipt of or
authorization for a genuine named service — a service-conditioned expansion, not an
income-ceiling raise. No prior state in this roster documents this specific pattern.

## Finding 3 — Missouri excludes the value of ALL vehicles, a genuinely BROADER blanket exclusion than any prior state in this roster

Missouri's own Resources chapter (1110.020.10) states in its opening line: "Exclude the value
of all vehicles." Unlike Indiana's hybrid rule in this roster (ordinary transportation vehicles
exempt, but boats/campers counted at equity value), Missouri's own text draws no such line:
every vehicle type this pack's research found named in Missouri's manual — car, truck,
motorcycle, ATV, camper, trailer, motor home, and boat (via the "trailers (utility/boat/etc.)"
example) — is excluded from countable resources. This is a genuinely simpler, more generous
blanket rule than any prior vehicle-treatment finding in this roster.

## Finding 4 — Missouri's dollar figures are GENUINELY MIXED on currency: some confirmed current for FFY2026, others confirmed stale

Unlike Indiana's uniformly current manual or Tennessee's uniformly stale one, this pack found a
genuinely PARTIAL staleness pattern in Missouri's own sources. CONFIRMED CURRENT for FFY2026
(via the DSS SNAP Program Changes Flyer, dated 10/2025): the income limits, the Standard
Deduction ($209/$209/$209/$223/$261/$299 by household size — matching this roster's Indiana and
Virginia packs' own independently-confirmed figures exactly), the $744 Excess Shelter Expense
Deduction cap, and the $198.99 Homeless Standard Deduction. CONFIRMED STALE (dated to IM-50,
September 2024, i.e. FFY2025, with no confirmed FFY2026 update located despite a targeted
search): the four Standard Utility Allowance figures (SUA $495, NHCS $363, LUA $158, telephone
$79 — MO IM Manual 1115.035.25.15). And CONFIRMED STALE via a genuinely different mechanism
(see Finding 5): the ABAWD age range. This topic-by-topic mixed pattern is itself worth
flagging as a departure from this roster's prior all-current or all-stale state findings.

## Finding 5 — a genuine, disclosed gap between Missouri's internal eligibility-system logic (current) and its public policy manual text (stale) on the ABAWD age range

Missouri's own public ABAWD manual section (1105.035.00, last updated IM-71, August 31, 2023)
still states the pre-OBBBA 18-54 age range. But Missouri's own HR1-implementation page
(mydss.mo.gov/hr1-implementation) confirms the state's FAMIS/MEDES eligibility SYSTEMS have
already been updated for the current federal 18-64 range (OBBBA, effective July 4, 2025 /
November 1, 2025 FNS implementation). This is a genuinely different failure mode from this
roster's Tennessee pack, where BOTH the codified rule and the numbered policy document were
independently stale — here, Missouri's internal system behavior is confirmed current while only
the PUBLIC-FACING manual text lags behind.

## Finding 6 — Missouri's modified drug-felony ban is genuinely STRICTER than Indiana's, and Missouri's own primary statute was fully fetchable with NO access barrier

RSMo § 208.247 was fetched directly and in full from revisor.mo.gov — a genuine PLUS compared
to this roster's Indiana pack, whose equivalent statute required convergent secondary
corroboration because Indiana's own statute-lookup site was an unexecutable client-side
JavaScript application. Missouri's own statute AND its implementing manual section
(1105.015.10.35.10) together establish a modified ban requiring ALL of: DBH-approved
substance-abuse treatment (participation, waitlist, completion, or provider-certified
not-needed), compliance with all court/DBH/probation-parole obligations, no additional
controlled-substance conviction within one year of the original, no more than two total
qualifying felony convictions ever, AND — the sharpest contrast with Indiana's own modified
ban, which the Indiana pack in this roster found requires NEITHER — participant-PAID voluntary
urinalysis testing that cannot be self-administered. Missouri's manual separately, and
currently, notes that medical and adult-use marijuana is legal in Missouri under Article XIV of
its state constitution (voters approved recreational marijuana in 2022) — relevant context, not
an exemption from the underlying ban mechanism itself.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed to check against)

Missouri has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding, not a cross-check against prior engineering work. A future
`packages/snap-rules` build for Missouri (out of scope for this task, requiring its own
separate, explicit go-ahead per the standing park rule) should treat this pack's citations as a
starting point, not a final answer, and should specifically re-verify the resource-limit figure
(Finding 0) and the SUA figures (Finding 4) against Missouri's own primary text once the
password-gated subsection becomes accessible, before hardcoding either into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Missouri manual text,
checking specifically for: claims inferred from a section heading rather than its own body
text; dollar figures not traceable to a specific dated source; and any
Missouri-vs-common-assumption contrast overclaimed as settled when the underlying evidence was
genuinely ambiguous. Concrete catches from this pass:

- The no-BBCE finding (Finding 1) was checked against the ACTUAL income-limit table's column
  headers (1115.099.00) rather than accepted from the secondary-source claims already
  surfaced — the secondary claims (both the correct "no BBCE" minority-source claims and the
  incorrect "200% FPL BBCE" claims) were treated as leads to verify against Missouri's own
  primary text, not as evidence in themselves. The specific WRONG secondary claim is named and
  quoted directly rather than vaguely gestured at, so a future reader can verify this pack's
  correction against the same claim.
- The vehicle finding (Finding 3) is stated with the EXACT wording Missouri's own text uses
  ("Exclude the value of all vehicles") rather than rounded up to a vaguer "Missouri has a
  generous vehicle policy" — and the recreational-vehicle inclusion is drawn from the same
  section's own examples (trailers, motor homes, and the "trailers (utility/boat/etc.)" FAMIS
  screen-recording instruction) rather than assumed.
- The resource-limit figure (Finding 0) is explicitly flagged as SECONDARY-SOURCE-ONLY rather
  than presented with the same confidence as findings resting on Missouri's own directly-fetched
  text — the password-wall barrier is named specifically (page-specific, not site-wide, since
  the sibling Vehicles page rendered cleanly) rather than smoothed over as equivalent to every
  other finding in this pack.
- The SUA staleness finding (Finding 4) explicitly distinguishes WHICH figures are confirmed
  current (income limits, Standard Deduction, Excess Shelter cap, Homeless Deduction) from
  WHICH are confirmed stale (the four utility standards) rather than characterizing the whole
  pack as uniformly current or uniformly stale — a genuinely mixed pattern stated precisely.
- The ABAWD finding (Finding 5) distinguishes Missouri's SYSTEM behavior (confirmed current via
  the state's own HR1-implementation page) from its MANUAL TEXT (confirmed stale via direct
  fetch) rather than conflating the two — a chatbot should state the current 18-64 range
  (matching Missouri's own confirmed system behavior) rather than quoting the manual's stale
  text verbatim, and this pack says so explicitly in freshness.json.
- The drug-felony finding (Finding 6) is checked against BOTH the bare statute (RSMo 208.247)
  AND its detailed implementing manual section (1105.015.10.35.10) — the implementing manual
  section revealed the participant-pays-for-testing detail that the bare statute states more
  generically ("demonstrated sobriety through voluntary urinalysis testing paid for by the
  participant" appears in the statute itself, and the manual section confirms and operationalizes
  it), so this pack did not rely on either source alone.
- The certification-period elderly/disabled trigger is explicitly flagged as secondary-source-only
  (a Public Defender guide) rather than stated with the same confidence as the general
  "12 or 24 months" range, which DOES come directly from Missouri's own manual text
  (1135.020.20) — the two confidence levels are kept distinct rather than merged.

## Sources

| Source | Access | Dated |
|---|---|---|
| DSS Manuals SNAP Manual, 1100.000.00 (Overview) | direct curl fetch (browser UA) | current |
| DSS Manuals SNAP Manual, 1105.035.00 (ABAWD) | direct curl fetch (browser UA) | STALE — states pre-OBBBA 18-54 range, last updated IM-71 (8/31/2023) |
| DSS Manuals SNAP Manual, 1105.015.10.35.10 (Felony Drug Conviction Exceptions) | direct curl fetch (browser UA) | current, last updated IM-56 (10/8/2024) |
| DSS Manuals SNAP Manual, 1110.020.10 (Vehicles) | direct curl fetch (browser UA) | current |
| DSS Manuals SNAP Manual, 1110.005.00 (Maximum Resources Allowed) | ATTEMPTED, FAILED — password-protected wall (page-specific, sibling subsection unaffected) | — |
| DSS Manuals SNAP Manual, 1115.035.05 (Standard/Earned Income Deductions) | direct curl fetch (browser UA) | current (defers dollar figures to the Flyer) |
| DSS Manuals SNAP Manual, 1115.035.15.05 (Medical Deduction) | direct curl fetch (browser UA) | current |
| DSS Manuals SNAP Manual, 1115.035.20 (Child Support Exclusion) | direct curl fetch (browser UA) | current |
| DSS Manuals SNAP Manual, 1115.035.25.05 (Allowable Shelter Costs) | direct curl fetch (browser UA) | current |
| DSS Manuals SNAP Manual, 1115.035.25.15 (Mandatory Utility Standards) | direct curl fetch (browser UA) | STALE — dated IM-50 (9/23/2024, FFY2025), no confirmed FFY2026 update located |
| DSS Manuals SNAP Manual, 1115.095.00 (Income Eligibility Limits) | direct curl fetch (browser UA) | current (narrative; dollar figures in 1115.099.00) |
| DSS Manuals SNAP Manual, 1115.099.00 (Income Limits and Allotment) | direct curl fetch (browser UA) | current table dated October 2024 in-page; superseded by, and cross-checked against, the 10/2025 Flyer |
| DSS Manuals SNAP Manual, 1125.010.00 (Expedited Service Criteria) | direct curl fetch (browser UA) | current, last updated IM-59 (10/29/2024) |
| DSS Manuals SNAP Manual, 1130.005.00 (Processing Time Frames) | direct curl fetch (browser UA) | current, last updated IM-48 (9/19/2024) |
| DSS Manuals SNAP Manual, 1135.020.20 (Certification Periods) | direct curl fetch (browser UA) | current on general 12-or-24-month range; elderly/disabled trigger not stated in this specific subsection |
| DSS Manuals SNAP Manual, 1135.035.00 (Categorical Eligibility) | direct curl fetch (browser UA) | current |
| DSS SNAP Program Changes Flyer (PDF) | direct curl fetch (browser UA) + pdftotext -layout | dated 10/2025 in-page (FFY2026) |
| Missouri Revisor of Statutes, RSMo § 208.247 | direct curl fetch (browser UA) | effective 8/28/2014, current, no barrier |
| Missouri DSS, "About the Family Support Division" (dss.mo.gov/fsd/intro.htm) | WebFetch | fetched 2026-08-11 |
| Missouri DSS, HR1 Implementation page (mydss.mo.gov/hr1-implementation) | WebFetch | fetched 2026-08-11 |
| USDA FNA, States that Operate a Restaurant Meals Program | direct curl fetch (browser UA) | page updated 8/7/2026 — Missouri absent from the 9-jurisdiction list |
| USDA FNA, Time Limit Waivers FY 2025-2029 index page | direct curl fetch (browser UA) | fetched 2026-08-11 — no Missouri entry |
| abawdmap.us, Missouri state page | direct curl fetch (browser UA) | fetched 2026-08-11 — "No waiver — rule applies" |
| Missouri Budget Project, SNAP Overview 2025 | WebFetch | fetched 2026-08-11 — secondary corroboration, resource limit only |
| Missouri State Public Defender, "How To: Apply for SNAP" | direct curl fetch (browser UA) + pdftotext -layout | last revised 11/2023 — used only for the still-current certification-period structural claim, NOT its stale dollar figures |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (MO guide questions), `eval/answer-eval.ts` (MO_GOLD,
spread into ALL_GOLD). Missouri is deliberately NOT added to any engine-citations.ts per-state
constant map — Missouri has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("MO", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Missouri policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, and Indiana's corpus packs in
this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request
an unfreeze. A future Missouri `packages/snap-rules` build is out of scope here and would need
its own separate, explicit go-ahead.
