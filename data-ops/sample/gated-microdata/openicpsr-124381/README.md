# openICPSR 124381 — Homonoff & Somerville, "Program Recertification Costs: Evidence from SNAP"

**SF CalFresh case-level recertification microdata, 2014–2016, with a
quasi-random recertification-interview-date instrument.** This is the *causal*
recertification dataset — the micro, instrumented analogue of the aggregate
CDSS CF-18 churn series in `../../cdss-cf18/`.

> **Status: SCAFFOLD (GATED).** Bytes are **not** vendored. Download requires a
> free openICPSR/AEA account and a click-through Terms-of-Use acceptance. No
> login was performed to build this README.

## What it is

- **Authors:** Tatiana Homonoff (NYU) · Jason Somerville (Federal Reserve Bank of New York).
- **Paper:** *Program Recertification Costs: Evidence from SNAP*, American Economic Journal: Economic Policy. Working paper: SSRN 3621816.
- **Setting:** CalFresh (California SNAP) in **San Francisco County**. In 2016, CalFresh served >2M households at ~$7B/yr; most recipients must recertify every 12 months (recert application + income verification + a caseworker interview).
- **The data:** administrative case records covering recertification spells, **2014–2016**. Unit of observation is the **CalFresh case** (with the recertification event / interview month).
- **The instrument:** caseworkers schedule the mandatory recertification interview, and the **interview date within the month is plausibly quasi-random** with respect to a household's underlying propensity to recertify. The headline result: cases assigned to **later** interview dates are **>20% less likely to recertify** — administrative burden, not eligibility, drives the drop.

## Regression role for Civica

| Slot | Variable | Notes |
| ---- | -------- | ----- |
| **Instrument (IV)** | assigned recertification interview date / position-in-month | The quasi-random scheduling shock. This is the dataset's reason for being. |
| **Dependent (DV)** | recertified (yes/no), and benefit continuity post-recert | Procedural churn at the *renewal* moment. |
| **Treatment of interest** | realized administrative burden (interview timing, friction) | What the IV identifies. |
| **Controls** | case demographics, benefit amount, spell history (as released in the package) | Confirm against the package codebook — exact released columns are not enumerable without the download. |

**Why Civica wants it:** it is the cleanest published *causal* estimate of how
much recertification friction costs eligible households — the empirical spine of
the **retention pillar** (`docs/findings/2026-05-28-retention-pillar-unrath.md`,
`docs/findings/2026-05-29-cdss-cf18-churn.md`). CF-18 sizes CA churn in
aggregate; 124381 proves a slice of it is *caused* by burden, with an instrument.

## Manual acquisition (operator steps)

1. Go to the project landing page: **https://www.openicpsr.org/openicpsr/project/124381/version/V1/view**
2. Sign in (or create a **free** account) — openICPSR accepts AEA / ICPSR / institutional / Google logins. *There is no cost to access AEA-repository data.*
3. On the download dialog, **read and accept the Terms of Use / Responsible-Use agreement** (the AEA/ICPSR click-through: no re-identification of subjects; replication use). **A human must accept this — do not script around it.**
4. Download **Version V1** (full replication package: data + Stata/R code).
5. Unzip into this directory (keep the upstream folder layout) and `dvc add` the data files per `docs/findings/README.md` → "DVC remote setup". **Do not commit raw microdata to git** — vendor only derived, aggregated artifacts + a provenance JSON, mirroring `../../usda-qc-ca/`.
6. Record the retrieval in a `provenance.json` here (source URL, version, retrieval date, license).

## License / terms

- **License:** openICPSR default is **CC-BY 4.0** for data/documents (modified-BSD for code); the depositor selects, and the AEA requires a license that permits replication use. Confirm the exact license shown on the 124381 landing page at download time.
- **Use agreement:** the ICPSR responsible-use click-through — (1) no use of the data to investigate specific individuals unless authorized in writing by ICPSR; (2) no use of any subject identity discovered inadvertently, and notify ICPSR.
- **Citation:** cite the openICPSR DOI shown on the landing page **and** the AEJ:EP article when used in any external claim.

## Sources

- Landing page: https://www.openicpsr.org/openicpsr/project/124381/version/V1/view
- Working paper (SSRN 3621816): https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3621816
- openICPSR / AEA repository terms: https://www.openicpsr.org/openicpsr/aea · https://www.openicpsr.org/openicpsr/faqs
