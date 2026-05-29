# CDSS CalFresh Churn Monthly Report (CF 18) — CA procedural churn

`cf18_churn_statewide.json` — California statewide procedural-churn aggregate for
FY2023-24 through FY2025-26 (partial), built from the CDSS CF-18 workbooks.

- **Source:** CDSS data portal — one `.xlsx` per fiscal year:
  `https://www.cdss.ca.gov/Portals/9/Additional-Resources/Research-and-Data/DSSDS/Tables/CF18FY24-25.xlsx`
  (also `CF18FY23-24.xlsx`, `CF18FY25-26.xlsx`, … back to FY20-21).
- **Landing page:** https://www.cdss.ca.gov/inforesources/data-portal/research-and-data/calfresh-data-tables/cf-18
- **License:** Public domain (CA state data).

## What CF-18 measures

For every month it counts the CalFresh/CFAP households scheduled to submit a
**SAR 7** (semi-annual report) or **RRR** (recertification), and how they were
disposed — timely, untimely, late, and whether the household **lost benefits**.
The load-bearing signal is **procedural churn**: eligible households that lose
benefits at a reporting moment because paperwork was late. It is the CA
state-data complement to the federal **CAPER** (denial-side error) and **QC**
(overpayment-side error).

**Procedural benefit-interruption rate = late-with-loss ÷ scheduled.**

## Headline (statewide)

| | RRR (recert) loss rate | SAR 7 loss rate | household-events with a benefit loss |
| --- | --- | --- | --- |
| FY2023-24 | 3.8% | 7.5% | 240,082 |
| FY2024-25 | **5.2%** | **8.5%** | **330,331** |
| FY2025-26 (7 mo) | 5.2% | 8.5% | 205,938 |

## Schema note (the workbook)

Sheet `Data_Internal`, headers in row 6 (`Cell 1`..`Cell N`), rows are
(month × county); `County Name == 'Statewide'` is the CA total. The cells map to
the `DataDictionary` items (alternating SAR 7 / RRR). We extract:
`Cell 1` SAR 7 scheduled · `Cell 2` RRR scheduled · `Cell 4` RRR timely-eligible ·
`Cell 15` SAR 7 late-with-loss · `Cell 16` RRR late-with-loss.

## Reproduce

```bash
UA="Mozilla/5.0 … Chrome/120 Safari/537.36"      # CDSS needs a browser UA
for fy in FY23-24 FY24-25 FY25-26; do
  curl -A "$UA" -o cf18/CF18$fy.xlsx \
    https://www.cdss.ca.gov/Portals/9/Additional-Resources/Research-and-Data/DSSDS/Tables/CF18$fy.xlsx
done
python tools/cdss-cf18/src/ingest_cf18.py --data-dir cf18 \
  --out data-ops/sample/cdss-cf18/cf18_churn_statewide.json
```

The script also keeps the monthly statewide series. County-level churn (all 58
counties are in the workbook) is a one-line filter change — useful for the
heatmap/distribution tracks.

## Caveats

- **Per-event, not per-household-per-year.** A household faces SAR 7 + RRR several
  times a year; the annual probability of ≥1 interruption is higher than any
  single rate.
- **Interruption ≠ permanent exit.** "Late with loss" means benefits lapsed;
  some households reinstate, some churn off fully (the re-entry cells, not
  extracted here, quantify return).
