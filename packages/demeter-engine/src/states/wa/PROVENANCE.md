# Washington pack — provenance

**Created:** 2026-08-04 (Wave 1, first NEW state pack — `docs/plans/mae-state-corpus-framework.md`).
**Method:** all content drafted from verbatim source text fetched from the state-of-record hosts on
2026-08-04 (workflow `wf_fac27f96-a29`: 4 fetch agents + 1 independent cross-check that re-fetched
every dollar value and load-bearing claim — **36 confirmed / 0 contradicted / 1 unreachable**), then
an adversarial refute pass over the drafted supplement texts before PR
(workflow `wf_867cbc5b-f8d`: **68 claims confirmed, 6 wrong + 1 unverifiable — all 7 corrected
pre-merge**: resource-test scope for over-200% elderly/disabled AUs; the everyone-in-AU cash-CE
qualifier; WAC 388-450-0190 added to the deductions citation; MCR deadline is the 10th day of month
six; the elderly/ESAP MCR exemption requires no earned income; WASHCAP opt-out needs medical >$35,
a pre-2005 election, or ≥$40 more; the ABAWD period-boundary reset softened to fixed-clock
mechanics pending explicit DSHS confirmation).

## Sources

| Source | URL | Fetch | Dated |
|---|---|---|---|
| WAC 388-414-0001 (categorical eligibility, 200% BBCE) | app.leg.wa.gov/WAC/default.aspx?cite=388-414-0001 | plain, ok | WSR 23-19-056, eff. 10/16/23 |
| WAC 388-478-0060 (income standards table) | …cite=388-478-0060 | plain, ok | table eff. 10/1/2025; WSR 26-02-071 eff. 2/7/26 |
| WAC 388-470-0005 (resource limits) | …cite=388-470-0005 | plain, ok | WSR 25-01-045, eff. 1/10/25 |
| WAC 388-450-0195 (utility allowances) | …cite=388-450-0195 | plain, ok | WSR 26-02-071, eff. 2/7/26 |
| WAC 388-450-0185/-0190 (deductions) | …cite=388-450-0185 | plain, ok | WSR 26-02-071, eff. 2/7/26 |
| WAC 388-450-0200 (medical mechanics) | …cite=388-450-0200 | plain, ok | WSR 24-13-020, eff. 7/7/24 |
| WAC 388-444-0030/-0035 (ABAWD) | …cite=388-444-0035 | plain, ok | WSR 26-05-015, eff. 3/9/26 (post-OBBBA) |
| WAC 388-416-0005, 388-418-0005/-0011 (certs/reporting) | …cite=388-416-0005 | plain, ok | — |
| WAC 388-492 (WASHCAP) | …cite=388-492 | plain, ok | — |
| EA-Z: Categorical Eligibility | dshs.wa.gov/esa/eligibility-z-manual-ea-z/categorical-eligibility-basic-food | plain, ok | Revised 4/1/2026 |
| EA-Z: ABAWD | dshs.wa.gov (EA-Z ABAWD page) | plain, ok | Revised 5/28/2026 |
| EA-Z: deductions / utility chart | dshs.wa.gov (EA-Z) | plain, ok | Revised 4/20/2026 |

**Fetch strategy:** `plain` for every source — no bot-blocking observed on app.leg.wa.gov or
dshs.wa.gov (unlike mass.gov / hhs.texas.gov). If a scheduled refresh starts seeing 403s, record the
change here and in `authorities.json`.

## Findings a maintainer must know

1. **Two update cycles.** The 200% CE standard updates **April 1** (WAC 388-414-0001(2)(a)(ii));
   the 130%/100% table updates **October 1** (WAC 388-478-0060). Never quote one date for both.
2. **No published 200% dollar chart.** The cross-check confirmed no per-AU-size dollar table exists
   for the CE test in WAC or the EA-Z standards page. The pack states the rule as a percentage and
   must never emit computed CE dollar limits.
3. **WAC 388-444-0035 codification error.** The published text has two consecutive subsections both
   numbered (3). Quote rule text, never deep subsection numbers, for ABAWD exemptions.
4. **Dollar values codified 2/7/2026** (WSR 26-02-071), months after the Oct 1 federal COLA — cite
   the WAC-text date, don't assume 10/1/2025.
5. **EA-Z lag.** The WASHCAP EA-Z page's revision stamp is 2011; the WAC has been amended since.
   Prefer WAC for operative rules; EA-Z for worker-practice color.
6. **Homeless shelter deduction is "$198" in WA rule text** (federal figure is $198.99) — quote WA
   as WA states it.

## Refresh triggers
- **2026-12-31 hard cliff:** ABAWD clock window ends; next period begins 1/1/2027 (freshness entry).
- **Oct 2026 COLA:** re-verify WAC 388-450-0185/-0195 dollar values (freshness entry).
- New WSR amendments to any WAC in `authorities.json` → update the affected supplement + this file.
