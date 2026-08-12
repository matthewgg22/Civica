# Indiana pack — provenance

**Created:** 2026-08-11. Indiana is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, and Tennessee's prior builds, Indiana has NO
existing `packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted; this
pack's findings stand entirely on its own primary-source research. This task's scope was
CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay
fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (with a standard browser `User-Agent` header) of eight current FSSA
Division of Family Resources SNAP/TANF Program Policy Manual chapter PDFs — 1000
(Introduction), 1400 (Administrative Policy), 2000 (Application Processing), 2200
(Continuing Case Processing), 2400 (Nonfinancial Eligibility Requirements), 2600
(Resources), 3000 (Eligibility Standards), 3200 (Assistance Groups), 3400 (Budgeting and
Benefit Calculation) — plus the full integrated `ICES_Program_Policy_Manual.pdf`, all
fetched directly from `in.gov/fssa/dfr/files/`. Every single fetch returned a clean HTTP 200
— **no tooling barrier of any kind for Indiana's own program manual**, a genuine contrast
with the statute-text access barrier documented below. Files converted to text with
`pdftotext -layout` and searched section-by-section. Also fetched directly: USDA's official
States that Operate a Restaurant Meals Program list, USDA's FY2025-2029 ABAWD Time Limit
Waivers index page, the independent abawdmap.us waiver aggregator, Indiana's own FSSA FAQ
page on drug-felony SNAP eligibility, the Public Health Law Center's Indiana SNAP-ban entry,
and the Network for Public Health Law's compiled 50-state SNAP felony-ban survey PDF (whose
Indiana row this pack independently parsed from the fetched PDF's own table).

## Finding 0 — a genuine, disclosed tooling barrier: Indiana's own drug-felony statute text was NOT independently fetchable

Unlike every FSSA/DFR document this pack tried (all clean HTTP 200s), Indiana's own
statute-lookup site, `iga.in.gov`, is a **client-side JavaScript single-page application**:
a direct curl fetch returned HTTP 200 but delivered only `<!doctype html>...<div
id="root"></div>` plus a bundled JS file — no server-rendered statutory text at all, unlike
a static-HTML barrier this pack's tooling could work around. This is a genuinely different
failure mode from Tennessee's pack in this roster (which hit HTTP 403 on two third-party
mirrors while its OWN government hosts returned clean 200s with real content) — here, even
Indiana's own primary-source host does not serve fetchable text via this pack's tooling.
This pack additionally tried two third-party statute mirrors for Ind. Code Ann. §
12-14-30-3's full text: `law.justia.com` returned HTTP 403, and `casetext.com` returned HTTP
410 (Gone), on every attempt (multiple User-Agents, both `http://` and `https://`). All
three attempts are disclosed as genuine, tried-and-failed barriers — not shortcuts taken
without trying, and not treated as equivalent to a successful primary-text fetch. The
drug-felony finding in this pack (see Finding 4) instead rests on convergent corroboration
from three independently fetched sources: Indiana's own FSSA FAQ page, the Public Health Law
Center's Indiana entry, and the Network for Public Health Law's compiled 50-state survey.

## Finding 1 (flagship) — Indiana has NOT adopted Broad-Based Categorical Eligibility, confirming (not contradicting) a widely-repeated secondary-source claim

Indiana's own Program Policy Manual, Section 3010.05.00 (Income Standards), states plainly
that SNAP's maximum gross income amounts are based on 130% of the Federal Poverty Guidelines
and maximum net income amounts on 100% — the plain federal test, with no higher
Broad-Based-Categorical-Eligibility percentage. This pack independently cross-checked this
against Section 2414.10.05 (Categorical Eligibility), which defines categorical eligibility
ONLY as the narrow "Basic CE" pathway (all AG members certified SSI and/or TANF) — no
expanded/broad-based pathway is described anywhere in Chapter 2400 or Chapter 3000. Several
SNAP-benefit calculator sites this pack checked during research already make this claim
about Indiana; this pack independently VERIFIED it from Indiana's own primary source rather
than repeating the secondary claim unchecked. This is worth flagging distinctly precisely
because it is the rarer finding: Indiana is a genuine minority-position state on BBCE, unlike
most states this roster has already built (and unlike Tennessee, which only adopted BBCE in
2026). A chatbot answering an Indiana applicant's income-limit question must NOT reach for
the higher 200% FPL figure that applies in neighboring Illinois or Michigan.

## Finding 2 — a genuine structural HYBRID: Indiana's vehicle rule combines this roster's two prior patterns

Indiana's own Resources chapter states a BLANKET exclusion for ordinary vehicles used for
household transportation ("exempt, regardless of value, licensing status, or condition") —
matching the pattern this roster's Virginia and North Carolina packs document. But the SAME
chapter separately states that recreational vehicles — "campers, trailers, and boats" — "must
be counted according to their current equity value" unless the vehicle serves as the AG's
actual home — matching the pattern this roster's Tennessee pack documents for boats and
recreational property. No single prior state in this roster combines BOTH patterns this
explicitly in one manual: Indiana's own text draws the line precisely at ordinary
transportation-use vehicles (exempt) versus recreational vehicles (counted), a genuine and
previously undocumented structural shape for this roster.

## Finding 3 — Indiana's dollar figures are fully current; no SUA/deduction gap exists, unlike Tennessee's pack

Every dollar-denominated SNAP standard this pack needed was directly, currently, and
verifiably stated in Indiana's own manual, dated effective 10/01/2025 (FFY2026) or
10/01/2024 for the resource limits: the four-tier Standard Utility Allowance ($486 heating/
cooling, $283 non-heating/cooling, $62 single utility, $36 telephone), the Standard
Deduction ($209/$209/$209/$223/$261/$299 by AG size), the Excess Shelter Expense Deduction
cap ($744), the Homeless Shelter Deduction ($198.99), and the resource limits ($3,000
standard / $4,500 elderly-or-disabled). This pack independently cross-checked the Standard
Deduction figures against Virginia's pack in this same roster, whose own independently
confirmed current FFY2026 Standard Deduction figures are identical ($209/$209/$209/$223/
$261/$299) — a genuine, positive cross-validation that Indiana's manual is current and not
stale, the OPPOSITE of the gap Tennessee's pack in this roster disclosed for the same class
of figures.

## Finding 4 — Indiana opted out of the federal lifetime drug-felony ban effective 2020, with NO drug-testing or treatment condition

Per Indiana's own FAQ page, the Public Health Law Center, and the Network for Public Health
Law's compiled survey (all independently fetched and converging on the same citation and
substantive condition — see Finding 0 for the primary-text access-barrier disclosure),
Indiana is a MODIFIED BAN state under Ind. Code Ann. § 12-14-30-3: individuals with a drug
felony conviction remain SNAP-eligible if they have completed, or are currently complying
with, court-ordered probation, parole, community corrections, or a reentry court program.
The Network for Public Health Law's own coded table — independently parsed by this pack from
the fetched PDF — confirms Indiana requires NEITHER drug testing NOR drug treatment as a
condition, unlike Tennessee's own modified ban (which conditions eligibility on
substance-abuse treatment participation for sub-Class-A felonies). Indiana's ban is
comparatively narrower in its conditions than Tennessee's, even though both are classified as
"modified bans."

## Finding 5 — Indiana's ABAWD provisions are genuinely CURRENT, a notable contrast with Tennessee's own multi-document staleness pattern

Indiana's own Program Policy Manual, Section 2438.17.05, states the ABAWD age range applies
"18-64 (as of 7/4/2025)" — the current post-OBBBA federal range, explicitly dated to the
OBBBA's own effective date. The same section's exemption list includes three specific
tribal-status exemptions drawn from the Indian Health Care Improvement Act (IHCIA) — "An
Indian," "An Urban Indian," and "A California Indian" — a precise, current reflection of
OBBBA's own tribal-member ABAWD exemption. This stands in direct, notable contrast with this
roster's Tennessee pack, where BOTH the codified rule and the current numbered policy
document independently repeated a stale 18-49 age range. Indiana's own manual also
confirms zero active ABAWD waivers statewide ("there are currently no such designations"),
independently cross-checked against USDA's official waiver index and the abawdmap.us
aggregator.

## Finding 6 — Indiana's Elderly Simplified Application Project offers a 36-month certification period, the longest this roster has documented for any state

Indiana's standard SNAP certification period is 12 months (matching Virginia's and New
Jersey's own 12-month defaults, and notably longer than Tennessee's unusually short 6-month
default). But Indiana's Elderly Simplified Application Project (ESAP) — for AGs where every
member is elderly (60+) and/or disabled — offers a 36-month certification period, materially
longer than any comparable provision this roster has documented (Virginia and Tennessee both
cap their own elderly/disabled options at 24 months). ESAP households with no earned or
self-employment income are also exempt from Indiana's 6-month Interim Report requirement
entirely, which otherwise applies to non-ESAP households (including elderly/disabled AGs
that do have earned income).

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed to check against)

Indiana has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing
engine constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding, not a cross-check against prior engineering work. A future
`packages/snap-rules` build for Indiana (out of scope for this task, requiring its own
separate, explicit go-ahead per the standing park rule) should treat this pack's citations as
a starting point, not a final answer, and should specifically re-verify the drug-felony
statute's exact text (Finding 4) against Indiana's own primary source once a
JavaScript-capable fetch tool is available, before hardcoding it into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Indiana manual text,
checking specifically for: claims inferred from a section heading rather than its own body
text; dollar figures not traceable to a specific dated source; and any
Indiana-vs-common-assumption contrast overclaimed as settled when the underlying evidence was
genuinely ambiguous. Concrete catches from this pass:

- The no-BBCE finding (Finding 1) was checked against TWO independent sections of Indiana's
  own manual (2414.10.05's narrow categorical-eligibility definition AND 3010.05.00's plain
  130%/100% income chart) rather than accepted from either section alone or from the
  secondary-source claim search results already surfaced — the secondary claim was treated as
  a lead to verify, not as evidence in itself.
- The vehicle finding (Finding 2) is stated with the EXACT dividing line Indiana's own text
  draws (transportation-use exempt; recreational-use counted) rather than rounded up to
  either "Indiana has a blanket vehicle exclusion like Virginia" or "Indiana counts vehicles
  like Tennessee counts boats" — both of which would have been an overclaim in one direction.
- The SUA/deduction dollar figures (Finding 3) were cross-checked against the SAME manual's
  own PRIOR-period column (5/1/2024-9/30/2025 figures alongside the current 10/1/2025
  figures) to confirm a clean COLA-style progression, and separately cross-checked against
  Virginia's pack's own independently-verified current FFY2026 Standard Deduction figures —
  two independent checks, not one, before this pack asserted these figures as reliable rather
  than merely present.
- The drug-felony finding (Finding 4) is explicitly flagged as resting on convergent
  secondary/quasi-primary corroboration rather than Indiana's own primary statutory text,
  with the SPECIFIC failure mode of each host named directly (iga.in.gov's client-side SPA
  shell; justia's 403; casetext's 410) — not smoothed over as equivalent to a successful
  primary-source fetch, and not silently treated the same as every OTHER finding in this pack
  (all of which DO rest on Indiana's own directly-fetched primary manual text).
- The ABAWD-currency finding (Finding 5) is stated as a genuine contrast with Tennessee's own
  pack rather than assumed to be the default for every state — this pack does not claim every
  state's ABAWD documentation is current, only that Indiana's specifically is, with the exact
  dated language ("as of 7/4/2025") quoted directly from Indiana's own text as the evidence.
- The medical-deduction supplement's claim that Indiana has NO flat state-option Medical
  Standard Deduction is explicitly flagged as a lower-confidence absence (this pack's search
  of Chapter 3400 was not exhaustive) rather than stated with the same confidence as findings
  resting on an affirmatively-quoted section.

## Sources

| Source | Access | Dated |
|---|---|---|
| FSSA DFR Program Policy Manual, Ch. 1000 (Introduction) | direct curl fetch (browser UA) + pdftotext -layout | current (full integrated manual) |
| FSSA DFR Program Policy Manual, Ch. 1400 (Administrative Policy) | direct curl fetch (browser UA) + pdftotext | current |
| FSSA DFR Program Policy Manual, Ch. 2000 (Application Processing) | direct curl fetch (browser UA) + pdftotext | current |
| FSSA DFR Program Policy Manual, Ch. 2200 (Continuing Case Processing) | direct curl fetch (browser UA) + pdftotext | current |
| FSSA DFR Program Policy Manual, Ch. 2400 (Nonfinancial Eligibility) | direct curl fetch (browser UA) + pdftotext | ABAWD age range dated "as of 7/4/2025" |
| FSSA DFR Program Policy Manual, Ch. 2600 (Resources) | direct curl fetch (browser UA) + pdftotext | current |
| FSSA DFR Program Policy Manual, Ch. 3000 (Eligibility Standards) | direct curl fetch (browser UA) + pdftotext | dollar figures effective 10/01/2025 (resource limits 10/01/2024) |
| FSSA DFR Program Policy Manual, Ch. 3200 (Assistance Groups) | direct curl fetch (browser UA) + pdftotext | current |
| FSSA DFR Program Policy Manual, Ch. 3400 (Budgeting and Benefit Calculation) | direct curl fetch (browser UA) + pdftotext | current |
| FSSA DFR Program Policy Manual, full integrated PDF | direct curl fetch (browser UA) + pdftotext | current |
| USDA FNA, States that Operate a Restaurant Meals Program | direct curl fetch (browser UA) | fetched 2026-08-11 — Indiana absent from the 9-jurisdiction list |
| USDA FNA, Time Limit Waivers FY 2025-2029 index page | direct curl fetch (browser UA) | fetched 2026-08-11 |
| abawdmap.us (independent waiver aggregator) | WebFetch | fetched 2026-08-11 — corroborates zero active Indiana waivers |
| FSSA FAQ, drug-felony SNAP eligibility (faqs.in.gov) | WebFetch | fetched 2026-08-11 |
| Public Health Law Center, SNAP Ban Opt-Out States Map — Indiana | WebFetch | fetched 2026-08-11 |
| Network for Public Health Law, 50-State Survey: SNAP Drug Felony Bans (PDF) | direct curl fetch (browser UA) + pdftotext | dated 2020 in URL/footer, Indiana row independently parsed |
| iga.in.gov (Ind. Code Ann. § 12-14-30-3 primary text) | ATTEMPTED, FAILED — client-side JS SPA, no server-rendered text | — |
| law.justia.com (Ind. Code Ann. § 12-14-30-3 primary text) | ATTEMPTED, FAILED — HTTP 403 on every try (multiple UAs, http/https) | — |
| casetext.com (Ind. Code Ann. § 12-14-30-3 primary text) | ATTEMPTED, FAILED — HTTP 410 (Gone) | — |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (IN guide questions), `eval/answer-eval.ts` (IN_GOLD,
spread into ALL_GOLD). Indiana is deliberately NOT added to any engine-citations.ts per-state
constant map — Indiana has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("IN", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds an Indiana policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, and Tennessee's corpus packs in this same
roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request
an unfreeze. A future Indiana `packages/snap-rules` build is out of scope here and would need
its own separate, explicit go-ahead.
