# SNAP policy-regression — the analysis panel (burden levers → participation)

The committed panel behind the **first real causal estimate** in the ledger
(finding `2026-05-30-regression-burden-participation`). Lets the regression
reproduce from the repo with **no raw downloads**.

- `analysis_panel.csv` — **15,300 state-months, 51 states × Jan 1996 – Dec 2020**:
  `state_fips`, `statename`, `yearmonth`, **13 policy levers in 3 families**
  (eligibility: `bbce`, `cap`, `vehexclall`, `bbce_inclmt`; transaction-cost:
  `call_any`, `oapp`, `reportsimple`, `ebtissuance`, `transben`, `outreach`;
  procedural: `faceini`, `facerec`, `fingerprint`), and FNS outcomes
  (`households`, `persons`, `issuance`).

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
The analysis (R² ladder by policy family across 3 outcomes, a parsimonious
interpretable-coefficient spec, a state-trend robustness pass, + a BBCE event
study — all two-way FE, cluster-robust by state) and its honest limits live in
the finding.
