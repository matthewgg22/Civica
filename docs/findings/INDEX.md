# Findings index

One line per active finding. Format: `- [id](file.md) — one-line hook`. Superseded findings stay in the directory but drop off this list.

See [README](README.md) for schema + tooling.

## 2026-05

- [2026-05-28-test-prefix-empty](2026-05-28-test-prefix-empty.md) — 0/100 commits match `^test(\(|:)` in the last 7 days; convention added to CLAUDE.md
- [2026-05-28-error-attribution-framework](2026-05-28-error-attribution-framework.md) — Proposed: event-sourced error ledger + Bayesian per-slice weights + causal DAG; supersedes scalar `scoreErrorRisk()`
- [2026-05-28-evidence-ledger-architecture](2026-05-28-evidence-ledger-architecture.md) — Repo-tracked findings + Datasette + DVC + Quarto + gbrain; closes the "model forgets on restart" loop
