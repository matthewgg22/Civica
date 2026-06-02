# MA SNAP-Gap builder — handoff state

Sibling of [`../ca-snap-gap/`](../ca-snap-gap/). Built for the MA-pilot rollout
planned for June 2026 (see `docs/designs/cbo-caseworker-mode.md`).

## Status (2026-06-01)

- [x] **Raw inputs pulled** — `data/csv_hma.zip` (households) + `data/csv_pma.zip` (persons), 2023 ACS 1-Year PUMS, FIPS 25 = MA, ~5.3 MB + 12 MB zipped.
- [ ] **Builder script** — not yet committed. PR #288 (the CA pull) shipped output artifacts only; the build code lives in `data-ops/sample/ca-snap-gap/README.md` as methodology prose, not committed Python.
- [ ] **Output dataset** — `data-ops/sample/ma-snap-gap/` not yet written.

## What the builder needs to do

Mirror the CA methodology in [`data-ops/sample/ca-snap-gap/README.md`](../../data-ops/sample/ca-snap-gap/README.md) line-for-line, with MA-specific knobs:

| Knob | CA value | MA value |
|---|---|---|
| State FIPS | `06` | `25` |
| PUMS household file | `psam_h06.csv` | `psam_h25.csv` (in `data/csv_hma.zip`) |
| PUMS person file | `psam_p06.csv` | `psam_p25.csv` (in `data/csv_pma.zip`) |
| Output dir | `data-ops/sample/ca-snap-gap/` | `data-ops/sample/ma-snap-gap/` |
| PUMA code prefix | `06` | `25` |
| `model_version` | `ca-snap-gap-v0.1.0` | `ma-snap-gap-v0.1.0` |

Everything else carries over:
- Eligibility filter: `HINCP × ADJINC` (2023 dollars) ≤ 130% FPL by household size, 2023 HHS Poverty Guidelines.
- Target: `FS == 2` (HH reports *not* receiving SNAP in last 12 months).
- 45-feature set documented in CA README §4 (language, HH composition, employment, income, asset proxies, other-benefit receipt, disability/citizenship, demographics, connectivity).
- `sklearn.ensemble.HistGradientBoostingClassifier` with `WGTP` sample weights.
- 5-fold stratified CV, weighted ROC-AUC.
- Per-PUMA weighted mean of out-of-fold predicted probabilities + 200-iteration bootstrap 95% CI.

## Expected output

`data-ops/sample/ma-snap-gap/`:
- `ma_snap_gap_puma.csv` — one row per MA PUMA. MA has ~52 PUMAs vs CA's 281 (smaller-state lower granularity). Schema identical to CA, with `puma_code` 7-char `25` + 5-digit PUMA.
- `model_card.json` — same fields as CA model card. Sanity targets to clear before publishing:
  - CV AUC should land in the 0.78–0.82 band (CA was 0.801; Erdős MD/VA/DC was ~0.80).
  - Weighted observed non-enrollment among the eligible-by-income subset will likely be **lower than CA's 61%** — MA historically has higher SNAP participation than CA among eligibles (consistent with [findings/2026-05-29-caper-denial-side-error](../../docs/findings/2026-05-29-caper-denial-side-error.md) where MA's 21.08% denial-side error rate suggests a less-leaky pipeline). Plausible band: 45–58%.
- `README.md` — copy CA template, swap state-specific numbers.

## Why this matters

Feeds:
- Project Bread targeting heatmap (which Greater Boston / Springfield PUMAs have the highest eligible-non-enrollee density).
- MA pilot baseline numbers for the pre-pilot finding (the `2026-06-XX-ma-state-baseline.md` ledger entry queued in the strategy plan).
- The MA equivalent of Map+USDA+heatmap track 1 demo (PR #288 was CA-only).

## Why not built today

Reconstructing the 45-feature builder from prose-only methodology is a 2–4 hour focused session with iterative test runs (eligibility filter validation, weight-correctness check, AUC sanity, bootstrap CI tightness). Doing it in-band risked silent methodology drift from the CA pattern. Raw inputs pulled deterministically; model build deferred to a focused agent run.

## To resume the build

1. Read `data-ops/sample/ca-snap-gap/README.md` end-to-end for methodology.
2. Author `tools/ma-snap-gap/build.py` (and back-port a generalized `tools/ca-snap-gap/build.py` so this isn't a one-shot script).
3. Run, write outputs to `data-ops/sample/ma-snap-gap/`.
4. Cross-check: weighted observed non-enrollment vs CAPER MA denial rate, CV AUC vs Erdős baseline, top-5 feature importance for face validity (`GRNTP`, `any_pap`, `householder_age` were CA's top three — expect similar but not identical for MA).
5. Update auto-memory note `reference_ca_snap_gap_dataset.md` to add an MA section.

## Source

- ACS 2023 1-Year PUMS, MA: https://www2.census.gov/programs-surveys/acs/data/pums/2023/1-Year/csv_hma.zip + `csv_pma.zip`
- Pulled 2026-06-01.
- License: U.S. federal public domain (17 U.S.C. § 105).
