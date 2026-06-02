# FY2026 SNAP reference tables — staging + load plan

**Status:** ✅ retrieved + LOADED (2026-06-01, via research agents) · **Date:** 2026-06-01 · **Companion:** [snap-rules-matrix.md](snap-rules-matrix.md)

> **Update 2026-06-01:** the FY2026 figures were retrieved by research agents and **loaded** — `poverty_guidelines.py` now has FY2026 poverty ($15,650 + $5,500), max allotment (HH1–8), and SUA (CA $663/$170/$20 · MA $890/$542/$62); `parameters.py` FY2026 is confirmed (SD $209/$223/$261/$299, cap $744, homeless $198.99, min $24, τ $58, asset $3,000/$4,500). **FY2026 determinations now run.** ✓ items are FNS/HHS/CRS-primary; ◦ items (max-allotment HH1-3/5-8, SD 4/5/6) are ≥2-source-corroborated — reconfirm against the FNS primary table PDF before production. The original staging plan below is retained for provenance.

The engine raises `NoTableForDateError` for any 2026-dated determination — [poverty_guidelines.py](../../backend/civic_api/snap/rules/poverty_guidelines.py) loads **FY2025 only** (effective 2024-10-01 → 2025-09-30). This is the documented deployment TODO at `poverty_guidelines.py:18`. Until FY2026 tables load, the shadow sweep counts 2026 packets as `skipped (no FY ref table)`.

> **Why this is staged, not loaded:** these are benefit-determining policy figures, and per the project rule (flag inferred policy, validate against regulation) they must be pulled from the primary source and confirmed by a human — not transcribed from a model. This doc makes the load mechanical and auditable once the numbers are validated.

## Authoritative sources (pull the numbers from here)

- **FY2026 COLA** (max allotments, standard deductions, shelter cap, income standards, min benefit, resource limits), effective Oct 1 2025: [fns.usda.gov/snap/allotment/cola/fy26](https://www.fns.usda.gov/snap/allotment/cola/fy26)
- **FY2026 Standard Utility Allowances** (state values): [fns.usda.gov/snap/admin/sua-fy26](https://www.fns.usda.gov/snap/admin/sua-fy26) — note SUAs are state-published; confirm CA (CalFresh) + MA (DTA) charts.
- **HHS Poverty Guidelines** (the 2025 guidelines drive FY2026 SNAP): [aspe.hhs.gov/.../poverty-guidelines](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines)

## Figures to load (mirror the FY25 structures in poverty_guidelines.py)

| Table | FY25 reference (in code) | FY2026 value | Source |
|---|---|---|---|
| `PovertyGuidelineTable` 48 | `15060` first / `5380` add'l | ⚠ **DRAFT, verify: `15650` first / `5500` add'l** (HHS 2025) | HHS |
| `MaxAllotmentTable` 48 | `{1:292 … 8:1756}`, +`220` | pull sizes 1–8 + each-add'l | FNS COLA |
| Standard deduction by size | `{≤3:204, 4:217, 5:254, 6+:291}` | pull by size | FNS COLA |
| Max excess shelter deduction | `712` | pull | FNS COLA |
| Minimum benefit (1–2 person) | `23` | pull | FNS COLA |
| Asset limit / elderly-disabled | `3000` / `4500` | pull (watch OBBBA changes) | FNS COLA |
| SUA — MA | heating `799` / non-heat `507` / phone `63` | pull FY26 | MA DTA |
| SUA — **CA** | **not loaded (any year)** | pull FY26 — required for CA determinations | CalFresh |

Only the HHS poverty figure is given a draft value (and still flagged); the determinative allotment/deduction/SUA numbers are intentionally left to pull from the cited source.

> ⚠ **OBBBA watch:** §10101 (TFP cost-neutrality) and §10104 (internet excluded from shelter) may affect the FY2026 allotment growth and shelter deduction. Confirm the COLA memo already reflects them, or model the OBBBA effective dates on the time axis (matrix §… time/WHEN).

## Code changes to make FY2026 actually flow

Loading the tables is necessary but **not sufficient** — the engine reads four reference values by FY25-hardcoded name, so those must become effective-dated lookups (like `poverty_guideline_for`):

1. Add FY2026 `PovertyGuidelineTable`, `MaxAllotmentTable`, `SUATable` (CA+MA) and register them in `_POVERTY_TABLES` / `_MAX_ALLOTMENT_TABLES` / `_SUA_TABLES`. *(These already flow by date — adding the rows is enough.)*
2. Refactor the four hardcoded reads in [federal.py](../../backend/civic_api/snap/rules/federal.py) to effective-dated lookups:
   - L221/L223 `FY25_ASSET_LIMIT_*` → `asset_limits_for(effective_date)` (new)
   - L242 `standard_deduction_for_size_fy25(size)` → `standard_deduction_for(effective_date, size)` (new)
   - L277 `FY25_MAX_EXCESS_SHELTER_DEDUCTION_48` → `max_excess_shelter_for(effective_date)` (new)
   - L298 `minimum_benefit_for(effective_date)` → extend its body to cover FY2026 (signature is already date-based)
3. Add the CI test the file references (`tests/snap/rules/test_effective_dating.py`) asserting a determination at an FY2026 date resolves (no `NoTableForDateError`) and an FY2027 date still raises.

## Verify checklist (before flipping on)

- [ ] Each figure cross-checked against the cited FNS/HHS document (screenshot/printout in the PR).
- [ ] OBBBA §10101/§10104 impact on FY2026 figures confirmed or explicitly N/A.
- [ ] CA SUA chart obtained (currently missing for all years).
- [ ] `test_effective_dating.py` green for an FY2026 date.
- [ ] Re-run the shadow sweep: FY2026 packets stop landing in `skipped (no FY ref table)`.

## Reality check on impact

This unblocks 2026-dated determinations **mechanically**, but real determinations still require the intake to collect per-member ages + citizenship ([intake-collection-gap.md](intake-collection-gap.md)). FY2026 tables + intake expansion are both necessary; neither alone produces a non-`pending` determination on today's packets.
