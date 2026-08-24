#!/usr/bin/env python3
"""Generalized per-state SNAP-gap fact-base builder (TODO-61).

Same methodology as tools/tx-snap-gap/build.py (which is the reviewed
reference implementation): 2023 ACS 1-Year PUMS, gross-income 130% FPL test,
FS receipt, WGTP weights, fractional tract-count PUMA->county allocation.

Usage:
  python3 build_state.py FL            # expects data/csv_hfl.zip downloaded
  python3 build_state.py FL NY AZ ...  # multiple states

Outputs per state to data-ops/sample/{xx}-snap-gap/ mirroring the TX layout.
All 50 states + DC. Alaska and Hawaii use their own 2023 HHS poverty tables.
"""
from __future__ import annotations

import json
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
CROSSWALK = REPO / "data-ops" / "reference" / "2020_tract_to_puma.txt"
GAZETTEER = ROOT / "data" / "2023_Gaz_counties_national.txt"

STATE_FIPS = {
    "AK": "02", "HI": "15",
    "AL": "01", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09",
    "DE": "10", "DC": "11", "FL": "12", "GA": "13", "ID": "16", "IL": "17",
    "IN": "18", "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23",
    "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29",
    "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35",
    "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40", "OR": "41",
    "PA": "42", "RI": "44", "SC": "45", "SD": "46", "TN": "47", "TX": "48",
    "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54", "WI": "55",
    "WY": "56",
}

# 2023 HHS Poverty Guidelines. Alaska and Hawaii have their own tables — using
# the contiguous-48 figures for them would understate eligibility badly (an
# Alaska one-person household is $18,210, not $14,580), so they are separate.
FPL_2023_ANNUAL = {1: 14_580, 2: 19_720, 3: 24_860, 4: 30_000,
                   5: 35_140, 6: 40_280, 7: 45_420, 8: 50_560}
FPL_EXTRA_PERSON = 5_140
FPL_2023_AK = {1: 18_210, 2: 24_640, 3: 31_070, 4: 37_500,
               5: 43_930, 6: 50_360, 7: 56_790, 8: 63_220}
FPL_EXTRA_AK = 6_430
FPL_2023_HI = {1: 16_770, 2: 22_680, 3: 28_590, 4: 34_500,
               5: 40_410, 6: 46_320, 7: 52_230, 8: 58_140}
FPL_EXTRA_HI = 5_910
FPL_TABLES = {"AK": (FPL_2023_AK, FPL_EXTRA_AK),
              "HI": (FPL_2023_HI, FPL_EXTRA_HI)}


def fpl_for_size(n: int, postal: str = "") -> float:
    table, extra = FPL_TABLES.get(postal, (FPL_2023_ANNUAL, FPL_EXTRA_PERSON))
    if n <= 8:
        return table[max(1, n)]
    return table[8] + extra * (n - 8)


def county_names(state_fp: str) -> dict[str, str]:
    names = {}
    with open(GAZETTEER, encoding="utf-8-sig") as f:
        header = f.readline().split("\t")
        gi, ni = header.index("GEOID"), header.index("NAME")
        for line in f:
            parts = line.rstrip("\n").split("\t")
            geoid, name = parts[gi].strip(), parts[ni].strip()
            if geoid.startswith(state_fp):
                # keep the suffix ("County"/"Parish"/"city") only when it
                # disambiguates (e.g. VA independent cities); strip " County".
                names[geoid[2:]] = name.replace(" County", "")
    return names


def build_state(postal: str) -> dict:
    postal = postal.upper()
    state_fp = STATE_FIPS[postal]
    lower = postal.lower()
    data_zip = ROOT / "data" / f"csv_h{lower}.zip"
    out_dir = REPO / "data-ops" / "sample" / f"{lower}-snap-gap"

    with zipfile.ZipFile(data_zip) as z:
        member = next(n for n in z.namelist() if n.endswith(".csv"))
        with z.open(member) as f:
            df = pd.read_csv(
                f, usecols=["PUMA", "ADJINC", "WGTP", "NP", "FS", "TYPEHUGQ", "HINCP"],
                dtype={"PUMA": str})
    df = df[(df["TYPEHUGQ"] == 1) & (df["WGTP"] > 0)].dropna(subset=["HINCP", "NP"])
    df["hinc_2023"] = df["HINCP"] * df["ADJINC"] / 1_000_000
    df["fpl"] = df["NP"].astype(int).map(lambda n: fpl_for_size(n, postal))
    df["income_to_fpl"] = df["hinc_2023"] / df["fpl"]

    def agg(frame):
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
        out["non_enroll_rate"] = out["no_snap_hh"] / (out["snap_hh"] + out["no_snap_hh"])
        return out

    elig = df[df["income_to_fpl"] <= 1.30]
    puma = agg(elig)
    p200 = agg(df[df["income_to_fpl"] <= 2.00])[["eligible_hh", "no_snap_hh", "non_enroll_rate"]]
    p200.columns = [c + "_200fpl" for c in p200.columns]
    puma = puma.join(p200)

    cw = pd.read_csv(CROSSWALK, dtype=str, encoding="utf-8-sig")
    cw = cw[cw["STATEFP"] == state_fp]
    shares = {p: (g["COUNTYFP"].value_counts() / len(g)).to_dict()
              for p, g in cw.groupby("PUMA5CE")}
    names = county_names(state_fp)

    county = defaultdict(lambda: defaultdict(float))
    missing = []
    for p, row in puma.iterrows():
        sh = shares.get(str(p).zfill(5))
        if not sh:
            missing.append(str(p))
            continue
        for cfips, w in sh.items():
            c = county[cfips]
            c["eligible_pop"] += row["eligible_persons"] * w
            c["unenrolled_pop"] += row["no_snap_persons"] * w
            c["eligible_hh"] += row["eligible_hh"] * w
            c["no_snap_hh"] += row["no_snap_hh"] * w
    if missing:
        raise SystemExit(f"{postal}: PUMAs missing from crosswalk: {missing}")

    out_dir.mkdir(parents=True, exist_ok=True)
    puma.reset_index().to_csv(out_dir / f"{lower}_snap_gap_puma.csv", index=False)
    rows = [{
        "County": names[cf],
        "eligible_pop": round(c["eligible_pop"], 1),
        "non_enroll_rate": round(c["unenrolled_pop"] / c["eligible_pop"], 6)
                           if c["eligible_pop"] else 0.0,
        "eligible_hh": round(c["eligible_hh"], 1),
        "no_snap_hh": round(c["no_snap_hh"], 1),
        "county_fips": state_fp + cf,
    } for cf, c in sorted(county.items())]
    pd.DataFrame(rows).to_csv(out_dir / f"{lower}_county_metrics.csv", index=False)

    reported = float((puma["snap_hh"] + puma["no_snap_hh"]).sum())
    summary = {
        "state": postal,
        "acs_vintage": "2023 1-Year PUMS",
        "eligible_households_weighted_130fpl": float(puma["eligible_hh"].sum()),
        "eligible_persons_weighted_130fpl": float(puma["eligible_persons"].sum()),
        "eligible_no_snap_households_130fpl": float(puma["no_snap_hh"].sum()),
        "eligible_no_snap_persons_130fpl": float(puma["no_snap_persons"].sum()),
        "weighted_non_enrollment_rate_130fpl": float(puma["no_snap_hh"].sum()) / reported,
        "n_counties": len(rows), "n_pumas": len(puma),
    }
    (out_dir / f"{lower}_snap_gap_summary.json").write_text(json.dumps(summary, indent=2))
    (out_dir / "model_card.json").write_text(json.dumps({
        "methodology": "Identical to tools/tx-snap-gap/build.py (reference impl): "
            "2023 1-Year PUMS gross-income 130% fact base + fractional tract-count "
            "PUMA->county allocation. See that file's docstring and known-bias list.",
        "known_biases": "Gross-income-only proxy overstates eligible (state asset/BBCE "
            "rules not modeled); ACS under-reports receipt, overstating non-enrollment. "
            "Upper-range estimate. State BBCE status NOT encoded here - check before "
            "any state-specific eligibility claim.",
        "acs_vintage": "2023 1-Year PUMS",
        "fpl_vintage": "2023 HHS Poverty Guidelines (48 states)",
        "gross_income_multiplier": 1.3,
        "built": datetime.now(timezone.utc).isoformat(),
    }, indent=2))
    (out_dir / f"{lower}_snap_gap.provenance.json").write_text(json.dumps({
        "source": f"US Census Bureau, 2023 ACS 1-Year PUMS, {postal} household file "
                  f"(csv_h{lower}.zip), pulled 2026-08-22",
        "builder": "tools/snap-gap-states/build_state.py (TODO-61 fan-out; "
                   "reference impl tools/tx-snap-gap/build.py, oracle-verified on TX)",
    }, indent=2))
    return summary


if __name__ == "__main__":
    for st in sys.argv[1:]:
        s = build_state(st)
        print(f"{s['state']}: pumas={s['n_pumas']} counties={s['n_counties']} "
              f"eligible_persons={s['eligible_persons_weighted_130fpl']:,.0f} "
              f"no_snap_persons={s['eligible_no_snap_persons_130fpl']:,.0f} "
              f"hh_rate={s['weighted_non_enrollment_rate_130fpl']:.3f}")
