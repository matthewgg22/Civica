# Minnesota pack — provenance

**Created:** 2026-08-11 (Wave 3 — `docs/plans/mae-state-corpus-framework.md` §7 flags Minnesota as the
HARDEST source in the entire roster: "Combined Manual on LEGACY dhs.state.mn.us CMS (agency moved to
DCYF)... Manual interleaves 7 programs; rot risk high." This pack was built to confirm — and disclose,
not paper over — exactly how that risk shows up in practice.).

**Method:** direct fetch and `pdftotext -layout` extraction of the Combined Manual's own Table of
Contents PDF (dhs.state.mn.us, an Oracle WebCenter Content / legacy CMS host) — the PDF turned out to
contain full section BODY text for every chapter, not merely a table of contents, so most of this pack's
sourcing came from reading that extraction directly rather than fetching individual section pages one at
a time (a genuine efficiency win over Oregon's and Wisconsin's per-section fetch pattern). Several
individual pages and cross-checks hit real access barriers on this pass — disclosed below, not silently
worked around with a guess.

## Why Minnesota matters to the schema

- **The best real-world test of this session's "verify via primary text, not AI summary" discipline.**
  This pack found and corrected a FALSE secondary-source claim (a lifetime SNAP drug-testing ban) that
  is flatly contradicted by the Combined Manual's own current text — the most consequential correction
  of this kind across every state built this session, because the false claim is actively repeated
  across multiple SNAP-advocacy and legal-aid websites, not just AI-summarization noise.
- **BBCE that exempts a unit from BOTH the asset test AND the net income test** — stronger than every
  other flat-screen state in this roster, which typically waive only the asset test.
- **A single combined Standard Utility Allowance** covering heat, cooling, electricity, water, sewer,
  garbage, and phone together — the opposite extreme from Wisconsin's 7-tier ladder in the same roster.
- **A genuinely uneven-freshness manual, in a way this pack could directly OBSERVE via issue-date stamps
  embedded in the fetched text itself** (12/2014 for medical deductions, 05/2023 for child support,
  10/2024 for shelter deductions, 11/2024 for drug felons, 04/2025 for recertification periods, 05/2025
  for expedited service) — direct, dated proof of the framework doc's "rot risk high" prediction, not an
  inference from indirect signals the way Oregon's and Wisconsin's findings were.
- **A genuine agency-name migration in progress**: DCYF now sets SNAP policy, but the authoritative
  Combined Manual is still hosted on the legacy DHS domain and CMS as of this pack's build date.
- **Two real access barriers hit on this pass**, disclosed rather than routed around with a guess — see
  Finding 3 below.

## Sources

| Source | Access | Dated |
|---|---|---|
| CM 0013.06, SNAP Categorical Eligibility/Ineligibility | `pdftotext` of the Combined Manual PDF | issue-dated 05/2025 in the extracted text |
| CM 0015.81, Assets - SNAP | `pdftotext` of the Combined Manual PDF | issue-dated 05/2025 |
| CM 0018.12, Medical Deductions | `pdftotext` of the Combined Manual PDF | issue-dated 12/2014 — see Finding 2 |
| CM 0018.15, Shelter Deductions | `pdftotext` of the Combined Manual PDF | issue-dated 10/2024 — see Finding 2 |
| CM 0018.33, Child and Spousal Support Deductions | `pdftotext` of the Combined Manual PDF | issue-dated 05/2023 |
| CM 0011.27.03, Drug Felons | `pdftotext` of the Combined Manual PDF | issue-dated 11/2024 — see Finding 1 |
| CM 0004.04, Expedited SNAP | `pdftotext` of the Combined Manual PDF | issue-dated 05/2025 |
| CM 0009.03, Length of Recertification Periods | `pdftotext` of the Combined Manual PDF | issue-dated 04/2025 |
| DCYF SNAP program page | WebFetch, dcyf.mn.gov | fetched 2026-08-11 |
| USDA FNA Restaurant Meals Program state list | reused from this session's direct-curl fetch for the Wisconsin pack | fetched 2026-08-11 |

## Findings a maintainer must know

1. **A widely-repeated secondary-source claim about Minnesota's drug-felony policy is FALSE.** Multiple
   SNAP-advocacy and legal-information sites claim Minnesota bans SNAP recipients for life after two
   failed drug tests. The Combined Manual's own current text (CM 0011.27.03, issue-dated 11/2024) says
   the OPPOSITE on every material point: random drug testing is OPTIONAL for agencies to require at all;
   "Do not deny or terminate assistance for a person who tests positive or fails to show up for a random
   drug testing"; and disqualifications from BEFORE 8/1/2023 were explicitly ENDED. This pack does not
   repeat the false claim — the criminal-justice-disqualifications supplement states the corrected,
   verbatim-sourced policy and names the false claim explicitly so a future maintainer doesn't
   accidentally reintroduce it from a plausible-looking secondary source.
2. **The manual's own issue-date stamps directly evidence uneven staleness — this pack read them, not
   inferred them.** Unlike Oregon's and Wisconsin's freshness findings (which required cross-referencing
   external deadlines against handbook text), Minnesota's Combined Manual PDF extraction literally prints
   "ISSUE DATE 12/2014" at the top of the medical-deductions section and different dates for nearly every
   other section — ranging from 2014 to 2025 within the SAME document. The shelter/utility section
   (10/2024) shows a $712 maximum shelter deduction and $190.30 homeless deduction, both notably LOWER
   than the FFY26 COLA figures ($744, $198.99) this roster's more recently-touched states display —
   consistent with, though not proof of, that section not yet reflecting the current federal COLA cycle.
   Do not assume any single Minnesota Combined Manual dollar figure is current without checking its own
   printed issue-date stamp first.
3. **Two real access barriers, disclosed rather than worked around with a guess.** (a) A direct fetch of
   the dhs.state.mn.us drug-felons-adjacent page returned an active Radware/perfdrive bot-detection
   challenge page, not the requested content — this pack's drug-felon sourcing instead came from the
   larger Combined Manual PDF extraction, which was NOT blocked. (b) USDA's own FY26 SUA values PDF and
   the ABAWD waiver-response page both returned access-denied responses to this pass's fetch attempts,
   and USDA distributes ABAWD waiver-response documents only as bulk per-fiscal-year ZIP files rather
   than individual state pages — this pass did not download and search that ZIP. As a direct result: (i)
   the exact current-FY dollar figures for Minnesota's utility-allowance ladder are NOT stated in this
   pack — the supplement explicitly instructs re-verifying against the live Combined Manual rather than
   quoting a secondary-sourced figure; (ii) Minnesota's ABAWD waiver status is treated as UNCONFIRMED and
   the pack instructs deferring to a direct current check rather than asserting either an active or
   expired waiver.
4. **`packages/snap-rules` has no Minnesota `StatePolicy` entry.** Consistent with every state built this
   session without pre-existing engine constants (NV, AZ, OR, WI) — a pre-existing authoring gap, not a
   finding from this pack. No new issue filed since the pattern is already tracked.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actual `pdftotext`-extracted verbatim text captured
during fetching, specifically checking for claims inferred from a section title rather than body text,
dollar figures not traceable to a specific numbered subsection with its own issue-date stamp, and any
state-vs-federal contrast overclaimed as settled when the evidence was genuinely uncertain. The single
most significant catch of this pass was Finding 1 above — an initial WebSearch summary asserting a
"lifetime ban after 2 failed drug tests" was checked directly against the Combined Manual's own text
before drafting, rather than accepted at face value, and found to be flatly false. Two further
corrections made deliberately conservative rather than confidently wrong:

- The SUA supplement does NOT state a specific current dollar figure for Minnesota's utility allowances,
  even though secondary sources offered plausible-looking numbers ($578 HCUA, $235 electric) — this pack
  could not independently verify either figure against a live Combined Manual fetch or a current USDA
  table this pass, and chose disclosed absence over a confident-sounding guess.
- The ABAWD supplement does NOT assert Minnesota currently holds or lacks a statewide waiver — it states
  the reported (already-past) expiration date and explicitly instructs a maintainer or Mae to re-check
  rather than pick a side on unconfirmed information.
