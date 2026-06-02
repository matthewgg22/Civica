---
id: 2026-06-02-snap-source-citation-triple-check
date: 2026-06-02
scope: [snap, eligibility-engine, citations, compliance, ca-pilot, ma-pilot]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: url
    ref: "https://www.fns.usda.gov/snap/allotment/cola/fy26"
    note: "Federal FY26 COLA memo — all engine dollar values confirmed against this source"
  - kind: url
    ref: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2025/25-68.pdf"
    note: "CDSS ACL 25-68 (FY26 SUA chart) — confirmed source for CA SUA $663/$170/$20"
  - kind: url
    ref: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACINs/2025/I-46_25.pdf"
    note: "CDSS ACIN I-46-25 — confirmed source for CA BBCE 200% FPL chart"
  - kind: url
    ref: "https://regulations.justia.com/states/massachusetts/100-199-cmr/106/106-cmr-364/364-976/"
    note: "106 CMR 364.976 — confirmed source for MA BBCE Categorical Eligibility Income Standards"
  - kind: url
    ref: "https://www.law.cornell.edu/regulations/massachusetts/106-CMR-364-400"
    note: "106 CMR 364.945 — confirmed source for MA SUA chart"
  - kind: url
    ref: "https://www.congress.gov/119/plaws/publ21/PLAW-119publ21.pdf"
    note: "OBBBA = P.L. 119-21, enacted 2025-07-04, 139 Stat. 72"
  - kind: url
    ref: "https://www.fns.usda.gov/snap/obbb-ABAWD-exemptions-implementation-memo"
    note: "FNS implementing memo for OBBBA §10102 ABAWD exemption changes (2025-10-03)"
  - kind: url
    ref: "https://www.fns.usda.gov/snap/abawd/waivers/2025-2029"
    note: "FNS FY25-29 ABAWD waiver bundle — per-state PDFs, not machine-readable"
  - kind: url
    ref: "https://calfresh.guide/waiver-of-the-abawd-work-requirements/"
    note: "Active CA ABAWD waivers (Nov 1 2025 – Oct 31 2026): only Colusa, Imperial, Tulare, Alpine, Merced, Monterey, Plumas"
  - kind: file
    ref: packages/snap-rules/src/constants/states.ts
    line: 50
    note: "CA.rmp_operated: true — correct outcome but stale comment; AB 942 made RMP statewide 2019-10-12"
  - kind: file
    ref: packages/snap-rules/src/benefit-calc.ts
    line: 112
    note: "OBBBA §10104 cutoff hard-coded to 2025-11-01; statutory enactment was 2025-07-04, SUA implementation 2025-10-01"
  - kind: file
    ref: docs/SNAP-source-citation-signoff.md
    note: "Existing signoff template — every reviewer column still blank as of this triple-check"
---

## What we found

A triple-check of the SNAP eligibility engine's source citations against live federal and state agency sites (USDA FNS, HHS ASPE, Congress.gov, eCFR, CDSS, DTA, MLRI) on 2026-06-02 surfaced **4 confirmed engine bugs**, **2 critical operational stale-data conditions**, and **1 silent miscompute path** — alongside confirmation that all FY26 dollar values, federal regulations, and the two newly-corrected state SUA/BBCE citations (CDSS ACL 25-68; DTA 106 CMR 364.945) match canonical sources.

## Why it matters

The engine ships against `codex/rebuild-feb18` with `pnpm test` green and the v0.6 oracle harness producing real PASS grades. But green tests don't catch **the engine being right about a math step while wrong about which county or which exemption applies**. Five specific real-world cases produce wrong verdicts today:

1. **CA ABAWD applicant in any of 51 non-waived counties (LA, SD, Alameda, Fresno, etc.)** — engine returns "waived area, exempt"; reality is time-limited starting **2026-06-01** (the day before this finding was written).
2. **MA ABAWD applicant anywhere in the state** — engine returns "waived"; reality is statewide time limits since 2025-06-30.
3. **MA Bay State CAP recipient** (elderly + SSI segment, ~70K cases) — engine uses HCSUA $914; correct value is the CAP-specific SUA per 106 CMR 366.910.
4. **CA Native American / Urban Indian / California Indian ABAWD applicant** — if engine narrows the exemption to "ANCSA only", false-fail. Statute (per OBBBA §10102) uses Indian Health Care Improvement Act definitions, which are broader.
5. **Age 55-64 ABAWD applicant in either state** — engine pre-OBBBA age band 18-54 (if not yet updated to 18-64) exempts incorrectly.

The first two are date-critical: CA statewide ABAWD time limits **resume 2026-06-01** per ACL 25-93. Any user enrolling in a non-waived CA county this week sees a wrong determination.

Beyond the determinations: the existing engineering signoff document `docs/SNAP-source-citation-signoff.md` has **zero reviewer signatures** across 19 rows. The triple-check found six corrections needed to that document before it can credibly be sent to legal-policy.

## What changes

### Immediate code fix (this session)

- [x] Updated `constants/states.ts` header citation block with corrected CA SUA source (ACL 25-68, not ACIN) and corrected MA SUA section (.945, not .976). Shipped as commit `36e330d5` 2026-06-02.

### Engine fixes filed as separate work items

- [ ] **CA RMP comment correction** — `constants/states.ts` should reflect that RMP is statewide per AB 942 (2019-10-12), not the stale 8-county list. The boolean is correct; the comment is stale.
- [ ] **MA Bay State CAP SUA path** — engine silently substitutes wrong SUA for CAP recipients. Either add a CAP-detection branch with the CAP-specific SUA value, or document the gap as a known-not-modeled segment and route CAP cases to a not-implemented surface.
- [ ] **OBBBA §10104 effective date** — `benefit-calc.ts:112` uses `2025-11-01`. Verify the correct semantics: statutory enactment 2025-07-04 vs SUA recalc 2025-10-01 vs 120-day implementation grace 2025-11-01. Pick one with citation.
- [ ] **OBBBA §10102 exemption category name** — auto-memory + any user-facing copy should use "Indian Health Care Improvement Act" definitions, not narrowed "Native American / ANCSA only".
- [ ] **HHS CY2026 FPL adoption** — published 2026-01-15 via FR Doc 2026-00755. MA BBCE uses calendar-year basis effective 2026-02-01. Engine likely still on CY2025; switch before MA pilot.
- [ ] **ABAWD waiver loader** — `abawd_waiver_avail: boolean` per-state is the wrong shape. Real shape: per-county effective-dated list. CA active waivers (Colusa, Imperial, Tulare, Alpine, Merced, Monterey, Plumas) sunset 2026-10-31. MA: no active waiver.

### Documentation fixes

- [ ] Update `docs/SNAP-source-citation-signoff.md` rows with the corrected citations. Specifically:
  - Row 3 (MA BBCE): keep 106 CMR 364.976 but verify FY26 dollar values against current DTA Helpful Charts and Figures download
  - Row 4 (MA SUA): pin to 106 CMR 364.945 + DTA SUA PDF (not the same .976 BBCE section)
  - Row 9 (Federal gross income limits): note these come from the FY26 COLA memo, not derived from FPL
  - Row 15 (CA BBCE): cite ACIN I-46-25 explicitly; remove "_(reviewer to confirm)_" hedge
  - Row 16 (CA SUA): cite ACL 25-68 with actual values $663/$170/$20
  - New rows needed: OBBBA P.L. 119-21 + each implementing memo URL + 2026 HHS FPL
- [ ] Add ABAWD waiver loader spec to docs/plans/

### Missing sources to add to engine citation list

Federal:
- 7 USC 2013(a) — program authority root
- 7 USC 2014 — eligible households (pair with each 7 CFR 273.x citation)
- 7 USC 2015 — eligibility/disqualifications (amended by OBBBA §10102)
- 7 USC 2017 — value & allotment (amended by OBBBA §10103/§10104)
- 7 CFR 273.24 — ABAWD time limit reg (not currently cited)
- 7 CFR 272.2 — State Plan of Operation
- OBBBA §10101 (TFP) — affects every benefit-calc derivation
- OBBBA §10105 (PER state match) — load-bearing for the error-rate engine
- FNS State Options Report 17th edition (Aug 2025) — pins each state's BBCE/asset/RMP elections

California:
- ACL 25-93 (statewide ABAWD time-limit resumption 2026-06-01)
- ACL 26-15 (current FY26 county waiver extension)
- CalFresh E&T State Plan PDF
- MPP §63-503 (net income computation regs)
- CA Welfare & Institutions Code §18900 et seq. (state statutory basis)

Massachusetts:
- BEACON5 Online Guide (DTA's caseworker source-of-truth)
- 106 CMR 366.910 (Bay State CAP)
- 106 CMR 365.180 / 365.190 (earned-income + dependent-care deductions)
- 106 CMR 367.495 (Simplified Reporting / IR thresholds)
- DTA November 2025 SNAP Updates PDF (MA OBBBA implementation record)
- SNAP Path to Work (snappathtowork.org) — NOT "Pathways to Self-Sufficiency"; that's a TAFDC brochure

## Open questions

1. **OBBBA §10104 effective date**: which of {2025-07-04 enactment, 2025-10-01 SUA implementation, 2025-11-01 120-day grace} is the correct cutoff for excluding internet utilities from the shelter deduction? The engine currently uses 2025-11-01 (FNS hold-harmless window). Agent verification says statutory effective is 2025-07-04 — need counsel determination on which date applies operationally.
2. **Bay State CAP SUA value**: what specific dollar amount does DTA's CAP-specific SUA carry for FY26? Agent could not retrieve the PDF; mass.gov returned 403 to WebFetch. Need a manual fetch + capture.
3. **CA RMP per-county participation**: AB 942 made RMP a statewide mandate. Does that mean every CA SNAP applicant can use EBT at participating restaurants statewide, or is restaurant participation still patchy? Affects how the engine surfaces RMP to the user.
4. **Signoff doc reviewer**: who actually drives `docs/SNAP-source-citation-signoff.md` to closure? Currently 19 rows all marked "_(reviewer)_". Engineering can populate; legal-policy must sign.
5. **State Plan of Operations FOIA**: BBCE election documents for CA and MA are filed with FNS Regional Offices but not publicly indexed. Worth a FOIA before launch?
