#!/usr/bin/env python3
"""
CA procedural-denial panel regression — is SNAP application churn OPERATIONAL?

On the real ICPSR 39331 (Pukelis) CA county-month panel (58 counties, 2016–2024),
the procedural-denial rate = APPS_DENIED_PROCEDURAL / APPS_RECEIVED. Two questions:

  MODEL A (headline) — OPERATIONAL VARIATION. Under IDENTICAL statewide SNAP rules,
    how much of the procedural-denial-rate variation is persistent BETWEEN counties
    (operational / administrative) vs. over time? A large between-county share is
    hard evidence the churn is operational, not policy/eligibility — i.e. a tool
    can move it. Volume-weighted (FYI: tiny rural counties like Alpine have ~0 apps
    and would otherwise dominate a raw min/max), reported as a p10–p90 spread among
    adequate-volume counties, NOT the noisy min/max.

  MODEL B (secondary) — EA-CLIFF event study. CA's pandemic Emergency Allotments
    ended 2023-02-28 (ICPSR 39703 EA_PEXD). Did procedural denials move after the
    cliff? This is an INTERRUPTED TIME SERIES, not a diff-in-diff: the cliff hit all
    58 CA counties the same month, so there is no within-CA control group. Interpret
    the post-cliff coefficient cautiously (confounded by anything else in 2023).

Source (public): ICPSR 39331 DS0002 (vendored CA slice) + ICPSR 39703 (EA dates).
Run:
  .venv/bin/python src/build_ca_churn_regression.py \
    --data ../../data-ops/sample/icpsr-39331-enrollment/ca_county_month_enrollment.csv \
    --out ../../apps/dashboard/lib/analytics/ca-churn-results.json --generated-at <ISO>
"""
from __future__ import annotations

import argparse
import json
import os
import sys

SPEC_VERSION = "1.0.0"
CLIFF_MONTH = (2023, 3)  # first month WITHOUT EA (EA_PEXD = 2023-02-28)
MIN_MEDIAN_APPS = 30     # adequate-volume floor for the county-spread headline


def main(argv=None) -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--out", default="apps/dashboard/lib/analytics/ca-churn-results.json")
    p.add_argument("--generated-at", default="unset")
    a = p.parse_args(argv)

    import numpy as np  # noqa: PLC0415
    import pandas as pd  # noqa: PLC0415
    import statsmodels.formula.api as smf  # noqa: PLC0415

    df = pd.read_csv(a.data)
    for c in ["APPS_RECEIVED", "APPS_APPROVED", "APPS_DENIED", "APPS_DENIED_PROCEDURAL", "HOUSEHOLDS"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Parse YM "2016m7" → year, month, ordinal t.
    ym = df["YM"].str.extract(r"(\d{4})m(\d{1,2})").astype(float)
    df["yr"] = ym[0]
    df["mo"] = ym[1]
    df = df.dropna(subset=["yr", "mo"])
    df["yr"] = df["yr"].astype(int)
    df["mo"] = df["mo"].astype(int)
    df["t"] = df["yr"] * 12 + df["mo"]

    # Usable rows: positive denominator + observed procedural denials.
    d = df[(df["APPS_RECEIVED"] > 0) & df["APPS_DENIED_PROCEDURAL"].notna()].copy()
    d["proc_rate"] = d["APPS_DENIED_PROCEDURAL"] / d["APPS_RECEIVED"] * 100.0
    d["w"] = d["APPS_RECEIVED"].astype(float)
    n_obs = int(len(d))
    n_counties = int(d["COUNTY"].nunique())

    wmean = float(np.average(d["proc_rate"], weights=d["w"]))

    # ── Model A — operational variation ──────────────────────────────────────
    # Variance shares: R² from county-only vs time-only (volume-weighted).
    r2_county = float(smf.wls("proc_rate ~ C(COUNTY)", data=d, weights=d["w"]).fit().rsquared)
    r2_time = float(smf.wls("proc_rate ~ C(YM)", data=d, weights=d["w"]).fit().rsquared)

    # County spread among adequate-volume counties (median monthly apps >= floor),
    # volume-weighted county means — robust to tiny-county noise.
    med = d.groupby("COUNTY")["APPS_RECEIVED"].median()
    adequate = med[med >= MIN_MEDIAN_APPS].index
    da = d[d["COUNTY"].isin(adequate)]
    cmean = da.groupby("COUNTY").apply(
        lambda g: float(np.average(g["proc_rate"], weights=g["w"])), include_groups=False
    )
    spread = {
        "n_counties_adequate": int(len(adequate)),
        "min_median_apps_floor": MIN_MEDIAN_APPS,
        "p10_pct": round(float(cmean.quantile(0.10)), 2),
        "median_pct": round(float(cmean.median()), 2),
        "p90_pct": round(float(cmean.quantile(0.90)), 2),
        "min_pct": round(float(cmean.min()), 2),
        "min_county": str(cmean.idxmin()),
        "max_pct": round(float(cmean.max()), 2),
        "max_county": str(cmean.idxmax()),
    }

    # ── Model B — EA-cliff interrupted time series ───────────────────────────
    cliff_t = CLIFF_MONTH[0] * 12 + CLIFF_MONTH[1]
    d["post"] = (d["t"] >= cliff_t).astype(int)
    d["tc"] = d["t"] - int(d["t"].min())  # linear trend
    n_post_months = int(d.loc[d["post"] == 1, "t"].nunique())
    mB = smf.wls("proc_rate ~ post + tc + C(COUNTY) + C(mo)", data=d, weights=d["w"]).fit(
        cov_type="cluster", cov_kwds={"groups": d["COUNTY"]}
    )
    ci = mB.conf_int().loc["post"]
    ea = {
        "cliff_month": f"{CLIFF_MONTH[0]}m{CLIFF_MONTH[1]}",
        "ea_program_end_date": "2023-02-28",
        "post_coef_pp": round(float(mB.params["post"]), 3),
        "ci_low_pp": round(float(ci[0]), 3),
        "ci_high_pp": round(float(ci[1]), 3),
        "p_value": round(float(mB.pvalues["post"]), 4),
        "n_post_months": n_post_months,
        "design": "interrupted time series (single statewide event; NOT a diff-in-diff — no within-CA control group)",
        "significant": bool(mB.pvalues["post"] < 0.05),
    }

    result = {
        "schema_version": SPEC_VERSION,
        "source_kind": "icpsr_39331_panel",  # REAL CA county-month panel
        "analysis": "ca_procedural_denial_panel",
        "scope": "CA",
        "outcome": "procedural-denial rate per application (APPS_DENIED_PROCEDURAL / APPS_RECEIVED)",
        "panel": {
            "unit": "county-month",
            "n_obs": n_obs,
            "n_counties": n_counties,
            "period": f"{d['YM'].min()}..{d['YM'].max()}",
        },
        "headline": {
            "weighted_mean_proc_rate_pct": round(wmean, 2),
            "interpretation": "~1 in 4 CA SNAP applications is procedurally denied (failed-to-complete), not denied on eligibility.",
        },
        "operational": {
            "between_county_r2": round(r2_county, 3),
            "time_r2": round(r2_time, 3),
            "spread": spread,
            "interpretation": (
                f"County fixed effects alone explain {round(r2_county * 100)}% of "
                "procedural-denial-rate variance — a substantial, PERSISTENT "
                "between-county (operational/administrative) component under identical "
                f"statewide rules — comparable to the {round(r2_time * 100)}% from time "
                "(seasonality + COVID-era shocks). So a meaningful share of procedural "
                "churn is operational (a tool can move that part), though NOT the majority "
                "— time/period explains an equal share."
            ),
        },
        "ea_cliff": ea,
        "notes": [
            "Volume-weighted by APPS_RECEIVED so tiny rural counties (e.g. Alpine, ~0 apps) don't dominate; spread reported p10–p90 among counties with median monthly apps >= %d." % MIN_MEDIAN_APPS,
            "Model B is an INTERRUPTED TIME SERIES, not a diff-in-diff: CA's EA cliff is a single statewide date (no within-CA control). Interpret cautiously.",
            "Procedural-denial rate is the APPLICATION-side churn proxy in this panel; it is not the dollar PER nor the recert/SAR-7 churn (CF-18).",
        ],
    }

    out = a.out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)
    prov = {
        "source": "ICPSR 39331 (Pukelis) DS0002 CA county-month + ICPSR 39703 EA_PEXD",
        "input_basename": os.path.basename(a.data),
        "generated_at": a.generated_at,
        "spec_version": SPEC_VERSION,
        "outcome": "APPS_DENIED_PROCEDURAL / APPS_RECEIVED",
        "weight": "APPS_RECEIVED",
        "model_a": "WLS variance shares (C(COUNTY) vs C(YM)) + volume-weighted county-mean spread",
        "model_b": "WLS proc_rate ~ post + trend + C(COUNTY) + C(month), cluster-robust by county; cliff=2023m3",
        "cliff_source": "ICPSR 39703 EA_PEXD (CA) = 2023-02-28",
    }
    with open(out.replace(".json", ".provenance.json"), "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2, ensure_ascii=False)

    # ── validation print ──
    print(f"wrote {out}")
    print(f"panel: {n_obs} county-months, {n_counties} counties, {result['panel']['period']}")
    print(f"weighted mean procedural-denial rate = {wmean:.1f}% of applications")
    print(f"between-county R2 = {r2_county:.2f}  |  time R2 = {r2_time:.2f}  (operational dominates if county >> time)")
    print(f"operational spread (adequate counties, n={spread['n_counties_adequate']}): "
          f"p10={spread['p10_pct']}%  median={spread['median_pct']}%  p90={spread['p90_pct']}%  "
          f"(max {spread['max_county']} {spread['max_pct']}%)")
    print(f"EA-cliff (ITS) post coef = {ea['post_coef_pp']:+.2f}pp "
          f"[{ea['ci_low_pp']}, {ea['ci_high_pp']}] p={ea['p_value']} (n_post_months={n_post_months})")


if __name__ == "__main__":
    main()
