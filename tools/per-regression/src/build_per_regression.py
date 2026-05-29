#!/usr/bin/env python3
"""Pre-registered PER regression harness.

WHAT THIS IS
------------
Civica's pitch makes a causal promise: enrolling through Civica's bridge
*lowers the SNAP payment error rate* (and speeds decisions, lifts handoff
completion + recertification success, raises navigator throughput). A
promise like that is only credible if the way we will measure it is locked
*before* the outcome data arrives — otherwise it is unfalsifiable
p-hacking. This script is that lock.

It does two things:

  1. Defines the PRE-REGISTERED analysis plan (`SPEC` below): the dependent
     variables, the treatment, the controls, the model family per DV, and
     the hypothesized sign of the treatment effect. This is frozen on the
     date in PREREG_LOCKED_AT and mirrored 1:1 by the TypeScript spec in
     apps/dashboard/lib/analytics/per-regression.ts. The dashboard renders
     the plan next to the results so a reader sees we committed first.

  2. Runs that exact plan against a dataset and emits a coefficient table
     (estimate, robust SE, test statistic, p-value, 95% CI, n, R²/pseudo-R²)
     as a JSON artifact the /findings/regression panel reads.

Until the FOIA'd CDSS case-level QC data lands, the dataset is a
FOIA-SHAPED SYNTHETIC population generated here with KNOWN, PLANTED
treatment effects and realistic confounding (Civica serves harder cases —
more non-English, more partner-CBO intake — so the *raw* gap understates
the true effect and the regression has real work to do isolating it). The
artifact is watermarked "synthetic" and carries the planted ground-truth
effect alongside each estimate, so a reviewer can confirm the machinery
recovers what was planted (the harness self-test).

SWAP-IN WHEN FOIA ARRIVES
-------------------------
    python src/build_per_regression.py --data /path/to/foia_cases.csv
The CSV must carry the columns named in SPEC (see COLUMN_CONTRACT). The
output schema is identical, so the dashboard needs zero changes — only the
`source_kind` flips from "synthetic" to "foia" and the watermark drops.

Mirrors the tools/ca-snap-gap harness pattern: a self-contained venv, a
seeded build script, a JSON artifact + provenance sidecar next to it.
"""

from __future__ import annotations

import argparse
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

# ---------------------------------------------------------------------------
# Pre-registration metadata. Bump PREREG_LOCKED_AT only with a new finding
# documenting *why* the plan changed — the whole point is that it does not
# move quietly after data is in hand.
# ---------------------------------------------------------------------------

PREREG_LOCKED_AT = "2026-05-28"
SCHEMA_VERSION = "1.0.0"
PLAN_FINDING_REF = "docs/findings/2026-05-28-per-regression-preregistration.md"

# CA statewide TOTAL PER (overpayment + underpayment), FY2024, the federal
# QC figure liability is assessed on. Source mirrored from the dashboard's
# apps/dashboard/lib/analytics/per-history.ts. Used only to anchor the
# synthetic payment-error baseline at a policy-plausible level.
CA_TOTAL_PER_FY2024 = 10.98

DEFAULT_SEED = 20260528
DEFAULT_N = 800  # realistic pilot cohort, not a fake-precision mega-sample

# The treatment whose coefficient is the headline in every model.
TREATMENT_KEY = "civica_assisted"

# Shared control set (case-level). Categoricals are wrapped with C() in the
# formula so statsmodels dummy-codes them. Kept identical across all
# case-level DVs so "controls held constant" means the same thing each time.
CASE_CONTROLS = [
    "household_size",
    "earned_income_share",
    "C(primary_language)",
    "C(county)",
    "C(intake_channel)",
    "expedited",
]

# The pre-registered model spec. Each entry is one dependent variable. This
# list is the contract the TypeScript spec must match (test asserts parity).
#
#   dv_key            machine key, stable across data vintages
#   dv_label          human label for the dashboard
#   unit              what one unit of the estimate means
#   model_family      ols | logit | poisson
#   frame             "case" (one row per case) | "navigator_month"
#   hypothesized_sign negative | positive  (our directional bet, pre-data)
#   interpretation    plain-English read of the treatment coefficient
SPEC: list[dict[str, Any]] = [
    {
        "dv_key": "payment_error",
        "dv_label": "Payment error rate per case",
        "unit": "percentage points",
        "model_family": "ols",
        "frame": "case",
        "hypothesized_sign": "negative",
        "interpretation": (
            "Change in a case's payment error magnitude (pp) when enrolled "
            "via Civica, holding household, income, language, county, channel "
            "and expedited status constant."
        ),
    },
    {
        "dv_key": "time_to_decision_days",
        "dv_label": "Time to eligibility decision",
        "unit": "days",
        "model_family": "ols",
        "frame": "case",
        "hypothesized_sign": "negative",
        "interpretation": (
            "Change in days from application to decision for a Civica-"
            "assisted case, controls held constant."
        ),
    },
    {
        "dv_key": "intake_to_handoff_complete",
        "dv_label": "Intake → handoff completion",
        "unit": "log-odds",
        "model_family": "logit",
        "frame": "case",
        "hypothesized_sign": "positive",
        "interpretation": (
            "Change in the log-odds that a case reaches a complete, "
            "submission-ready handoff when Civica-assisted."
        ),
    },
    {
        "dv_key": "recert_success",
        "dv_label": "Recertification success",
        "unit": "log-odds",
        "model_family": "logit",
        "frame": "case",
        "hypothesized_sign": "positive",
        "interpretation": (
            "Change in the log-odds that a household successfully "
            "recertifies (no churn-off) when Civica-assisted."
        ),
    },
    {
        "dv_key": "apps_per_navigator_month",
        "dv_label": "Apps per navigator-month",
        "unit": "log-rate",
        "model_family": "poisson",
        "frame": "navigator_month",
        "hypothesized_sign": "positive",
        "interpretation": (
            "Change in the log of completed apps per navigator-month per "
            "unit increase in that navigator-month's Civica-assisted share."
        ),
    },
]

# Column contract a real FOIA CSV must satisfy (case frame). Documented here
# so the swap-in is mechanical.
COLUMN_CONTRACT = [
    "case_id",
    "navigator_id",
    "enrollment_month",  # 1..12 (or any stable period key)
    TREATMENT_KEY,  # 0/1
    "household_size",
    "earned_income_share",  # 0..1
    "primary_language",  # categorical
    "county",  # categorical
    "intake_channel",  # categorical
    "expedited",  # 0/1
    "payment_error",  # continuous pp
    "time_to_decision_days",  # continuous days
    "intake_to_handoff_complete",  # 0/1
    "recert_success",  # 0/1
]

# Ground-truth treatment effects planted into the synthetic generator. These
# are what an unbiased fit should recover (within CI). Echoed into the
# artifact as `true_effect` for the self-test. (Ignored when --data is real.)
PLANTED_EFFECTS = {
    "payment_error": -3.0,  # pp lower
    "time_to_decision_days": -6.5,  # days faster
    "intake_to_handoff_complete": 0.85,  # +log-odds
    "recert_success": 0.65,  # +log-odds
    "apps_per_navigator_month": 0.30,  # +log-rate per full Civica share
}

LANGUAGES = ["english", "spanish", "chinese", "vietnamese", "other"]
LANG_P = [0.55, 0.27, 0.07, 0.06, 0.05]
COUNTIES = ["los_angeles", "fresno", "san_diego", "sacramento", "other"]
COUNTY_P = [0.34, 0.10, 0.18, 0.12, 0.26]
CHANNELS = ["online", "phone", "in_person", "partner_cbo"]
CHANNEL_P = [0.42, 0.18, 0.15, 0.25]


# ---------------------------------------------------------------------------
# Synthetic data generation
# ---------------------------------------------------------------------------


def synthesize_cases(n: int, seed: int) -> pd.DataFrame:
    """FOIA-shaped synthetic case-level data with planted effects + confounding.

    Confounding by design: Civica disproportionately serves harder cases
    (non-English, partner-CBO intake, higher earned-income share). Those same
    factors independently worsen baseline outcomes. So the *unadjusted* Civica
    vs comparison gap is biased toward "no help" (or harm) on error/time, and
    the regression must net out the controls to surface the true effect. This
    is exactly the raw-vs-isolated story the dashboard tells.
    """
    rng = np.random.default_rng(seed)

    household_size = rng.integers(1, 8, size=n)  # 1..7
    earned_income_share = np.clip(rng.beta(2.2, 2.0, size=n), 0, 1)
    primary_language = rng.choice(LANGUAGES, size=n, p=LANG_P)
    county = rng.choice(COUNTIES, size=n, p=COUNTY_P)
    intake_channel = rng.choice(CHANNELS, size=n, p=CHANNEL_P)
    expedited = rng.binomial(1, 0.22, size=n)
    navigator_id = rng.integers(0, 40, size=n)  # ~40 navigators
    enrollment_month = rng.integers(1, 13, size=n)  # 1..12

    non_english = (primary_language != "english").astype(float)
    partner_cbo = (intake_channel == "partner_cbo").astype(float)

    # Treatment propensity (confounded): harder cases more likely Civica.
    logit_p = (
        -0.4
        + 0.9 * non_english
        + 1.1 * partner_cbo
        + 0.8 * (earned_income_share - 0.5)
    )
    p_treat = 1.0 / (1.0 + np.exp(-logit_p))
    civica = rng.binomial(1, p_treat).astype(float)

    # Baseline "case difficulty" drivers (independent of treatment) that
    # worsen error + slow decisions. Same drivers correlate with treatment,
    # creating the confounding the controls must absorb.
    difficulty = (
        0.9 * non_english
        + 0.7 * partner_cbo
        + 1.4 * (earned_income_share - 0.5)
        + 0.15 * (household_size - 3)
    )

    # --- payment_error (pp), OLS. Anchored near CA total PER. ---
    payment_error = (
        CA_TOTAL_PER_FY2024
        + 2.3 * difficulty
        + PLANTED_EFFECTS["payment_error"] * civica
        + rng.normal(0, 4.5, size=n)
    )
    payment_error = np.clip(payment_error, 0, None)

    # --- time_to_decision_days, OLS. ---
    time_to_decision_days = (
        30.0
        + 5.0 * difficulty
        - 4.0 * expedited
        + PLANTED_EFFECTS["time_to_decision_days"] * civica
        + rng.normal(0, 7.0, size=n)
    )
    time_to_decision_days = np.clip(time_to_decision_days, 1, None)

    # --- intake_to_handoff_complete, logit. ---
    handoff_logodds = (
        1.0
        - 0.8 * difficulty
        + PLANTED_EFFECTS["intake_to_handoff_complete"] * civica
    )
    p_handoff = 1.0 / (1.0 + np.exp(-handoff_logodds))
    intake_to_handoff_complete = rng.binomial(1, p_handoff)

    # --- recert_success, logit. ---
    recert_logodds = (
        1.2
        - 0.7 * difficulty
        + PLANTED_EFFECTS["recert_success"] * civica
    )
    p_recert = 1.0 / (1.0 + np.exp(-recert_logodds))
    recert_success = rng.binomial(1, p_recert)

    return pd.DataFrame(
        {
            "case_id": np.arange(n),
            "navigator_id": navigator_id,
            "enrollment_month": enrollment_month,
            TREATMENT_KEY: civica,
            "household_size": household_size,
            "earned_income_share": earned_income_share,
            "primary_language": primary_language,
            "county": county,
            "intake_channel": intake_channel,
            "expedited": expedited,
            "payment_error": payment_error,
            "time_to_decision_days": time_to_decision_days,
            "intake_to_handoff_complete": intake_to_handoff_complete,
            "recert_success": recert_success,
        }
    )


def navigator_month_frame(cases: pd.DataFrame) -> pd.DataFrame:
    """Aggregate the case frame to navigator-month for the Poisson throughput
    model. app_count = completed apps that navigator handled that month;
    civica_share = fraction of that navigator-month's caseload via Civica."""
    grp = cases.groupby(["navigator_id", "enrollment_month"])
    nav = grp.agg(
        app_count=("case_id", "size"),
        civica_share=(TREATMENT_KEY, "mean"),
    ).reset_index()
    return nav


def inject_navmonth_effect(nav: pd.DataFrame, seed: int) -> pd.DataFrame:
    """The case-frame counts alone don't encode a throughput lift (Civica
    raises *capacity*, not just who's in the room). Re-draw app_count from a
    Poisson whose log-mean rises with civica_share by the planted log-rate,
    plus month seasonality, so the Poisson fit has a real effect to recover."""
    rng = np.random.default_rng(seed + 7)
    month = nav["enrollment_month"].to_numpy()
    season = 0.08 * np.sin(2 * np.pi * month / 12.0)
    log_mean = (
        np.log(16.0)
        + PLANTED_EFFECTS["apps_per_navigator_month"] * nav["civica_share"].to_numpy()
        + season
    )
    nav = nav.copy()
    nav["app_count"] = rng.poisson(np.exp(log_mean))
    return nav


# ---------------------------------------------------------------------------
# Model fitting
# ---------------------------------------------------------------------------


def _treatment_row(res, n: int, pseudo_r2: float | None, r2: float | None,
                   true_effect: float | None) -> dict[str, Any]:
    """Extract the treatment coefficient row from a fitted statsmodels result."""
    est = float(res.params[TREATMENT_KEY])
    se = float(res.bse[TREATMENT_KEY])
    stat = float(res.tvalues[TREATMENT_KEY])
    p = float(res.pvalues[TREATMENT_KEY])
    ci = res.conf_int().loc[TREATMENT_KEY]
    return {
        "estimate": est,
        "std_error": se,
        "statistic": stat,
        "p_value": p,
        "ci_low": float(ci[0]),
        "ci_high": float(ci[1]),
        "n": int(n),
        "r2": None if r2 is None else float(r2),
        "pseudo_r2": None if pseudo_r2 is None else float(pseudo_r2),
        "true_effect": true_effect,
    }


def fit_case_ols(cases: pd.DataFrame, dv: str, true_effect: float | None) -> dict:
    formula = f"{dv} ~ {TREATMENT_KEY} + " + " + ".join(CASE_CONTROLS)
    res = smf.ols(formula, data=cases).fit(cov_type="HC1")
    return _treatment_row(res, n=int(res.nobs), pseudo_r2=None,
                          r2=float(res.rsquared), true_effect=true_effect)


def fit_case_logit(cases: pd.DataFrame, dv: str, true_effect: float | None) -> dict:
    formula = f"{dv} ~ {TREATMENT_KEY} + " + " + ".join(CASE_CONTROLS)
    res = smf.logit(formula, data=cases).fit(disp=0)
    return _treatment_row(res, n=int(res.nobs), pseudo_r2=float(res.prsquared),
                          r2=None, true_effect=true_effect)


def fit_navmonth_poisson(nav: pd.DataFrame, true_effect: float | None) -> dict:
    formula = "app_count ~ civica_share + C(enrollment_month)"
    res = smf.glm(formula, data=nav, family=sm.families.Poisson()).fit()
    # McFadden pseudo-R² via an intercept-only null model.
    null = smf.glm("app_count ~ 1", data=nav, family=sm.families.Poisson()).fit()
    mcfadden = 1.0 - (res.llf / null.llf)
    est = float(res.params["civica_share"])
    se = float(res.bse["civica_share"])
    stat = float(res.tvalues["civica_share"])
    p = float(res.pvalues["civica_share"])
    ci = res.conf_int().loc["civica_share"]
    return {
        "estimate": est,
        "std_error": se,
        "statistic": stat,
        "p_value": p,
        "ci_low": float(ci[0]),
        "ci_high": float(ci[1]),
        "n": int(res.nobs),
        "r2": None,
        "pseudo_r2": float(mcfadden),
        "true_effect": true_effect,
    }


def run_spec(cases: pd.DataFrame, nav: pd.DataFrame, synthetic: bool) -> list[dict]:
    """Fit every DV in SPEC and return the per-model artifact rows."""
    models: list[dict] = []
    for entry in SPEC:
        dv = entry["dv_key"]
        true_effect = PLANTED_EFFECTS.get(dv) if synthetic else None
        if entry["model_family"] == "ols":
            treatment = fit_case_ols(cases, dv, true_effect)
        elif entry["model_family"] == "logit":
            treatment = fit_case_logit(cases, dv, true_effect)
        elif entry["model_family"] == "poisson":
            treatment = fit_navmonth_poisson(nav, true_effect)
        else:  # pragma: no cover - guarded by SPEC authoring
            raise ValueError(f"unknown model_family for {dv}")

        models.append(
            {
                "dv_key": entry["dv_key"],
                "dv_label": entry["dv_label"],
                "unit": entry["unit"],
                "model_family": entry["model_family"],
                "frame": entry["frame"],
                "hypothesized_sign": entry["hypothesized_sign"],
                "interpretation": entry["interpretation"],
                "treatment_key": TREATMENT_KEY,
                "treatment": treatment,
            }
        )
    return models


# ---------------------------------------------------------------------------
# Artifact assembly + IO
# ---------------------------------------------------------------------------


def _git_sha() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except Exception:
        return None


def _pkg_versions() -> dict[str, str]:
    versions = {"python": platform.python_version()}
    for mod in (np, pd, sm):
        name = mod.__name__.split(".")[0]
        versions[name] = getattr(mod, "__version__", "unknown")
    return versions


def build_artifact(models: list[dict], *, synthetic: bool, seed: int,
                   n_cases: int, n_navmonths: int) -> dict:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    source_kind = "synthetic" if synthetic else "foia"
    watermark = (
        "SYNTHETIC — illustrative power analysis on simulated cases with "
        "planted effects, NOT real outcomes. Swap in FOIA'd CDSS QC data to "
        "make these estimates live."
        if synthetic
        else None
    )
    provenance = {
        "source_kind": source_kind,
        "generated_at": generated_at,
        "seed": seed if synthetic else None,
        "spec_version": SCHEMA_VERSION,
        "prereg_locked_at": PREREG_LOCKED_AT,
        "prereg_finding": PLAN_FINDING_REF,
        "git_sha": _git_sha(),
        "environment": _pkg_versions(),
        "treatment_key": TREATMENT_KEY,
        "baseline_anchor": {
            "ca_total_per_fy2024": CA_TOTAL_PER_FY2024,
            "source": "apps/dashboard/lib/analytics/per-history.ts",
        },
    }
    return {
        "schema_version": SCHEMA_VERSION,
        "source_kind": source_kind,
        "watermark": watermark,
        "n_cases": n_cases,
        "n_navigator_months": n_navmonths,
        "controls": [c.replace("C(", "").replace(")", "") for c in CASE_CONTROLS],
        "provenance": provenance,
        "models": models,
    }


def write_json(obj: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, sort_keys=False, ensure_ascii=False)
        fh.write("\n")


def main(argv: list[str] | None = None) -> int:
    repo_root = Path(__file__).resolve().parents[3]
    default_out = (
        repo_root / "apps" / "dashboard" / "lib" / "analytics"
        / "per-regression-results.json"
    )
    default_csv = (
        repo_root / "data-ops" / "sample" / "per-regression"
        / "per_regression_synthetic.csv"
    )

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", type=Path, default=None,
                    help="Real case-level CSV (FOIA). If omitted, synthesize.")
    ap.add_argument("--out", type=Path, default=default_out,
                    help="Results JSON the dashboard reads.")
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--n", type=int, default=DEFAULT_N,
                    help="Synthetic case count (ignored with --data).")
    ap.add_argument("--write-csv", action="store_true",
                    help="Also write the synthetic case CSV to data-ops/sample.")
    args = ap.parse_args(argv)

    synthetic = args.data is None
    if synthetic:
        cases = synthesize_cases(args.n, args.seed)
        nav = inject_navmonth_effect(navigator_month_frame(cases), args.seed)
    else:
        cases = pd.read_csv(args.data)
        missing = [c for c in COLUMN_CONTRACT if c not in cases.columns]
        if missing:
            ap.error(f"--data CSV missing required columns: {missing}")
        nav = navigator_month_frame(cases)
        # Real data carries its own throughput counts; only re-draw for synth.

    models = run_spec(cases, nav, synthetic=synthetic)
    artifact = build_artifact(
        models, synthetic=synthetic, seed=args.seed,
        n_cases=int(len(cases)), n_navmonths=int(len(nav)),
    )

    write_json(artifact, args.out)
    # Provenance sidecar (superset of the embedded block + audit extras).
    sidecar = args.out.with_suffix(".provenance.json")
    write_json(
        {
            **artifact["provenance"],
            "argv": sys.argv,
            "out": str(args.out),
            "n_cases": artifact["n_cases"],
            "n_navigator_months": artifact["n_navigator_months"],
            "planted_effects": PLANTED_EFFECTS if synthetic else None,
        },
        sidecar,
    )

    if synthetic and args.write_csv:
        out_csv = default_csv
        out_csv.parent.mkdir(parents=True, exist_ok=True)
        cases.to_csv(out_csv, index=False)
        print(f"  synthetic CSV -> {out_csv}")

    print(f"Wrote {args.out}")
    print(f"Wrote {sidecar}")
    print(f"  source_kind={artifact['source_kind']} "
          f"n_cases={artifact['n_cases']} "
          f"n_navmonths={artifact['n_navigator_months']}")
    for m in models:
        t = m["treatment"]
        flag = ""
        if t["true_effect"] is not None:
            covered = t["ci_low"] <= t["true_effect"] <= t["ci_high"]
            flag = f"  [planted {t['true_effect']:+.2f} {'OK' if covered else 'MISS'}]"
        print(f"  {m['dv_key']:<28} b={t['estimate']:+.3f} "
              f"se={t['std_error']:.3f} p={t['p_value']:.2e}{flag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
