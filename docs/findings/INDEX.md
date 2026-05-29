# Findings index

One line per active finding. Format: `- [id](file.md) — one-line hook`. Superseded findings stay in the directory but drop off this list.

See [README](README.md) for schema + tooling.

## 2026-05

- [2026-05-28-test-prefix-empty](2026-05-28-test-prefix-empty.md) — 0/100 commits match `^test(\(|:)` in the last 7 days; convention added to CLAUDE.md
- [2026-05-28-error-attribution-framework](2026-05-28-error-attribution-framework.md) — Proposed: event-sourced error ledger + Bayesian per-slice weights + causal DAG; supersedes scalar `scoreErrorRisk()`
- [2026-05-28-evidence-ledger-architecture](2026-05-28-evidence-ledger-architecture.md) — Repo-tracked findings + Datasette + DVC + Quarto + gbrain; closes the "model forgets on restart" loop
- [2026-05-28-civica-tam-repositioning](2026-05-28-civica-tam-repositioning.md) — Pitch the 13.95% earned-income subgroup PER (2.4× baseline), not the 10.98% statewide average that understates Civica's served population
- [2026-05-28-distribution-union-gig-channels](2026-05-28-distribution-union-gig-channels.md) — Union (SEIU/UFW) + gig-platform partnerships are the lowest-CAC CA channel; ~544K reachable households → ~$1.0B/yr
- [2026-05-28-retention-pillar-unrath](2026-05-28-retention-pillar-unrath.md) — Unrath (2024): ~40%+ CA spells end at reporting moments, 2:1 still-eligible exit ratio; retention/Type-1 reduction becomes the second pitch pillar
- [2026-05-28-submission-data-flow-gap](2026-05-28-submission-data-flow-gap.md) — Submission flow is real through prepare-export (Phase 1); BenefitsCal auto-submit is `DRIVER_NOT_WIRED` and the county-outcome loop has no code path — biggest gap for a data-proven pitch
- [2026-05-28-usda-advanced-automation-scope](2026-05-28-usda-advanced-automation-scope.md) — USDA FNS Advanced Automation (Jan 2024) governs state determination automation; founder read: NOT a live blocker for CBO-facing scope, becomes load-bearing only if Civica touches determination
- [2026-05-28-argyle-evidentiary-standard](2026-05-28-argyle-evidentiary-standard.md) — Load-bearing B2G open question: does Argyle satisfy 7 CFR 273.2(f)? Yes → compliance accelerant/audit trail; no → enrollment-UX only. Canvas dropped, Argyle deferred past T0
- [2026-05-28-per-regression-preregistration](2026-05-28-per-regression-preregistration.md) — Pre-registered regression (5 DVs: payment error, decision speed, handoff + recert completion, throughput) locked before FOIA data; statsmodels harness + synthetic self-test live at /findings/regression, swaps to real CDSS QC data with one command
- [2026-05-29-error-rate-truth-point](2026-05-29-error-rate-truth-point.md) — Anti-drift method for producing canonical insights: AI explains, a deterministic job computes; materialize one error-rate snapshot into Postgres (the omnipresent store) + land AI-drafted insights as cited findings. Kicks off the canonical `error_rate_snapshot`.
- [2026-05-29-error-rate-readout](2026-05-29-error-rate-readout.md) — First live truth-point reading: engagement-implied 10.69% is reading TEST data (322 dev/UAT packets, 16-month spread, 0 Argyle/SUA engagement) — not a Civica signal. Guardrail: cite the methodology + reference layer (61% of CA errors = shelter+wages = Civica's pillars; earned-income cohort 2.4×), not a live reduction, until production traffic exists.
