# Maryland pack — provenance

**Created:** 2026-08-11. Maryland is a genuine BLANK SLATE in this roster — like North
Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, and Missouri's prior
builds, Maryland has NO existing `packages/snap-rules` entry and NO oracle fixture coverage at
all. No discrepancy-checking against an existing engine constant was possible or attempted; this
pack's findings stand entirely on its own primary-source research. This task's scope was
CORPUS ONLY — the Demeter chatbot's Q&A content layer — and does not touch
`packages/snap-rules` or `data-ops/sample/civica-test-profiles/v0.6.json`, both of which stay
fully parked per the standing rule (`feedback_dashboard_snap_rules_parked`).

## Method

Direct `curl` fetch (browser User-Agent) of thirteen current Maryland DHS SNAP Manual section
files from `dhs.maryland.gov/documents/FIA/Manuals/Supplemental Nutrition Assistance Program
(SNAP)/` — Sections 100 (Household Composition), 106 (ABAWDs), 115 (Categorical Eligibility),
200 (Resources), 201 (Vehicles), 211 (Excluded Income), 212 (Deductions), 213 (Determining
Income Deductions), 214 (Utility Allowances), 401 (Expedited Service), 406 (Normal Processing
Standards), 408 (Verification), and 600 (Standards for Income and Deductions) — every fetch a
clean HTTP 200. Files were a mix of PDF (converted with `pdftotext -layout`) and `.docx`
(converted with macOS `textutil -convert txt`). Also fetched directly: FIA Action Transmittal
AT 26-09 (H.R. 1 2025 ABAWD/OBBBA changes, issued October 16, 2025, effective November 1, 2025,
including its embedded ABAWD FAQ and screening tool), FIA Action Transmittal AT 26-05 (SNAP Mass
Changes for October 2025, issued October 3, 2025), the current DHS Family Investment
Administration Income Guidelines (dated October 2025, revised 8/2025), and — via Maryland's own
legislative statute-text lookup at mgaleg.maryland.gov, every fetch a clean HTTP 200 with **no**
access barrier — Md. Code, Human Services §§ 5-501, 5-502, 5-503, 5-505, and 5-506. WebFetch was
used for the manual index page, the ABAWD program page, and the Restaurant Meals Program page.

## Finding 0 — one access barrier, cleanly resolved: law.justia.com's mirror of Maryland's Human Services Article 403'd; Maryland's own mgaleg.maryland.gov statute-text tool did not

Both `curl` and `WebFetch` against `law.justia.com/codes/maryland/human-services/title-5/subtitle-5/`
returned a 403 — matching the pattern this roster has repeatedly found with third-party
statute-mirror sites (Tennessee's, North Carolina's prior 403s). Maryland's OWN legislative
statute-text lookup (`mgaleg.maryland.gov/mgawebsite/Laws/StatuteText`) returned clean HTTP 200s
for every section this pack requested, with full primary statutory text — a genuine contrast
with this roster's Indiana pack (whose equivalent statute-lookup site was an unexecutable
client-side JavaScript application) and consistent with this roster's Missouri pack (whose own
Revisor of Statutes site was also fully and cleanly fetchable). No secondary corroboration was
needed anywhere in this pack; every statutory claim traces to Maryland's own primary text.

## Finding 1 (flagship) — Maryland's BBCE claim is CONFIRMED, stated with unusual specificity

Several secondary sources describe Maryland as using Broad-Based Categorical Eligibility (BBCE)
at 200% of the federal poverty level. This pack independently checked that claim against
Maryland's own primary source (MD SNAP Manual Section 115.2(F)) and found it accurate — Maryland
confers BBCE to all households under 200% FPL via a TANF-funded brochure ("Family Planning: A
Guide for You"), with a 200% FPL table matching the current FFY2026 income limits this pack
independently cross-validated via the October 2025 Income Guidelines and FIA Action Transmittal
AT 26-05. Distinctively, Maryland's own manual states the practical consequence with unusual
bluntness in three separate places: "you should not have any non-categorically eligible SNAP
households" — an explicit instruction that the resource and gross/net income tests are, in
practice, almost never actually applied to a Maryland SNAP applicant.

## Finding 2 (flagship) — a genuine THREE-TIER drug-felony structure, directly contradicting a specific secondary-source claim that Maryland "eliminated drug testing requirements"

Secondary sources claim Maryland disqualifies applicants for only two narrow drug felonies
(volume dealer, drug kingpin), that all other drug felonies leave an applicant fully eligible,
and that Maryland eliminated drug testing requirements for drug-felony SNAP applicants. This
pack's direct read of Maryland's own manual (Sections 100.62(H) and 100.7(I)/(J)) found a more
precise THREE-TIER structure. TIER 1: volume-dealer/drug-kingpin convictions are listed among
"Disqualified Individuals" with no stated time limit (100.62(H)). TIER 2, genuinely BROADER: an
individual convicted after July 1, 2000 of manufacture, distribution, OR possession WITH INTENT
TO DISTRIBUTE a controlled substance is ineligible for SNAP for ONE YEAR from conviction, AND
"subject to testing and treatment for substance abuse for a period of two years" (100.7(J)) —
this DIRECTLY CONTRADICTS the "eliminated drug testing" secondary claim. TIER 3, implicit: simple
possession without intent to distribute appears in neither provision. This pack disclosed, rather
than resolved, an apparent internal date inconsistency between the two sections (100.62(H)
references convictions "after October 1, 2017"; 100.7(I)/(J) reference "after July 1, 2000") —
see freshness.json.

## Finding 3 — a genuine, disclosed, DOUBLE internal contradiction within Maryland's own currently-published manual: two different dollar figures for the same fact, in two different sections, neither one a mere "stale page"

Unlike this roster's Missouri SUA-staleness finding (one manual page quietly lagging a COLA
cycle), this pack found Maryland's OWN currently-published manual stating two DIFFERENT numbers
for the SAME fact, in two DIFFERENT places, TWICE:

1. **Resource limit**: Section 200 ("REVIEWED JUNE 2026") states $2,250/$3,250; Section 600
   ("REVISED AUGUST 2025," effective 10/1/2025) states $3,000/$4,500 — cross-validated by FIA AT
   26-05.
2. **Homeless Shelter Allowance**: Section 212.10 (unrevised since a 2020 transmittal it names
   directly) states $148; Section 600 states $198.99 — cross-validated by FIA AT 26-05's own
   text: "The maximum homeless shelter deduction increased to $198.99."

Both contradictions are disclosed explicitly in freshness.json; this pack treats Section 600 (the
explicitly-dated, COLA-cycle-revised standards table, independently cross-validated twice) as
authoritative in both cases, and flags the older narrative sections as unreconciled rather than
silently correcting them without disclosure.

## Finding 4 — Maryland excludes ALL vehicles as resources, matching Missouri's blanket pattern rather than Indiana's hybrid rule

MD SNAP Manual Section 201: "All vehicles are excluded resources... The type of vehicle does not
matter (automobile, boat, recreational vehicle, or airplane, etc.)." This is the same
no-equity-value-counting, all-vehicle-types-excluded pattern this roster's Missouri pack
documents, not Indiana's hybrid rule (ordinary vehicles exempt, boats/campers counted at equity
value).

## Finding 5 — Maryland's Restaurant Meals Program is established directly by state STATUTE, not merely adopted administratively

Md. Code, Human Services § 5-505, fetched directly with no access barrier, establishes Maryland's
RMP by name, purpose, and eligibility criteria (homeless, or 60+/disabled and spouse) — a
genuinely different mechanism from every prior RMP finding in this roster, where the program
exists purely through administrative adoption of the federal 7 CFR 274.7(g) option. Distinctively,
Maryland's own DHS page discloses the program is a county-by-county pilot, not yet fully
statewide.

## Finding 6 — a genuinely Maryland-specific certification-period mechanism: the 12-month cert with a mandatory 6-month "Maryland Benefit Review" touchpoint

MD SNAP Manual Section 410 documents E&E assigning a full 12-month certification period (not the
generic 6-month simplified-reporting period) with a mandatory, no-interview-required 6-month
Maryland Benefit Review (MBR) form — a specific, named implementation this roster has not
previously documented under this name. All-elderly/disabled no-earned-income households get up to
24 months; MSNAP/ESAP households get 36 months, matching the longest period this roster's Indiana
pack documents for its own Elderly Simplified Application Project option.

## Finding 7 — a genuinely Maryland-specific state-funded benefit floor: the $50/month supplement for households with a member 60+

Md. Code, Human Services § 5-501(d) establishes a state-funded top-up distinct from the federal
$24 categorical-eligibility minimum benefit — a household with a member 60 or older whose federal
SNAP benefit would be under $50/month gets a state supplement bringing it to $50. A minor,
disclosed age-threshold discrepancy exists between the statute's "60" and the manual's own
cross-reference to "62" — see freshness.json.

## Finding 8 — a naming artifact: Maryland's governing statute subtitle is still headed "Food Stamps," predating the 2008 federal rename

Maryland's own public-facing DHS materials and its current manual folder path
(dhs.maryland.gov/documents/FIA/Manuals/Supplemental Nutrition Assistance Program (SNAP)/)
consistently use the plain federal name "SNAP," but the governing Maryland Code, Human
Services Article, Title 5 subtitle housing the program's statutes is still headed "Food
Stamps" — a naming artifact that predates SNAP's 2008 federal rename, even though the lead
section within that subtitle (§ 5-501) is itself titled "Supplemental Nutrition Assistance
Program." Worked examples inside the manual's own deduction-calculation sections still use
the old "FS" abbreviation.

(Moved here from `pack.json`'s `program` field 2026-08-12 — that field renders directly in
the UI's agency-list card, and this pack's original full-length version, at ~700 characters,
was long enough to overflow the card at a 320px viewport and fail the WCAG 1.4.10 reflow e2e
test. `program` should stay a short display string; longer research narrative belongs here.)

## Confirmed — no discrepancy found against an existing engine constant (no engine constant existed to check against)

Maryland has no prior `packages/snap-rules` `StatePolicy` entry, so there is no existing engine
constant this pack could confirm or contradict — every finding above is a first-pass
primary-source finding. A future `packages/snap-rules` build for Maryland (out of scope for this
task, requiring its own separate, explicit go-ahead per the standing park rule) should treat this
pack's citations as a starting point, not a final answer, and should specifically re-verify the
two internal-contradiction figures (Finding 3) and the drug-felony date inconsistency (Finding 2)
against Maryland's own primary text before hardcoding either into engine constants.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual fetched Maryland manual/statute text,
checking specifically for: claims inferred from a section heading rather than its own body text;
dollar figures not traceable to a specific dated source; and any Maryland-vs-common-assumption
contrast overclaimed as settled when the underlying evidence was genuinely ambiguous. Concrete
catches from this pass:

- The BBCE finding (Finding 1) was checked against the ACTUAL 200% FPL table (Section 115.2(d))
  and cross-validated against the October 2025 Income Guidelines and AT 26-05 rather than accepted
  from secondary sources already surfaced — the secondary claims here happened to be accurate, and
  this pack states that plainly rather than manufacturing a false "correction" narrative for its
  own sake.
- The drug-felony finding (Finding 2) is stated as a THREE-TIER structure with the exact
  conditions and dates Maryland's own text uses, rather than rounded up to a vaguer "modified
  ban" — and the apparent internal date inconsistency (2017 vs. 2000) is disclosed rather than
  silently resolved in either direction, because this pack could not determine with confidence
  which date governs which population from the fetched text alone.
- The two internal-contradiction findings (Finding 3) are stated as genuine CONTRADICTIONS within
  Maryland's own current manual — not smoothed into "one page happens to be a little old" — with
  the specific superseding transmittal Section 212.10 itself cites (AT 20-02) named directly, and
  the specific October 2025 cross-validating transmittal (AT 26-05) quoted with its own words
  ("increased to $198.99").
- The Restaurant Meals Program finding (Finding 5) is checked against the statute's own eligibility
  text (§ 5-505(d)) rather than assumed from the DHS webpage summary alone — the statute and the
  webpage description were cross-checked against each other and found consistent, with the
  county-pilot-rollout caveat sourced specifically from the DHS webpage (the statute itself is
  silent on rollout pace).
- The certification-period finding (Finding 6) is stated with Maryland's own specific mechanism
  name ("Maryland Benefit Review," MBR) rather than generically as "6-month touchpoint," and the
  36-month MSNAP/ESAP figure is drawn directly from Section 410's own text rather than assumed by
  analogy to Indiana's ESAP figure.
- The state-supplement finding (Finding 7) discloses the age-threshold discrepancy between the
  statute ("60") and the manual's cross-reference ("62") rather than picking one value silently.

## Sources

| Source | Access | Dated |
|---|---|---|
| MD SNAP Manual, Section 100 (Household Composition) | direct curl fetch (browser UA) + pdftotext | Reviewed May 2026 |
| MD SNAP Manual, Section 106 (ABAWDs) | direct curl fetch (browser UA) + pdftotext | Revised September 2025 |
| MD SNAP Manual, Section 115 (Categorical Eligibility) | direct curl fetch (browser UA) + pdftotext | current |
| MD SNAP Manual, Section 200 (Resources) | direct curl fetch (browser UA) + pdftotext | STALE on resource limit — "Reviewed June 2026" footer but contradicts Section 600 |
| MD SNAP Manual, Section 201 (Vehicles) | direct curl fetch (browser UA) + textutil | July 2023 |
| MD SNAP Manual, Section 211 (Excluded Income) | direct curl fetch (browser UA) + pdftotext | Revised April 2026 |
| MD SNAP Manual, Section 212 (Deductions) | direct curl fetch (browser UA) + textutil | STALE on homeless allowance (cites a 2020 transmittal); current on medical/child-support mechanics |
| MD SNAP Manual, Section 213 (Determining Income Deductions) | direct curl fetch (browser UA) + textutil | July 2023 |
| MD SNAP Manual, Section 214 (Utility Allowances) | direct curl fetch (browser UA) + pdftotext | Revised September 2025 |
| MD SNAP Manual, Section 401 (Expedited Service) | direct curl fetch (browser UA) + textutil | July 2023 |
| MD SNAP Manual, Section 406 (Normal Processing Standards) | direct curl fetch (browser UA) + pdftotext | Revised January 2025 |
| MD SNAP Manual, Section 408 (Verification) | direct curl fetch (browser UA) + pdftotext | October 2025 |
| MD SNAP Manual, Section 410 (Certification Periods) | direct curl fetch (browser UA) + textutil | July 2023 |
| MD SNAP Manual, Section 600 (Standards for Income and Deductions) | direct curl fetch (browser UA) + pdftotext | Revised August 2025, effective 10/1/2025 |
| FIA Action Transmittal AT 26-09 (H.R. 1 2025 ABAWD changes) | direct curl fetch (browser UA) + pdftotext | issued 10/16/2025, effective 11/1/2025 |
| FIA Action Transmittal AT 26-05 (SNAP Mass Changes October 2025) | direct curl fetch (browser UA) + pdftotext | issued 10/3/2025 |
| FIA Programs Income Guidelines as of October 2025 | direct curl fetch (browser UA) + pdftotext | effective 10/1/2025, revised 8/2025 |
| Md. Code, Human Services §§ 5-501, 5-502, 5-503, 5-505, 5-506 | direct WebFetch via mgaleg.maryland.gov, no access barrier | current |
| Maryland DHS, Restaurant Meals Program page | WebFetch | fetched 2026-08-11 |
| Maryland DHS, ABAWD program page | WebFetch | fetched 2026-08-11 |
| Maryland DHS, SNAP Manual index page | WebFetch | fetched 2026-08-11 |
| law.justia.com mirror of Human Services Article Title 5 Subtitle 5 | ATTEMPTED, FAILED — 403 on both curl and WebFetch; resolved via mgaleg.maryland.gov directly | — |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (MD guide questions), `eval/answer-eval.ts` (MD_GOLD,
spread into ALL_GOLD). Maryland is deliberately NOT added to any engine-citations.ts per-state
constant map — Maryland has no `packages/snap-rules` `StatePolicy` entry at all to mirror.
`formatEngineParams("MD", ...)` will throw `UnknownStateError` until a future, separately-gated
`packages/snap-rules` build adds a Maryland policy — this matches the precedent already set by
North Carolina's, Ohio's, New Jersey's, Virginia's, Tennessee's, Indiana's, and Missouri's corpus
packs in this same roster.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request
an unfreeze. A future Maryland `packages/snap-rules` build is out of scope here and would need
its own separate, explicit go-ahead.
