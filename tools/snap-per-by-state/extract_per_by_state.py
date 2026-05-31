#!/usr/bin/env python3
"""Build the FY2024 national PER × issuance cross-section for the §10105 model.

Inputs (both public, not committed):
  1. FNS QC Payment Error Rates FY2024 table PDF (e.g. snap-fy24QC-PER.pdf)
  2. FNS National/State Monthly Data — the FY24 workbook (FY24.xlsx from
     snap-zip-fy69tocurrent), for per-state SNAP issuance.

Emits:
  - data-ops/sample/snap-per-by-state/per_by_state_fy24.csv
  - apps/dashboard/lib/analytics/per-by-state-fy24.json  (what section10105.ts imports)

Usage:
  python extract_per_by_state.py <PER.pdf> <FY24.xlsx>

Requires: pandas, openpyxl; pdftotext on PATH.
"""
import sys, re, json, subprocess
from pathlib import Path
import pandas as pd

FIPS = {
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
INV = {v: k for k, v in FIPS.items()}
_M = {'Oct': 10, 'Nov': 11, 'Dec': 12, 'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
      'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9}
_MON = re.compile(r'^([A-Z][a-z]{2})\s+(\d{4})\s*(.*)$')


def _num(x):
    try:
        return float(str(x).replace(',', ''))
    except (ValueError, TypeError):
        return float('nan')


def parse_per(pdf):
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"],
                         capture_output=True, text=True).stdout
    rows, natl = [], None
    for line in txt.splitlines():
        m = re.match(r'\s*([A-Z][A-Z .]+?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s*$', line)
        if not m:
            continue
        name = m.group(1).strip()
        if name == 'UNITED STATES':
            natl = float(m.group(4))
        rows.append((name, float(m.group(2)), float(m.group(3)), float(m.group(4))))
    df = pd.DataFrame(rows, columns=['state', 'overpay', 'underpay', 'per'])
    return df[df['state'] != 'UNITED STATES'].copy(), natl


def parse_issuance(fy24_xlsx):
    xl = pd.ExcelFile(fy24_xlsx)
    out = {}
    for sh in xl.sheet_names:
        if sh.strip() == 'US Summary' or sh.strip().startswith('1969'):
            continue
        df = pd.read_excel(fy24_xlsx, sheet_name=sh, header=None)
        i = 0
        while i < len(df):
            f = FIPS.get(str(df.iloc[i, 0]).strip().lower())
            if f:
                tot, j = 0.0, i + 1
                while j < len(df) and j < i + 16:
                    lab = str(df.iloc[j, 0]).strip()
                    if lab.lower().startswith('total'):
                        break
                    m = _MON.match(lab)
                    if m and _M.get(m.group(1)):
                        rest = [_num(df.iloc[j, c]) for c in (3, 4, 5) if c < df.shape[1]]
                        tot += max([r for r in rest if pd.notna(r)], default=0)
                    elif lab.lower() in FIPS:
                        break
                    j += 1
                out[f] = tot
            i += 1
    return out


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: extract_per_by_state.py <PER.pdf> <FY24.xlsx>")
    per, natl = parse_per(sys.argv[1])
    iss = parse_issuance(sys.argv[2])
    per['state_fips'] = per['state'].str.strip().str.lower().map(FIPS)
    per['fy24_issuance_usd'] = per['state_fips'].map(iss)
    out = per[['state', 'state_fips', 'overpay', 'underpay', 'per',
               'fy24_issuance_usd']].sort_values('state')

    root = Path(__file__).resolve().parents[2]
    csv = root / "data-ops/sample/snap-per-by-state/per_by_state_fy24.csv"
    out.to_csv(csv, index=False)

    states = out[out['state_fips'].notna() & out['fy24_issuance_usd'].notna()]
    js = {
        "fiscal_year": 2024,
        "national_avg_per": natl,
        "source": "USDA FNS — SNAP QC Payment Error Rates FY2024 (per) + FNS National/State Monthly Data (issuance)",
        "note": "Real published data. Tier schedule + cost-share mechanism are statutory parameters in section10105.ts, not here.",
        "states": [
            {"state": r['state'].title(), "fips": int(r['state_fips']),
             "per": round(float(r['per']), 2), "fy24_issuance_usd": int(r['fy24_issuance_usd'])}
            for _, r in states.sort_values('state').iterrows()
        ],
    }
    jpath = root / "apps/dashboard/lib/analytics/per-by-state-fy24.json"
    jpath.write_text(json.dumps(js, indent=2) + "\n")
    print(f"national avg PER={natl}  states={len(js['states'])}")
    print(f"wrote {csv}\nwrote {jpath}")


if __name__ == "__main__":
    main()
