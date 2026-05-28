# CA SNAP-Gap (Eligible Non-Enrollee) — PUMA-Level Estimates

PUMA-level estimates of the California **SNAP/CalFresh gap**: among households
whose gross income makes them eligible for SNAP, the predicted share that does
**not** receive benefits. Built from the 2023 ACS 1-Year PUMS.

This is the CA-specific, PUMA-granular extension of the Erdős Institute
spring-2026 SNAP-Gap classifier (which was restricted to MD/VA/DC at the state
level). See cross-references at the bottom of this file.

## Files

| File | Description |
| ---- | ----------- |
| `ca_snap_gap_puma.csv` | One row per CA PUMA (281 rows). See schema below. |
| `model_card.json` | Sample/weighted counts, CV AUC, full permutation-importance ranking. |

## Schema (`ca_snap_gap_puma.csv`)

| Column | Type | Description |
| ------ | ---- | ----------- |
| `puma_code` | string | Full 7-character code `06` (CA state FIPS) + 5-digit PUMA. |
| `puma_raw` | int | Raw 5-digit PUMA from PUMS (2020 PUMA boundaries). |
| `est_eligible_households` | float | Sum of WGTP across sampled HH at ≤130% FPL in the PUMA. |
| `est_eligible_population` | float | Sum of WGTP × household size — weighted person-count estimate. |
| `n_sample_households` | int | Raw PUMS sample size in the PUMA (no weighting). |
| `est_non_enrollment_rate` | float | Weighted mean of model-predicted P(FS==2) for the PUMA. |
| `observed_non_enrollment_rate` | float | Weighted mean of actual FS==2 in the same sample (sanity check). |
| `ci95_lo`, `ci95_hi` | float | 200-iter bootstrap 95% CI on the predicted rate. |
| `model_confidence` | float | `1 − (ci95_hi − ci95_lo)`. Higher = tighter CI; not a probability. |
| `top_predictive_features` | string | Top-5 features by permutation ROC-AUC drop (constant per file). |
| `model_auc_cv5` | float | 5-fold weighted CV ROC-AUC (constant per file). |
| `model_version` | string | `ca-snap-gap-v0.1.0`. |
| `acs_vintage` | string | `2023 1-Year PUMS`. |

## Methodology

1. **Data**: 2023 ACS 1-Year PUMS, California — 167,075 households / 392,318
   persons (un-weighted). Census Bureau release Sep 2024.
2. **Eligibility filter**: gross household income (HINCP × ADJINC, adjusted to
   2023 dollars) ≤ **130% of the 2023 HHS Poverty Guidelines** for household
   size — the SNAP gross-income test (7 CFR §273.9(a)(1)). Yields **18,034
   eligible-by-gross-income households** (weighted ≈ 4.66M Californians).
   - This proxy ignores the asset test (7 CFR §273.8) and ABAWD work
     requirements (7 CFR §273.7), because ACS PUMS does not measure household
     assets directly. PolicyEngine's asset/work-req encodings in
     `data-ops/sample/policyengine-us-params/` are the right reference for a
     stricter filter in a future revision.
3. **Target**: `FS == 2` (household reports *not* receiving SNAP in the last 12
   months). Among the eligible-by-income subset, **weighted observed
   non-enrollment ≈ 61%** — consistent with the Erdős MD/VA/DC ≈ 66% finding
   while accounting for CA's higher historical CalFresh participation among
   eligibles.
4. **Features (45 total)** — same family as Erdős:
   - Primary language / linguistic isolation: `HHL`, `LNGI`,
     `spanish_household`, `asian_lang_household`, `linguistic_isolation`,
     `n_limited_english`.
   - Household composition: `n_persons`, `n_adults`, `n_children`,
     `n_elderly`, `has_children`, `has_elderly`, `HHT`, `HUPAOC`, `NRC`.
   - Employment: `n_workers`, `avg_hours_worked`, `WIF`.
   - Income components: `HINCP_ADJ`, `FINCP`, `sum_wages`, `sum_retp`,
     `sum_ssp`, `income_to_fpl`, `earned_income_share`.
   - Asset proxies: `TEN`, `owns_home`, `rents`, `VEH`, `no_vehicle`,
     `GRNTP`, `VALP`.
   - Other-benefit receipt: `any_pap` (TANF), `any_ssi`.
   - Disability / citizenship: `n_disabled`, `n_noncitizen`, `CIT` rollups.
   - Demographics: `any_hispanic`, `any_black`, `any_asian`,
     `householder_age`, `householder_schl`, `n_college`, `n_no_hs`.
   - Connectivity (CA outreach signal): `has_internet`, `has_broadband`.
5. **Model**: `sklearn.ensemble.HistGradientBoostingClassifier` (histogram
   gradient boosting, same algorithm family as LightGBM — chosen because the
   macOS sandbox lacked `libomp` for the LightGBM wheel). Trained with
   household weights (`WGTP`) on all 5 folds.
6. **Validation**: 5-fold stratified CV, weighted ROC-AUC.
   **Mean AUC = 0.801** — matches the 0.80 baseline reported by the Erdős
   team on MD/VA/DC.
7. **PUMA aggregation**: per-PUMA weighted mean of out-of-fold predicted
   probabilities + 200-iteration bootstrap 95% CI over the sampled households.

## Top predictive features (permutation ROC-AUC drop)

Computed on an 8,000-row held-out subsample of the eligible set:

| Rank | Feature | Δ AUC |
| ---- | ------- | ----- |
| 1 | `GRNTP` (gross rent) | 0.084 |
| 2 | `any_pap` (any public-assistance income) | 0.043 |
| 3 | `householder_age` | 0.025 |
| 4 | `n_disabled` | 0.022 |
| 5 | `HHT` (household/family type) | 0.018 |
| 6 | `income_to_fpl` | 0.018 |
| 7 | `n_noncitizen` | 0.016 |
| 8 | `VEH` (vehicles) | 0.014 |
| 9 | `any_ssi` | 0.013 |
| 10 | `householder_schl` (education) | 0.012 |

Full ranking in `model_card.json → feature_importance_top20`.

## Cross-references — how this dataset informs Civica strategy

- **TAM repositioning** (`project_civica_tam_repositioning.md`). The pitch
  thesis is the 27.3% earned-income cohort at 13.95% PER (2.4× baseline).
  This dataset lets us check whether predicted-gap mass concentrates in
  PUMAs with high `earned_income_share` — i.e. whether the earned-income
  cohort is also where outreach has the highest expected lift.
- **Distribution strategy** (`project_distribution_strategy.md`). SEIU 2015
  (homecare) and UFW (agricultural) channels target specific labor
  geographies. Overlaying gap PUMAs with Central Valley / Imperial / Salinas
  PUMAs (UFW heartland) and Bay Area / SoCal homecare-density PUMAs (SEIU
  2015) is the natural next analytical step.
- **Map / heatmap demo track** (`project_demo_track_2026_05_22.md`). This
  CSV is the substrate for the Track-1 PUMA-level heatmap overlay on the
  USDA SNAP-spend category dataset.
- **Dashboard design review** (`project_dashboard_design_review_may2026.md`).
  The CBO/county dashboard is the likely consumer once a visualization is
  wired (see `apps/dashboard/DESIGN.md`).

## Caveats — read before using in any external claim

1. **2010 vs 2020 PUMA boundaries**. The 2023 1-Year PUMS uses 2020-vintage
   PUMA boundaries (CA has 281 of these vs 265 under 2010 vintage). Any
   crosswalk to older Civica geographies needs the official Census 2010↔2020
   PUMA equivalence file.
2. **Gross-income proxy** ≠ full SNAP eligibility. We do not test assets,
   ABAWD work requirements, immigration-status SNAP restrictions, or
   categorical eligibility (BBCE). Predicted "non-enrollment" therefore
   includes some technically ineligible households — biasing the gap rate
   upward.
3. **Self-reported SNAP receipt** in ACS is known to be under-reported
   (USDA/Census linkage studies estimate ~25–35% under-report at national
   level). This biases the gap rate further upward. The model learns
   `P(self-reported non-receipt)`, not `P(true non-receipt)`.
4. **1-Year PUMS**: smaller samples than 5-Year — some PUMAs have <100
   sampled eligible households (`n_sample_households` column). Treat CIs as
   the authoritative uncertainty signal; a wide CI in a small-sample PUMA is
   not actionable on its own.
5. **No re-use of the trained model**. The Erdős repo's trained model was
   for MD/VA/DC. This is an independent re-implementation in line with the
   methodology section above; no weights were imported.

## Provenance

- **Source data**: U.S. Census Bureau, *2023 American Community Survey 1-Year
  Public Use Microdata Sample (PUMS)*. Files: `csv_hca.zip`, `csv_pca.zip`,
  retrieved from `www2.census.gov/programs-surveys/acs/data/pums/2023/1-Year/`
  on 2026-05-27.
- **Methodology**: Erdős Institute Spring 2026 "Local Poverty Rate Estimation"
  team project — `github.com/Erdos-Projects/spring-2026-local-poverty-rate-estimation`.
- **Generated by**: `tools/ca-snap-gap/src/build_ca_snap_gap.py` @ commit
  `codex/rebuild-feb18`.
- **License**: ACS PUMS is public-domain U.S. government data. This derived
  CSV is shipped under the Civica repository license. Methodology citation
  above is non-binding (Erdős repo is MIT-licensed at the time of this run).
