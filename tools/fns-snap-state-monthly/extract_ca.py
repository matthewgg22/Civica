#!/usr/bin/env python3
"""Extract the California monthly SNAP participation series from the FNS
"National and/or State Level Monthly Data" workbooks (snap-zip-fy69tocurrent).

Source: USDA FNS SNAP Data Tables →
  "National and/or State Level Monthly and/or Annual Data" →
  snap-zip-fy69tocurrent-NN.zip  (public, no login).
The zip holds one workbook per fiscal year (FY89.xls … FY25.xlsx); each has a
sheet per FNS regional office. California lives in the **WRO** (Western) sheet,
where each state is a name row followed by 12 monthly rows with columns:
  [month, Household(cases), Persons, Cost(issuance), Cost/HH, Cost/Persons]
NOTE the issuance column position differs across vintages (old files put Cost
last), so we pick it by magnitude among cols 3-5.

Usage:
  python extract_ca.py /path/to/unzipped/fy69tocurrent  out.csv

Raw zip is ~1.5MB and NOT vendored; unzip it and point this at the folder.
Requires: pandas, openpyxl (.xlsx), xlrd>=2 (.xls).
"""
import sys, glob, os, re
import pandas as pd

MONTHS = {'Oct':10,'Nov':11,'Dec':12,'Jan':1,'Feb':2,'Mar':3,
          'Apr':4,'May':5,'Jun':6,'Jul':7,'Aug':8,'Sep':9}
MON_RE = re.compile(r'^([A-Z][a-z]{2})\s+(\d{4})\s*(.*)$')  # group3 = footnote (e.g. /2)


def _num(x):
    try:
        return float(str(x).replace(',', ''))
    except (ValueError, TypeError):
        return float('nan')


def extract(indir):
    rows = []
    files = sorted(glob.glob(os.path.join(indir, 'FY*.xls')) +
                   glob.glob(os.path.join(indir, 'FY*.xlsx')))
    for f in files:
        try:
            xl = pd.ExcelFile(f)
        except Exception:
            continue
        wro = [s for s in xl.sheet_names if s.strip() == 'WRO']
        if not wro:
            continue
        df = pd.read_excel(f, sheet_name=wro[0], header=None)
        col0 = df[0].astype(str).str.strip().str.lower()
        hits = df.index[col0 == 'california']
        if len(hits) == 0:
            continue
        i, got = hits[0] + 1, 0
        while i < len(df) and got < 13:
            lab = str(df.iloc[i, 0]).strip()
            if lab.lower().startswith('total'):
                break  # end of the California block
            m = MON_RE.match(lab)
            if m and MONTHS.get(m.group(1)):
                yr, mo, fn = int(m.group(2)), MONTHS[m.group(1)], m.group(3).strip()
                hh, persons = _num(df.iloc[i, 1]), _num(df.iloc[i, 2])
                rest = [_num(df.iloc[i, c]) for c in (3, 4, 5) if c < df.shape[1]]
                iss = max([r for r in rest if pd.notna(r)], default=float('nan'))
                rows.append((yr, mo, f'{yr}-{mo:02d}', hh, persons, iss, fn))
                got += 1
            elif lab and lab.lower() != 'nan' and not m and got > 0:
                break  # reached the next state's name row
            i += 1
    ca = (pd.DataFrame(rows, columns=['year', 'month', 'ym', 'households',
                                      'persons', 'issuance', 'footnote'])
            .drop_duplicates('ym').sort_values('ym').reset_index(drop=True))
    return ca


if __name__ == '__main__':
    indir = sys.argv[1] if len(sys.argv) > 1 else '.'
    out = sys.argv[2] if len(sys.argv) > 2 else 'ca_monthly_participation.csv'
    ca = extract(indir)
    ca.to_csv(out, index=False)
    print(f'{len(ca)} CA months {ca.ym.iloc[0]}..{ca.ym.iloc[-1]} -> {out}')
