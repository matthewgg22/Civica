# North Carolina pack — provenance

**Created:** 2026-08-11. North Carolina is a genuine BLANK SLATE in this roster — unlike Ohio's
prior build (which already had a full, independently-verified `StatePolicy` entry and 92-profile
oracle-fixture coverage), North Carolina has NO existing `packages/snap-rules` entry and NO oracle
fixture coverage at all. No discrepancy-checking against an existing engine constant was possible
or attempted; this pack's findings stand entirely on its own primary-source research. This task's
scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay fully
parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (with a standard browser `User-Agent` header) of individual FNS Certification
Manual section PDFs at `policies.ncdhhs.gov`, extracted to text with `pdftotext -layout`, plus a
direct fetch of North Carolina General Statute § 108A-51.1 and its enacting 2015 session law at
`ncleg.gov`, and a cross-check of USDA's current Restaurant Meals Program state list against
NCDHHS's own Hurricane Helene hot-foods-waiver press release.

## Finding 0 — a tooling-artifact lesson, same shape as Pennsylvania's, different mechanism

`policies.ncdhhs.gov` (North Carolina's manual host) returned a bare **HTTP 403 Forbidden** on
every `WebFetch` attempt in this pass, against BOTH the manual's HTML listing pages and its PDF
documents — a response that looks exactly like "this host blocks bot traffic, give up" at first
glance. A plain `curl` request against the SAME URLs, with a standard browser `User-Agent` header
(`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ...`), returned clean **HTTP
200** responses immediately, every time, for both the HTML manual-index pages and every PDF
section fetched during this pass. This is a DIFFERENT failure mode from Pennsylvania's plain-HTTP-
only host in this same roster (that host actively refused TLS; this host serves HTTPS fine but
appears to reject requests lacking a browser-like `User-Agent` header, a common lightweight bot
mitigation) — but the METHODOLOGICAL LESSON is the same one this task's briefing anticipated: a
generic fetch tool's failure mode (a bare 403, a bare connection refusal) is not proof the content
is gone or gated behind real authentication. Both this pass's `WebFetch` calls AND the general
`WebFetch` tool's own error message gave no hint that a UA-header change would fix it; this was
discovered only by retrying with `curl` per this task's explicit instruction to try a raw fetch
before concluding a source is unreachable. Every dollar figure and policy citation in this pack is
sourced from the successful `curl` fetches, not from any WebFetch-summarized content (WebFetch
never returned usable body text for this host in this pass).

## Finding 1 (flagship) — North Carolina has barred itself from ABAWD waivers since 2015, a full decade before Ohio's comparable prohibition

North Carolina General Statute § 108A-51.1, "Prohibition on certain waivers," reads verbatim (text
fetched directly from `ncleg.gov`'s current codified-statute page, confirmed unchanged since
enactment):

> "Except for waivers for the Disaster Supplemental Nutrition Assistance Program sought for an
> area that has received a Presidential disaster declaration of Individual Assistance from the
> Federal Emergency Management Agency, the Department shall not seek waivers to time limits
> established by federal law for food and nutrition benefits for able-bodied adults without
> dependents required to fulfill work requirements to qualify for those benefits."

This statute was enacted by Session Law 2015-294, § 16(a) — House Bill 318, the "Protect North
Carolina Workers Act," signed by Governor McCrory on October 29, 2015, effective **October 1,
2015**. This pack fetched the ORIGINAL session-law text directly (`ncleg.gov`'s enacted-legislation
HTML page for SL 2015-294) to confirm the enacting language matches the current codified statute,
and separately fetched the CURRENT `G.S. 108A-51.1` statute page to confirm no repeal or amendment
has occurred in the intervening decade. Section 16(b) of the same session law additionally required
NCDHHS to withdraw any then-pending waiver request and discontinue any then-active waiver by March
1, 2016 (with a savings clause protecting a waiver already in place as of September 1, 2015) — this
was not merely a forward-looking prohibition but an immediate, retroactive-effect wind-down of
whatever county waivers existed at the time.

This is a genuinely notable finding on its own terms — a full DECADE of continuous, unambiguous
statutory prohibition, longer-standing than Ohio's comparable Ohio Revised Code § 5101.548
(effective September 30, 2025) elsewhere in this roster, and one this pack found independently
corroborated by secondary sources (Ballotpedia's "Work requirements for public assistance in North
Carolina" page, and multiple North Carolina policy-news outlets covering the 2015 legislation)
rather than contradicted by them — several already accurately attribute North Carolina's current
"no waiver" status to this specific 2015 statute. NCDHHS's own current ABAWD program page makes no
reference to any waived area, and USDA's current ABAWD waiver-status reporting (checked via
WebSearch during this pass) names only Minnesota, Montana, and North Dakota as holding active
statewide waivers as of the current reporting period — North Carolina is not among them, consistent
with the decade-old statutory bar.

## Finding 2 (flagship) — North Carolina's drug-felony rule is a genuine MODIFIED ban, not a full opt-out, and this pack independently confirmed secondary sources already describe it correctly

FNS 270 makes permanent disqualification the DEFAULT for any controlled-substance felony conviction
(federal or North Carolina law) committed on or after August 23, 1996. The ONLY reinstatement path
(FNS 270.02) requires BOTH that the conviction be classified as a North Carolina Class H or Class I
felony (the state's two least-serious felony classes) AND that the conviction occurred IN North
Carolina specifically — FNS 270's own worked example states a Virginia conviction of an equivalent
severity class remains permanently disqualifying because it did not occur in North Carolina. Even
within that narrow reinstatement path, an individual must wait a minimum of six months (from release
from custody, or from the conviction date if never incarcerated) AND receive a notice of compliance
from the local Area Mental Health Authority (AMHA) — a state/county mental-health entity, not the
DSS eligibility worker, that determines whether ongoing substance-abuse treatment participation is
required and can re-disqualify an individual for the SAME conviction later if it finds noncompliance.

This pack checked whether this modified-ban characterization is already correctly reported by
outside secondary sources before treating it as a "correction" — it is not a correction. The North
Carolina Justice Center's own advocacy materials, the Collateral Consequences Resource Center's
national state-by-state SNAP/TANF drug-conviction survey, and the Public Health Law Center's
opt-out-state tracking map (checked via WebSearch during this pass) ALL already correctly classify
North Carolina as a "modified ban" state with the Class H/I in-state carve-out, not a full ban and
not a full opt-out. This pack's primary-source read of FNS 270 CONFIRMS that existing, accurate
secondary-source consensus rather than correcting a false one — flagged explicitly here so a
reviewer does not go looking for a drug-felony correction that isn't the actual finding for North
Carolina (contrast this roster's Illinois ABAWD-waiver correction, Minnesota's drug-testing
correction, and this pack's own RMP finding below, all genuine corrections of a false claim).

Separately, this pack checked whether FNS 270's current text is at risk of imminent legislative
change: North Carolina Senate Bill 564 / House Bill 682 ("Public Safety Through Food Access Act,"
2025-2026 session) would eliminate both the permanent and 6-month disqualifications entirely. As of
this pack's WebSearch check, the bill remained in committee, referred to the Senate/House Rules
committees in spring 2025 and past the May 8, 2025 crossover deadline, with no indication of
enactment — FNS 270's modified-ban text described above remains the CURRENT, operative policy as of
this pack's build date. See `freshness.json`'s `nc-drug-felony-reform-bill-watch` entry.

## Finding 3 — a genuine secondary-source conflation this pack corrects: the Hurricane Helene hot-foods waiver is NOT North Carolina's Restaurant Meals Program

USDA's current Restaurant Meals Program (RMP) state list does not include North Carolina (checked
via WebSearch against USDA's own reporting during this pass — the list currently reads Arizona,
California, Illinois, Maryland, Massachusetts, Michigan, New York, Rhode Island, and Virginia, the
same nine-state list Ohio's pack in this roster independently found). Several third-party
SNAP-benefit explainer sites checked during this pass either list North Carolina among RMP states or
publish North Carolina-specific "how to use EBT at a restaurant" content without clearly stating the
program's actual (non-)existence in the state. This pack traced the likely source of the confusion:
NCDHHS's own October 4, 2024 press release, "North Carolinians Enrolled in Food and Nutrition
Services Can Use Benefits to Buy Hot Food Following Hurricane Helene," announced that FNS
participants could use EBT benefits to purchase hot, prepared food from authorized EBT VENDORS
(the release specifically names gas stations and grocery-store deli departments) for approximately
one month, October 4 through November 3, 2024 — and explicitly, in the release's own text, EXCLUDED
restaurants from this waiver. This is a federal disaster hot-foods waiver (a different statutory
mechanism than the ongoing RMP option under 7 CFR 274.7(g), typically tied to a Presidential disaster
declaration; NCDHHS was separately pursuing a D-SNAP application for the same disaster at the time),
not an ongoing program, not restaurant-specific, and already expired as of this pack's build date.
This pack's restaurant-meals-program supplement and freshness.json both state this distinction
plainly, with an explicit re-verification trigger should a future declared disaster prompt a new
hot-foods waiver.

## Finding 4 — a genuine structural difference from every other state this roster has built: SUA scales with household size

North Carolina's Standard Utility Allowance (and its Basic Utility Allowance) are NOT flat,
single-figure amounts the way Ohio's ($766), Pennsylvania's, Wisconsin's, and Minnesota's SUA
figures are in this roster — FNS 360.01's current table (effective October 1, 2025) scales the SUA
from $637 (household size 1) up to $912 (5 or more), and the BUA from $392 up to $564, over the same
size tiers; only the Telephone Utility Allowance ($42) is flat regardless of size. This pack checked
this was not a misreading of a size-neutral table by re-reading the table's own column header
("Food and Nutrition Services Unit Size") and confirming the dollar figures genuinely differ by row
— it is a genuine, deliberate structural choice distinct from the federal-standard flat-SUA
convention most other USDA-guidance states (and this roster's other 2026-built packs) follow.

## Finding 5 — North Carolina's certification-period structure is flatter and its default SHORTER than most of this roster

FNS 500.02 sets only two certification-period tiers: 12 months for a household containing ONLY
Specified Persons (elderly/disabled) with no earned income, and 6 months for every other household.
There is no 24- or 36-month tier reachable by any household type, and — notably — the 6-month figure
is North Carolina's DEFAULT for ordinary households, not a shortened tier reserved for unstable
circumstances the way it functions in Ohio's and Pennsylvania's graduated multi-tier structures in
this same roster (where 12 months is the more common default and 6 months or shorter is reserved for
ABAWD members or otherwise unstable households). This pack flags the contrast explicitly so a reader
does not assume North Carolina's 6-month figure carries the same "shortened for instability" meaning
it does elsewhere in this roster.

## Confirmed — no discrepancy found (no engine constant existed to check against)

North Carolina has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing
engine constant this pack could confirm or contradict — every dollar figure, categorical-eligibility
rule, and disqualification rule above is a first-pass primary-source finding, not a cross-check
against prior engineering work. A future `packages/snap-rules` build for North Carolina (out of
scope for this task, requiring its own explicit go-ahead per the standing park rule) should treat
this pack's citations as a starting point, not a final answer, and re-verify independently.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched manual-section or statute text,
checking specifically for: claims inferred from a section title rather than its own body text;
dollar figures not traceable to the specific dated FNS Change Notice; and any North-Carolina-vs-
common-assumption contrast overclaimed as settled when the underlying evidence was genuinely
ambiguous. Concrete catches from this pass:

- The ABAWD-waiver-prohibition finding (Finding 1) was NOT accepted from a WebSearch summary
  alone — the statute's exact codified text was fetched directly from `ncleg.gov`, and the ORIGINAL
  2015 enacting session law was separately fetched to confirm the codified text traces to a real,
  datable legislative act rather than a WebSearch hallucination of a statute number.
- The drug-felony finding (Finding 2) was explicitly checked against outside secondary sources
  BEFORE drafting, specifically to determine whether this was a correction (like Illinois' and
  Minnesota's) or a confirmation (like Ohio's drug-felony and RMP findings) — it turned out to be a
  confirmation, and this pack says so directly rather than manufacturing a correction narrative
  where none exists.
- The RMP finding (Finding 3) does NOT merely assert "North Carolina has no RMP" from USDA's list —
  it traces the SPECIFIC likely source of the third-party conflation (the Hurricane Helene press
  release) and reads that release's own text closely enough to catch that it explicitly excludes
  restaurants, rather than assuming a generic "disaster flexibility" summary was accurate.
- The SUA household-size-scaling finding (Finding 4) was re-checked against the table's own column
  structure (not just the numbers) to rule out a possible pdftotext table-extraction artifact
  misaligning columns — the "Food and Nutrition Services Unit Size" header and monotonically
  increasing dollar figures across rows 1 through 5-or-more confirm this is a genuine per-size table,
  not a parsing error.
- The vehicle-exclusion claim (asset-rule supplement) is stated as a full, unconditional exclusion
  ("Motor Vehicles... This includes boats") because that is the ONLY vehicle-related provision this
  pack's fetch of FNS 390 found — no per-vehicle equity-value cap or one-vehicle-only limitation
  appears anywhere in the fetched resource-exclusions text, so this pack does not invent one.
- The AMHA reinstatement mechanics (criminal-justice-disqualifications supplement) are described
  using ONLY the process FNS 270 itself specifies — this pack does not invent typical AMHA
  processing timelines or estimate how consistently the 100 counties reach AMHA referrals; that gap
  is disclosed directly in freshness.json rather than papered over with an invented estimate.

## Sources

| Source | Access | Dated |
|---|---|---|
| FNS 220, Categorical Eligibility | direct curl fetch (browser UA) + pdftotext | Change #02-2024, eff. 10/1/2024 |
| FNS 390, Resources | direct curl fetch (browser UA) + pdftotext | Change #02-2024, eff. 10/1/2024 |
| FNS 340, Deductions | direct curl fetch (browser UA) + pdftotext | Change #02-2026, eff. 8/4/2026 |
| FNS 360, Determining Benefit Levels | direct curl fetch (browser UA) + pdftotext | Change #01-2025, eff. 10/1/2025 |
| FNS 260, Able-Bodied Adults without Dependents (ABAWD) | direct curl fetch (browser UA) + pdftotext | Change #02-2025, eff. 12/1/2025 |
| FNS 270, Controlled Substance Felons | direct curl fetch (browser UA) + pdftotext | Change #18-2021, eff. 9/20/2021 |
| FNS 425, Expedited Service Processing | direct curl fetch (browser UA) + pdftotext | Change #01-2024, eff. 3/1/2024 |
| FNS 500, SR Category & Reporting Requirements | direct curl fetch (browser UA) + pdftotext | Change #02-2024, eff. 10/1/2024 |
| N.C. Gen. Stat. § 108A-51.1, Prohibition on certain waivers | direct curl fetch, ncleg.gov current-statute page | eff. 10/1/2015, enacted S.L. 2015-294 § 16(a) |
| S.L. 2015-294 (House Bill 318, "Protect North Carolina Workers Act") | direct curl fetch, ncleg.gov enacted-legislation page | ratified 9/29/2015, signed 10/29/2015 |
| USDA FNS Restaurant Meals Program state list | WebSearch (WebFetch timed out on the live USDA page) | fetched 2026-08-11 |
| NCDHHS press release, Hurricane Helene hot-foods waiver | WebFetch | published 10/4/2024, fetched 2026-08-11 |
| NCDHHS ABAWD program page (ncdhhs.gov) | WebFetch | fetched 2026-08-11 |
| Secondary corroboration of the modified drug-felony ban (NC Justice Center, Collateral Consequences Resource Center, Public Health Law Center) | WebSearch, secondary corroboration only | fetched 2026-08-11 |
| Secondary corroboration of the 2015 ABAWD-waiver-prohibition statute (Ballotpedia, NC policy-news coverage) | WebSearch, secondary corroboration only | fetched 2026-08-11 |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES). North Carolina
is deliberately NOT added to `engine-citations.ts`'s `BBCE_PCT` map — that map mirrors
`packages/snap-rules`' per-state constant by design (see the comment above the map), and North
Carolina has no `packages/snap-rules` `StatePolicy` entry at all to mirror. `formatEngineParams("NC",
...)` will throw `UnknownStateError` until a future, separately-gated `packages/snap-rules` build
adds a North Carolina policy — this matches the precedent already set by New York's corpus pack in
this same roster, which is also absent from `BBCE_PCT` for the identical reason.

`packages/snap-rules` stays fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`)
— this pack does not modify it and does not request an unfreeze. A future North Carolina
`packages/snap-rules` build is out of scope here and would need its own separate, explicit go-ahead.
