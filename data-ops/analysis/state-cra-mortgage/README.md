# State-CRA mortgage lender target data

Source: **CFPB/FFIEC HMDA Data Browser API**, 2024 filing year, pulled 2026-08-22.

Method:
1. `/v2/data-browser-api/view/filers?years=2024&states=<ST>` → every institution filing HMDA in
   that state. **Note: this endpoint honors `states` but IGNORES `actions_taken`** — its `count` is
   all LAR records (applications, denials, withdrawals), not originations.
2. For each candidate, `/v2/data-browser-api/view/aggregations?years=2024&states=<ST>&actions_taken=1&leis=<LEI>`
   → true origination count. Candidate floor was set generously (NY raw ≥300, MA raw ≥80) since
   originations run roughly 40–55% of total LAR records.
3. Depository classification is a **name heuristic and is not authoritative**: explicit markers
   (credit union / savings / bancorp / national association / trust company / FCU) plus "bank" as a
   substring, except where the name contains "mortgage banker" (an IMB, not a depository). Four
   HMDA-truncated names were hand-classified as depositories: DIGITAL (DCU), MERRIMACK VALLEY,
   FIRST SOURCE, SEFCU SERVICES.

⚠️ **Coverage is determined by the state licensee list, not by HMDA.** New York covers DFS-licensed
non-depository mortgage bankers; Massachusetts covers DOB-licensed mortgage lenders. Verify any
target against the state licensee register before treating it as covered. HMDA gives volume, not
coverage.

⚠️ 2024 filing year. Both rules test the **prior calendar year**, so confirm against 2025 data when
it publishes.
