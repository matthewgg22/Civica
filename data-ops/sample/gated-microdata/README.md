# Gated microdata — acquisition scaffolds

Four external datasets that the error-rate / retention / TAM analyses want as
regression inputs but that **cannot be auto-fetched** by an unattended agent:
three are behind a free login + click-through research-use agreement, and the
fourth (Census SAIPE) is keyless-capable but the agent sandbox blocks every
network-fetch tool. This directory holds the **acquisition scaffold** for each:
a per-dataset README with the exact manual (or one-command) pull, the public
metadata, and — where the agent could retrieve it — the vendored bytes.

> **No login was performed and no terms were accepted to build this.** Every
> READMEs's "acquisition" section is written for a human operator to execute.
> See the finding `docs/findings/2026-05-29-data-gated-microdata.md` for the
> regression role (DV / IV / control) of each dataset and the full checklist.

## Index

| Dir | Dataset | Gate | Regression role | Unit · years |
| --- | ------- | ---- | --------------- | ------------ |
| `openicpsr-124381/` | Homonoff & Somerville — SNAP **recertification** costs (SF CalFresh) | openICPSR/AEA free account + Terms-of-Use click-through | **IV** (quasi-random interview-date instrument) → recert take-up **DV** | CalFresh case × month, **2014–2016** |
| `openicpsr-194727/` | Giannella/Homonoff/Rino/Somerville — administrative burden → **procedural denial** RCT (LA) | openICPSR/AEA free account + Terms-of-Use click-through | **IV** (randomized flexible-interview treatment) → approval / procedural-denial **DV** | applicant (~65K) , **field-experiment window ~2017** |
| `census-saipe/` | Census **SAIPE** county poverty + median income | none for small calls — **keyless**; blocked only by the agent sandbox | **control** (county poverty rate, median HH income) | county × year, **CA (state=06)**, annual |
| `census-acs-pums-foodstmp/` | Census **ACS PUMS** household SNAP receipt (`FS`/FOODSTMP) + demographics | free Census API key (microdata) | **DV** (household SNAP receipt) + **controls** (demographics) | household record, **2022 1-Year (CA)** |

## Why these four, together

They span the three error/retention surfaces Civica is building a data-proven
pitch around, at the **micro (case/applicant/household) level** the public
aggregates in `../usda-qc-ca/`, `../usda-caper/`, and `../cdss-cf18/` can only
approximate:

- **Recertification churn** (124381) — case-level, with a *causal instrument*.
  The micro analogue of `../cdss-cf18/` (CF-18 procedural churn, aggregate).
- **Procedural denial on the application side** (194727) — applicant-level RCT.
  The micro, *experimentally identified* analogue of `../usda-caper/` (CAPER
  denial-side error, aggregate).
- **Eligible-but-unenrolled + demographics** (ACS PUMS `FS`) — the household
  substrate behind `../ca-snap-gap/` (which already uses PUMS but vendors only
  PUMA-level model outputs, not the raw household DV).
- **County poverty controls** (SAIPE) — the denominator/control layer every
  county-level regression in `docs/findings/2026-05-28-per-regression-preregistration.md`
  needs to avoid confounding "more poverty" with "more error."

## Status legend

- **SCAFFOLD** — README + public metadata only; bytes require manual acquisition.
- **PULLED** — bytes vendored here (reproducible).

| Dir | Status | Note |
| --- | ------ | ---- |
| `openicpsr-124381/` | SCAFFOLD | Manual: AEA login → project 124381 → accept ToU → download `V1`. |
| `openicpsr-194727/` | SCAFFOLD | Manual: AEA login → project 194727 → accept ToU → download `V1`. |
| `census-saipe/` | SCAFFOLD | Keyless one-command pull documented; agent sandbox blocked `curl`/WebFetch so bytes are not vendored. |
| `census-acs-pums-foodstmp/` | SCAFFOLD | Free API key required for the microdata endpoint; exact call documented. |
