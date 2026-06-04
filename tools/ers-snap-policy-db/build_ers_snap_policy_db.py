#!/usr/bin/env python3
"""Build a tidy state x month SNAP policy-lever panel from the USDA ERS SNAP Policy Database.

The USDA Economic Research Service (ERS) SNAP Policy Database is the canonical
state x month panel of SNAP administrative policy levers (BBCE, simplified /
periodic reporting, certification-period length, online application, call
centers, fingerprinting/biometric, transitional benefits, vehicle exclusions,
EBT issuance share, noncitizen eligibility). It covers all 50 states + DC,
monthly, January 1996 through December 2020.

This script:
  1. Downloads the source workbook ``SNAPPolicyDatabase.xlsx`` (if not already
     present locally) from the ERS Laserfiche data-files host.
  2. Reads the policy-database sheet, normalises column names, and emits a
     COMPACT tidy panel restricted to the key levers Civica's pre-registered
     SNAP error/churn regression treats as exogenous treatment / instrument
     columns.
  3. Writes two CSVs to ``data-ops/sample/ers-snap-policy-db/``:
       - ``ers_snap_policy_panel.csv``  — full national panel (50 states + DC)
       - ``ers_snap_policy_panel_ca.csv`` — California subset (statefips == 6)
     plus refreshes ``provenance.json``.

Run (from repo root or anywhere):

    /tmp/pe-venv/bin/python tools/ers-snap-policy-db/build_ers_snap_policy_db.py

Optional flags:
    --xlsx PATH    Use an already-downloaded workbook instead of fetching.
    --no-download  Fail instead of fetching when the workbook is missing.
    --out-dir DIR  Override the output directory.

The script is deliberately defensive about column names: ERS has shipped the
workbook with several capitalisation / underscore conventions across releases,
so we resolve each lever from a list of known aliases and record any misses in
provenance under ``unresolved_columns`` rather than silently dropping them.

License: the ERS SNAP Policy Database is a U.S. Government work, public domain
(17 U.S.C. Sec. 105). Vendored derivatives ship under the Civica repo license.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
import urllib.request
from pathlib import Path

import pandas as pd

# --------------------------------------------------------------------------- #
# Source coordinates
# --------------------------------------------------------------------------- #
# Canonical ERS landing page (human):
#   https://www.ers.usda.gov/data-products/snap-policy-data-sets
# Direct workbook (Laserfiche data-files host). ERS appends a ``?v=<n>`` cache
# buster that changes per republish; the bare path resolves to the current file.
SOURCE_XLSX_URL = (
    "https://www.ers.usda.gov/sites/default/files/_laserfiche/DataFiles/"
    "108689/SNAPPolicyDatabase.xlsx"
)
# Variable Definitions & Coding Descriptions (companion PDF codebook):
CODEBOOK_PDF_URL = (
    "https://ers.usda.gov/sites/default/files/_laserfiche/DataFiles/"
    "108689/SNAPPolicyDatabaseVariableDefinitionsAndCodingDescriptions.pdf"
)
# Mirrors (stable, citable):
#   data.gov resource: c0e7611b-ac4f-4f03-8f9f-aa308a80b770
#   Ag Data Commons DOI landing: agdatacommons.nal.usda.gov/.../25696446
BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)

PANEL_START = 199601
PANEL_END = 202012
CA_FIPS = 6

# --------------------------------------------------------------------------- #
# Lever selection — the exogenous treatment / instrument spine.
#
# Each entry maps a STABLE output column name -> ordered list of source-column
# aliases (case-insensitive). The first alias found in the workbook wins. This
# is the set the pre-registered regression treats as policy treatment columns;
# it is intentionally a compact subset of the ~40-column raw file (the raw file
# also carries imputation flags, std errors, and distributional percentiles for
# the certification-length variables, which we drop from the tidy panel).
#
# Source: ERS "SNAP Policy Database: Variable Definitions and Coding
# Descriptions" (companion PDF) + the documentation page.
# --------------------------------------------------------------------------- #
LEVER_ALIASES: "dict[str, list[str]]" = {
    # --- identifiers ---
    "statefips": ["statefips", "state_fips", "fips", "stfips"],
    "state": ["state", "stateabbrev", "state_abbrev", "st", "statename"],
    "yearmonth": ["yearmonth", "year_month", "ym", "date"],
    # --- broad-based categorical eligibility (BBCE) cluster ---
    "bbce": ["bbce"],
    "bbce_inclmt": ["bbce_inclmt", "bbceinclmt", "bbce_gil", "bbce_incl"],
    "bbce_asset": ["bbce_asset", "bbceasset", "bbce_assettest"],
    "bbce_a_amt": ["bbce_a_amt", "bbceaamt", "bbce_asset_amt"],
    "bbce_a_veh": ["bbce_a_veh", "bbceaveh", "bbce_asset_veh"],
    # --- reporting regime ---
    "reportsimple": ["reportsimple", "simplereport", "simplified_reporting", "report_simple"],
    # --- certification / recertification length (mean months) ---
    "certearnincome": ["certearnincome", "cert_earnincome", "certearn", "certearninc"],
    "certelderly": ["certelderly", "cert_elderly", "certeld"],
    # --- access / issuance levers ---
    "oapp": ["oapp", "online_app", "onlineapp", "onlineapplication"],
    "call": ["call", "callcenter", "call_center"],
    "ebt": ["ebt", "ebt_share", "ebtissuance"],
    # --- transitional benefits / combined application project ---
    "cap": ["cap", "tba", "transitional", "combined_application"],
    # --- biometric / fingerprinting (barrier lever) ---
    "fingerprint": ["fingerprint", "finger", "biometric", "fingerprinting"],
    # --- face-to-face interview waiver ---
    "faceto": ["faceto", "face_to_face", "f2f", "facetoface"],
    # --- vehicle exclusion (non-BBCE pathway) ---
    "vehexclall": ["vehexclall", "veh_excl_all", "vehicleexclall"],
    "vehexclone": ["vehexclone", "veh_excl_one", "vehicleexclone"],
    "vehexclamt": ["vehexclamt", "veh_excl_amt", "vehicleexclamt"],
    # --- noncitizen eligibility (any of adult/elderly/child variants) ---
    "noncitizen_adult": ["noncitizenadult", "noncit_adult", "noncitizen_adult"],
    "noncitizen_eld": ["noncitizeneld", "noncit_eld", "noncitizen_elderly", "noncitizeneld"],
    "noncitizen_child": ["noncitizenchild", "noncit_child", "noncitizen_child"],
}

# Levers we will NOT tolerate missing — without these the panel is meaningless.
REQUIRED = ["statefips", "yearmonth", "bbce"]


def _log(msg: str) -> None:
    print(f"[ers-snap-policy-db] {msg}", file=sys.stderr)


def download_xlsx(dest: Path) -> None:
    """Fetch the workbook with a browser UA (ERS 403s default urllib UA)."""
    _log(f"downloading {SOURCE_XLSX_URL}")
    req = urllib.request.Request(SOURCE_XLSX_URL, headers={"User-Agent": BROWSER_UA})
    with urllib.request.urlopen(req, timeout=120) as resp:  # noqa: S310 (trusted host)
        data = resp.read()
    dest.write_bytes(data)
    _log(f"wrote {dest} ({len(data):,} bytes)")


def _pick_sheet(xls: pd.ExcelFile) -> str:
    """Choose the policy-database sheet (not the 'States' distribution tab)."""
    names = xls.sheet_names
    # Heuristics: the policy panel is the widest, ~monthly sheet. The companion
    # 'States' sheet (distribution schedule) is small. Prefer a sheet whose name
    # mentions 'policy' or 'data'; else fall back to the sheet with the most rows.
    for cand in names:
        low = cand.lower()
        if "policy" in low or low in {"data", "snap policy database", "database"}:
            return cand
    if "States" in names and len(names) > 1:
        return next(n for n in names if n != "States")
    # widest by row count
    best, best_rows = names[0], -1
    for n in names:
        try:
            rows = xls.parse(n, nrows=0)  # header only first
        except Exception:  # noqa: BLE001
            continue
        full = xls.parse(n)
        if len(full) > best_rows:
            best, best_rows = n, len(full)
    return best


def _resolve_columns(df: pd.DataFrame) -> "tuple[dict[str, str], list[str]]":
    """Map output names -> actual source columns; return (mapping, unresolved)."""
    lower = {c.lower().strip(): c for c in df.columns}
    mapping: "dict[str, str]" = {}
    unresolved: "list[str]" = []
    for out_name, aliases in LEVER_ALIASES.items():
        hit = next((lower[a] for a in aliases if a in lower), None)
        if hit is not None:
            mapping[out_name] = hit
        else:
            unresolved.append(out_name)
    return mapping, unresolved


def build(xlsx_path: Path, out_dir: Path) -> dict:
    xls = pd.ExcelFile(xlsx_path)
    sheet = _pick_sheet(xls)
    _log(f"reading sheet {sheet!r} (sheets: {xls.sheet_names})")
    raw = xls.parse(sheet)
    raw.columns = [str(c).strip() for c in raw.columns]

    mapping, unresolved = _resolve_columns(raw)
    missing_required = [c for c in REQUIRED if c not in mapping]
    if missing_required:
        raise SystemExit(
            f"FATAL: required columns unresolved {missing_required}. "
            f"Workbook columns were: {list(raw.columns)}"
        )

    tidy = raw[[mapping[k] for k in mapping]].copy()
    tidy.columns = list(mapping.keys())

    # Coerce identifiers
    tidy["statefips"] = pd.to_numeric(tidy["statefips"], errors="coerce").astype("Int64")
    tidy["yearmonth"] = pd.to_numeric(tidy["yearmonth"], errors="coerce").astype("Int64")
    tidy = tidy.dropna(subset=["statefips", "yearmonth"])

    # Derive convenience year / month columns
    tidy.insert(
        list(tidy.columns).index("yearmonth") + 1,
        "year",
        (tidy["yearmonth"] // 100).astype("Int64"),
    )
    tidy.insert(
        list(tidy.columns).index("year") + 1,
        "month",
        (tidy["yearmonth"] % 100).astype("Int64"),
    )

    # Clamp to the documented panel window and sort
    tidy = tidy[(tidy["yearmonth"] >= PANEL_START) & (tidy["yearmonth"] <= PANEL_END)]
    tidy = tidy.sort_values(["statefips", "yearmonth"]).reset_index(drop=True)

    out_dir.mkdir(parents=True, exist_ok=True)
    national = out_dir / "ers_snap_policy_panel.csv"
    ca = out_dir / "ers_snap_policy_panel_ca.csv"
    tidy.to_csv(national, index=False)
    tidy[tidy["statefips"] == CA_FIPS].to_csv(ca, index=False)
    _log(f"wrote {national} ({len(tidy):,} rows)")
    _log(f"wrote {ca} ({(tidy['statefips'] == CA_FIPS).sum():,} rows)")

    n_states = int(tidy["statefips"].nunique())
    ym_min = int(tidy["yearmonth"].min())
    ym_max = int(tidy["yearmonth"].max())
    bbce_states_2020 = (
        tidy[(tidy["yearmonth"] == ym_max) & (tidy["bbce"] == 1)]["statefips"].nunique()
        if "bbce" in tidy.columns
        else None
    )

    provenance = {
        "source_name": "USDA ERS SNAP Policy Database",
        "source_url": SOURCE_XLSX_URL,
        "codebook_url": CODEBOOK_PDF_URL,
        "landing_page": "https://www.ers.usda.gov/data-products/snap-policy-data-sets",
        "mirrors": {
            "data_gov_resource": "c0e7611b-ac4f-4f03-8f9f-aa308a80b770",
            "ag_data_commons": "https://agdatacommons.nal.usda.gov/articles/dataset/SNAP_Policy_Data_Sets/25696446",
        },
        "license": "U.S. Government work, public domain (17 U.S.C. 105)",
        "retrieved": _dt.date.today().isoformat(),
        "unit": "state x month (one row per state-FIPS x YYYYMM)",
        "panel_years": "1996-01 to 2020-12 (monthly)",
        "geography": "50 states + DC (statefips 1-56, excl. territories)",
        "rows_national": int(len(tidy)),
        "rows_ca": int((tidy["statefips"] == CA_FIPS).sum()),
        "n_states": n_states,
        "yearmonth_min": ym_min,
        "yearmonth_max": ym_max,
        "bbce_states_at_2020_12": (None if bbce_states_2020 is None else int(bbce_states_2020)),
        "levers_resolved": sorted(mapping.keys()),
        "unresolved_columns": unresolved,
        "raw_sheet": sheet,
        "raw_columns": list(raw.columns),
        "generator": "tools/ers-snap-policy-db/build_ers_snap_policy_db.py",
        "note": (
            "Tidy compact subset of the raw ERS workbook. Imputation flags, "
            "standard errors, and certification-length percentile columns are "
            "dropped; see codebook for full variable set. Coverage ends "
            "2020-12 — post-2020 policy must be hand-coded from FNS State "
            "Options Reports."
        ),
    }
    (out_dir / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    _log("wrote provenance.json")
    return provenance


def main(argv: "list[str] | None" = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--xlsx", type=Path, default=None, help="Pre-downloaded workbook path.")
    ap.add_argument("--no-download", action="store_true", help="Do not fetch if missing.")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data-ops" / "sample" / "ers-snap-policy-db",
        help="Output directory for tidy CSVs + provenance.",
    )
    args = ap.parse_args(argv)

    cache = Path(__file__).resolve().parent / "_cache"
    cache.mkdir(exist_ok=True)
    xlsx = args.xlsx or (cache / "SNAPPolicyDatabase.xlsx")
    if not xlsx.exists():
        if args.no_download:
            raise SystemExit(f"workbook not found at {xlsx} and --no-download set")
        download_xlsx(xlsx)

    prov = build(xlsx, args.out_dir)
    _log("DONE")
    print(json.dumps({k: prov[k] for k in (
        "rows_national", "rows_ca", "n_states", "yearmonth_min", "yearmonth_max",
        "bbce_states_at_2020_12", "levers_resolved", "unresolved_columns",
    )}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
