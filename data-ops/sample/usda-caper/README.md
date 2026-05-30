# USDA SNAP Case and Procedural Error Rates (CAPER) — FY2024

`caper_fy2024.json` — the full state/territory CAPER table for fiscal year 2024,
extracted verbatim from the USDA FNS PDF.

- **Source:** https://www.fns.usda.gov/sites/default/files/resource-files/snap-fy24QC-CAPER.pdf (dated 2025-06-30)
- **Landing page:** https://www.fns.usda.gov/snap/qc/caper
- **License:** Public domain (US federal data)

## What CAPER measures (and why it matters)

CAPER is the **other** SNAP error rate. The payment error rate (PER) covers only
*approved / issued payments* — it never looks at households that were denied, cut
off, or suspended. CAPER does: it is the share of a state's **negative actions**
(denial, termination, suspension) that contained one or more inaccurate or
procedurally incorrect actions. A high CAPER means the *access* side of the
program is error-prone.

FY2024 headline: **California 39.84%**, **United States 43.81%** (Massachusetts
21.08%).

**Honest reading:** a case/procedural error in a negative action does **not**
mean the household was definitely eligible — many CAPER errors are procedural
(notice/timeframe/handling). It measures agency-side process error on negative
actions, not a wrongful-denial count. CAPER and PER have different denominators
and are **not** additive.

## Reproduce

```
curl -A "<browser-UA>" -o caper_fy24.pdf \
  https://www.fns.usda.gov/sites/default/files/resource-files/snap-fy24QC-CAPER.pdf
pdftotext -layout caper_fy24.pdf -        # table is a single page; parse "STATE  NN.NN"
```

Prior years use `snap-qc-caper-fy{NN}.pdf` (back to FY2012). The **CA trend
FY2012–FY2024** is vendored at `caper_ca_trend.json` — CA has held a **32%–40%
band every reported year** (32.5% FY2012 → 39.8% FY2024). Two gaps read honestly:
**FY2020–21 are absent** (USDA waived QC during COVID — the URLs 404), and
**FY2018 = 60.9%** is a one-year outlier. Regenerate by downloading each year's
PDF and parsing the CALIFORNIA / UNITED STATES rows.
