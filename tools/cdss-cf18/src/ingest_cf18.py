#!/usr/bin/env python3
"""
CDSS CalFresh Churn Monthly Report (CF 18) -> CA statewide procedural-churn aggregate.

CF-18 is California's state-level retention dataset: for every month it counts the
CalFresh households scheduled to submit a SAR 7 (semi-annual report) or RRR
(recertification), and how those were disposed -- timely, untimely, late, and
whether the household LOST benefits. The load-bearing signal is procedural churn:
eligible households that lose benefits at a reporting moment because paperwork was
late. It is the CA state-data complement to the federal CAPER (denial-side error)
and QC (overpayment-side error).

Source (public, no agreement): CDSS data portal, one .xlsx per fiscal year:
  https://www.cdss.ca.gov/Portals/9/Additional-Resources/Research-and-Data/DSSDS/Tables/CF18FY24-25.xlsx
  (also FY23-24, FY25-26, ... back to FY20-21). Landing page:
  https://www.cdss.ca.gov/inforesources/data-portal/research-and-data/calfresh-data-tables/cf-18

Each workbook: sheet 'Data_Internal', headers in row 6 ("Cell 1".."Cell N"), rows
are (month x county); County Name == 'Statewide' is the CA total. The "Cell N"
columns map to the DataDictionary items (alternating SAR 7 / RRR):

  Cell 1  = SAR 7 scheduled            Cell 2  = RRR scheduled
  Cell 4  = RRR timely, eligible       Cell 8  = RRR untimely, eligible, no loss
  Cell 13 = SAR 7 late, eligible, NO loss (6a)   Cell 14 = RRR late, eligible, NO loss (6a)
  Cell 15 = SAR 7 late, eligible, WITH loss (6b) Cell 16 = RRR late, eligible, WITH loss (6b)

Procedural-churn (benefit-interruption) rate = late-WITH-loss / scheduled.

Run (download the xlsx first; CDSS needs a browser User-Agent):
  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python src/ingest_cf18.py --data-dir /path/to/cf18 \
    --out ../../data-ops/sample/cdss-cf18/cf18_churn_statewide.json --generated-at <ISO>
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re

# Cell -> (measure, meaning) for the columns we extract.
CELLS = {
    "Cell 1": "sar7_scheduled",
    "Cell 2": "rrr_scheduled",
    "Cell 4": "rrr_timely_eligible",
    "Cell 15": "sar7_late_with_loss",
    "Cell 16": "rrr_late_with_loss",
}


def fy_from_name(path: str) -> str:
    m = re.search(r"CF18FY(\d{2}-\d{2})", os.path.basename(path), re.I)
    return f"FY20{m.group(1)}" if m else os.path.basename(path)


def main(argv=None) -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", required=True, help="dir of CF18FY*.xlsx files")
    p.add_argument("--out", default="data-ops/sample/cdss-cf18/cf18_churn_statewide.json")
    p.add_argument("--generated-at", default="unset")
    a = p.parse_args(argv)

    import pandas as pd  # noqa: PLC0415

    files = sorted(glob.glob(os.path.join(a.data_dir, "CF18FY*.xlsx")))
    if not files:
        raise SystemExit(f"no CF18FY*.xlsx in {a.data_dir}")

    years: dict[str, dict] = {}
    monthly: list[dict] = []
    for path in files:
        fy = fy_from_name(path)
        df = pd.read_excel(path, sheet_name="Data_Internal", header=5)
        df = df[df["County Name"] == "Statewide"].copy()
        for cell in CELLS:
            df[cell] = pd.to_numeric(df[cell], errors="coerce")
        agg = {CELLS[c]: float(df[c].sum()) for c in CELLS}
        agg["months"] = int(len(df))
        agg["rrr_loss_rate_pct"] = round(agg["rrr_late_with_loss"] / agg["rrr_scheduled"] * 100, 1) if agg["rrr_scheduled"] else None
        agg["sar7_loss_rate_pct"] = round(agg["sar7_late_with_loss"] / agg["sar7_scheduled"] * 100, 1) if agg["sar7_scheduled"] else None
        agg["household_events_with_loss"] = int(agg["rrr_late_with_loss"] + agg["sar7_late_with_loss"])
        years[fy] = {k: (int(v) if isinstance(v, float) and k != "rrr_loss_rate_pct" and k != "sar7_loss_rate_pct" else v) for k, v in agg.items()}
        for _, r in df.iterrows():
            d = r["Date"]
            monthly.append({
                "fy": fy,
                "month": str(d)[:7] if d is not None else None,
                "rrr_scheduled": int(r["Cell 2"]) if pd.notna(r["Cell 2"]) else None,
                "rrr_late_with_loss": int(r["Cell 16"]) if pd.notna(r["Cell 16"]) else None,
                "sar7_scheduled": int(r["Cell 1"]) if pd.notna(r["Cell 1"]) else None,
                "sar7_late_with_loss": int(r["Cell 15"]) if pd.notna(r["Cell 15"]) else None,
            })

    result = {
        "source": "CDSS CalFresh Churn Monthly Report (CF 18)",
        "source_landing": "https://www.cdss.ca.gov/inforesources/data-portal/research-and-data/calfresh-data-tables/cf-18",
        "scope": "California statewide",
        "generated_at": a.generated_at,
        "generated_from": [os.path.basename(f) for f in files],
        "definition": "Procedural benefit interruption at periodic reporting. 'with loss' = SAR 7 / RRR submitted late AND the household experienced a loss of benefits (CF-18 item 6b). Rate = late-with-loss / scheduled. RRR = recertification; SAR 7 = semi-annual report.",
        "cell_map": CELLS,
        "years": years,
        "monthly_statewide": monthly,
        "caveats": [
            "Per-EVENT rate, not per-household-per-year: a household faces SAR 7 + RRR multiple times a year, so annual probability of >=1 interruption is higher.",
            "'late with loss' is a benefit INTERRUPTION, not necessarily a permanent exit; some reinstate, some churn off fully.",
            "CFAP households are included with CalFresh per the CF-18 definition.",
        ],
    }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    print(f"wrote {a.out}")
    for fy, y in years.items():
        print(f"  {fy}: RRR {y['rrr_loss_rate_pct']}%  SAR7 {y['sar7_loss_rate_pct']}%  "
              f"events-with-loss {y['household_events_with_loss']:,} (months={y['months']})")


if __name__ == "__main__":
    main()
