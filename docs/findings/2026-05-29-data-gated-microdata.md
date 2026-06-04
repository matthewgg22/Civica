---
id: 2026-05-29-data-gated-microdata
date: 2026-05-29
scope: [analytics, regression, data-ops]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: data-ops/sample/gated-microdata/README.md
    note: "Acquisition-scaffold index: regression role (DV/IV/control), gate type, and manual download path per dataset"
  - kind: file
    ref: data-ops/sample/gated-microdata/openicpsr-124381/README.md
    note: "openICPSR 124381 (Homonoff & Somerville) — SF CalFresh recert microdata 2014-2016 + interview-date IV. Gate: AEA login + ToU click-through"
  - kind: file
    ref: data-ops/sample/gated-microdata/openicpsr-194727/README.md
    note: "openICPSR 194727 (Giannella/Homonoff/Rino/Somerville) — LA flexible-interview RCT (~65K applicants, ~2017). Gate: AEA login + ToU click-through"
  - kind: file
    ref: data-ops/sample/gated-microdata/census-saipe/README.md
    note: "Census SAIPE county poverty + median HH income (CA, annual). Keyless API; blocked only by agent sandbox. Companion script: pull_saipe_ca.py"
  - kind: file
    ref: data-ops/sample/gated-microdata/census-saipe/pull_saipe_ca.py
    line: 1
    note: "Stdlib-only (urllib) keyless one-command pull, written for a human operator in any python3 env"
  - kind: pr
    ref: "#475"
    note: "Recovered the acquisition scaffolds from an orphaned agent worktree; companion to the 2026-06-04 audit"
---

## What we found

Four external datasets the audit ([[2026-05-29-regression-data-sources]]) flagged
as P0/P1 for the pre-registered SNAP error / churn / retention regression cannot
be auto-fetched by an unattended agent. The acquisition scaffold (READMEs +
where possible a keyless puller) now lives at
`data-ops/sample/gated-microdata/` with the **regression role + gate type +
exact manual pull path** documented per dataset:

| Dir | Dataset | Gate | Regression role |
| --- | ------- | ---- | --------------- |
| `openicpsr-124381/` | Homonoff & Somerville — SNAP recert costs (SF CalFresh) | openICPSR/AEA free account + ToU click-through | **IV** (quasi-random interview-date) → recert take-up **DV** |
| `openicpsr-194727/` | Giannella/Homonoff/Rino/Somerville — administrative burden → procedural denial RCT (LA) | openICPSR/AEA free account + ToU click-through | **IV** (randomized flexible-interview) → approval / procedural-denial **DV** |
| `census-saipe/` | Census SAIPE county poverty + median HH income | none for small calls — **keyless**; only the agent sandbox blocks it | **control** (county poverty rate, median HH income) |
| `census-acs-pums-foodstmp/` | Census ACS PUMS household SNAP receipt (`FS`/`FOODSTMP`) + demographics | free Census API key for the microdata endpoint | **DV** (household SNAP receipt) + **controls** (demographics) |

**No login was performed and no terms were accepted to build this directory.**
Every README's "acquisition" section is written for a human operator to execute.

## Why it matters

The audit's optimism that openICPSR pulls a free panel was wrong — the openICPSR
case-level microdata for the two recert studies is **restricted, not public**
(corrected in [[2026-05-29-data-academic-recert-microdata]]). What ships from
those packages is *code + variable definitions*, not the case-level `.dta`/`.csv`
files. The gated-microdata scaffold codifies that honesty: it does not pretend
the data is one `curl` away. It documents the IV/DV/control role, the gate, and
the path a human operator would take.

The SAIPE entry is the exception — it is **keyless and reproducible**, blocked
only by the agent sandbox. The `pull_saipe_ca.py` companion (stdlib-only) gives
a human operator a one-command path to the control layer for every county-level
error regression.

## What changes

- The 4 datasets stay as **SCAFFOLD** in `data-ops/sample/gated-microdata/`
  until a human operator runs the documented acquisition steps. Bytes land
  under `PULLED` status only with provenance.
- The two openICPSR recert studies remain **request-only like Unrath** per
  [[2026-05-29-data-academic-recert-microdata]]; this finding inherits that
  status and does not re-litigate it.
- SAIPE is the lowest-friction "first pull" — it unblocks the county-level
  control layer for every county-grain regression downstream.

## Open questions

- Run `pull_saipe_ca.py` outside the agent sandbox to vendor the CA county
  panel; promote that subdir from SCAFFOLD to PULLED.
- Confirm whether the LA RCT (openICPSR 194727) analysis data is obtainable
  separately from the package's code/docs; if yes, apply.
- Acquire a free Census API key and pull the ACS PUMS 2022 1-Year CA microdata
  → promote `census-acs-pums-foodstmp/` to PULLED.

Related: [[2026-05-29-regression-data-sources]] · [[2026-05-29-data-academic-recert-microdata]] · [[2026-05-28-per-regression-preregistration]]
