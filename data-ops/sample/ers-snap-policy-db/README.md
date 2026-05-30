# USDA ERS SNAP Policy Database — the IV spine

The canonical **state × month** SNAP policy-lever panel (BBCE + its asset/vehicle
variants, simplified & periodic reporting, certification/recert length, call
centers, vehicle exclusion, transitional benefits, online application, …),
50 states + DC, **Jan 1996 – Dec 2020** (15,300 state-months × 49 columns).

- **Source:** https://www.ers.usda.gov/media/6472/snap-policy-database.xlsx (sheet `SNAP Policy Database`; US Gov public domain).
- `ca_policy_levers.csv` — the **CA subset** (300 state-months, all 49 columns).
- `lever_adoption_national.json` — national adoption of key levers by year (e.g. **BBCE: 0% of states in 1996 → 79.7% by 2020** — a textbook policy-diffusion IV).

**Regression role:** the exogenous **IV / treatment backbone** — within-state,
over-time policy variation for fixed-effects / difference-in-differences /
event-study models of SNAP payment error & churn. Join everything else onto this.

## Caveats
- Coverage ends **Dec 2020** — post-2020 needs hand-coding (or hold the panel ≤2020).
- ~30 partly-collinear lever dummies — for a one-number regressor use the ERS
  **SNAP Policy Index** composite instead.

## Reproduce
Download the xlsx, read the `SNAP Policy Database` sheet, filter `state_fips==6`
for CA; group by `yearmonth//100` for annual adoption.
