#!/usr/bin/env python3
"""Ingest FRED state monthly unemployment-rate downloads → state_unemployment.csv.

The Model-S1 business-cycle control. FRED's per-state series are {ST}UR
(e.g. CAUR), Unemployment Rate, Percent, Monthly, Seasonally Adjusted. Download
them from fred.stlouisfed.org (single per-state .csv/.xlsx, or the combined
fredgraph multi-series download — FRED caps that at ~12 series, so several
batches). FRED was unreachable from the build host, so the files are fetched
by hand and dropped in a directory; this script auto-detects every state.

Handles all three shapes:
  • {ST}UR.csv               — observation_date,{ST}UR
  • {ST}UR.xlsx              — a README sheet + a Monthly data sheet
  • fredgraph*.csv/.xlsx     — observation_date + many {ST}UR columns

Usage:
  python ingest_unemployment.py <downloads_dir> [out.csv]

Emits data-ops/sample/snap-policy-regression/state_unemployment.csv:
  state_fips, yearmonth, unemployment   (51 states, filtered to 1996-2020)
"""
import sys, os, glob
from pathlib import Path
import pandas as pd

FIPS = {'AL': 1, 'AK': 2, 'AZ': 4, 'AR': 5, 'CA': 6, 'CO': 8, 'CT': 9, 'DE': 10,
        'DC': 11, 'FL': 12, 'GA': 13, 'HI': 15, 'ID': 16, 'IL': 17, 'IN': 18,
        'IA': 19, 'KS': 20, 'KY': 21, 'LA': 22, 'ME': 23, 'MD': 24, 'MA': 25,
        'MI': 26, 'MN': 27, 'MS': 28, 'MO': 29, 'MT': 30, 'NE': 31, 'NV': 32,
        'NH': 33, 'NJ': 34, 'NM': 35, 'NY': 36, 'NC': 37, 'ND': 38, 'OH': 39,
        'OK': 40, 'OR': 41, 'PA': 42, 'RI': 44, 'SC': 45, 'SD': 46, 'TN': 47,
        'TX': 48, 'UT': 49, 'VT': 50, 'VA': 51, 'WA': 53, 'WV': 54, 'WI': 55,
        'WY': 56}
YM_MIN, YM_MAX = 199601, 202012


def _table(d: pd.DataFrame):
    """Find the row whose first cell is 'observation_date' and use it as header."""
    for i in range(min(len(d), 6)):
        if str(d.iloc[i, 0]).strip().lower() == 'observation_date':
            cols = [str(x).strip() for x in d.iloc[i].tolist()]
            out = d.iloc[i + 1:].copy()
            out.columns = cols
            return out
    return None


def _load(f: str):
    if f.endswith('xlsx'):
        xl = pd.ExcelFile(f)
        for sh in xl.sheet_names:  # FRED xlsx hides data on a 'Monthly' sheet
            t = _table(pd.read_excel(f, sheet_name=sh, header=None))
            if t is not None:
                return t
        return None
    return _table(pd.read_csv(f, header=None))


def ingest(dl_dir: str) -> pd.DataFrame:
    seen, rows = set(), []

    def add(st, dates, vals):
        if st in FIPS and st not in seen:
            seen.add(st)
            df = pd.DataFrame({'date': pd.to_datetime(dates, errors='coerce'),
                               'ur': pd.to_numeric(vals, errors='coerce')}).dropna()
            df['ym'] = df['date'].dt.year * 100 + df['date'].dt.month
            for _, r in df.iterrows():
                rows.append((FIPS[st], int(r['ym']), float(r['ur'])))

    g = lambda p: glob.glob(os.path.join(dl_dir, p))
    for f in g('??UR.csv') + g('??UR.xlsx'):
        t = _load(f)
        if t is not None:
            add(os.path.basename(f)[:2], t['observation_date'], t.iloc[:, 1])
    for f in g('fredgraph*.csv') + g('fredgraph*.xlsx'):
        t = _load(f)
        if t is not None:
            for c in t.columns:
                if str(c).endswith('UR'):
                    add(str(c)[:2], t['observation_date'], t[c])

    ue = (pd.DataFrame(rows, columns=['state_fips', 'yearmonth', 'unemployment'])
            .drop_duplicates(['state_fips', 'yearmonth']))
    return ue[(ue['yearmonth'] >= YM_MIN) & (ue['yearmonth'] <= YM_MAX)] \
        .sort_values(['state_fips', 'yearmonth']).reset_index(drop=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: ingest_unemployment.py <downloads_dir> [out.csv]")
    out = (sys.argv[2] if len(sys.argv) > 2 else
           str(Path(__file__).resolve().parents[3] / "data-ops" / "sample"
               / "snap-policy-regression" / "state_unemployment.csv"))
    ue = ingest(sys.argv[1])
    ue.to_csv(out, index=False)
    print(f"{ue['state_fips'].nunique()} states, {len(ue)} rows -> {out}")
