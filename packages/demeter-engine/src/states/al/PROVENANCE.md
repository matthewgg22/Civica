# Alabama pack — provenance

**Created:** 2026-08-12. Alabama is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, and South Carolina's prior builds, Alabama has NO existing `packages/snap-rules`
entry and NO oracle fixture coverage at all. No discrepancy-checking against an existing engine
constant was possible or attempted; this pack's findings stand entirely on its own primary-source
research. This task's scope was CORPUS ONLY — the Demeter chatbot's Q&A content layer — and
does not touch `packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of
which stay fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (browser User-Agent) of Alabama DHR's CURRENT, per-chapter SNAP Points of
Eligibility (POE) Manual, hosted at `apps.dhr.alabama.gov/POE/` (Chapters 1, 2, 7, 8, 9, 10, 11
fetched individually as PDFs and converted with `pdftotext -layout`), plus DHR's current Form
DHR-FAP-1942 (Rev. 10/25, `dhr.alabama.gov`) and DHR's Food Assistance landing page. Every fetch
returned a clean HTTP 200 with no access barrier. Also fetched directly, deliberately, as a
cross-check: a DIFFERENT, older bundled POE manual PDF also hosted on `dhr.alabama.gov`
("Appendix I," 2022-vintage) — found MATERIALLY STALE (see Finding 3) and NOT relied on for any
current fact in this pack. WebSearch cross-checks were used to locate Ala. Code § 38-1-8 (Justia
and FindLaw both returned HTTP 403 on direct fetch — a now-familiar pattern in this roster),
resolved via convergent secondary corroboration (AL Reporter, Alabama Today) cross-checked
against DHR's own primary-source manual text, which independently states the same substantive
rule in its own words.

## Finding 0 — no access barrier encountered on Alabama DHR's own hosts, but a genuine
stale-duplicate-document trap was found on those SAME hosts

`apps.dhr.alabama.gov` and `dhr.alabama.gov` both returned clean HTTP 200 responses to direct
curl with a browser User-Agent on every fetch attempt — no login wall, no rate limiting. The
access complication this pack found is more subtle and, arguably, more consequential than an
outright 403: `dhr.alabama.gov` hosts TWO different vintages of the same POE manual content,
both still live, both easily surfaced by an ordinary search, with materially different substantive
content and no visible flag on either page indicating one supersedes the other. See Finding 3.

## Finding 1 (flagship) — Alabama's drug-felony SNAP ban is MODIFIED, not the unconditional
federal default — a genuine correction to an oversimplified widely-repeated secondary-source
framing

21 U.S.C. § 862a(a)(2) sets a federal default: anyone convicted of a state or federal felony for
possessing, using, or distributing a controlled substance is permanently ineligible for SNAP,
unless a state enacts legislation opting out or modifying the ban under § 862a(d)(1). A 2022-era
Equal Justice Initiative article titled "Alabama in Minority of States That Ban Food Stamps for
People Convicted of Drug Offenses" is the kind of secondary source an applicant or advocate might
easily read as saying Alabama retains the full, unconditional federal ban — the same narrow
category this roster's South Carolina pack independently documented as one of only two full-ban
U.S. jurisdictions nationwide (with Guam). Alabama's own POE Manual (§ 101(f), identical text
confirmed in both the current `apps.dhr.alabama.gov` chapter and this pack's cross-check of the
stale bundle) tells a more specific story: Alabama enacted real modifying legislation — Act
2015-185, § 12 (part of Alabama's 2015 prison-reform package, effective on or about Jan. 30,
2016), codified at **Ala. Code § 38-1-8**. The statute provides that a person otherwise
disqualified for a drug-related felony becomes SNAP-eligible upon completing their sentence, OR
while satisfactorily serving a period of probation — including satisfactorily completing mandatory
participation in a drug treatment program — provided all other program eligibility requirements
are met. DHR's own manual text is genuinely a little confusing on this point: § 101(f) states the
disqualification "is permanent" and then, in the very next sentence, describes the
sentence-completion/probation-compliance pathway back — using "permanent" loosely, to mean
"indefinite absent the statutory pathway," not an unconditional lifetime bar. This pack states this
as a genuine CORRECTION to any secondary-source framing that reads Alabama as a full-ban state:
Alabama sits in the MODIFIED-BAN majority category, not the tiny full-ban minority — though an
applicant should be told plainly that eligibility is conditional on completing a sentence or
satisfactorily complying with probation and any required drug treatment, not automatic.

**Access caveat:** Justia and FindLaw both returned HTTP 403 on direct fetch of Ala. Code §
38-1-8's own text — resolved via convergent secondary corroboration (AL Reporter's Feb. 2016
"The End of Alabama's Lifetime SNAP and TANF Bans," Alabama Today's contemporaneous coverage)
cross-checked against DHR's own primary-source manual text, which independently states the same
substantive rule in its own words. This pack did not read the Alabama Legislature's own codified
statute text directly — see `freshness.json`.

## Finding 2 (flagship) — Alabama's Expanded Categorical Eligibility (BBCE analog) has a REAL
DUAL-TRACK income ceiling: 130% FPL generally, 200% FPL only for all-elderly-or-disabled
households — partially correcting an oversimplified secondary-source debate

This pack's own initial WebSearch results surfaced BOTH a 130% FPL claim and a 200% FPL claim for
Alabama's BBCE ceiling, with no way from the search summaries alone to tell which was current or
whether one was simply wrong. Alabama's own POE Manual (§ 210(B), confirmed identical across the
current `apps.dhr.alabama.gov` chapter and DHR's own Form 1942) resolves the apparent conflict by
stating BOTH figures apply, to different household compositions: Expanded Categorical Eligibility
(conferred via authorization for Family Assistance/TANF non-cash information-and-referral
services) uses an income test of EITHER 130% of the Federal Poverty Level, OR 200% of the FPL "if
all household members are elderly or disabled and the net income limit is at or below 100% of
FPL" — with an explicit instruction that a household exceeding the 200% ceiling reverts to normal
program rules (100% FPL net income limit, $3,000/$4,500 asset test). A household with even one
non-elderly, non-disabled member qualifies only up to 130% FPL under this pathway — the same as
the ordinary federal floor. This pack states the actual dual-track structure plainly rather than
picking one figure as "the" Alabama BBCE ceiling, because neither single-figure secondary claim
was simply wrong — each was true for a different household composition.

## Finding 3 (flagship, structural/access) — Alabama DHR's own website hosts TWO different
vintages of the SAME POE manual with materially different substantive content, and neither page
flags the older one as superseded

This pack found `dhr.alabama.gov/wp-content/uploads/2022/04/Appendix-I-Food-Assistance-SNAP-Points-of-Eligibility-Manual.pdf`
— a bundled PDF appendix to an FY22 D-SNAP disaster plan — still live, still easily surfaced by an
ordinary search for "Alabama SNAP policy manual," and containing MATERIALLY STALE content
compared to the current per-chapter manual DHR separately hosts at `apps.dhr.alabama.gov/POE/`:

- **ABAWD age range:** the stale bundle exempts individuals "Under age 18 or at least age 50"
  (the pre-OBBBA 18-49 range) and ties the caregiver exemption to "under age 18"; the current
  per-chapter manual exempts individuals "Under age 18 or at least age 65" (the current federal
  18-64 range), ties the caregiver exemption to "under the age of 14," and adds an
  Indian/Urban Indian/California Indian exemption entirely absent from the stale bundle. A
  bundled DHR-FAP-1942 handout embedded within the same stale PDF even contains an internal
  date fingerprint confirming its vintage: "the period from Jan 2019 to Dec 2021."
- **Resource limits:** the stale bundle states $2,250 standard / $3,500 elderly-or-disabled (an
  even OLDER embedded appendix handout within the same PDF states yet a THIRD, mutually
  inconsistent figure, $2,500/$3,750) — all three superseded by the current $3,000/$4,500 figures
  this pack confirmed via both the current `apps.dhr.alabama.gov` chapter text AND DHR's own
  current Form 1942 (Rev. 10/25).
- **Income-eligibility and maximum-allotment tables:** the stale bundle's embedded handout is
  explicitly labeled "Effective 10/1/2021 - 9/30/2022" — an FFY2022 table, roughly four federal
  fiscal years behind this pack's fetch date.

This pack treats `apps.dhr.alabama.gov`'s per-chapter manual and DHR's current Form 1942 (Rev.
10/25) as authoritative wherever the two diverge, and discloses the stale duplicate explicitly in
`freshness.json` rather than silently preferring one without explanation — a future researcher (or
a future Demeter build) who finds `dhr.alabama.gov`'s bundled PDF FIRST, rather than
`apps.dhr.alabama.gov`'s per-chapter manual, would draw confidently wrong conclusions about
current Alabama SNAP policy.

## Finding 4 — Alabama excludes ALL vehicles from the resource test (matching this roster's
Missouri/Maryland/Colorado blanket-exempt pattern)

AL POE § 802 states plainly: "[t]he value of all non-liquid resources, including personal
property, buildings, and land, will be excluded from the resource determination. The value of all
vehicles will be excluded from the resource determination (as allowed under PL 106-387 by
adoption of Alabama's Family Assistance vehicle policy)." This is a blanket all-vehicles
exclusion — matching this roster's Missouri, Maryland, and Colorado pattern, not South Carolina's
per-licensed-driver exemption or Indiana's hybrid ordinary-vehicle-exempt/boats-and-campers-counted
rule. No vehicle-specific complexity (fair market value tests, per-driver counting, boat/camper
carve-outs) was found anywhere in Alabama's resource chapter.

## Finding 5 — Alabama has TWO similarly-named DHR programs — "Food Assistance" (SNAP) and
"Family Assistance" (TANF) — a genuine, concrete naming-confusion risk

DHR's own website lists "Family Assistance" and "Food Assistance" as two SEPARATE top-level
service menu items. "Food Assistance" is SNAP; "Family Assistance" is Alabama's TANF
cash-assistance program. DHR's own POE Manual abbreviates the latter as "FA" throughout ("FA
benefits," "FA case," "Family Assistance work program" as a qualifying ABAWD work activity at AL
POE § 710(A).4) — and TANF/Family Assistance receipt is the qualifying benefit that confers
Alabama's Expanded Categorical Eligibility pathway (Finding 2), making the two programs
functionally intertwined as well as similarly named. This differs from South Carolina's
"Family Independence"/TANF naming-confusion finding in the specific words involved, but is the
same underlying risk: an applicant or caseworker conversation using "Food Assistance" and "Family
Assistance" imprecisely could genuinely misdirect someone to the wrong DHR program.

## Finding 6 — Alabama's standard certification period runs up to 12 months, including for
ABAWDs — a structural departure from this roster's more common 6-month baseline

AL POE § 1005 defaults most stable households — including, explicitly, ABAWDs, migrant/seasonal
farmworkers, homeless households, residents of drug/alcohol treatment centers, and students
subject to simplified reporting — to a 12-month certification period, with a required Six-Month
Report partway through. This is closer to this roster's Maryland pattern (12-month certification)
than South Carolina's or Colorado's 6-month standard baseline, though without Maryland's distinct
mid-period "Benefit Review" mechanism. DHR's own guidelines do not explicitly resolve an apparent
overlap between the 12-month ABAWD guideline and a separate 4-month guideline for households coded
entirely with work-registration code "J" — this pack states both exactly as written in
`supplements.json` rather than picking one without a textual basis to do so.

## Finding 7 — Alabama does NOT operate a Restaurant Meals Program for elderly/disabled SNAP
recipients, only a narrower homeless-specific mechanism

USDA FNA's own current Restaurant Meals Program state list (cross-checked against this roster's
South Carolina, Missouri, and Indiana packs' own independent fetches of the same list) names
Arizona, Maryland, New York, California, Massachusetts, Rhode Island, Illinois (Cook and Franklin
Counties only), Michigan, and Virginia — Alabama is absent. AL POE § 1107 describes exactly one
restaurant/prepared-meal mechanism, and its own text limits it strictly to homeless SNAP
recipients (both the homeless-meal-provider and the DHR/USDA-approved-restaurant tracks) — no
broader elderly/disabled option exists.

## Finding 8 — Alabama's current manual text already reflects a 2025-updated LIHEAP-to-SUA
tightening rule; and Alabama holds zero ABAWD waivers statewide, including its Black Belt region

AL POE § 903(G) (current per-chapter text) states that a qualifying LIHEAP payment now confers
automatic Standard Utility Allowance eligibility ONLY for households with an elderly (60+) or
disabled member; households without such a member must independently incur and verify a heating
or cooling expense — a national "Heat and Eat" policy tightening this pack did not have research
budget to compare in depth against the rest of this roster, flagged in `freshness.json` for a
future pass. Separately, and more simply: this pack specifically checked Alabama's Black Belt
region (18 rural counties — Barbour, Bullock, Butler, Choctaw, Crenshaw, Dallas, Greene, Hale,
Lowndes, Macon, Marengo, Montgomery, Perry, Pickens, Pike, Russell, Sumter, Wilcox — with a
long-documented history of elevated rural unemployment) for an ABAWD waiver, given the task's
specific prompt to look there. ABAWDMap.us's independent aggregator confirms Alabama holds ZERO
ABAWD waivers anywhere in the state, urban or rural, as of this pack's fetch date.

## Confirmed — no discrepancy found against an existing engine constant (no engine constant
existed to check against)

Alabama has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding. A future `packages/snap-rules` build for Alabama (out of scope for this
task, requiring its own separate, explicit go-ahead per the standing park rule) should treat this
pack's citations as a starting point, not a final answer, and should specifically re-verify the
dual-track BBCE ceiling (Finding 2), the modified drug-felony pathway (Finding 1), and — most
importantly — confirm it is reading `apps.dhr.alabama.gov`'s current per-chapter manual rather
than `dhr.alabama.gov`'s stale bundled PDF (Finding 3) before hardcoding any Alabama-specific
figure into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Alabama manual text, checking
specifically for: claims inferred from a section heading rather than its own body text; dollar
figures not traceable to a specific dated source; and any Alabama-vs-common-assumption contrast
overclaimed as settled when the underlying evidence was genuinely ambiguous or access-blocked.
Concrete catches from this pass:

- The drug-felony finding (Finding 1) does NOT claim Alabama fully opted out of the federal ban
  the way, say, a state with no remaining disqualification at all would have — it states the
  actual conditional pathway (sentence completion OR satisfactory probation compliance including
  drug treatment) exactly as DHR's own manual and the underlying statute state it, and explicitly
  flags that Justia/FindLaw 403'd so the statute itself was not read directly.
- The BBCE finding (Finding 2) does NOT pick either the 130% or 200% figure as "the" Alabama
  ceiling — it states the actual dual-track structure, because the underlying manual text
  genuinely supports both figures for different household compositions, and an initial
  WebSearch pass surfaced conflicting summaries that this pack resolved by reading § 210(B)
  directly rather than trusting either summary.
- The stale-duplicate-PDF finding (Finding 3) was caught specifically because this pack
  deliberately cross-checked TWO different DHR-hosted documents against each other rather than
  stopping at the first one found — the first search result for "Alabama DHR SNAP policy manual"
  actually surfaces the STALE bundle, not the current per-chapter version, making this a
  realistic trap rather than a hypothetical one.
- The SUA/BUA/telephone dollar-figure gap (Finding 8's freshness entry) is stated as an
  UNCONFIRMED gap, not as a specific number — this pack found secondary sources reporting
  specific dollar figures but did not present them as independently confirmed against Alabama's
  own primary "Basis of Issuance Chart," which this pack could not locate at any public URL.
- The vehicle-exclusion finding (Finding 4) was checked against the FULL § 802 text (not just a
  section heading) to confirm "all vehicles" is a genuine blanket rule, not a partial exemption
  with an unstated cap.
- The Restaurant Meals Program finding (Finding 7) does not claim Alabama will never adopt one —
  it states the current absence, sourced to USDA's own dated list cross-checked against this
  roster's prior independent fetches of the same list, and separately confirms Alabama's own
  manual describes only the narrower homeless-specific mechanism.

## Sources

| Source | Access | Dated |
|---|---|---|
| AL POE Manual (current, `apps.dhr.alabama.gov`), Chapters 1, 2, 7, 8, 9, 10, 11 | direct curl fetch (browser UA) | fetched 2026-08-12, current, no access barrier |
| AL POE Manual ("Appendix I" bundle, `dhr.alabama.gov`, 2022-vintage) | direct curl fetch (browser UA) | fetched 2026-08-12; MATERIALLY STALE, cross-checked only, not relied on for current facts |
| DHR Form DHR-FAP-1942, Summarized Eligibility Requirements (Rev. 10/25) | direct curl fetch (browser UA), `dhr.alabama.gov` | fetched 2026-08-12, current FFY2026 figures |
| Alabama DHR, Food Assistance landing page | direct curl fetch (browser UA) | fetched 2026-08-12, current |
| ABAWDMap.us, Alabama state entry | direct curl fetch (browser UA) | fetched 2026-08-12 — "No waiver — rule applies" |
| USDA FNA, SNAP Restaurant Meals Program state list | cross-checked via this roster's South Carolina/Missouri/Indiana packs' independent fetches | Alabama absent |
| Ala. Code § 38-1-8 (Act 2015-185, § 12) | Justia and FindLaw both HTTP 403 on direct fetch; resolved via secondary corroboration | not read directly — see freshness.json |
| AL Reporter, "The End of Alabama's Lifetime SNAP and TANF Bans" (Feb. 2016) | WebSearch | secondary corroboration only, for the drug-felony statute finding |
| Alabama Today, "Felony drug offenders now eligible for SNAP, TANF benefits in Alabama" | WebSearch | secondary corroboration only, for the drug-felony statute finding |
| Equal Justice Initiative, "Alabama in Minority of States That Ban Food Stamps for People Convicted of Drug Offenses" | WebSearch | the widely-repeated secondary framing Finding 1 corrects/nuances, not itself relied on as a source of Alabama's operative rule |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (AL guide questions), `eval/answer-eval.ts` (AL_GOLD, spread
into ALL_GOLD). Alabama is deliberately NOT added to any engine-citations.ts per-state constant
map — Alabama has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("AL", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds an Alabama policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, Missouri's, Maryland's,
Colorado's, and South Carolina's corpus packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Alabama `packages/snap-rules` build is out of scope here and would need its own
separate, explicit go-ahead.
