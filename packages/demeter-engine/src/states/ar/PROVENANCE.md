# Arkansas pack — provenance

**Created:** 2026-08-12. Arkansas is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, and Oklahoma's prior builds,
Arkansas has NO existing `packages/snap-rules` entry and NO oracle fixture coverage at all. No
discrepancy-checking against an existing engine constant was possible or attempted; this pack's
findings stand entirely on its own primary-source research. This task's scope was CORPUS ONLY —
the Demeter chatbot's Q&A content layer — and does not touch `packages/snap-rules` or
`data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully parked per the standing
rule (`feedback_dashboard_snap_rules_parked`).

Arkansas is part of this roster's new "batch tier" — smaller-population states built 3-5 at a
time in parallel (Connecticut, Utah, and Iowa were built concurrently by separate agents). See
the "Registration and merge conflict handling" section below for how the shared registration
files were reconciled.

## Method

Direct curl fetch (browser User-Agent) of every Arkansas DHS-hosted PDF (the full SNAP
Certification Manual, its Appendix D/Exhibits A-B dollar-figure appendix, and a separate SNAP
Policy Directives change-history PDF) returned a clean HTTP 403 on every attempt — a genuine
access barrier for Arkansas's PRIMARY policy-manual publisher (see Finding 0). This pack instead
retrieved the SAME PDFs via WebFetch, which succeeded on every DHS document attempted: the full
SNAP Certification Manual (4.8MB), the Appendix D/Exhibits A-B dollar-figure PDF (1.2MB), and the
SNAP Policy Directives change-history PDF (1.8MB), each converted with `pdftotext -layout` for
full-text search and verbatim reading. Separately, and with NO access barrier at all, this pack
directly curl-fetched the Arkansas Bureau of Legislative Research's own emergency-rule filing
(`arkleg.state.ar.us`), which reproduces Act 675 of 2023 (Senate Bill 306)'s own enacted statutory
text in full — this pack's single richest primary source, read directly rather than inferred from
a secondary summary. WebSearch/WebFetch cross-checks located FindLaw's current-code mirror of
Arkansas Code § 20-76-409 (the drug-felony opt-out) after Justia's own mirror 403'd. USDA FNS's
current Restaurant Meals Program state list was fetched directly (clean HTTP 200, Arkansas
absent).

## Finding 0 — a genuine, disclosed access barrier on every Arkansas DHS-hosted primary-source
PDF, resolved by fetching the SAME files through a different tool, not a fabricated citation

Every DHS-hosted PDF this pack attempted via direct curl (with a browser User-Agent) — the full
SNAP Certification Manual, the Appendix D/Exhibits dollar-figure PDF, and the SNAP Policy
Directives change-history PDF — returned a clean HTTP 403 on every attempt. This pack resolved it
by fetching the identical URLs through WebFetch instead, which retrieved each document's full
binary content successfully for direct `pdftotext` extraction — a genuine, disclosed
access-barrier workaround using a DIFFERENT FETCH PATH to the SAME primary-source file, not a
substitution of a lower-quality or different source. Justia's Arkansas Code mirror
(`law.justia.com`) also 403'd on direct WebFetch, the now-familiar Justia-block pattern this
roster has documented repeatedly (Louisiana, Virginia, Indiana, Missouri, Maryland, Colorado,
South Carolina, Alabama, Kentucky, Oklahoma) — resolved via FindLaw's current-code mirror instead,
which returned readable text cleanly. By contrast, the Arkansas Bureau of Legislative Research's
own emergency-rule filing (a different host, `arkleg.state.ar.us`) returned a clean HTTP 200 to
direct curl with no barrier at all.

## Finding 1 (flagship, structural) — Arkansas law STATUTORILY BARS income-based BBCE and caps its
resource-based categorical-eligibility exemption to a TEMPORARY $5,500 limit, once every 5 years

Arkansas Code § 20-76-115, added by Act 675 of 2023 (Senate Bill 306, 94th General Assembly, read
in full from the Arkansas Bureau of Legislative Research's own emergency-rule filing, which
reproduces the Act's enacted text verbatim), states in relevant part that unless required by
federal law, DHS "shall not... [a]pply gross income standards for food assistance higher than the
standards specified in 7 U.S.C. § 2014(c)" (the plain federal 130% FPL) nor "grant categorical
eligibility that exempts households from the gross income standard... for any noncash, in-kind,
or other benefit" unless DHS separately obtains a federal waiver from USDA. This is a genuine
LEGISLATIVE self-restriction on DHS's own eligibility policy — structurally similar in KIND (a
state legislature restricting the administering agency's own discretion) to this roster's Oklahoma
finding (statutory ABAWD-waiver-request ban), though different in SUBJECT (BBCE/income limits
rather than ABAWD waivers). Separately, and consequentially, the same Act directs DHS to seek (and
DHS did obtain, per its own April 2025 emergency-rule filing) a federal waiver exempting SNAP
enrollees from the FEDERAL RESOURCE limit specifically — but caps the resulting benefit tightly:
the temporary increased asset limit is capped at $5,500, available "for a period of up to one (1)
year," and "no more than one (1) time every five (5) years" (Ark. Code § 20-76-115(b)(2)(B)-(C)).
This pack independently confirmed this operates as described in DHS's own SNAP Certification
Manual § 1919 (dated 04/01/2025, implementing the Act), which restates the same 12-month/5-year
structure in plain language. This is a genuinely different, and more restrictive, structural shape
than every other BBCE-equivalent pack this roster has built: TEMPORARY, RESOURCE-ONLY, and
legislatively capped, with income-based BBCE affirmatively barred by state law absent a separate
federal waiver this pack found no evidence DHS has obtained (see freshness.json).

## Finding 2 (flagship, time-sensitive) — Arkansas's own ABAWD age-exemption table (Manual § 3100)
reflects only the 2023 pre-OBBBA Fiscal Responsibility Act schedule, topping out at exempt-at-55

Manual § 3100 (dated "SNAP Manual 01/01/2024") lists the 2023 federal Fiscal Responsibility Act's
own incremental phase-in verbatim: "Effective September 1, 2023, the ABAWD time limit increases to
age fifty (50)... Effective October 1, 2023... fifty-two (52)... Effective October 1, 2024...
fifty-four (54)... Effective October 1, 2025... fifty-five (55)" (i.e., subject through age 54) —
with no mention anywhere in the manual of the One Big Beautiful Bill Act (OBBBA), signed July 4,
2025, which raised the ABAWD age ceiling to 64 effective IMMEDIATELY upon enactment (narrowing the
caregiver exemption from under-18 to under-14 children), with states directed to complete phase-in
by no later than June 2026 — well before this pack's own August 12, 2026 fetch date. This pack
treats OBBBA's 18-64 standard as the operative federal floor regardless of Arkansas's own stale 55
figure, structurally similar to this roster's Oklahoma pack's own three-way ABAWD age-range
staleness finding, though Arkansas's manual is internally consistent (one stale figure, not three
conflicting ones) rather than self-contradictory.

## Finding 3 — Arkansas's own ABAWD waiver-status statement (Manual § 3501) is dated 01/01/17 —
the oldest individually-dated section this pack found anywhere in the manual, roughly nine years
unrevised

Manual § 3501 (Waivers) is dated "SNAP Manual 01/01/17" and states plainly: "The state of Arkansas
is currently not under a waiver and RTW applies as of January 1, 2016." This is the OLDEST
individually-dated section citation this pack found anywhere in Arkansas's SNAP Certification
Manual — roughly nine years unrevised despite the manual's own cover page showing a 07/01/2026
overall revision date. This pack found no more recent Arkansas-specific ABAWD waiver statement
anywhere in DHS's own manual, and did NOT independently verify current county-level unemployment
data against USDA FNS's own waiver-eligibility criteria (the plain federal 10%-unemployment
threshold) as a cross-check — this pack states what Arkansas's own primary source says, discloses
explicitly that the source itself is nine years stale, and does not assert current statewide
waiver-free status with full confidence beyond what that stale 2017-dated section supports (see
freshness.json).

## Finding 4 — Arkansas's drug-felony SNAP ban: a FULL opt-out, confirmed by directly reading the
statute's own current plain-language text

Arkansas Code § 20-76-409 (Opt out), read directly via FindLaw's current-code mirror after
Justia's own mirror 403'd (see Finding 0), states in full: "The State of Arkansas opts out of
Section 115 of the Personal Responsibility and Work Opportunity Reconciliation Act of 1996, Pub.
L. No. 104-193." Section 115 of PRWORA is the specific federal provision (codified as 21 U.S.C.
§ 862a) that created the drug-felony SNAP/TANF ban in the first place — an unconditional opt-out
of Section 115 is therefore a FULL opt-out, not a partial modification, a conclusion this pack
reached by reading the statute's own current text directly rather than relying solely on secondary
survey sources (Collateral Consequences Resource Center and others independently report the same
conclusion, generally dating Arkansas's full repeal to around 2017, corroborating rather than
substituting for the direct statutory read). This pack cross-checked the conclusion against the
SNAP Certification Manual's own current disqualification-category provisions and found no
drug-felony disqualification category anywhere in the manual, independently corroborating the
statute's plain opt-out language.

## Finding 5 — this pack found NO distinctive branded EBT card name for Arkansas, and does not
assert one

This pack specifically checked for a distinctive branded EBT card name (the pattern this roster's
Oklahoma pack found — the "ACCESS Oklahoma Card" — and Louisiana's confirmed "Louisiana Purchase
Card") and found NONE for Arkansas. DHS's own EBT materials refer to it plainly as an "EBT card"
or "electronic benefits transfer (EBT) card," routed through the Quest® network for point-of-sale
and ATM transactions. This pack does not assert a distinctive card name it could not verify — the
same evidentiary standard this roster's Kentucky pack applied when it rejected an unverified
card-name claim from a secondary source rather than repeating it uncritically.

## Finding 6 — Arkansas has a narrower, contract-based restaurant-meal option for homeless SNAP
recipients — genuinely distinct from, and should not be conflated with, USDA's Restaurant Meals
Program

USDA FNS's own current Restaurant Meals Program (RMP) state list (fetched directly, clean HTTP
200) confirms Arkansas is ABSENT — the same nine-state/jurisdiction list this roster's Oklahoma
and Kentucky packs independently confirmed. This pack found Arkansas DOES use a genuinely
different, narrower federal option worth distinguishing carefully: Manual §§ 120-121 (Communal
Dining Facilities) permit homeless SNAP households to purchase meals from restaurants that
CONTRACT specifically with DHS to supply reduced-price meals to the homeless (and separately permit
contracted meal-delivery services for elderly/SSI-recipient households) — a materially narrower
mechanism than full RMP: only DHS-contracted restaurants qualify (not any FNS-authorized retailer
generally), tied to a negotiated reduced price rather than ordinary menu pricing. This pack states
both facts precisely (Arkansas absent from full RMP; Arkansas DOES have a narrower homeless-specific
contracted-meal option) rather than collapsing them into either an overstated "yes" or an
understated flat "no."

## Finding 7 — Arkansas has no federally recognized tribal reservations today; no in-state FDPIR
mutual-exclusivity question to check

Given this roster's build guidance and the significant tribal history in the broader region, this
pack specifically checked whether Arkansas has current federally recognized tribal land or an
in-state Food Distribution Program on Indian Reservations (FDPIR) presence requiring a
SNAP/FDPIR mutual-exclusivity disclosure the way this roster's Oklahoma pack documents. It found
none: most Native American nations historically present in Arkansas (Quapaw, Caddo, Osage, and
later Cherokee) were forced out during the Indian Removals of the 1800s, relocated primarily to
what is now Oklahoma, and Arkansas has no federally recognized tribal reservation located within
the state today. This is a genuine, checked-for structural CONTRAST with Oklahoma worth stating
plainly rather than silently assuming Arkansas has a similar tribal-SNAP dimension it does not.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Arkansas has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass primary-source
finding. A future `packages/snap-rules` build for Arkansas (out of scope for this task, requiring
its own separate, explicit go-ahead per the standing park rule) should treat this pack's citations
as a starting point, not a final answer, and should specifically re-verify Act 675 of 2023's
continued force and any subsequent income-standard BBCE waiver DHS may have separately sought
(Finding 1, the most legally consequential fact in this pack), Manual § 3501's now nine-year-stale
waiver-status statement against USDA FNS's own current quarterly waiver list (Finding 3), and
whether Manual § 3100 has since been corrected to reflect OBBBA's 18-64 standard (Finding 2)
before hardcoding Arkansas's parameters into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Arkansas source text, checking
specifically for: claims inferred from a search-result summary rather than a direct primary-source
read; dollar figures not traceable to a specific dated source; and any Arkansas-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- The BBCE/resource-limit finding (Finding 1) does not merely restate a secondary aggregator's
  summary of Arkansas's "$5,500 resource limit" — it is grounded in this pack directly reading
  Act 675 of 2023's own enacted bill text (Senate Bill 306, fetched via the Arkansas Bureau of
  Legislative Research's own emergency-rule filing, not inferred from a search snippet), which
  distinguishes the statute's TWO separate mechanisms (the income-standard bar and the
  resource-only temporary increase) in a way a simple "resource limit is $5,500" fact would
  collapse and lose.
- The drug-felony finding (Finding 4) does not claim a secondary-source-only conclusion — it is
  grounded in this pack directly reading Ark. Code § 20-76-409's own current plain-language text
  via FindLaw, after confirming Justia's own mirror was blocked, rather than accepting a secondary
  survey's citation without independently locating the statute.
- The EBT-card-name finding (Finding 5) explicitly states the ABSENCE of a distinctive name this
  pack searched for and could not confirm, rather than repeating an unverified "Arkansas EBT card"
  label from a secondary aggregator as though it were a genuine brand name — avoiding the exact
  failure mode this roster's Kentucky pack caught and self-corrected.
- The restaurant-meals finding (Finding 6) does not answer the "can I use EBT at a restaurant"
  question with a flat "no" (which would understate Arkansas's genuine homeless-specific
  contracted-meal option, directly read from Manual §§ 120-121) or a flat "yes" (which would
  overstate it as equivalent to the nine-jurisdiction RMP) — it states the precise, narrower
  mechanism Arkansas's own manual actually describes.
- The certification-period finding was specifically checked against Kentucky's and Oklahoma's
  differently-shaped tri-tier/flat structures rather than assumed to match either — Arkansas's own
  36-month provision (Manual § 3320) carries a distinctive minor-dependent-child gate neither of
  those two prior packs documents, and this pack states that gate explicitly rather than
  generalizing "Arkansas has a 36-month option" without its actual condition.
- The Standard Medical Deduction's dated-effective-date lag (10/01/2024 vs. the rest of Appendix
  D's 10/01/2025) was deliberately flagged as an open, undetermined discrepancy (freshness.json)
  rather than silently assumed to be either an intentional freeze or a document error — this pack
  does not know which, and says so.

## Registration and merge conflict handling

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (AR guide questions), `eval/answer-eval.ts` (AR_GOLD, spread
into ALL_GOLD). Arkansas is deliberately NOT added to any `engine-citations.ts` per-state constant
map — Arkansas has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("AR", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds an Arkansas policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, South Carolina's, Alabama's, Louisiana's, Kentucky's, and Oklahoma's corpus packs in
this same roster.

Arkansas was built in this roster's new "batch tier" alongside Connecticut, Utah, and Iowa, each
intended to build concurrently by a separate agent. In practice, this pack's own push landed
CLEANLY — a `git fetch` immediately before the final push (after a `git rebase` onto the latest
`codex/rebuild-feb18`, which itself only picked up an unrelated citation-verifier fix, #773) showed
no Connecticut, Utah, or Iowa commits had landed yet on any of the four shared registration files
(`states/index.ts`, `packs.ts`, `apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`). No merge
conflict occurred; this pack was first to land in the batch. Both suites were re-run after the
rebase to confirm nothing regressed (demeter-engine: 328/328 passing incl. 2 skipped; apps/web:
463/463 passing incl. 15 skipped) before the final push.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Arkansas `packages/snap-rules` build is out of scope here and would need its
own separate, explicit go-ahead.
