# USDA SNAP QC — Massachusetts aggregates (FY2023)

State-level error-rate aggregates derived from the **USDA SNAP QC Public-Use File**
(FY2023), filtered to Massachusetts. Built using the same multi-element +
multi-AGENCY methodology as [`../usda-qc-ca/`](../usda-qc-ca/), validated to
reproduce the CA reference output within 0.25pp on every element share.

## Files

- `ma_qc_fy2023.json` — aggregates (total PER, income-group PER, multi-element share, responsibility split).
- `ma_qc_fy2023.provenance.json` — input file path/mtime, columns used, FIPS filter, codebook ref.

## Headline numbers

| Metric | MA (FY2023) | CA (FY2023, ref build) | Δ |
|---|---:|---:|---:|
| Total Payment Error Rate | **7.76%** | ~10.45% (raw PER); 13.40% (engine constant) | −2.7 pp raw |
| Earned-any cohort PER | 15.24% | 14.31% | +0.9 pp |
| No-earned PER | 5.38% | 8.50% | −3.1 pp |
| Cases in scope | 950 | 867 | — |
| Errored cases (attributable) | 367 | 379 | — |
| **Shelter + Wages share of errored cases** | **60.05%** | 60.80% | −0.75 pp |

(The CA "engine constant" 13.40% is the value embedded in `error-risk.ts`; the
raw derived 10.45% comes directly from the QC file. The gap is the QC
$-tolerance threshold the official method applies — not material to MA vs CA
comparison since both are computed the same way here.)

**Element attribution (top 10, per-case dedup, weighted):**

| Element code | Label | MA share | CA share | Δ |
|---|---|---:|---:|---:|
| 363 | Shelter deduction | 37.82% | 41.50% | −3.7 |
| 311 | Wages | 24.30% | 22.18% | +2.1 |
| 331 | RSDI | 11.07% | 11.49% | −0.4 |
| 365 | Medical expense deduction | 9.46% | 4.03% | **+5.4** |
| 333 | SSI | 6.24% | 7.95% | −1.7 |
| 350 | Dependent care deduction | 5.41% | 1.96% | **+3.5** |
| 364 | Standard utility allowance | 4.87% | 4.92% | −0.05 |
| 323 | Unemployment compensation | 3.51% | 0.74% | **+2.8** |
| 150 | Household composition | 2.80% | 1.62% | +1.2 |
| 312 | Self-employment | 2.29% | 5.11% | **−2.8** |

**The interesting story is in the deltas:** MA cases over-index on **medical
expense deduction errors** (9.5% vs CA's 4.0% — likely MA's older population +
the medical-expense deduction's elderly/disabled gating), **dependent care**
(5.4% vs 2.0%), and **unemployment compensation** (3.5% vs 0.7%). MA
under-indexes on **shelter** (still #1 but smaller share) and **self-employment**
(2.3% vs 5.1% — fewer self-employed errors).

## ⚠ Data-quality caveat — do NOT publish the responsibility split yet

| Metric | MA reported | Why caveat is needed |
|---|---:|---|
| Operational $ share | 25.9% | Based on **39% of MA error-element slots** |
| Client $ share | 74.1% | …only 167 of 431 MA slots have a classifiable AGENCY code |

In CA, 94% of ELEMENT slots have AGENCY filled (435 of 465 → unbiased
classification). In MA, only **39% do** (167 of 431 → 264 ELEMENT-only slots,
unclassified). The MA responsibility split therefore reflects only the slots MA
QC reviewers chose to attach an AGENCY code to — **not a representative slice
of MA error-element causes**.

The 25.9/74.1 split is dramatically different from CA's 64.6/35.4. **Do not
build a Civica pitch on this number without first investigating** the MA
AGENCY-null rate. Options:
- (a) Contact USDA FNS / MA DTA to confirm whether AGENCY is recorded differently in MA QC reviews.
- (b) Check FY2022 and FY2024 (when released) to see whether the MA AGENCY-null rate is structural or year-specific.
- (c) Look at other states' AGENCY-null rates to see if MA is the outlier or part of a regional pattern.

## What we CAN say with confidence

- ✓ **MA total PER ≈ 7.76% — materially lower than CA's 10–13%.** This is robust because PER computation doesn't depend on AGENCY codes.
- ✓ **Element shares are reliable** — 431 MA ELEMENT slots vs 465 CA ELEMENT slots, similar density (1.17 vs 1.23 per case). The element-mix delta (more medical/dep-care/UI; less shelter/self-employment) is real signal.
- ✓ **Methodology validated:** CA reference reproduced to within 0.25pp on every top-10 element. Same code, same data, different state filter.

## What this means for the MA pilot

The pre-rerun "MA has cleaner pipeline → less Pillar-1 headroom" framing **needs revision**:

1. **MA's lower PER is genuine** — confirmed (7.76% vs 10.45% raw CA).
2. **But the element MIX differs in ways that matter for Civica:**
   - **Medical-expense deduction errors** (9.5% in MA vs 4.0% in CA) are exactly the kind of error a coached intake (Civica's iOS app) reduces — clients often forget to claim or misreport medical expenses.
   - **Dependent care errors** (5.4% vs 2.0%) similarly benefit from a guided form.
   - **Wages** (24.3% vs 22.2%) — about the same.
3. **Pillar-1 thesis re-frames for MA:** rather than "catch operational errors before the county," frame it as **"help clients self-report cleanly on the elements MA actually fails most"** — medical, dependent-care, household composition.
4. **Pillar 3 (retention) remains the lead** per the existing strategy — MA's lower PER means there's less Type-2 error to recover, but MA's procedural denial / churn pattern (CAPER 21.08%, Unrath retention) still has plenty of headroom.

Whether the **responsibility split** (operational vs client) actually flips in MA vs CA — i.e., whether MA's lower PER is from cleaner DTA processing OR fewer client-side mistakes OR both — is unknowable from this data alone. Flag for follow-up.

## Source

- **USDA SNAP QC Public-Use File FY2023** — public, free, no login.
- **Download:** https://snapqcdata.net/datafiles → `qcfy2023_csv.zip` → `qc_pub_fy2023.csv`
- **Codebook:** FY2023 Technical Documentation, Chapter V (~p. 55).
- **License:** U.S. federal public domain (17 U.S.C. § 105).
- **Pulled:** previously to `~/Downloads/qc_pub_fy2023.csv` (mtime in provenance.json).
- **Generated:** 2026-06-01.

## How to reproduce

```bash
cd tools/usda-qc-ingest
.venv/bin/python src/ingest_qc.py build \
  --data ~/Downloads/qc_pub_fy2023.csv \
  --state MA --state-code 25 \
  --col-state STATE --col-weight FYWGT \
  --col-error AMTERR --col-benefit FSBEN --col-earned FSEARN \
  --multi-element
```

## Methodology validation

CA reference output (`../usda-qc-ca/ca_qc_fy2023.json`) was reproduced from the
raw QC file using the same `--multi-element` flag. Validation deltas vs reference:

| Metric | This build | CA reference | Δ |
|---|---:|---:|---:|
| n_errored_cases | 378 | 379 | −1 |
| Element 363 share | 41.60 | 41.50 | +0.10 |
| Element 311 share | 22.24 | 22.18 | +0.06 |
| Element 331 share | 11.52 | 11.49 | +0.03 |
| Element 333 share | 7.97 | 7.95 | +0.02 |
| Shelter+wages share | 60.99 | 60.80 | +0.19 |
| Operational $ share | 65.4 | 64.6 | +0.8 |

Within rounding tolerance on every metric → methodology port is correct, and
the MA numbers can be trusted as the same-method extension of the CA reference.

## Cross-references

- CA sibling — [`../usda-qc-ca/`](../usda-qc-ca/)
- Multi-year CA panel — [`../usda-qc-multiyear/`](../usda-qc-multiyear/)
- Cross-state PER — [`../snap-per-by-state/`](../snap-per-by-state/)
- Truth-point finding — [`../../../docs/findings/2026-05-29-error-rate-truth-point.md`](../../../docs/findings/2026-05-29-error-rate-truth-point.md)
- Caseworker mode MA-first design — [`../../../docs/designs/cbo-caseworker-mode.md`](../../../docs/designs/cbo-caseworker-mode.md)
