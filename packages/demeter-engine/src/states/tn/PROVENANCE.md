# Tennessee pack — provenance

**Created:** 2026-08-11. Tennessee is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, and Virginia's prior builds, Tennessee has NO existing
`packages/snap-rules` entry and NO oracle fixture coverage at all. No discrepancy-checking
against an existing engine constant was possible or attempted; this pack's findings stand
entirely on its own primary-source research. This task's scope was CORPUS ONLY — the Demeter
chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the
standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (with a standard browser `User-Agent` header) of Tennessee's TWO parallel
primary-source families: (1) the codified Rules of the Tennessee Department of Human Services,
Chapter 1240-01, filed with the TN Secretary of State and published at
`publications.tnsosfiles.com` — fetched section-by-section (1240-01-14-.15 categorical
eligibility, 1240-01-03 non-financial eligibility/ABAWD, 1240-01-04 financial eligibility
tables, 1240-01-07 periods of eligibility) — and (2) TDHS's own current, numbered SNAP Policy
series (24.02, 24.03, 24.11, 24.12, 24.13, 24.14, 24.18, 24.24), fetched directly from
`tn.gov/content/dam`. Also fetched: TDHS's original 2017 SNAP Policy Manual PDF (found severely
stale and NOT relied upon for current policy), USDA's official ABAWD Time Limit Waivers
FY2025-2029 index, and (after two direct-fetch attempts on the primary statute host failed) two
independent secondary legal-research sources for the drug-felony provision.

## Finding 0 — a genuine, disclosed tooling barrier: Tennessee's own drug-felony statute text was NOT independently fetchable

Unlike Virginia's build in this same roster, which encountered no tooling barrier anywhere,
this pack tried `law.justia.com` (multiple User-Agents, both `http://` and `https://`) and
`casetext.com`'s dedicated statute page for Tenn. Code Ann. § 71-5-308's full text. BOTH
returned HTTP 403 on every attempt. This is disclosed as a genuine, tried-and-failed barrier —
not a shortcut taken without trying, and not treated as equivalent to a successful primary-text
fetch. The drug-felony finding in this pack (see Finding 5) instead rests on convergent
corroboration from the Public Health Law Center's SNAP Ban Opt-Out States map and the Network
for Public Health Law's compiled 50-state SNAP felony-ban survey, both fetched directly and
cross-checked against TDHS's own rule text, which independently confirms the citation and the
general disqualification category (without independently proving every specific condition the
secondary sources describe). `publications.tnsosfiles.com` (the TN Secretary of State's own
rule-publication host) and `tn.gov/content/dam` (TDHS's own document host), by contrast, returned
a clean HTTP 200 on every attempt in this build — the barrier was specific to the two statute-text
hosts tried, not a general Tennessee-government access problem.

## Finding 1 (flagship) — Tennessee adopted Broad-Based Categorical Eligibility only in 2026, and kept an unusual net-income overlay most BBCE states waive

Tennessee amended Tenn. Comp. R. & Regs. ch. 1240-01-14-.15 on January 15, 2026 (effective
April 15, 2026 — less than four months before this pack's build date) to add "Expanded
Categorical Eligibility": a household with a member receiving or authorized to receive a
non-cash/in-kind Families-First-funded (TANF) service is categorically eligible for SNAP,
without the ordinary resource test, if its gross monthly income is at or below 200% of the
Federal poverty level AND its net monthly income is at or below 100% of the Federal poverty
level. This pack fetched the amended rule text directly from `publications.tnsosfiles.com` and
cross-checked the change's recency against contemporaneous news coverage (fox13memphis.com,
June 2026, quoting a University of Memphis researcher: "Before it was 130%. Now the total
household gross monthly income can be up to 200"). Two things are worth flagging distinctly:
first, several SNAP-benefit calculator/explainer sites this pack checked during research
(snapscreener.com, the Sycamore Institute's own page) still quote Tennessee's OLD 130% gross
ceiling as current, a live secondary-source staleness risk given how recent this change is;
second, Tennessee's version of BBCE keeps a SEPARATE 100% FPL NET income ceiling that Virginia's
and New Jersey's packs in this roster do not document for their own flat-percentage BBCE
screens — a genuinely narrower structure than the single-gross-percentage BBCE pattern this
roster has otherwise seen.

## Finding 2 — a genuine, MULTI-DOCUMENT internal staleness pattern going in BOTH directions, worse than anything else in this roster

This is Tennessee's most structurally distinctive finding. Every prior state in this roster with
a disclosed internal staleness issue (Virginia's stale Appendix I footnote, New Jersey's stale
resource-limit text) found it confined to a SINGLE section or footnote within ONE document. TN
shows a genuinely broader pattern, spanning TWO independently-numbered, independently-dated
Tennessee document families going in OPPOSITE directions:

- **Rule ahead of policy:** TN Rule 1240-01-14-.15 was amended April 2026 to add BBCE, but
  TDHS's own SNAP Policy 24.24 (Categorically Eligible SNAP Recipients), last reviewed
  11/30/2023, has NOT been updated to describe BBCE at all — it still only describes the old
  narrow SSI/Families-First-only categorical eligibility.
- **Rule AND policy both behind federal law:** TN Rule 1240-01-03-.43 (last amended May 2004)
  states the ABAWD work-requirement age range as 18-49. TDHS's own SNAP Policy 24.11 (Work
  Requirements), independently reviewed as recently as 11/30/2023, repeats the SAME stale 18-49
  range — meaning TDHS's own 2023 review of its current operational policy did not catch that
  the age range had already changed under the 2023 Fiscal Responsibility Act, let alone under
  2025's OBBBA (current federal range: 18-64). TDHS's own separate public-facing ABAWD webpage,
  by contrast, correctly implies the current 18-64 range.
- **Rule behind policy:** TN Rule 1240-01-07-.01 (Periods of Eligibility), last amended
  September 1983, states "[i]n no circumstances may a certification period extend beyond one
  year" — but TDHS's own current SNAP Policy 24.02 (effective 12/01/2022) offers a 24-month
  certification period for all-elderly/disabled/no-earned-income households not on Families
  First, directly conflicting with the still-published 1983 rule text.

This pack treats TDHS's more recently-dated document as the operative source in each specific
conflict (the newer BBCE rule for categorical eligibility; the newer Policy 24.02 for
certification-period length; and neither stale ABAWD document, instead citing current federal
law and TDHS's own separate correct public webpage, for the ABAWD age range) — but flags all
three conflicts explicitly rather than silently picking a winner without disclosure.

## Finding 3 — a genuine and disclosed gap: Tennessee's current utility-allowance and deduction dollar figures could not be confirmed from any source this pack could access

TDHS's own current policy series (24.12 Resources, 24.18 Deductions from Income) deliberately
does NOT hardcode dollar figures — both explicitly defer exact current amounts to an internal
"Family Assistance Standards Desk Guide" this pack could not locate published anywhere on
`tn.gov`. The only PUBLICLY fetchable dollar table for these figures — inside the codified rule
1240-01-04-.27 — shows strong internal evidence of being stale by a decade or more (its own
Standard Deduction figures of $142-$205 and $200 one-person Maximum Coupon Allotment do not
match any recent Fiscal Year's federal COLA-adjusted figures; compare Virginia's pack in this
same roster, whose current FFY2026 Standard Deduction is $209-$299 and whose current maximum
allotment is far above $200 for a single person). USDA's national FY2026 SUA rollup page did
not render fetchable per-state data in this pass either — the same disclosed limitation
Virginia's pack in this roster recorded for the identical USDA page. This pack states Tennessee's
utility-allowance STRUCTURE confidently (a three-tier system: size-scaled Standard Utility
Allowance, flat Basic Utility Allowance, flat Standard Telephone Allowance — matching the shape
this roster's North Carolina pack documents) but explicitly declines to assert a current dollar
figure for the Standard Utility Allowance, Basic Utility Allowance, Standard Telephone Allowance,
Standard Deduction, Maximum Excess Shelter Deduction, or Homeless Shelter Allowance — a genuine,
disclosed research gap, not a fabricated number. For the federally uniform resource limits
($3,000/$4,500), this pack DOES apply the current FFY2026 federal figures, on the strength of
TDHS Policy 24.12's own "uniform national resource standards" language, which explicitly adopts
the federal figures by reference rather than stating a Tennessee-specific override.

## Finding 4 — a genuine departure from Virginia's/North Carolina's blanket vehicle exclusion: Tennessee's Resources policy names boats and vacation homes as countable

TDHS Policy 24.12 lists, among examples of countable non-liquid resource equity, "non-exempt
buildings, non-exempt land, recreational properties, and property such as boats, vacation homes,
or mobile homes." This pack reads this as a genuine departure from Virginia's and North
Carolina's packs in this same roster, both of which document a BLANKET vehicle exclusion (every
vehicle excluded, no qualifier, no exception for boats or recreational vehicles). Tennessee's
policy text, in the sections this pack fetched, does not state a comparably blanket exclusion.
This pack could NOT, however, independently locate and fetch TDHS's separate "Treatment of
Vehicles" procedure document (referenced by Policy 24.12 as the authoritative source for ordinary
passenger-vehicle treatment specifically, but not published on the public DHS Publications page
in this pass) — so this pack states the BOAT/recreational-property finding with confidence while
explicitly disclosing the ordinary passenger-vehicle rule as an unconfirmed gap, rather than
assuming Tennessee treats passenger vehicles the same way it treats boats.

## Finding 5 — Tennessee is a modified drug-felony ban state, corroborated by convergent secondary sources after a genuine primary-source access barrier

See Finding 0 above for the access-barrier disclosure. Per the Public Health Law Center and the
Network for Public Health Law's compiled 50-state survey, both fetched directly, Tennessee is a
MODIFIED BAN state under Tenn. Code Ann. § 71-5-308: permanent ineligibility for a Class A
felony drug conviction, with conditional eligibility for other drug felonies contingent on
substance-abuse treatment participation/completion (or a licensed provider's no-need
determination) and compliance with court-imposed obligations. TDHS's own current rule,
1240-01-14-.15(3)(a)3, independently corroborates the existence of a "drug-related felony"
categorical-eligibility exception under 7 C.F.R. § 273.11, consistent with (though not fully
proving every condition of) the modified-ban structure the secondary sources describe.

## Finding 6 — Tennessee's DEFAULT certification period is just six months, the shortest default this roster has documented

TDHS Policy 24.02 states the STANDARD certification period is "six (6) months or less depending
on the circumstances" — shorter than every other state this roster has documented (Virginia and
New Jersey both default to 12 months). A 24-month period is available only for households where
every adult member is elderly or disabled, WITH NO EARNED INCOME, AND the household is NOT
receiving or applying for Families First — narrower than Virginia's comparable 24-month gate,
which does not add a Families-First exclusion. See Finding 2 above for the conflict with the
still-published 1983 certification-period rule.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed to check against)

Tennessee has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding, not a cross-check against prior engineering work. A future
`packages/snap-rules` build for Tennessee (out of scope for this task, requiring its own
separate, explicit go-ahead per the standing park rule) should treat this pack's citations as a
starting point, not a final answer, and should specifically re-verify the SUA/deduction dollar
figures (Finding 3) and the drug-felony statute's exact conditions (Finding 5) against primary
sources this pack could not access, before hardcoding either into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Tennessee rule/policy text,
checking specifically for: claims inferred from a section heading rather than its own body text;
dollar figures not traceable to a specific dated source; and any Tennessee-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- The BBCE finding (Finding 1) was NOT accepted from a single news article's summary — the
  amended rule text itself was independently fetched directly from `publications.tnsosfiles.com`
  (the Secretary of State's own host) and the exact effective date (April 15, 2026) confirmed
  from the rule's own Administrative History line, not inferred from the news article's vaguer
  "recently implemented" language. A separate, initially-surfaced WebSearch AI-summary claim that
  Tennessee's BBCE was enacted via "SB 2132/HB 2043" was independently checked by fetching that
  bill's actual text directly — the fetched text showed SB 2132/HB 2043 is an UNRELATED bill
  about administrative-rule expiration continuity, not SNAP BBCE at all. This false lead was
  caught and discarded rather than repeated into the pack, and is recorded here as a concrete
  example of why this pack independently verifies bill numbers against primary bill text rather
  than trusting a search engine's AI-generated summary of legislative history.
- The SUA/deduction dollar-figure gap (Finding 3) is stated as an explicit, disclosed absence
  rather than filled in with the stale codified-rule numbers or a plausible-sounding invented
  figure — this pack cross-checked the stale table's OTHER figures (Standard Deduction, Maximum
  Coupon Allotment) against Virginia's pack's own current FFY2026 figures specifically to build
  the case that the table is stale, rather than asserting staleness without a concrete comparison.
- The vehicle/boat finding (Finding 4) is stated narrowly — countable recreational property
  named in Policy 24.12's text — WITHOUT extending the claim to ordinary passenger vehicles,
  which this pack could not independently confirm; the gap is disclosed in `freshness.json`
  rather than silently assumed to follow the same rule as boats.
- The drug-felony finding (Finding 5) is explicitly flagged as resting on secondary corroboration
  rather than primary statutory text, with the specific hosts tried and their failure mode
  (HTTP 403) named directly in `pack.json`'s verification method and in this document — not
  smoothed over as equivalent to a successful primary-source fetch.
- The multi-document staleness pattern (Finding 2) is stated with the SPECIFIC conflicting
  document pairs and their exact review/amendment dates named directly, rather than a vague
  "some documents may be outdated" caveat — each of the three conflicts is independently
  traceable to two specific, dated Tennessee documents this pack fetched and quoted directly.

## Sources

| Source | Access | Dated |
|---|---|---|
| TN Rule 1240-01-14-.15, Categorically Eligible Households - SNAP Only | direct curl fetch (browser UA) + pdftotext -layout | amended 1/15/2026; effective 4/15/2026 |
| TN Rule 1240-01-03-.43, Food Stamp Program Work Requirements (ABAWD) | direct curl fetch (browser UA) + pdftotext | last amended May 2004 |
| TN Rule 1240-01-04-.27, Financial Eligibility Requirements — Tables III-VII | direct curl fetch (browser UA) + pdftotext | May 2024 (Revised) republication; underlying dollar figures disclosed as stale |
| TN Rule 1240-01-07-.01, Periods of Eligibility | direct curl fetch (browser UA) + pdftotext | last amended September 1983 |
| TDHS SNAP Policy 24.02, Application Processing | direct curl fetch (browser UA) + pdftotext | effective 12/01/2022; last reviewed 11/30/2023 |
| TDHS SNAP Policy 24.03, Timeliness Standards | direct curl fetch (browser UA) + pdftotext | effective 02/01/2022; last reviewed 11/30/2023 |
| TDHS SNAP Policy 24.11, Work Requirements | direct curl fetch (browser UA) + pdftotext | effective 03/01/2023; last reviewed 11/30/2023 |
| TDHS SNAP Policy 24.12, Resources | direct curl fetch (browser UA) + pdftotext | effective 03/01/2021; last reviewed 11/30/2023 |
| TDHS SNAP Policy 24.13, Lottery or Gambling Winnings | direct curl fetch (browser UA) + pdftotext | effective 03/01/2021; last reviewed 11/30/2023 |
| TDHS SNAP Policy 24.14, Income | direct curl fetch (browser UA) + pdftotext | last reviewed 11/30/2023 |
| TDHS SNAP Policy 24.18, Deductions from Income | direct curl fetch (browser UA) + pdftotext | effective 09/17/2018; last reviewed 11/30/2023 |
| TDHS SNAP Policy 24.24, Categorically Eligible SNAP Recipients | direct curl fetch (browser UA) + pdftotext | effective 06/15/2021; last reviewed 11/30/2023 |
| TDHS original SNAP Policy Manual PDF (found severely stale, not relied upon) | direct curl fetch (browser UA) | dated "July 2017" in its own footer |
| TDHS SNAP program page and ABAWD information page | WebFetch | fetched 2026-08-11 |
| USDA FNA, Time Limit Waivers FY 2025-2029 index | direct curl fetch (browser UA), followed redirect | fetched 2026-08-11, page updated 7/22/2026 |
| USDA FNA, States that Operate a Restaurant Meals Program | direct curl fetch (browser UA) | fetched 2026-08-11, page updated 8/7/2026 — Tennessee absent from the 9-state list |
| Public Health Law Center, SNAP Ban Opt-Out States Map — Tennessee | WebFetch | fetched 2026-08-11 |
| Network for Public Health Law, 50-State Survey: SNAP Drug Felony Bans (PDF) | direct curl fetch (browser UA) + pdftotext | dated 2020 in URL, content cross-checked against Public Health Law Center |
| fox13memphis.com, "Tennessee changes SNAP rules..." | WebFetch | June 2026 |
| Fetched-and-discarded false lead: TN SB2132/HB2043 bill text | direct curl fetch (browser UA) + pdftotext | confirmed UNRELATED to SNAP; not about BBCE |
| law.justia.com, casetext.com (Tenn. Code Ann. § 71-5-308 primary text) | ATTEMPTED, FAILED — HTTP 403 on every try (multiple UAs, http/https) | — |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (TN guide questions), `eval/answer-eval.ts` (TN_GOLD, spread
into ALL_GOLD). Tennessee is deliberately NOT added to any engine-citations.ts per-state
constant map — Tennessee has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("TN", ...)` will throw `UnknownStateError` until a future,
separately-gated `packages/snap-rules` build adds a Tennessee policy — this matches the
precedent already set by North Carolina's, Ohio's, New Jersey's, and Virginia's corpus packs in
this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Tennessee `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.
