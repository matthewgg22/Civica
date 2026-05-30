# ICPSR 39331 (Pukelis) — CA SNAP county-month enrollment + policy waivers

The **outcome panel** for the COVID natural experiment. From ICPSR 39331
(Pukelis, *SNAP COVID-19 Policy and Enrollment Data, 1987–2024*), the CA slice of
DS0002 (county enrollment) + DS0001 (policy), Delimited `.tsv`.

- `ca_county_month_enrollment.csv` — CA **county-month** SNAP enrollment +
  application dispositions, **2016–2024, 58 counties** (5,336 rows):
  `HOUSEHOLDS`, `INDIVIDUALS`, `ISSUANCE`, `APPS_RECEIVED/APPROVED/DENIED`, and the
  denial split **`APPS_DENIED_NEEDBASED` vs `APPS_DENIED_PROCEDURAL`**.
- `ca_policy_waivers.csv` — CA state-month policy/waiver records (DS0001):
  `POLICY_NAME` (coded — see the ICPSR codebook), `VALUE`, dates. The COVID-era IVs.

**Cross-validation:** CA's procedural-denial share here (**~60%**, 2016–2024)
matches the independent CDSS **CF 296** figure (~67%) — two unrelated sources
agree ~2 in 3 CA application denials are procedural, not need-based.

**Regression role:** the **county-month enrollment / denial OUTCOME panel** that
pairs with the ICPSR 39703 EA-end instrument + the DS0001 waivers for a
difference-in-differences / event study on SNAP churn & denials.

Source: ICPSR 39331 (public-use), Delimited. Raw 57 MB national `DS0002-Data.tsv`
not committed — `pd.read_csv(..., sep='\t', encoding='latin-1')`, filter
`STATEFIPS==6` to regenerate. (DS0003 state-level detail goes back to 1987;
not extracted here.)
