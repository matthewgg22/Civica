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

## ma_lender_register_2026.csv

All **99 mortgage lenders** rated by the Massachusetts Division of Banks, joined to 2024 HMDA MA
origination counts. Columns: name · HQ · exam date · exam year · rating · MA originations 2024 ·
public evaluation URL.

Rating mix: **0 Outstanding · 7 High Satisfactory · 85 Satisfactory · 7 Needs to Improve · 0 SNC.**
The observed ceiling is High Satisfactory — never imply a grant produces an Outstanding.

⚠️ The name join is fuzzy (HMDA and DOB spell institutions differently). It matched longest-key-first
after normalising suffixes, which fixed one real error: "Guaranteed Rate Affinity" initially
inherited "Guaranteed Rate, Inc."'s 4,444 originations instead of its own 664. **Spot-check any row
before using its volume in a document.**

⚠️ **PE contents are NOT mined.** mass.gov's WAF returns 403 to scripted clients regardless of
headers, and in-browser extraction failed (CSP blocks constructing a Response from a
DecompressionStream, and a manual reader path still yielded no text). The register gives ratings,
dates and volumes — it does not give each lender's disclosed giving. That data is inside the PE PDFs
and remains unread.
