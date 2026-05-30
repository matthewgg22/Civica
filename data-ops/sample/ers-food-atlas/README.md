# USDA ERS Food Environment Atlas — CA county food access

`ca_food_access.csv` — California's 58 counties with food-access indicators from
the ERS Food Environment Atlas (https://www.ers.usda.gov/media/5569/food-environment-atlas-data-download.xlsx):

- **Store density per 1,000 pop** — grocery (`GROCPTH`), supercenter
  (`SUPERCPTH`), convenience (`CONVSPTH`), and **SNAP-authorized stores
  (`SNAPSPTH`)**, two vintages each (2016/2020, 2017/2023).
- **Low food access** — `LACCESS_POP` (population far from a store), 2015/2019.
- **SNAP participation** — `PCT_SNAP`, 2017/2022.

**Regression role:** county control variables / secondary IVs.

**Bonus — the heatmap's missing layer:** `SNAPSPTH` (SNAP-authorized stores per
1,000) is a real **per-capita food-access** metric — it can upgrade the
`/findings/retention` choropleth's raw retailer *count* into a density layer for
the food-desert × churn story.

**Reproduce:** download the Atlas xlsx, read the `STORES` / `ACCESS` /
`ASSISTANCE` sheets (header in row 2), filter `State=='CA'`, merge on `FIPS`.
