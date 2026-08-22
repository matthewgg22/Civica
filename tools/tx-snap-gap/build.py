#!/usr/bin/env python3
"""Build TX SNAP-Gap per-PUMA + per-county estimates from 2023 ACS 1-Year PUMS.

TODO-61 first state. Mirrors the MA fact-base methodology
(tools/ma-snap-gap/build.py) — weighted counts of households eligible by
gross income (130% FPL, 7 CFR 273.9(a)(1)) that do not report SNAP receipt —
plus the county allocation the CRA artifact generator consumes.

Differences from MA build, both deliberate:
  * County allocation is FRACTIONAL (tract-count share of each PUMA per
    county, from the national 2020 tract→PUMA crosswalk), matching the CA
    county_metrics approach — not dominant-county assignment. TX has 254
    counties and many multi-county rural PUMAs; dominant-county would zero
    out small counties.
  * Emits tx_county_metrics.csv in the exact schema the CRA generator's
    score.py consumes (County, eligible_pop, non_enroll_rate), where
    eligible_pop is PERSON-weighted (WGTP × NP), consistent with the CA
    county_metrics person-grain.

Texas note: TX has NO BBCE — the 130% gross test (plus assets) is the real
eligibility boundary, so unlike CA/MA the federal-baseline figure IS the
Texas figure. A 165%/200% sensitivity column is still emitted for context.

Outputs to data-ops/sample/tx-snap-gap/:
  - tx_snap_gap_puma.csv
  - tx_county_metrics.csv   (CRA-generator-compatible)
  - tx_snap_gap_summary.json
  - model_card.json
"""
from __future__ import annotations

import json
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
OUT_DIR = REPO / "data-ops" / "sample" / "tx-snap-gap"
DATA_ZIP = ROOT / "data" / "csv_htx.zip"
CROSSWALK = REPO / "data-ops" / "reference" / "2020_tract_to_puma.txt"
STATE_FP = "48"

# 2023 HHS Poverty Guidelines, 48 contiguous states + DC.
# Source: https://aspe.hhs.gov/2023-poverty-guidelines
FPL_2023_ANNUAL = {
    1: 14_580, 2: 19_720, 3: 24_860, 4: 30_000,
    5: 35_140, 6: 40_280, 7: 45_420, 8: 50_560,
}
FPL_EXTRA_PERSON = 5_140

# FIPS county code -> county name for Texas (254 counties), built from the
# Census 2020 county gazetteer names. Only counties appearing in the
# crosswalk are needed; names verified against FIPS 48xxx list.
TX_COUNTY_NAMES_PATH = ROOT / "data" / "tx_county_fips.json"


def fpl_for_size(n: int) -> float:
    if n <= 8:
        return FPL_2023_ANNUAL[max(1, n)]
    return FPL_2023_ANNUAL[8] + FPL_EXTRA_PERSON * (n - 8)


def load_households() -> pd.DataFrame:
    with zipfile.ZipFile(DATA_ZIP) as z:
        member = next(n for n in z.namelist() if n.endswith(".csv"))
        with z.open(member) as f:
            df = pd.read_csv(
                f,
                usecols=["PUMA", "ADJINC", "WGTP", "NP", "FS", "TYPEHUGQ", "HINCP"],
                dtype={"PUMA": str},
            )
    # Occupied non-group-quarters households with real weight + reported income
    df = df[(df["TYPEHUGQ"] == 1) & (df["WGTP"] > 0)]
    df = df.dropna(subset=["HINCP", "NP"])
    df["hinc_2023"] = df["HINCP"] * df["ADJINC"] / 1_000_000
    df["fpl"] = df["NP"].astype(int).map(fpl_for_size)
    df["income_to_fpl"] = df["hinc_2023"] / df["fpl"]
    return df


def puma_county_shares() -> dict[str, dict[str, float]]:
    """PUMA -> {county_fips: tract-count share} for TX from the national crosswalk."""
    cw = pd.read_csv(CROSSWALK, dtype=str, encoding="utf-8-sig")
    cw = cw[cw["STATEFP"] == STATE_FP]
    shares: dict[str, dict[str, float]] = {}
    for puma, grp in cw.groupby("PUMA5CE"):
        counts = grp["COUNTYFP"].value_counts()
        total = counts.sum()
        shares[puma] = {c: n / total for c, n in counts.items()}
    return shares


def build() -> None:
    df = load_households()
    n_hh_sample = len(df)

    elig = df[df["income_to_fpl"] <= 1.30].copy()
    elig_200 = df[df["income_to_fpl"] <= 2.00]

    def agg(frame: pd.DataFrame) -> pd.DataFrame:
        g = frame.groupby("PUMA")
        out = pd.DataFrame({
            "eligible_hh": g["WGTP"].sum(),
            "eligible_persons": g.apply(lambda x: (x["WGTP"] * x["NP"]).sum()),
            "snap_hh": g.apply(lambda x: x.loc[x["FS"] == 1, "WGTP"].sum()),
            "no_snap_hh": g.apply(lambda x: x.loc[x["FS"] == 2, "WGTP"].sum()),
            "no_snap_persons": g.apply(
                lambda x: (x.loc[x["FS"] == 2, "WGTP"] * x.loc[x["FS"] == 2, "NP"]).sum()),
            "n_sample": g.size(),
        })
        reported = out["snap_hh"] + out["no_snap_hh"]
        out["non_enroll_rate"] = out["no_snap_hh"] / reported
        return out

    puma = agg(elig)
    puma200 = agg(elig_200)[["eligible_hh", "no_snap_hh", "non_enroll_rate"]]
    puma200.columns = ["eligible_hh_200fpl", "no_snap_hh_200fpl", "non_enroll_rate_200fpl"]
    puma = puma.join(puma200)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    puma.reset_index().to_csv(OUT_DIR / "tx_snap_gap_puma.csv", index=False)

    # ---- county allocation (fractional, tract-count weighted) ----
    shares = puma_county_shares()
    names = json.loads(TX_COUNTY_NAMES_PATH.read_text())
    county = defaultdict(lambda: {"eligible_pop": 0.0, "unenrolled_pop": 0.0,
                                  "eligible_hh": 0.0, "no_snap_hh": 0.0})
    missing_pumas = []
    for p, row in puma.iterrows():
        sh = shares.get(str(p).zfill(5))
        if not sh:
            missing_pumas.append(str(p))
            continue
        for cfips, w in sh.items():
            c = county[cfips]
            c["eligible_pop"] += row["eligible_persons"] * w
            c["unenrolled_pop"] += row["no_snap_persons"] * w
            c["eligible_hh"] += row["eligible_hh"] * w
            c["no_snap_hh"] += row["no_snap_hh"] * w
    if missing_pumas:
        raise SystemExit(f"PUMAs with no crosswalk entry: {missing_pumas}")

    rows = []
    for cfips, c in sorted(county.items()):
        rows.append({
            "County": names[cfips],
            "eligible_pop": round(c["eligible_pop"], 1),
            "non_enroll_rate": round(c["unenrolled_pop"] / c["eligible_pop"], 6)
                               if c["eligible_pop"] else 0.0,
            "eligible_hh": round(c["eligible_hh"], 1),
            "no_snap_hh": round(c["no_snap_hh"], 1),
            "county_fips": f"{STATE_FP}{cfips}",
        })
    cm = pd.DataFrame(rows)
    cm.to_csv(OUT_DIR / "tx_county_metrics.csv", index=False)

    tot_elig_p = float(puma["eligible_persons"].sum())
    tot_unenr_p = float(puma["no_snap_persons"].sum())
    reported_hh = float((puma["snap_hh"] + puma["no_snap_hh"]).sum())
    summary = {
        "state": "TX",
        "acs_vintage": "2023 1-Year PUMS",
        "eligible_households_weighted_130fpl": float(puma["eligible_hh"].sum()),
        "eligible_persons_weighted_130fpl": tot_elig_p,
        "eligible_no_snap_households_130fpl": float(puma["no_snap_hh"].sum()),
        "eligible_no_snap_persons_130fpl": tot_unenr_p,
        "weighted_non_enrollment_rate_130fpl":
            float(puma["no_snap_hh"].sum()) / reported_hh,
        "eligible_households_weighted_200fpl": float(puma["eligible_hh_200fpl"].sum()),
        "n_counties": len(rows),
        "n_pumas": len(puma),
        "note_tx_no_bbce": "Texas operates NO broad-based categorical eligibility; "
            "the 130% gross test is the operative boundary, so the federal-baseline "
            "figure is the Texas figure (asset test not modeled — see model card).",
    }
    (OUT_DIR / "tx_snap_gap_summary.json").write_text(json.dumps(summary, indent=2))

    card = {
        "methodology": "MA fact-base family (tools/ma-snap-gap) + CA-style fractional "
            "tract-count PUMA->county allocation. Gross-income test only "
            "(HINCP x ADJINC vs 1.30 x 2023 HHS FPL by household size); occupied "
            "non-GQ households; FS=1 receipt / FS=2 no receipt; WGTP household "
            "weights; person counts = WGTP x NP.",
        "known_biases": [
            "Gross-income proxy ignores the TX asset/vehicle test -> overstates eligible.",
            "ACS under-reports SNAP receipt -> overstates non-enrollment.",
            "No net-income or deduction modeling.",
            "Fractional tract-count allocation assumes eligibility uniform within PUMA.",
            "ABAWD time limits and immigrant-eligibility rules not modeled.",
        ],
        "n_households_sample": int(n_hh_sample),
        "n_eligible_households_sample_130fpl": int(len(elig)),
        "acs_vintage": "2023 1-Year PUMS",
        "fpl_vintage": "2023 HHS Poverty Guidelines (48 states)",
        "gross_income_multiplier": 1.3,
        "built": datetime.now(timezone.utc).isoformat(),
        "consistency_check": "FNS FY2022 modeled TX eligible ~3.85M persons at 74% "
            "participation (~1.0M unenrolled) under FULL eligibility rules; this "
            "gross-income-only fact base will differ (see known_biases).",
    }
    (OUT_DIR / "model_card.json").write_text(json.dumps(card, indent=2))

    print(f"PUMAs: {len(puma)}  counties: {len(rows)}  sample HH: {n_hh_sample:,}")
    print(f"Eligible persons (130%): {tot_elig_p:,.0f}")
    print(f"Eligible-no-SNAP persons: {tot_unenr_p:,.0f}")
    print(f"HH non-enrollment rate: {summary['weighted_non_enrollment_rate_130fpl']:.3f}")
    top = cm.sort_values("eligible_pop", ascending=False).head(8)
    for _, r in top.iterrows():
        print(f"  {r['County']:<22} eligible={r['eligible_pop']:>11,.0f} rate={r['non_enroll_rate']:.3f}")


if __name__ == "__main__":
    build()
