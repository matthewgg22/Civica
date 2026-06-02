#!/usr/bin/env python3
"""Build MA SNAP-Gap per-PUMA estimates from 2023 ACS 1-Year PUMS.

PUMS-derived eligible-non-enrollee counts, mirroring the same methodology
family as the CA build in data-ops/sample/ca-snap-gap/. Honest scope:
this is the FACT BASE (weighted counts of households eligible by gross
income who don't report SNAP receipt), NOT the 45-feature predictive
model the CA artifact also ships. The predictive model is a meaningful
add-on but not load-bearing for the Project Bread pitch — the raw
weighted gap counts ARE the pitch.

Methodology:
  1. Load PUMS h25.csv (MA households) from data/csv_hma.zip.
  2. Compute annual gross household income: HINCP × ADJINC / 1_000_000
     → 2023 dollars.
  3. Per-household FPL multiplier: 2023 HHS Poverty Guidelines (48 contig
     states) by household-size (NP).
  4. Filter eligible-by-gross-income: annual_HINC ≤ 1.30 × annual_FPL.
     (This is the SNAP gross-income test under 7 CFR §273.9(a)(1). It
     ignores BBCE's 200% expansion — that's intentional: the pitch needs
     federal-baseline numbers + a separate BBCE-adjusted figure.)
  5. SNAP receipt: FS=1 means HH reports having received SNAP/Food Stamps
     in the past 12 months. FS=2 means not. NaN means not reported.
  6. Per PUMA, weighted by WGTP:
       - eligible_hh_count
       - eligible_with_snap_count    (FS=1)
       - eligible_without_snap_count (FS=2)  → THE SNAP-GAP
       - non_enrollment_rate          = eligible_without_snap / eligible
  7. Also compute the BBCE-adjusted figure (≤ 2.00 × annual_FPL) since
     MA + CA both operate BBCE at 200% — gives the realistic "Civica
     could serve" denominator.

Outputs to data-ops/sample/ma-snap-gap/:
  - ma_snap_gap_puma.csv — one row per MA PUMA, both 130% and 200% bases.
  - ma_snap_gap_summary.json — state-level totals + Project Bread
    catchment overlay (PUMAs in Suffolk/Middlesex/Norfolk/Essex/Worcester/
    Hampden counties).
  - model_card.json — methodology, sample counts, assumptions.
"""
from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd  # type: ignore

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
OUT_DIR = REPO / "data-ops" / "sample" / "ma-snap-gap"
DATA_ZIP = ROOT / "data" / "csv_hma.zip"

# 2023 HHS Poverty Guidelines for the 48 contiguous states + DC.
# Source: https://aspe.hhs.gov/2023-poverty-guidelines
# (MA uses the 48-states guideline, not the Alaska/Hawaii variants.)
FPL_2023_ANNUAL = {
    1: 14_580,
    2: 19_720,
    3: 24_860,
    4: 30_000,
    5: 35_140,
    6: 40_280,
    7: 45_420,
    8: 50_560,
}
FPL_2023_PER_ADDITIONAL = 5_140  # $5,140 per additional person beyond 8.

# Project Bread's primary catchment counties = the 6 counties with 72%
# of MA SNAP-EBT retailers (per the 2026-06-01 USDA retailer pull).
PROJECT_BREAD_COUNTY_FIPS = {
    "25025": "Suffolk",
    "25017": "Middlesex",
    "25021": "Norfolk",
    "25009": "Essex",
    "25027": "Worcester",
    "25013": "Hampden",
}

# MA PUMA → dominant county mapping. 2020 PUMA boundaries (used by
# 2023 ACS PUMS). PUMA codes are 5-digit within state; full code is
# "25" + PUMA. Built from Census's official tract-to-PUMA crosswalk
# (2020_Census_Tract_to_2020_PUMA.txt) by assigning each PUMA to the
# county containing the most of its tracts.
#
# Source: https://www2.census.gov/geo/docs/reference/puma2020/2020_Census_Tract_to_2020_PUMA.txt
# Crosswalk verified against the 14 MA counties (FIPS 25001–25027 odd).
MA_PUMA_TO_COUNTY = {
    "00100": "25003",  # Berkshire
    "00201": "25011",  # Franklin
    "00301": "25015",  # Hampshire
    "00401": "25013",  # Hampden (Project Bread)
    "00402": "25013",  # Hampden
    "00403": "25013",  # Hampden
    "00501": "25027",  # Worcester (Project Bread)
    "00502": "25027",  # Worcester
    "00503": "25027",  # Worcester
    "00504": "25027",  # Worcester
    "00505": "25027",  # Worcester
    "00506": "25027",  # Worcester
    "00507": "25027",  # Worcester
    "00601": "25017",  # Middlesex (Project Bread)
    "00602": "25017",  # Middlesex
    "00603": "25017",  # Middlesex
    "00604": "25017",  # Middlesex
    "00605": "25017",  # Middlesex
    "00606": "25017",  # Middlesex
    "00607": "25017",  # Middlesex
    "00608": "25017",  # Middlesex
    "00609": "25017",  # Middlesex
    "00610": "25017",  # Middlesex
    "00611": "25017",  # Middlesex
    "00612": "25017",  # Middlesex
    "00613": "25017",  # Middlesex
    "00701": "25009",  # Essex (Project Bread)
    "00702": "25009",  # Essex
    "00703": "25009",  # Essex
    "00704": "25009",  # Essex
    "00705": "25009",  # Essex
    "00706": "25009",  # Essex
    "00801": "25025",  # Suffolk (Project Bread)
    "00802": "25025",  # Suffolk
    "00803": "25025",  # Suffolk
    "00804": "25025",  # Suffolk
    "00805": "25025",  # Suffolk
    "00806": "25025",  # Suffolk
    "00901": "25021",  # Norfolk (Project Bread)
    "00902": "25021",  # Norfolk
    "00903": "25021",  # Norfolk
    "00904": "25021",  # Norfolk
    "00905": "25021",  # Norfolk
    "00906": "25021",  # Norfolk
    "01001": "25005",  # Bristol
    "01002": "25005",  # Bristol
    "01003": "25005",  # Bristol
    "01004": "25005",  # Bristol
    "01101": "25023",  # Plymouth
    "01102": "25023",  # Plymouth
    "01103": "25023",  # Plymouth
    "01104": "25023",  # Plymouth
    "01201": "25001",  # Barnstable
    "01301": "25001",  # Barnstable (incl. Dukes + Nantucket)
}


def fpl_for_size(hh_size: int) -> float:
    """Annual 2023 FPL for a household of `hh_size` (48 contig + DC)."""
    if hh_size <= 0:
        return float(FPL_2023_ANNUAL[1])
    if hh_size in FPL_2023_ANNUAL:
        return float(FPL_2023_ANNUAL[hh_size])
    # 9+ extrapolates.
    return float(FPL_2023_ANNUAL[8]) + float(FPL_2023_PER_ADDITIONAL) * (hh_size - 8)


def load_mass_pums() -> pd.DataFrame:
    """Load psam_h25.csv from the zipped PUMS distribution."""
    with zipfile.ZipFile(DATA_ZIP) as z:
        # Find the .csv member (Census usually packages psam_h<state>.csv).
        csv_name = next(
            n for n in z.namelist() if n.lower().endswith(".csv") and "psam_h" in n.lower()
        )
        with z.open(csv_name) as f:
            return pd.read_csv(
                f,
                low_memory=False,
                usecols=["PUMA", "ADJINC", "WGTP", "NP", "FS", "TYPEHUGQ", "HINCP", "HHL", "TEN"],
            )


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Loading MA PUMS h25.csv…", file=sys.stderr)
    df = load_mass_pums()
    n_total = len(df)
    print(f"  rows: {n_total:,}", file=sys.stderr)

    # 1. Restrict to occupied housing-unit households (TYPEHUGQ == 1
    #    means "Housing unit, occupied"). Vacant units + group quarters
    #    don't have SNAP-eligibility math that maps cleanly.
    df = df[df["TYPEHUGQ"].astype("Int64") == 1].copy()
    print(f"  occupied HHs: {len(df):,}", file=sys.stderr)

    # 2. Annual gross income in 2023 dollars.
    #    ADJINC is a 7-digit integer where the income should be multiplied
    #    by ADJINC / 1_000_000 to inflate to the survey year's dollars.
    df["adj_hincp"] = df["HINCP"].astype("float64") * df["ADJINC"].astype("float64") / 1_000_000.0

    # 3. FPL by household size.
    df["fpl_annual"] = df["NP"].astype("Int64").apply(fpl_for_size)
    df["income_to_fpl"] = df["adj_hincp"] / df["fpl_annual"]

    # 4. Two eligibility thresholds: federal 130% (gross-income test)
    #    and BBCE 200% (the realistic MA-served threshold).
    df["eligible_130"] = df["income_to_fpl"] <= 1.30
    df["eligible_200"] = df["income_to_fpl"] <= 2.00

    # 5. SNAP receipt indicator. FS=1 → received; FS=2 → not received.
    df["fs_int"] = df["FS"].astype("Int64")
    df["snap_received"] = df["fs_int"] == 1
    df["snap_not_received"] = df["fs_int"] == 2

    # 6. Per-PUMA aggregation, weighted by WGTP.
    df["w"] = df["WGTP"].astype("float64")

    def agg(group: pd.DataFrame) -> pd.Series:
        w = group["w"]
        return pd.Series({
            "n_sample_hh": len(group),
            "weighted_hh": float(w.sum()),
            # Federal 130% basis (gross-income test)
            "eligible_130_weighted": float(w[group["eligible_130"]].sum()),
            "eligible_130_with_snap_weighted": float(
                w[group["eligible_130"] & group["snap_received"]].sum()
            ),
            "eligible_130_without_snap_weighted": float(
                w[group["eligible_130"] & group["snap_not_received"]].sum()
            ),
            # BBCE 200% basis (realistic Civica-served threshold)
            "eligible_200_weighted": float(w[group["eligible_200"]].sum()),
            "eligible_200_with_snap_weighted": float(
                w[group["eligible_200"] & group["snap_received"]].sum()
            ),
            "eligible_200_without_snap_weighted": float(
                w[group["eligible_200"] & group["snap_not_received"]].sum()
            ),
        })

    df["puma_5"] = df["PUMA"].astype("Int64").astype(str).str.zfill(5)
    by_puma = df.groupby("puma_5", observed=True).apply(agg).reset_index()
    by_puma["state_fips"] = "25"
    by_puma["puma_code"] = by_puma["state_fips"] + by_puma["puma_5"]

    # Non-enrollment rates and SNAP-gap counts.
    by_puma["non_enrollment_rate_130"] = (
        by_puma["eligible_130_without_snap_weighted"]
        / by_puma["eligible_130_weighted"].replace(0, pd.NA)
    )
    by_puma["non_enrollment_rate_200"] = (
        by_puma["eligible_200_without_snap_weighted"]
        / by_puma["eligible_200_weighted"].replace(0, pd.NA)
    )

    # 7. Project Bread catchment overlay.
    by_puma["primary_county_fips"] = by_puma["puma_5"].map(MA_PUMA_TO_COUNTY).fillna("25_other")
    by_puma["project_bread_catchment"] = by_puma["primary_county_fips"].isin(
        PROJECT_BREAD_COUNTY_FIPS.keys()
    )
    by_puma["county_label"] = by_puma["primary_county_fips"].map(
        lambda f: PROJECT_BREAD_COUNTY_FIPS.get(f, "other MA")
    )

    # Round for human readability.
    for col in [
        "weighted_hh",
        "eligible_130_weighted",
        "eligible_130_with_snap_weighted",
        "eligible_130_without_snap_weighted",
        "eligible_200_weighted",
        "eligible_200_with_snap_weighted",
        "eligible_200_without_snap_weighted",
    ]:
        by_puma[col] = by_puma[col].round(0).astype("Int64")
    for col in ["non_enrollment_rate_130", "non_enrollment_rate_200"]:
        by_puma[col] = by_puma[col].astype("float64").round(4)

    # Ordering for CSV.
    by_puma = by_puma.sort_values("puma_code").reset_index(drop=True)
    cols = [
        "puma_code",
        "puma_5",
        "state_fips",
        "primary_county_fips",
        "county_label",
        "project_bread_catchment",
        "n_sample_hh",
        "weighted_hh",
        "eligible_130_weighted",
        "eligible_130_with_snap_weighted",
        "eligible_130_without_snap_weighted",
        "non_enrollment_rate_130",
        "eligible_200_weighted",
        "eligible_200_with_snap_weighted",
        "eligible_200_without_snap_weighted",
        "non_enrollment_rate_200",
    ]
    by_puma = by_puma[cols]

    csv_path = OUT_DIR / "ma_snap_gap_puma.csv"
    by_puma.to_csv(csv_path, index=False)
    print(f"  wrote {csv_path} ({len(by_puma)} PUMAs)", file=sys.stderr)

    # State and catchment totals.
    state_totals = {
        "n_pumas": int(len(by_puma)),
        "n_sample_hh": int(by_puma["n_sample_hh"].sum()),
        "weighted_hh": int(by_puma["weighted_hh"].sum()),
        "eligible_130_weighted": int(by_puma["eligible_130_weighted"].sum()),
        "eligible_130_without_snap_weighted": int(
            by_puma["eligible_130_without_snap_weighted"].sum()
        ),
        "eligible_200_weighted": int(by_puma["eligible_200_weighted"].sum()),
        "eligible_200_without_snap_weighted": int(
            by_puma["eligible_200_without_snap_weighted"].sum()
        ),
    }
    state_totals["non_enrollment_rate_130"] = round(
        state_totals["eligible_130_without_snap_weighted"]
        / state_totals["eligible_130_weighted"],
        4,
    )
    state_totals["non_enrollment_rate_200"] = round(
        state_totals["eligible_200_without_snap_weighted"]
        / state_totals["eligible_200_weighted"],
        4,
    )

    catchment = by_puma[by_puma["project_bread_catchment"]]
    catchment_totals = {
        "n_pumas": int(len(catchment)),
        "weighted_hh": int(catchment["weighted_hh"].sum()),
        "eligible_130_weighted": int(catchment["eligible_130_weighted"].sum()),
        "eligible_130_without_snap_weighted": int(
            catchment["eligible_130_without_snap_weighted"].sum()
        ),
        "eligible_200_weighted": int(catchment["eligible_200_weighted"].sum()),
        "eligible_200_without_snap_weighted": int(
            catchment["eligible_200_without_snap_weighted"].sum()
        ),
    }
    if catchment_totals["eligible_130_weighted"]:
        catchment_totals["non_enrollment_rate_130"] = round(
            catchment_totals["eligible_130_without_snap_weighted"]
            / catchment_totals["eligible_130_weighted"],
            4,
        )
        catchment_totals["non_enrollment_rate_200"] = round(
            catchment_totals["eligible_200_without_snap_weighted"]
            / catchment_totals["eligible_200_weighted"],
            4,
        )
        catchment_totals["catchment_share_of_state_gap_130"] = round(
            catchment_totals["eligible_130_without_snap_weighted"]
            / state_totals["eligible_130_without_snap_weighted"],
            4,
        )
        catchment_totals["catchment_share_of_state_gap_200"] = round(
            catchment_totals["eligible_200_without_snap_weighted"]
            / state_totals["eligible_200_without_snap_weighted"],
            4,
        )

    # Per-county breakdown inside the catchment.
    per_county = (
        by_puma[by_puma["project_bread_catchment"]]
        .groupby("county_label", observed=True)
        .agg(
            n_pumas=("puma_code", "count"),
            eligible_130_weighted=("eligible_130_weighted", "sum"),
            eligible_130_without_snap_weighted=("eligible_130_without_snap_weighted", "sum"),
            eligible_200_weighted=("eligible_200_weighted", "sum"),
            eligible_200_without_snap_weighted=("eligible_200_without_snap_weighted", "sum"),
        )
        .reset_index()
    )
    per_county["non_enrollment_rate_130"] = (
        per_county["eligible_130_without_snap_weighted"] / per_county["eligible_130_weighted"]
    ).round(4)
    per_county["non_enrollment_rate_200"] = (
        per_county["eligible_200_without_snap_weighted"] / per_county["eligible_200_weighted"]
    ).round(4)
    for col in [
        "eligible_130_weighted",
        "eligible_130_without_snap_weighted",
        "eligible_200_weighted",
        "eligible_200_without_snap_weighted",
    ]:
        per_county[col] = per_county[col].astype("Int64")

    summary = {
        "state": "MA",
        "acs_vintage": "2023 1-Year PUMS",
        "fpl_vintage": "2023 HHS Poverty Guidelines (48 contig)",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "state_totals": state_totals,
        "project_bread_catchment": {
            "counties": list(PROJECT_BREAD_COUNTY_FIPS.values()),
            "totals": catchment_totals,
            "per_county": per_county.to_dict(orient="records"),
        },
    }
    summary_path = OUT_DIR / "ma_snap_gap_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2))
    print(f"  wrote {summary_path}", file=sys.stderr)

    # Model card.
    model_card = {
        "model_version": "ma-snap-gap-v0.1.0",
        "model_kind": "weighted_counts_no_ml",
        "scope": "Massachusetts — per-PUMA SNAP-eligible non-enrollee counts.",
        "methodology": "Fact-base counts only. Eligible-by-gross-income filter uses 2023 HHS FPL × 1.30 (federal SNAP gross-income test, 7 CFR §273.9(a)(1)) and × 2.00 (BBCE basis used by MA + CA). FS column flags self-reported SNAP receipt. Weighted by WGTP. No predictive model — the CA equivalent (ca-snap-gap-v0.1.0) adds a 45-feature HistGradientBoosting layer on top; that ML layer is deferred for MA.",
        "data_source": "ACS 2023 1-Year PUMS, Massachusetts (FIPS 25).",
        "acs_release": "Census Bureau, September 2024.",
        "n_total_hh_rows": n_total,
        "n_occupied_hh_rows": int(state_totals["n_sample_hh"]),
        "n_eligible_130_sample_hh": int((df["eligible_130"]).sum()),
        "n_eligible_200_sample_hh": int((df["eligible_200"]).sum()),
        "fpl_table_annual_2023": FPL_2023_ANNUAL,
        "fpl_per_additional_2023": FPL_2023_PER_ADDITIONAL,
        "caveats": [
            "Gross-income filter ignores SNAP asset test (7 CFR §273.8) — most asset-tested HHs in scope; PUMS lacks asset measurement.",
            "BBCE 200% filter is the realistic Civica-served denominator but does NOT capture the categorical-eligibility nuance (TANF-informational-brochure trigger). MA + CA both effectively offer BBCE to every applicant.",
            "Non-enrollment rate uses self-reported FS column — known under-counts SNAP receipt versus admin records.",
            "PUMA-to-county mapping uses dominant-county assignment; some PUMAs span counties.",
            "Single-year vintage. 2024 ACS PUMS releases Sep 2025; rerun then for the post-OBBBA snapshot.",
        ],
    }
    card_path = OUT_DIR / "model_card.json"
    card_path.write_text(json.dumps(model_card, indent=2))
    print(f"  wrote {card_path}", file=sys.stderr)

    print(file=sys.stderr)
    print("STATE TOTALS:", file=sys.stderr)
    print(
        f"  Eligible HHs (130%): {state_totals['eligible_130_weighted']:>9,}  "
        f"non-enrolled: {state_totals['eligible_130_without_snap_weighted']:>9,}  "
        f"({state_totals['non_enrollment_rate_130']:.1%})",
        file=sys.stderr,
    )
    print(
        f"  Eligible HHs (200%): {state_totals['eligible_200_weighted']:>9,}  "
        f"non-enrolled: {state_totals['eligible_200_without_snap_weighted']:>9,}  "
        f"({state_totals['non_enrollment_rate_200']:.1%})",
        file=sys.stderr,
    )
    print(file=sys.stderr)
    print("PROJECT BREAD CATCHMENT:", file=sys.stderr)
    if catchment_totals.get("eligible_130_weighted"):
        print(
            f"  130%: {catchment_totals['eligible_130_without_snap_weighted']:>9,} non-enrolled  "
            f"({catchment_totals['non_enrollment_rate_130']:.1%}, "
            f"{catchment_totals['catchment_share_of_state_gap_130']:.1%} of state)",
            file=sys.stderr,
        )
        print(
            f"  200%: {catchment_totals['eligible_200_without_snap_weighted']:>9,} non-enrolled  "
            f"({catchment_totals['non_enrollment_rate_200']:.1%}, "
            f"{catchment_totals['catchment_share_of_state_gap_200']:.1%} of state)",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
