#!/usr/bin/env python3
"""
PolicyEngine US (offline) -> CA SNAP benefit-leverage by error element.

The MODELED lens for /findings/error-rate. The QC microdata says WHICH parts of
an application error (shelter, wages, ...). This says HOW MUCH a dollar of error
in each part actually moves the benefit -- the mechanism behind the error rate.

leverage(element) = |d(annual SNAP benefit)| / |d(input dollars)|, computed as a
central slope (+/- one step) on a representative panel of CA households, then
summarized (median + IQR). Captures the structural facts a single formula can't:
  - unearned income flows ~dollar-for-dollar into net income -> ~0.30 leverage
  - wages get a 20% earned-income deduction -> lower leverage
  - the excess SHELTER deduction is CAPPED for non-elderly/non-disabled
    households; in high-rent CA most are over the cap, so extra rent moves the
    benefit $0. Households with an elderly (60+) or disabled member are UNCAPPED.

AGPL NOTE: policyengine-us is AGPL-3.0. This harness is a DEV TOOL that runs it
OFFLINE in a local venv (see README); it is NEVER imported into any Civica
runtime. We ship only the JSON OUTPUT (facts) + this harness source, not the
policyengine-us code. Do not `pip install policyengine-us` into apps/* or backend/*.

Run:
  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python src/leverage.py --out ../../data-ops/sample/policyengine-ca/element_leverage_fy2024.json
"""
from __future__ import annotations

import argparse
import json
import os
import statistics

YEAR = 2024
STEP_M = 100  # +/- $100/month perturbation for the central slope


def make_situation(size, earn_m, unearn_m, shelter_m, elderly):
    from policyengine_us import Simulation  # noqa: F401  (import here for clear errors)

    age = 67 if elderly else 35
    head = {"age": {YEAR: age}, "employment_income": {YEAR: earn_m * 12}}
    if unearn_m:
        head["social_security"] = {YEAR: unearn_m * 12}
    people = {"head": head}
    members = ["head"]
    for i in range(size - 1):
        people[f"c{i}"] = {"age": {YEAR: 10}}
        members.append(f"c{i}")
    return {
        "people": people,
        "spm_units": {
            "spm": {
                "members": members,
                "snap": {YEAR: None},
                "housing_cost": {YEAR: shelter_m * 12},
                "utility_expense": {YEAR: 3600},
            }
        },
        "households": {"hh": {"members": members, "state_name": {YEAR: "CA"}}},
    }


def benefit(sit):
    from policyengine_us import Simulation

    return float(Simulation(situation=sit).calculate("snap", YEAR)[0])


def leverage(hh, element, step_m=STEP_M):
    key = {"wages": "earn_m", "unearned": "unearn_m", "shelter": "shelter_m"}[element]
    up = dict(hh)
    dn = dict(hh)
    up[key] = up[key] + step_m
    dn[key] = max(0, dn[key] - step_m)
    d_input = (up[key] - dn[key]) * 12
    if d_input == 0:
        return None
    return abs(benefit(make_situation(**up)) - benefit(make_situation(**dn))) / d_input


def build_panel(quick=False):
    elderly_opts = [False, True]
    sizes = [1, 2] if quick else [1, 2, 3, 4]
    income_mixes = [(1200, 0), (0, 1000)] if quick else [(1200, 0), (600, 600), (0, 1000), (1800, 0)]
    shelters = [1600] if quick else [1000, 1600]
    panel = []
    for elderly in elderly_opts:
        for size in sizes:
            for earn_m, unearn_m in income_mixes:
                for shelter_m in shelters:
                    panel.append(
                        dict(size=size, earn_m=earn_m, unearn_m=unearn_m,
                             shelter_m=shelter_m, elderly=elderly)
                    )
    return panel


def summarize(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    vals_sorted = sorted(vals)
    q = statistics.quantiles(vals_sorted, n=4) if len(vals_sorted) >= 4 else [vals_sorted[0]] * 3
    return {
        "median": round(statistics.median(vals_sorted), 3),
        "p25": round(q[0], 3),
        "p75": round(q[2], 3),
        "n": len(vals_sorted),
        "share_zero": round(sum(1 for v in vals_sorted if v < 0.01) / len(vals_sorted), 3),
    }


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="data-ops/sample/policyengine-ca/element_leverage_fy2024.json")
    p.add_argument("--quick", action="store_true")
    p.add_argument("--pe-version", default="unknown")
    a = p.parse_args(argv)

    panel = build_panel(quick=a.quick)
    elements = ["wages", "unearned", "shelter"]
    rows = {e: [] for e in elements}
    shelter_by_elderly = {True: [], False: []}
    benefits = []
    for hh in panel:
        benefits.append(benefit(make_situation(**hh)))
        for e in elements:
            lev = leverage(hh, e)
            rows[e].append(lev)
            if e == "shelter":
                shelter_by_elderly[hh["elderly"]].append(lev)

    result = {
        "source": "PolicyEngine US (AGPL-3.0) run OFFLINE; outputs are facts (not the model code)",
        "pe_version": a.pe_version,
        "param_year": YEAR,
        "state": "CA",
        "metric": "benefit_leverage_per_dollar",
        "definition": "|d(annual SNAP benefit)| / |d(input $)|, central +/-$100/mo slope, summarized over a representative CA household panel.",
        "panel": {
            "n_households": len(panel),
            "definition": "structured grid: size 1-4 x {earned/unearned mixes} x shelter {1000,1600}/mo x elderly/disabled flag",
            "mean_correct_benefit_monthly": round(statistics.mean(benefits) / 12, 2),
        },
        "leverage_per_dollar": {e: summarize(rows[e]) for e in elements},
        "shelter_split": {
            "nonelderly_capped": summarize(shelter_by_elderly[False]),
            "elderly_disabled_uncapped": summarize(shelter_by_elderly[True]),
        },
        "notes": [
            "Unearned income leverage ~0.30: counts ~dollar-for-dollar into net income x 30% benefit reduction.",
            "Wages leverage < unearned: 20% earned-income deduction softens each dollar.",
            "Shelter leverage is bimodal: ~0 for non-elderly households over the excess-shelter cap (most high-rent CA renters), ~0.30 for elderly/disabled (uncapped).",
            "Implication: the highest-DOLLAR-leverage error is income, which is exactly the part automated payroll verification fixes -- so the dollar-weighted error tilts more toward income than the case-count shares suggest.",
        ],
    }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    print(json.dumps(result["leverage_per_dollar"], indent=2))
    print("shelter_split:", json.dumps(result["shelter_split"]))
    print("wrote", a.out)


if __name__ == "__main__":
    main()
