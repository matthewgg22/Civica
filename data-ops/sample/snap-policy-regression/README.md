# SNAP policy-regression — the analysis panel (burden levers → participation)

The committed panel behind the **first real causal estimate** in the ledger
(finding `2026-05-30-regression-burden-participation`). Lets the regression
reproduce from the repo with **no raw downloads**.

- `analysis_panel.csv` — **15,300 state-months, 51 states × Jan 1996 – Dec 2020**:
  `state_fips`, `statename`, `yearmonth`, the six policy levers
  (`reportsimple`, `bbce`, `call_any`, `oapp`, `faceini`, `facerec`), and FNS
  participation (`households`, `persons`, `issuance`).

**Sources** (both public, no FOIA), joined 1:1 on state × month:
- *Treatment* — USDA ERS **SNAP Policy Database** (`snap-policy-database.xlsx`).
- *Outcome* — USDA FNS **National/State Monthly Data** (`snap-zip-fy69tocurrent`).

**Reproduce:**
```
# from the two raw downloads → this panel:
python tools/snap-policy-regression/src/build_policy_regression.py --build-panel \
  --ers <snap-policy-database.xlsx> --fns-dir <unzipped fy69 dir> \
  --panel data-ops/sample/snap-policy-regression/analysis_panel.csv
# from this committed panel → the fitted artifact (no raw files needed):
python tools/snap-policy-regression/src/build_policy_regression.py
```

Raw ERS xlsx (~3.9 MB) and FNS zip (~1.5 MB) are **not committed** — regen above.
The model (two-way fixed effects + BBCE event study, cluster-robust by state) and
its honest limits live in the finding.
