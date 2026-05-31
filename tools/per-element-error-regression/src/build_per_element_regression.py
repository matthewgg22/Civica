#!/usr/bin/env python3
"""
Per-element SNAP-QC error regression — what household characteristics predict an
error in EACH specific element of the eligibility determination, on the real
USDA QC FY2023 California microdata.

This is the per-subset complement to the (synthetic, treatment-effect) pre-reg
PER regression: instead of ONE aggregate payment-error DV, it fits an INDIVIDUAL
model per error element (shelter, wages, RSDI, SSI, …) on real federal data —
answering "where, and for whom, are errors predictable?" element by element.

DV per element E: the case cites element E in any variance (ELEMENT1..9 == code) —
the SAME case-count basis the engine's element-attribution shares use
(tools/usda-qc-ingest/src/ca_aggregates.py). NOTE: this is QC VARIANCE-CITATION,
not the dollar-weighted PER; ~43% of CA cases cite some variance vs the ~11% PER.
Labeled accordingly — no claim that these are PER rates.

Predictors (pre-registered, household characteristics):
  household_size      CERTHHSZ (certified household size)
  has_earned_income   sum(WAGES1..16) > 0
  has_elderly         any AGE1..16 >= 60
  has_child           any AGE1..16 in [0, 17]

Model: unweighted logistic (statsmodels Logit), HC1 robust SEs (matches the
pre-reg harness convention). Unweighted = honest inference on the n=867 CA sample
(the QC public-use file carries no replicate weights / strata for design-based
SEs); FYWGT is used ONLY for the descriptive weighted prevalence reported
alongside each model. n + n_events reported per element; elements with
n_events < MIN_EVENTS are flagged underpowered (reported, not hidden).

Source (public-use, free): https://snapqcdata.net/datafiles (FY2023 CSV).
Run:
  .venv/bin/python src/build_per_element_regression.py \
    --data ~/Downloads/qc_pub_fy2023.csv \
    --out ../../apps/dashboard/lib/analytics/per-element-error-results.json \
    --generated-at <ISO>
"""
from __future__ import annotations

import argparse
import json
import os
import sys

SPEC_VERSION = "1.0.0"
MIN_EVENTS = 30  # below this, a per-element model is flagged underpowered

# Major elements (engine CA_ELEMENT_ATTRIBUTION_FY23 codes + labels).
ELEMENTS = {
    363: "Shelter deduction",
    311: "Wages",
    331: "RSDI",
    333: "SSI",
    346: "Other unearned income",
    312: "Self-employment",
    364: "Standard utility allowance",
}
PREDICTORS = ["household_size", "has_earned_income", "has_elderly", "has_child"]


def build_features(ca, df_cols):
    import numpy as np  # noqa: PLC0415
    import pandas as pd  # noqa: PLC0415

    age_cols = [c for c in df_cols if c.startswith("AGE") and c[3:].isdigit()]
    wage_cols = [c for c in df_cols if c.startswith("WAGES") and c[5:].isdigit()]
    ages = ca[age_cols]
    wages = ca[wage_cols]

    feats = pd.DataFrame(index=ca.index)
    feats["household_size"] = ca["CERTHHSZ"].astype(float)
    feats["has_earned_income"] = (wages.fillna(0).sum(axis=1) > 0).astype(int)
    feats["has_elderly"] = (ages.max(axis=1) >= 60).astype(int)
    # any household member aged 0..17 (ages are per-person; NaN = absent member)
    feats["has_child"] = ((ages >= 0) & (ages <= 17)).any(axis=1).astype(int)
    return feats


def fit_logit(y, X):
    """Unweighted logistic, HC1 robust SEs. Returns a result dict or a skip reason."""
    import numpy as np  # noqa: PLC0415
    import statsmodels.api as sm  # noqa: PLC0415

    Xc = sm.add_constant(X, has_constant="add")
    try:
        # HC1 robust SEs requested at fit time (the supported path).
        res = sm.Logit(y, Xc).fit(cov_type="HC1", disp=0, maxiter=200)
    except Exception as e:  # perfect separation / singular / non-convergence
        return {"converged": False, "reason": type(e).__name__ + ": " + str(e)[:120]}

    if not res.mle_retvals.get("converged", True):
        return {"converged": False, "reason": "MLE did not converge (likely separation)"}

    params, ci, pvals = res.params, res.conf_int(), res.pvalues
    terms = []
    for name in Xc.columns:
        if name == "const":
            continue
        coef = float(params[name])
        terms.append({
            "name": name,
            "coef": round(coef, 4),
            "odds_ratio": round(float(np.exp(coef)), 3),
            "or_ci_low": round(float(np.exp(ci.loc[name, 0])), 3),
            "or_ci_high": round(float(np.exp(ci.loc[name, 1])), 3),
            "p_value": round(float(pvals[name]), 4),
        })
    return {
        "converged": True,
        "pseudo_r2": round(float(res.prsquared), 4),
        "terms": terms,
    }


def main(argv=None) -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--out", default="apps/dashboard/lib/analytics/per-element-error-results.json")
    p.add_argument("--fiscal-year", type=int, default=2023)
    p.add_argument("--generated-at", default="unset")
    a = p.parse_args(argv)

    import pandas as pd  # noqa: PLC0415

    df = pd.read_csv(a.data, low_memory=False)
    if "STATE" not in df.columns:
        sys.exit("STATE column missing — wrong file?")
    ca = df[df["STATE"] == 6].copy()
    n = int(len(ca))
    w = "FYWGT"
    ecols = [c for c in df.columns if c.startswith("ELEMENT") and c[7:].isdigit()]

    feats = build_features(ca, df.columns)
    # Drop rows with a missing predictor (household_size always present; guards NaN)
    valid = feats.dropna()
    feats = feats.loc[valid.index]
    ca = ca.loc[valid.index]
    n_model = int(len(feats))

    any_error = ca[ecols].notna().any(axis=1)
    tot_err_w = float(ca.loc[any_error, w].sum())

    models = []
    # Overall any-error model first, then per element.
    dvs = [("any_error", "Any cited variance", None)] + [
        (f"element_{code}", label, code) for code, label in ELEMENTS.items()
    ]
    for dv_key, label, code in dvs:
        if code is None:
            y = any_error.astype(int)
        else:
            y = (ca[ecols] == code).any(axis=1).astype(int)
        n_events = int(y.sum())
        # weighted prevalence (FYWGT) for context — population-generalizing share
        wprev = round(float(ca.loc[y == 1, w].sum()) / float(ca[w].sum()) * 100, 2)
        # weighted share-of-errored (matches engine element-attribution denominator)
        wshare = (round(float(ca.loc[(y == 1) & any_error, w].sum()) / tot_err_w * 100, 2)
                  if code is not None and tot_err_w else None)
        entry = {
            "dv_key": dv_key,
            "element_code": code,
            "label": label,
            "n": n_model,
            "n_events": n_events,
            "sample_prevalence_pct": round(n_events / n_model * 100, 2),
            "weighted_prevalence_pct": wprev,
            "weighted_share_of_errored_pct": wshare,
            "underpowered": n_events < MIN_EVENTS,
        }
        fit = fit_logit(y.values, feats[PREDICTORS])
        entry.update(fit)
        # Flag quasi-separation: a predictor mechanically tied to the element
        # (e.g. wages↔has_earned_income) blows the OR up — report, don't trust.
        if fit.get("converged"):
            ors = [t["odds_ratio"] for t in fit["terms"]]
            entry["quasi_separation"] = any(o > 50 or o < 0.02 for o in ors)
        models.append(entry)

    result = {
        "schema_version": "1.0.0",
        "source_kind": "qc_microdata",  # REAL federal microdata (not synthetic)
        "analysis": "per_element_error_logistic",
        "scope": "CA",
        "fiscal_year": a.fiscal_year,
        "n_cases": n,
        "n_modeled": n_model,
        "predictors": PREDICTORS,
        "model_family": "logistic (statsmodels Logit), unweighted, HC1 robust SEs",
        "dv_basis": "case cites the element in any variance (ELEMENT1..9) — QC variance-citation, NOT the dollar PER",
        "min_events_for_power": MIN_EVENTS,
        "models": models,
        "notes": [
            "DV = QC variance-citation per element (engine element-attribution basis), NOT the dollar-weighted PER (~11%); ~43% of CA cases cite some variance.",
            "Unweighted logistic → honest inference on the n CA sample; FYWGT used only for the descriptive weighted prevalence/share. Design-based SEs need replicate weights/strata absent from the public-use file.",
            "Elements with n_events < %d are flagged underpowered — reported with wide CIs, never hidden." % MIN_EVENTS,
        ],
    }

    out = a.out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)

    prov = {
        "source": "USDA SNAP QC Public-Use File — snapqcdata.net (qcfy2023_csv.zip)",
        "fiscal_year": a.fiscal_year,
        "input_basename": os.path.basename(a.data),
        "generated_at": a.generated_at,
        "spec_version": SPEC_VERSION,
        "scope": "CA (STATE==6)",
        "weight_for_prevalence": w,
        "element_codes": {str(k): v for k, v in ELEMENTS.items()},
        "predictors": PREDICTORS,
        "model": "statsmodels Logit, unweighted, HC1 robust covariance",
        "codebook": "FY2023 Tech Doc Ch. V (ELEMENT1..9 element-of-error; AGE/WAGES/CERTHHSZ household chars)",
    }
    prov_out = out.replace(".json", ".provenance.json")
    with open(prov_out, "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2, ensure_ascii=False)

    # ---- validation print ----
    print(f"wrote {out}")
    print(f"CA cases={n}  modeled={n_model}  any-error events={int(any_error.sum())}")
    print(f"{'DV':26s} {'n_ev':>5s} {'samp%':>6s} {'wt%':>6s}  top term (OR, p)")
    for m in models:
        top = ""
        if m.get("converged") and m.get("terms"):
            t = max(m["terms"], key=lambda x: abs(x["coef"]))
            flag = " [UNDERPOWERED]" if m["underpowered"] else ""
            top = f"{t['name']} OR={t['odds_ratio']} p={t['p_value']}{flag}"
        elif not m.get("converged"):
            top = "DID NOT CONVERGE: " + m.get("reason", "")
        print(f"{m['dv_key']:26s} {m['n_events']:5d} {m['sample_prevalence_pct']:6.1f} "
              f"{m['weighted_prevalence_pct']:6.1f}  {top}")


if __name__ == "__main__":
    main()
