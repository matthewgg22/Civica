# FNS SNAP — California monthly participation, FY1989–FY2025 (the long backbone)

The **long state-level outcome series** the regression lacked. ICPSR 39331's CA
panel only reaches back to 2016; this reaches **Oct 1988**.

- `ca_monthly_participation.csv` — **444 county-wide CA months, Oct 1988 → Sep 2025,
  zero gaps**: `households` (cases), `persons`, `issuance` ($), `footnote`.

Source: USDA FNS **SNAP Data Tables** → "National and/or State Level Monthly
and/or Annual Data" → `snap-zip-fy69tocurrent-NN.zip` (public, no login). The zip
holds one workbook per fiscal year; California is the **WRO** (Western regional
office) sheet of each. Raw zip (~1.5 MB) is **not committed** — regenerate with
`tools/fns-snap-state-monthly/extract_ca.py <unzipped-dir> <out.csv>`.

**The policy-era arc this captures** (annual-avg persons):

| Year | CA persons | Era |
|---|---|---|
| 1989 | 1.8M | baseline |
| 1996 | 3.1M | pre-PRWORA peak |
| 2000 | 1.8M | **−42% PRWORA welfare-reform collapse** |
| 2008 | 2.3M | pre-recession |
| 2013 | 4.2M | **Great Recession / ARRA peak** |
| 2020–21 | 4.4M | COVID |
| 2024 | 5.4M (peak 5.50M, Dec 2024) | all-time high |

**Footnotes preserved, not silently dropped:** Jan/Feb 2019 carry FNS `/2` — the
Jan-2019 federal-shutdown **early issuance** (Feb benefits paid in Jan → Jan shows
~2× issuance, Feb shows depressed counts). A real benefit-timing micro-experiment,
kept faithful to source.

Validation: latest month (Sep 2025 issuance `1,035,586,487`) matches FNS's separate
state benefits table exactly.
