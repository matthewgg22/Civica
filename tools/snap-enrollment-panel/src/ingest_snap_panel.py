#!/usr/bin/env python3
"""
ICPSR 39331 (Pukelis) -> CA SNAP county-month enrollment panel + COVID-policy
state-month table.

ICPSR study 39331, "Supplemental Nutrition Assistance Program COVID-19 Policy and
Enrollment Data, United States, 1987-2024" (Kelsey Pukelis, distributed 2025-05-29),
is the highest-value *longitudinal* SNAP panel that does not yet live in this repo:
a county-month enrollment series 1993-01 .. 2024-06 plus a state-month COVID policy
table (the recert-waiver / emergency-allotment / simplified-application natural
experiments). Together they are exactly a churn/retention dependent variable
(county-month enrollment level + month-over-month change) wired to clean policy IVs.

  Landing page (assembled, public-use, FREE ICPSR account, NO embargo):
    https://www.icpsr.umich.edu/web/sbeccc/studies/39331
  Build code + original public source URLs (GitHub, NO login):
    https://github.com/kpukelis/snap_data           (snap_data_availability.csv)
  Raw per-state agency files: linked from snap_data_availability.csv / Dropbox.

ICPSR datasets in the study:
  DS1  SNAP COVID Policy Data        state-month  2019-01 .. 2023-06   <- the IVs
  DS2  SNAP County Enrollment Data   county-month 1993-01 .. 2024-06   <- the DV
  DS3  SNAP State Enrollment Detail  state-month  1987-07 .. 2024-06

WHY THIS IS A SCAFFOLD (status=GATED): the assembled panel is only redistributed
via ICPSR (free account, click-through terms) and Dropbox; neither is fetchable
non-interactively, and we do NOT bypass the ICPSR login (it is a gated download,
not a paywall we may circumvent). The original per-state-agency source files are
listed in snap_data_availability.csv but are not uniformly one-curl-each (mixed
portals, some via the Wayback Machine). So this repo vendors the *public manifest*
(availability + provenance) and ships this reproducible ingest: once an operator
does the one-time manual ICPSR download (see README), this script turns the
delimited DS1/DS2 files into the two compact CA artifacts with one command.

Run (after the manual ICPSR download -> a dir of the delimited .tsv/.csv files):
  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python src/ingest_snap_panel.py \
      --ds2 /path/to/DS0002_snap_county_enrollment.tsv \
      --ds1 /path/to/DS0001_snap_covid_policy.tsv \
      --state CA \
      --out-dir ../../data-ops/sample/snap-enrollment-panel \
      --generated-at <ISO8601>

The script is column-tolerant: ICPSR delimited exports vary in case and exact
header spelling between releases, so we resolve each field from a small set of
candidate names and fail loudly (listing the headers we DID see) if a required
column is absent — rather than silently emitting an empty panel.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

# California FIPS. The county panel (DS2) carries a state FIPS column; CA == "06".
CA_STATE_FIPS = "06"

# Candidate header spellings. ICPSR delimited releases differ in case / separators;
# resolve case-insensitively against this ordered list (first hit wins).
DS2_FIELDS = {
    "state_fips": ["state_fips", "statefips", "fips_state", "st_fips", "state_code"],
    "county_fips": ["county_fips", "countyfips", "fips_county", "cnty_fips", "fips"],
    "state_abbr": ["state_abbr", "state_abbreviation", "stabbr", "state", "st"],
    "county_name": ["county_name", "countyname", "county", "name"],
    "year": ["year", "data_year", "yr"],
    "month": ["month", "data_month", "mo"],
    # enrollment measures (any subset may be present per-state in DS2):
    "households": ["households", "snap_households", "n_households", "hh", "cases"],
    "individuals": ["individuals", "persons", "snap_individuals", "n_individuals", "recipients"],
    "adults": ["adults", "n_adults"],
    "children": ["children", "n_children"],
    "infants": ["infants", "n_infants"],
    "elderly": ["elderly", "n_elderly"],
    "disabled": ["disabled", "n_disabled"],
}

# DS1 (state-month policy) — the natural-experiment IVs.
DS1_FIELDS = {
    "state_fips": ["state_fips", "statefips", "fips_state", "st_fips", "state_code"],
    "state_abbr": ["state_abbr", "state_abbreviation", "stabbr", "state", "st"],
    "year": ["year", "data_year", "yr"],
    "month": ["month", "data_month", "mo"],
    # policy flags / fields (Pukelis DS1 documents waiver name + an implementation
    # indicator + months certification periods were extended + source + notes):
    "emergency_allotment": [
        "emergency_allotment", "ea", "emergency_allotments", "ea_implemented", "ea_flag",
    ],
    "recert_waiver": [
        "recert_waiver", "recertification_waiver", "recert_extension",
        "extend_certification", "cert_extension", "recert_flag",
    ],
    "simplified_application": [
        "simplified_application", "simplified_app", "interview_waiver",
        "adjusted_interview", "interview_adjustment", "app_simplification",
    ],
    "cert_extension_months": [
        "cert_extension_months", "months_extended", "certification_months_extended",
        "extension_months",
    ],
    "policy_name": ["policy", "policy_name", "waiver", "waiver_name"],
    "source": ["source", "waiver_source", "info_source"],
}


def _read_delimited(path: str):
    import pandas as pd  # noqa: PLC0415

    sep = "\t" if path.lower().endswith((".tsv", ".tab", ".txt")) else ","
    # dtype=str everywhere so FIPS strings keep their leading zeros; coerce numerics
    # downstream only where we need them.
    return pd.read_csv(path, sep=sep, dtype=str, keep_default_na=False, low_memory=False)


def _resolve(columns, candidates):
    lower = {c.lower(): c for c in columns}
    for cand in candidates:
        if cand.lower() in lower:
            return lower[cand.lower()]
    return None


def _require(resolved: dict, names: list[str], columns, label: str):
    missing = [n for n in names if resolved.get(n) is None]
    if missing:
        raise SystemExit(
            f"[{label}] missing required column(s) {missing}.\n"
            f"  headers present: {sorted(columns)}\n"
            f"  -> add the real spelling to the candidate list in {os.path.basename(__file__)} "
            f"and re-run. (ICPSR delimited exports vary in header spelling between releases.)"
        )


def _to_int(v):
    try:
        s = str(v).strip().replace(",", "")
        if s in ("", ".", "NA", "N/A", "NaN"):
            return None
        return int(float(s))
    except (TypeError, ValueError):
        return None


def _truthy(v):
    s = str(v).strip().lower()
    if s in ("1", "true", "t", "yes", "y", "implemented", "approved", "active"):
        return True
    if s in ("0", "false", "f", "no", "n", "", ".", "na", "n/a", "not implemented"):
        return False
    # numeric > 0 counts as implemented (e.g. months-extended encodes the waiver)
    n = _to_int(v)
    return bool(n) if n is not None else None


def build_county_panel(ds2_path: str, state_fips: str, state_abbr: str):
    import pandas as pd  # noqa: PLC0415

    df = _read_delimited(ds2_path)
    r = {k: _resolve(df.columns, v) for k, v in DS2_FIELDS.items()}
    _require(r, ["state_fips", "year", "month"], df.columns, "DS2 county enrollment")

    # filter to the target state by FIPS (preferred) or abbreviation.
    sf = df[r["state_fips"]].astype(str).str.strip().str.zfill(2)
    mask = sf == str(state_fips).zfill(2)
    if r["state_abbr"]:
        mask = mask | (df[r["state_abbr"]].astype(str).str.strip().str.upper() == state_abbr.upper())
    df = df[mask].copy()
    if df.empty:
        raise SystemExit(
            f"[DS2] no rows for state {state_abbr} (FIPS {state_fips}). "
            f"Pukelis DS2 covers only a LIMITED set of states — confirm {state_abbr} is in this "
            f"release (it may not be). See README 'Honest limits'."
        )

    measures = ["households", "individuals", "adults", "children", "infants", "elderly", "disabled"]
    rows = []
    for _, row in df.iterrows():
        y, m = _to_int(row[r["year"]]), _to_int(row[r["month"]])
        if y is None or m is None:
            continue
        rec = {
            "state_abbr": state_abbr.upper(),
            "state_fips": str(state_fips).zfill(2),
            "county_fips": (str(row[r["county_fips"]]).strip().zfill(5) if r["county_fips"] else None),
            "county_name": (str(row[r["county_name"]]).strip() if r["county_name"] else None),
            "year": y,
            "month": m,
            "ym": f"{y:04d}-{m:02d}",
        }
        for meas in measures:
            rec[meas] = _to_int(row[r[meas]]) if r[meas] else None
        rows.append(rec)

    rows.sort(key=lambda x: (x["county_fips"] or "", x["ym"]))
    yms = [x["ym"] for x in rows]
    counties = sorted({x["county_fips"] for x in rows if x["county_fips"]})
    return {
        "source": "ICPSR 39331 DS2 — SNAP County Enrollment Data (Pukelis)",
        "source_landing": "https://www.icpsr.umich.edu/web/sbeccc/studies/39331",
        "scope": f"{state_abbr.upper()}, county-month",
        "unit": "county-month",
        "measures": measures,
        "n_rows": len(rows),
        "n_counties": len(counties),
        "month_range": [min(yms), max(yms)] if yms else None,
        "panel": rows,
    }


def build_policy_table(ds1_path: str, state_fips: str, state_abbr: str):
    df = _read_delimited(ds1_path)
    r = {k: _resolve(df.columns, v) for k, v in DS1_FIELDS.items()}
    _require(r, ["state_fips", "year", "month"], df.columns, "DS1 COVID policy")

    sf = df[r["state_fips"]].astype(str).str.strip().str.zfill(2)
    mask = sf == str(state_fips).zfill(2)
    if r["state_abbr"]:
        mask = mask | (df[r["state_abbr"]].astype(str).str.strip().str.upper() == state_abbr.upper())
    df = df[mask].copy()

    rows = []
    for _, row in df.iterrows():
        y, m = _to_int(row[r["year"]]), _to_int(row[r["month"]])
        if y is None or m is None:
            continue
        rows.append({
            "state_abbr": state_abbr.upper(),
            "state_fips": str(state_fips).zfill(2),
            "year": y,
            "month": m,
            "ym": f"{y:04d}-{m:02d}",
            "emergency_allotment": (_truthy(row[r["emergency_allotment"]]) if r["emergency_allotment"] else None),
            "recert_waiver": (_truthy(row[r["recert_waiver"]]) if r["recert_waiver"] else None),
            "simplified_application": (_truthy(row[r["simplified_application"]]) if r["simplified_application"] else None),
            "cert_extension_months": (_to_int(row[r["cert_extension_months"]]) if r["cert_extension_months"] else None),
            "policy_name": (str(row[r["policy_name"]]).strip() if r["policy_name"] else None),
            "source": (str(row[r["source"]]).strip() if r["source"] else None),
        })
    rows.sort(key=lambda x: x["ym"])
    yms = [x["ym"] for x in rows]
    return {
        "source": "ICPSR 39331 DS1 — SNAP COVID Policy Data (Pukelis)",
        "source_landing": "https://www.icpsr.umich.edu/web/sbeccc/studies/39331",
        "scope": f"{state_abbr.upper()}, state-month",
        "unit": "state-month",
        "ivs": ["emergency_allotment", "recert_waiver", "simplified_application", "cert_extension_months"],
        "definition": (
            "COVID-19 SNAP policy waivers, the natural-experiment instruments: "
            "emergency_allotment (supplemental benefits up to the max, Mar 2020 .. Feb 2023), "
            "recert_waiver (temporary waiver / extension of recertification & periodic-report "
            "requirements), simplified_application (waived/adjusted interview & application steps). "
            "cert_extension_months = number of months certification periods were extended."
        ),
        "n_rows": len(rows),
        "month_range": [min(yms), max(yms)] if yms else None,
        "policy": rows,
    }


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ds2", help="DS2 delimited file (SNAP County Enrollment Data) — the DV")
    p.add_argument("--ds1", help="DS1 delimited file (SNAP COVID Policy Data) — the IVs")
    p.add_argument("--state", default="CA", help="two-letter state to slice (default CA)")
    p.add_argument("--state-fips", default=CA_STATE_FIPS, help="state FIPS (default 06 = CA)")
    p.add_argument("--out-dir", default="data-ops/sample/snap-enrollment-panel")
    p.add_argument("--generated-at", default="unset")
    a = p.parse_args(argv)

    if not a.ds2 and not a.ds1:
        p.error(
            "nothing to do: pass --ds2 and/or --ds1 pointing at the ICPSR 39331 delimited "
            "files. They are a one-time manual download (free ICPSR account, no embargo) — "
            "see data-ops/sample/snap-enrollment-panel/README.md."
        )

    os.makedirs(a.out_dir, exist_ok=True)
    wrote = []

    if a.ds2:
        county = build_county_panel(a.ds2, a.state_fips, a.state)
        county["generated_at"] = a.generated_at
        county["generated_from"] = os.path.basename(a.ds2)
        out = os.path.join(a.out_dir, f"{a.state.lower()}_county_month_enrollment.json")
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(county, fh, indent=2)
        wrote.append(out)
        print(f"wrote {out}: {county['n_rows']} rows, {county['n_counties']} counties, "
              f"range {county['month_range']}")

    if a.ds1:
        policy = build_policy_table(a.ds1, a.state_fips, a.state)
        policy["generated_at"] = a.generated_at
        policy["generated_from"] = os.path.basename(a.ds1)
        out = os.path.join(a.out_dir, f"{a.state.lower()}_covid_policy_state_month.json")
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(policy, fh, indent=2)
        wrote.append(out)
        print(f"wrote {out}: {policy['n_rows']} state-month rows, range {policy['month_range']}")

    if not wrote:
        sys.exit("no artifacts written")


if __name__ == "__main__":
    main()
