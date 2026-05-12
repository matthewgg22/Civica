# SNAP source-citation signoff

Engineering deliverable for legal/policy review. Each row below is a user-facing claim, dollar value, URL, label, or agency reference that ships in Civica's SNAP screener. Civica engineering has populated the **Current code value**, **Current code location**, **Proposed verified value**, and **Last checked** columns. The reviewer fills the remaining columns — **Source URL**, **Effective date**, **Reviewer**, **Signoff date**, and **Renewal cadence** — and returns this document signed before the production beta cuts.

The TODO comments at [SNAPStateResources.swift:16](../Civica/Features/SNAP/SNAPStateResources.swift) (lines 16, 18, 167) point future readers at this table.

> **Scope.** This is a product/engineering compliance decision aid for the Worktree A beta launch (MA-only). It is not a legal opinion. The reviewer signoff converts each row from "engineering's best guess" to a citable, dated source we can present to counsel or regulators.

> **Renewal.** All federal rows renew annually with the USDA FNS COLA cycle (Oct. 1). MA rows renew with the DTA Helpful Charts update cycle (typically annually plus mid-year COLA refresh). The reviewer sets the cadence per row; engineering re-opens this document on each renewal.

---

## Source-citation table

| # | Jurisdiction | Data item | Current code value | Current code location | Proposed verified value | Source authority | Source URL | Effective date | Last checked | Owner | Reviewer | Signoff date | Renewal cadence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | MA | Apply URL | `https://dtaconnect.eohhs.mass.gov/` | [SNAPStateResources.swift:17](../Civica/Features/SNAP/SNAPStateResources.swift) | _(reviewer to confirm: the FNS-linked Apply for Benefits destination, or DTA Connect root)_ | FNS MA directory | `https://www.fns.usda.gov/snap/state-directory/massachusetts` | _(reviewer)_ | 2026-05-12 | Engineering (Matthew) | Legal-Policy | _(blank)_ | Annual + COLA |
| 2 | MA | Helpline label + phone | `"DTA Assistance Line (placeholder)"` | [SNAPStateResources.swift:19](../Civica/Features/SNAP/SNAPStateResources.swift) | `"DTA Assistance Line, 877-382-2363"` _(verify)_ | FNS MA directory | _(reviewer)_ | _(reviewer)_ | 2026-05-12 | Engineering | Legal-Policy | _(blank)_ | Annual |
| 3 | MA | BBCE gross income limits, HH 1-8 | HH 1-4 only, stale: `[2510, 3408, 4304, 5200]` with HH 5+ clamped to size-4 floor | [MAStateRules.swift:114-134](../Civica/Features/SNAP/Rules/MAStateRules.swift) | `[2660, 3607, 4553, 5500, 6447, 7393, 8340, 9287]` + `$947` per additional member | DTA Helpful Charts and Figures (SNAP) | _(reviewer)_ | 2026-02-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual + COLA |
| 4 | MA | Standard Utility Allowances | Heating/cooling `$799`; non-heating `$507`; phone `$63` | [MAStateRules.swift:152-161](../Civica/Features/SNAP/Rules/MAStateRules.swift) | Heating/cooling `$914`; non-heating `$556`; phone `$64`; Bay State CAP `$914` | DTA Helpful Charts / DTA COLA | _(reviewer)_ | 2025-10-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual + COLA |
| 5 | Federal | FY26 max allotments, HH 1-8 | `[292, 536, 768, 975, 1158, 1390, 1536, 1756]` + `$220`/add | [FederalDefaultRules.swift:243-252](../Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | `[298, 546, 785, 994, 1183, 1421, 1571, 1789]` + `$218`/add | USDA FNS FY26 COLA | _(reviewer)_ | 2025-10-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual COLA |
| 6 | Federal | Standard deduction by HH band | HH 1-3 `$204`; HH 4 `$217`; HH 5 `$254`; HH 6+ `$291` | [FederalDefaultRules.swift:198-203](../Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | HH 1-3 `$209`; HH 4 `$223`; HH 5 `$261`; HH 6+ `$299` | USDA FNS FY26 COLA | _(reviewer)_ | 2025-10-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual COLA |
| 7 | Federal | Maximum excess shelter deduction (non-elderly/disabled) | `$712` | [FederalDefaultRules.swift:215](../Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | `$744` (cap removed for households with an elderly/disabled member) | USDA FNS FY26 COLA | _(reviewer)_ | 2025-10-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual COLA |
| 8 | Federal | Minimum SNAP benefit, HH 1-2 | `$23` | [FederalDefaultRules.swift:263](../Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | `$24` | USDA FNS FY26 COLA | _(reviewer)_ | 2025-10-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual COLA |
| 9 | Federal | Gross income limits, HH 1-8 (48 states + DC) | _Derived from FPL formula, drifts ±$1_ | [FederalDefaultRules.swift:35](../Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | Exact tables: `[1696, 2292, 2888, 3483, 4079, 4675, 5271, 5867]` + `$596`/add — do **not** derive from FPL | USDA FNS FY26 COLA | _(reviewer)_ | 2025-10-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual COLA |
| 10 | Federal | Net income limits, HH 1-8 (48 states + DC) | _Derived from FPL formula, drifts ±$1_ | [FederalDefaultRules.swift:40](../Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | Exact tables: `[1305, 1763, 2221, 2680, 3138, 3596, 4055, 4513]` + `$459`/add — do **not** derive from FPL | USDA FNS FY26 COLA | _(reviewer)_ | 2025-10-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual COLA |
| 11 | Federal | Asset limits | `$3,000` standard; `$4,500` with elderly/disabled member | [FederalDefaultRules.swift:274-276](../Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | `$3,000` standard; `$4,500` with elderly/disabled member (verify FY26 carry-over) | USDA FNS FY26 COLA | _(reviewer)_ | 2025-10-01 | 2026-05-12 | Engineering | Policy | _(blank)_ | Annual COLA |
| 12 | All states | Agency-name list | Internal mapping by state code | [SNAPStateResources.swift:168-220](../Civica/Features/SNAP/SNAPStateResources.swift) | Verified 50-state list against USDA State Directory + each state agency page | USDA State Directory + state agency pages | `https://www.fns.usda.gov/snap/state-directory` | 2026-02-17 | 2026-05-12 | Engineering | Legal-Policy | _(blank)_ | Annual |

---

## Notes for the reviewer

- **Rows 5–11** are part of Worktree B (rules-engine correctness). Worktree A — the pre-beta privacy/location/MA-gate batch — does not change these dollar values. Worktree A lands the gate that prevents non-MA users from seeing the (currently stale) federal-floor math at all. Sign these rows off ahead of Worktree B so engineering can land the updates without a second review round.
- **Row 1** (MA apply URL) is the one user-facing URL active in production today. The DTA Connect root is reachable; the FNS Massachusetts directory may link to a more specific Apply for Benefits destination. Reviewer should pick one and stamp the row.
- **Row 2** (helpline) currently displays the label `"DTA Assistance Line (placeholder)"`. The "placeholder" word makes it obvious the value is unverified. Engineering will keep that suffix until row 2 is signed off.
- **Row 12** is broad: it covers every state-agency string that appears in the unsupported-state gate. Reviewer can spot-check 5–10 states against the FNS directory and the linked state pages; engineering does not need every state individually signed off if reviewer is satisfied with the source authority.
