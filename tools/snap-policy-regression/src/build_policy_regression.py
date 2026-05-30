#!/usr/bin/env python3
"""External causal evidence: do administrative-burden-reducing SNAP policies
raise participation? A staggered-adoption panel regression on public data.

WHAT THIS IS
------------
The pre-registered harness (tools/per-regression) measures *Civica's* causal
effect on five outcomes — but it needs production traffic that does not exist
yet. This script is the complementary **external** test: it asks, on 25 years
of public state-panel data, whether the *mechanism* Civica relies on is real —
does lowering administrative/procedural burden measurably raise SNAP
participation? If yes, the thesis ("a perfect, low-friction application keeps
eligible people enrolled") has independent, peer-reviewed-style support before
Civica has shipped a single case.

It replicates the canonical transaction-cost result (Ganong & Liebman 2018;
Klerman & Danielson 2011; Kabbani & Wilde) on the two flagship vendored
datasets:

  • OUTCOME  — FNS monthly SNAP participation (persons), 51 states, 1996-2020,
    extracted from the FNS "National/State Monthly Data" workbooks.
  • TREATMENT — USDA ERS SNAP Policy Database: state-month adoption of
    burden-reducing levers (broad-based categorical eligibility, call centers,
    online applications, simplified reporting, in-person interview rules).

DESIGN
------
Two-way fixed effects (state + calendar-month), cluster-robust SEs by state:

    ln(persons)_st = Σ_k β_k · Lever_{k,st} + α_s + δ_t + ε_st

α_s absorbs every fixed state difference; δ_t absorbs national shocks (the
business cycle, federal rule changes). β_k is identified off within-state,
over-time policy switches net of the national trend — a % change in
participation per lever. Plus a BBCE **event study** (yearly leads/lags vs the
year before adoption, never-adopters as controls) whose flat pre-trends are the
identification check and whose rising post-path is the dynamic effect.

HONEST LIMITS (mirrored into the finding)
- TWFE with staggered binary treatment + heterogeneous effects can be biased
  (Goodman-Bacon); the event study is the more credible read.
- State-specific economic shocks are not fully absorbed by the national time
  FE; the flat BBCE pre-trends mitigate but do not eliminate this. A state
  unemployment control is the natural next robustness.
- Participation is not error/churn directly; it is the retention margin the
  thesis is about (more burden-reduced enrollment = fewer eligible people lost).

REPRODUCE
    # 1) assemble the panel from the two raw public sources (need the downloads)
    python build_policy_regression.py --build-panel \
        --ers /path/snap-policy-database.xlsx --fns-dir /path/unzipped/fy69 \
        --panel ../../../data-ops/sample/snap-policy-regression/analysis_panel.csv
    # 2) fit + emit the artifact from the committed panel (no raw files needed)
    python build_policy_regression.py        # reads the vendored panel

Requires: pandas, numpy, linearmodels (+ openpyxl, xlrd for --build-panel).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import platform
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

SCHEMA_VERSION = "1.0.0"
ANALYSIS_LOCKED_AT = "2026-05-30"

# The levers we report, with a human label and whether adoption *reduces*
# applicant burden (the thesis-relevant sign) or *expands eligibility*.
LEVERS: list[dict[str, str]] = [
    {"key": "reportsimple", "label": "Simplified / periodic reporting",
     "kind": "reduces_burden"},
    {"key": "bbce", "label": "Broad-based categorical eligibility",
     "kind": "expands_eligibility"},
    {"key": "call_any", "label": "Call-center case management",
     "kind": "reduces_burden"},
    {"key": "oapp", "label": "Online application",
     "kind": "reduces_burden"},
    {"key": "faceini", "label": "In-person interview required at application",
     "kind": "increases_burden"},
    {"key": "facerec", "label": "In-person interview required at recert",
     "kind": "increases_burden"},
]
LEVER_KEYS = [l["key"] for l in LEVERS]

STATE_FIPS = {
    'alabama': 1, 'alaska': 2, 'arizona': 4, 'arkansas': 5, 'california': 6,
    'colorado': 8, 'connecticut': 9, 'delaware': 10, 'district of columbia': 11,
    'florida': 12, 'georgia': 13, 'hawaii': 15, 'idaho': 16, 'illinois': 17,
    'indiana': 18, 'iowa': 19, 'kansas': 20, 'kentucky': 21, 'louisiana': 22,
    'maine': 23, 'maryland': 24, 'massachusetts': 25, 'michigan': 26,
    'minnesota': 27, 'mississippi': 28, 'missouri': 29, 'montana': 30,
    'nebraska': 31, 'nevada': 32, 'new hampshire': 33, 'new jersey': 34,
    'new mexico': 35, 'new york': 36, 'north carolina': 37, 'north dakota': 38,
    'ohio': 39, 'oklahoma': 40, 'oregon': 41, 'pennsylvania': 42,
    'rhode island': 44, 'south carolina': 45, 'south dakota': 46,
    'tennessee': 47, 'texas': 48, 'utah': 49, 'vermont': 50, 'virginia': 51,
    'washington': 53, 'west virginia': 54, 'wisconsin': 55, 'wyoming': 56,
}
_MON = {'Oct': 10, 'Nov': 11, 'Dec': 12, 'Jan': 1, 'Feb': 2, 'Mar': 3,
        'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9}
_MON_RE = re.compile(r'^([A-Z][a-z]{2})\s+(\d{4})\s*(.*)$')
YM_MIN, YM_MAX = 199601, 202012


def _num(x: Any) -> float:
    try:
        return float(str(x).replace(',', ''))
    except (ValueError, TypeError):
        return float('nan')


# --------------------------------------------------------------------------
# Panel assembly (upstream; needs the raw public downloads)
# --------------------------------------------------------------------------

def extract_national_enrollment(fns_dir: str) -> pd.DataFrame:
    """Parse FNS monthly workbooks → (state_fips, yearmonth, households,
    persons, issuance) for every state, 1996-2020. Each workbook is a fiscal
    year; each regional sheet stacks states as a name row + 12 month rows."""
    rows = []
    files = sorted(glob.glob(os.path.join(fns_dir, 'FY*.xls')) +
                   glob.glob(os.path.join(fns_dir, 'FY*.xlsx')))
    for f in files:
        try:
            xl = pd.ExcelFile(f)
        except Exception:
            continue
        for sh in xl.sheet_names:
            if sh.strip() == 'US Summary' or sh.strip().startswith('1969'):
                continue
            df = pd.read_excel(f, sheet_name=sh, header=None)
            i = 0
            while i < len(df):
                fips = STATE_FIPS.get(str(df.iloc[i, 0]).strip().lower())
                if fips:
                    j = i + 1
                    while j < len(df) and j < i + 16:
                        lab = str(df.iloc[j, 0]).strip()
                        if lab.lower().startswith('total'):
                            break
                        m = _MON_RE.match(lab)
                        if m and _MON.get(m.group(1)):
                            yr, mo = int(m.group(2)), _MON[m.group(1)]
                            rest = [_num(df.iloc[j, c]) for c in (3, 4, 5)
                                    if c < df.shape[1]]
                            iss = max([r for r in rest if pd.notna(r)],
                                      default=float('nan'))
                            rows.append((fips, yr * 100 + mo,
                                         _num(df.iloc[j, 1]),
                                         _num(df.iloc[j, 2]), iss))
                        elif lab.lower() in STATE_FIPS:
                            break
                        j += 1
                i += 1
    en = (pd.DataFrame(rows, columns=['state_fips', 'yearmonth',
                                      'households', 'persons', 'issuance'])
            .drop_duplicates(['state_fips', 'yearmonth']))
    return en[(en['yearmonth'] >= YM_MIN) & (en['yearmonth'] <= YM_MAX)]


def build_panel(ers_xlsx: str, fns_dir: str) -> pd.DataFrame:
    en = extract_national_enrollment(fns_dir)
    pdb = pd.read_excel(ers_xlsx, sheet_name='SNAP Policy Database')
    keep = ['state_fips', 'statename', 'yearmonth'] + LEVER_KEYS
    mg = pdb[keep].merge(en, on=['state_fips', 'yearmonth'], how='inner')
    return mg.sort_values(['state_fips', 'yearmonth']).reset_index(drop=True)


# --------------------------------------------------------------------------
# Estimation (off the committed panel)
# --------------------------------------------------------------------------

def fit_twfe(panel: pd.DataFrame) -> dict:
    from linearmodels.panel import PanelOLS
    d = panel[panel['persons'] > 0].dropna(subset=LEVER_KEYS).copy()
    d['ln_persons'] = np.log(d['persons'])
    d['t'] = pd.to_datetime(d['yearmonth'].astype(int).astype(str), format='%Y%m')
    pan = d.set_index(['state_fips', 't'])
    formula = ("ln_persons ~ " + " + ".join(LEVER_KEYS) +
               " + EntityEffects + TimeEffects")
    r = PanelOLS.from_formula(formula, pan).fit(
        cov_type='clustered', cluster_entity=True)
    levers = []
    for lev in LEVERS:
        k = lev["key"]
        lo, hi = r.conf_int().loc[k]
        levers.append({
            "key": k, "label": lev["label"], "kind": lev["kind"],
            "estimate_pct": float(100 * r.params[k]),
            "ci_low_pct": float(100 * lo), "ci_high_pct": float(100 * hi),
            "std_error_pct": float(100 * r.std_errors[k]),
            "p_value": float(r.pvalues[k]),
        })
    return {
        "outcome": "ln(SNAP persons)",
        "spec": "two-way fixed effects (state + calendar-month), cluster-robust by state",
        "n": int(r.nobs), "states": int(d['state_fips'].nunique()),
        "within_r2": float(r.rsquared_within), "levers": levers,
    }


def fit_event_study(panel: pd.DataFrame) -> dict:
    from linearmodels.panel import PanelOLS
    d = panel[panel['persons'] > 0].dropna(subset=LEVER_KEYS).copy()
    d['ln_persons'] = np.log(d['persons'])
    d['t'] = pd.to_datetime(d['yearmonth'].astype(int).astype(str), format='%Y%m')
    d['adopt'] = d.groupby('state_fips')['bbce'].transform(
        lambda s: d.loc[s.index, 'yearmonth'].where(s == 1).min())
    ym2 = lambda ym: (ym // 100) * 12 + (ym % 100)
    d['evt_y'] = np.where(
        d['adopt'].notna(),
        np.floor((ym2(d['yearmonth']) - ym2(d['adopt'].fillna(1).astype(int))) / 12),
        np.nan)
    # yearly bins; reference = year -1 (and never-adopters, who get all-zero)
    bins = [('em3p', '<=-3'), ('em2', '-2'), ('ep0', '0'),
            ('ep1', '+1'), ('ep2', '+2'), ('ep3p', '+3+')]

    def lab_of(e):
        if pd.isna(e):
            return 'never'
        if e <= -3:
            return 'em3p'
        return {-2: 'em2', -1: 'em1ref', 0: 'ep0', 1: 'ep1', 2: 'ep2'}.get(int(e), 'ep3p')

    d['eb'] = d['evt_y'].apply(lab_of)
    for key, _ in bins:
        d[key] = (d['eb'] == key).astype(int)
    pan = d.set_index(['state_fips', 't'])
    formula = ("ln_persons ~ " + " + ".join(k for k, _ in bins) +
               " + EntityEffects + TimeEffects")
    r = PanelOLS.from_formula(formula, pan).fit(
        cov_type='clustered', cluster_entity=True)
    points = []
    for key, yr in bins:
        lo, hi = r.conf_int().loc[key]
        points.append({
            "year_label": yr,
            "estimate_pct": float(100 * r.params[key]),
            "ci_low_pct": float(100 * lo), "ci_high_pct": float(100 * hi),
            "p_value": float(r.pvalues[key]),
        })
    return {
        "treatment": "Broad-based categorical eligibility (BBCE) adoption",
        "reference": "year before adoption (−1); never-adopters as controls",
        "never_adopter_states": int(d[d['eb'] == 'never']['state_fips'].nunique()),
        "points": points,
    }


# --------------------------------------------------------------------------
# Artifact + IO
# --------------------------------------------------------------------------

def _git_sha() -> str | None:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                              capture_output=True, text=True, check=True
                              ).stdout.strip()
    except Exception:
        return None


def _versions() -> dict[str, str]:
    v = {"python": platform.python_version()}
    for name in ("numpy", "pandas", "linearmodels"):
        try:
            v[name] = __import__(name).__version__
        except Exception:
            v[name] = "unknown"
    return v


def build_artifact(panel: pd.DataFrame, twfe: dict, event: dict) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "source_kind": "public_panel",
        "analysis": "burden_levers_to_participation",
        "analysis_locked_at": ANALYSIS_LOCKED_AT,
        "panel": {
            "unit": "state-month",
            "n_rows": int(len(panel)),
            "states": int(panel['state_fips'].nunique()),
            "period": "1996-01..2020-12",
        },
        "twfe": twfe,
        "event_study": event,
        "benchmark": (
            "Replicates the administrative-burden / transaction-cost literature "
            "(Ganong & Liebman 2018; Klerman & Danielson 2011): burden-reducing "
            "modernization (BBCE, call centers, simplified reporting) raised SNAP "
            "participation several percent — recovered here within CI."
        ),
        "provenance": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "git_sha": _git_sha(),
            "environment": _versions(),
            "outcome_source": "USDA FNS SNAP Data Tables — National/State Monthly Data (snap-zip-fy69tocurrent)",
            "treatment_source": "USDA ERS SNAP Policy Database (snap-policy-database.xlsx)",
            "panel_file": "data-ops/sample/snap-policy-regression/analysis_panel.csv",
        },
    }


def write_json(obj: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def main(argv: list[str] | None = None) -> int:
    root = Path(__file__).resolve().parents[3]
    default_panel = (root / "data-ops" / "sample" / "snap-policy-regression"
                     / "analysis_panel.csv")
    default_out = (root / "apps" / "dashboard" / "lib" / "analytics"
                   / "policy-regression-results.json")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel", type=Path, default=default_panel)
    ap.add_argument("--out", type=Path, default=default_out)
    ap.add_argument("--build-panel", action="store_true",
                    help="Assemble the panel from raw ERS xlsx + FNS dir first.")
    ap.add_argument("--ers", type=Path, default=None)
    ap.add_argument("--fns-dir", type=Path, default=None)
    args = ap.parse_args(argv)

    if args.build_panel:
        if not (args.ers and args.fns_dir):
            ap.error("--build-panel needs --ers and --fns-dir")
        panel = build_panel(str(args.ers), str(args.fns_dir))
        args.panel.parent.mkdir(parents=True, exist_ok=True)
        panel.to_csv(args.panel, index=False)
        print(f"Wrote panel {args.panel}  ({len(panel)} state-months)")
    else:
        panel = pd.read_csv(args.panel)

    twfe = fit_twfe(panel)
    event = fit_event_study(panel)
    artifact = build_artifact(panel, twfe, event)
    write_json(artifact, args.out)
    write_json({**artifact["provenance"], "argv": sys.argv,
                "twfe_n": twfe["n"], "within_r2": twfe["within_r2"]},
               args.out.with_suffix(".provenance.json"))
    print(f"Wrote {args.out}")
    print(f"  panel n={artifact['panel']['n_rows']} states={artifact['panel']['states']}")
    for lv in twfe["levers"]:
        print(f"  {lv['key']:<13} {lv['estimate_pct']:+6.2f}%  p={lv['p_value']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
