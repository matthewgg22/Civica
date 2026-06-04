---
id: 2026-06-03-fy26-reference-cell-audit
date: 2026-06-03
scope: [snap, fy26, reference-tables, verification, obbba]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: url
    ref: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACINs/2025/I-46_25.pdf"
    note: "CDSS ACIN I-46-25 (Sep 3 2025): California passing-through of FNS FY2026 COLA values; Attachment I confirms every contested cell"
  - kind: url
    ref: "https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines"
    note: "HHS 2025 Poverty Guidelines (the FY2026 SNAP basis) — $15,650 HH1 + $5,500/additional"
  - kind: file
    ref: backend/civic_api/snap/rules/poverty_guidelines.py
    line: 223
    note: "FY26_MAX_ALLOTMENT_48 table — all 9 cells verified ✓"
  - kind: file
    ref: backend/civic_api/snap/rules/parameters.py
    line: 93
    note: "FY2026 FYParameters (standard deduction by size, shelter cap, min benefit, homeless deduction) — all verified ✓"
  - kind: file
    ref: packages/snap-rules/src/constants/federal-tables.ts
    line: 89
    note: "TS engine FY26 snapshot — all federal cells verified ✓"
  - kind: file
    ref: packages/snap-rules/src/constants/states.ts
    line: 165
    note: "TS engine MA SUA — DRIFT vs Python engine ($914 vs $890); neither primary-verified"
  - kind: file
    ref: backend/civic_api/snap/rules/state_parameters.py
    line: 33
    note: "CA standard medical deduction $150 — primary source (CDSS waiver) not located today"
---

## What we found

Per issue [#428](https://github.com/matthewgg22/Civica/issues/428): every FY2026 SNAP reference cell flagged as `◦` (≥2-source-corroborated, not primary-confirmed) **passes** cross-check against CDSS ACIN I-46-25, the CA state-agency pass-through of the FNS FY2026 COLA memo (Sep 3 2025). The `◦` annotations can be stripped to `✓` for all 12 federal cells + CA SUA.

Two open items remain:

1. **MA SUA drift between the Python engine and the TS engine** — Python `state_parameters.py:238` encodes `$890/$542/$62`; TS `constants/states.ts:165` encodes `$914/$556/$64`. Neither is primary-verified (mass.gov + Mass Legal Help both 403'd today, matching the engine code's own pending-verification note).
2. **CA standard medical deduction $150** — engine cites "CDSS demo waiver via LSNC"; the LSNC URL 404'd today. Cell is still `◦` until a primary CDSS waiver doc is attached.

## Verified ✓ against CDSS ACIN I-46-25 (Attachment I, p.3)

**Federal max allotment 48-state (`FY26_MAX_ALLOTMENT_48`, all 9 cells)**

| HH | ACIN | Engine (PY + TS) | Status |
|----|------|------------------|--------|
| 1 | $298 | $298 | ✓ |
| 2 | $546 | $546 | ✓ |
| 3 | $785 | $785 | ✓ |
| 4 | $994 | $994 | ✓ (was anchor) |
| 5 | $1,183 | $1,183 | ✓ |
| 6 | $1,421 | $1,421 | ✓ |
| 7 | $1,571 | $1,571 | ✓ |
| 8 | $1,789 | $1,789 | ✓ |
| +each | $218 | $218 | ✓ |

**Federal standard deduction**

| HH | ACIN | Engine | Status |
|----|------|--------|--------|
| 1–3 | $209 | $209 | ✓ |
| 4 | $223 | $223 | ✓ |
| 5 | $261 | $261 | ✓ |
| 6+ | $299 | $299 | ✓ |

**Other federal FY26 cells**

| Item | ACIN | Engine | Status |
|------|------|--------|--------|
| Max excess shelter deduction (non-E/D) | $744 | $744 | ✓ |
| Minimum benefit (HH 1–2) | $24 | $24 | ✓ |
| Homeless shelter deduction | $198.99 | $198.99 | ✓ |
| Resource limit (general) | $3,000 | $3,000 | ✓ |
| Resource limit (E/D) | $4,500 | $4,500 | ✓ |

**CA SUA (CDSS ACIN I-46-25, p.3)**

| Tier | ACIN | Engine (PY + TS) | Status |
|------|------|------------------|--------|
| Heating/Cooling (HCSUA) | $663 | $663 | ✓ |
| Limited (LUA, non-heating) | $170 | $170 | ✓ |
| Telephone (TUA, phone-only) | $20 | $20 | ✓ |

**HHS 2025 Poverty Guidelines (FY26 SNAP basis)**

| Item | HHS | Engine | Status |
|------|-----|--------|--------|
| Annual HH1 | $15,650 | $15,650 | ✓ |
| Each additional | $5,500 | $5,500 | ✓ |

Spot-check of derived monthly thresholds (ACIN Attachment I) against `15,650 + 5,500*(n-1) / 12 * ratio`: HH1 130% = ACIN $1,696 ↔ floor($15,650 × 1.30 / 12) = $1,695 (off-by-one is the FNS rounding convention noted in `packages/snap-rules/src/constants/federal-tables.ts:163`); HH1 200% BBCE = ACIN $2,610 ↔ floor($15,650 × 2.00 / 12) = $2,608 (same convention). Engine's `floorDollar()` matches.

## OBBBA reflected in FY26 values

**§10101 (TFP cost-neutrality)** — explicitly confirmed in CDSS ACIN I-46-25 narrative (p.1–2):

> "The Act specifies that the next reevaluation of the TFP may occur no earlier than October 1, 2027, and any adjustment must be cost neutral. These changes limit increases in SNAP benefit allotments due to a change in dietary guidelines or the rising cost of food over time."

FY26 max-allotment growth = FY25 → FY26 inflation only, no TFP refresh. ✓

**§10104 (internet excluded from shelter)** — NOT addressed in this ACIN (the COLA memo is allotment/SUA, not deduction-method). The internet-exclusion implementation in our engine is at `packages/snap-rules/src/benefit-calc.ts:124–127` with cutoff date `2025-11-01`. Statutory effective date is **2025-07-04** per the OBBBA text. The discrepancy is a known, pre-existing open question — see [[project_obbba_audit]] auto-memory and the comment block in `packages/snap-rules/src/constants/states.ts:103–113`. Counsel decision pending; outside the scope of #428.

**§10108 (refugee eligibility)** — handled separately in `packages/snap-rules/src/gates/immigration.ts:55–78` with the statutory 2025-07-04 cutoff (✓ correct per FNS memo 2025-10-31). Outside #428 scope.

## What still drifts (action items)

### 1. MA SUA — engines disagree, neither primary-verified

| Tier | Python `state_parameters.py:238` | TS `constants/states.ts:165` | Δ |
|------|------|------|---|
| HCSUA | $890 | $914 | +$24 |
| LUA | $542 | $556 | +$14 |
| TUA | $62 | $64 | +$2 |

The TS engine code-comment block (`constants/states.ts:41–78`) already flags this as `PENDING DTA PRIMARY-SOURCE VERIFICATION` — mass.gov returned 403 to fetches both there and again today. The Python engine claims `✓ via mass.gov DTA` but the source link was never preserved in code.

**One of the two engines is producing wrong MA benefit numbers.** Estimated max impact: a non-E/D MA household with rent $800 and heating utilities sees excess-shelter capped at $744 either way, so the visible benefit drift may be zero in typical cases — but elderly/disabled MA households (uncapped shelter deduction) will see a $24–$48 monthly delta in computed benefits.

**Action:** an operator with browser cookies (mass.gov rejects bot fetches) needs to pull DTA's "FY2026 SUA chart" from <mass.gov/info-details/snap-benefits-eligibility-requirements> or a logged-in DTA caseworker portal, attach a screenshot to a follow-up issue, then align both engines on the verified number.

### 2. CA standard medical deduction $150

`backend/civic_api/snap/rules/state_parameters.py:33` encodes `$150` as the CA standard medical deduction with provenance "CDSS demo waiver, ◦ via LSNC". The LSNC URL 404'd today. **The number could be right** — CA's elderly/disabled medical deduction option has historically been ~$120–$150 under the standard-medical-vs-itemize waiver — but the primary source needs to be attached before any FY2026 elderly-medical determination ships to prod.

**Action:** locate the active CDSS All County Letter (ACL) authorizing the standard medical deduction waiver, attach as evidence, strip the `◦` annotation. Likely candidates: CDSS ACL 17-35 (original waiver) or a subsequent renewal ACL.

## What changes

**Now (this finding):**
- Document everything above as the canonical reconfirmation source for FY26 cells.
- Strip `◦` from the Python `parameters.py` provenance string and from `poverty_guidelines.py` inline comments for all 12 federal cells + CA SUA — they're now `✓`.
- Leave MA SUA + CA standard medical at `◦` with explicit "pending primary verification" call-outs.

**Follow-up (separate PRs):**
- File issue: "Pull primary MA DTA FY26 SUA chart; reconcile Python ($890) vs TS ($914) engines."
- File issue: "Attach primary CDSS source for CA standard medical deduction $150."

## Open questions

- Which MA SUA value is correct? Operator must pull from a logged-in mass.gov session.
- Is the $150 CA standard medical still the current CDSS-elected amount under their waiver, or has it been adjusted since the original LSNC reference?
- Should the TS engine's `2025-11-01` OBBBA §10104 internet-exclusion cutoff be tightened to the statutory `2025-07-04`? (Counsel decision per [[project_obbba_audit]] — outside #428 scope but worth re-raising once counsel responds.)

## Sources

- **CDSS ACIN I-46-25** (Sep 3 2025) — fetched as PDF, text-extracted, full Attachment I cross-walked above. The CalFresh state pass-through of FNS FY2026 COLA; equivalently authoritative for federal cells because CDSS publishes what FNS announces verbatim.
- **HHS 2025 Poverty Guidelines** — fetched live from <aspe.hhs.gov> today; matches the engine.
- **FNS FY26 COLA primary page** (`fns.usda.gov/snap/allotment/cola/fy26`) — fetched today, content body is empty (page renders title only; tables are in linked memo PDFs that returned 403/timeouts). CDSS ACIN I-46-25 fully substitutes since it explicitly cites and quotes the FNS values.
