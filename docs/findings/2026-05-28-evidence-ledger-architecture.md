---
id: 2026-05-28-evidence-ledger-architecture
date: 2026-05-28
scope: [meta, knowledge-management, tooling]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: docs/findings/README.md
    note: "Schema spec for this ledger."
  - kind: file
    ref: scripts/findings_to_sqlite.py
    note: "Build script: markdown frontmatter → SQLite, consumed by Datasette."
  - kind: file
    ref: datasette/metadata.yaml
    note: "Datasette config (titles, descriptions, default queries)."
  - kind: file
    ref: Makefile
    note: "Targets: findings, datasette, report."
  - kind: memory
    ref: MEMORY.md
    note: "Auto-memory continues to exist; private to one Claude Code session, captures preferences not findings."
  - kind: external
    ref: "https://datasette.io/"
    note: "Open-source SQLite UI (Apache 2.0). Free; optional hosted tier skipped."
  - kind: external
    ref: "https://dvc.org/"
    note: "Open-source data version control (Apache 2.0). Free; storage costs paid to existing R2."
  - kind: external
    ref: "https://quarto.org/"
    note: "Open-source reproducible-report compiler (MIT). Free."
---

## What we found

The current knowledge flow is **stateless analysis with private summaries**: user asks → Claude analyzes → user gets value → next session, analysis is gone. Auto-memory partially mitigates this for *preferences* but is wrong for *findings* — it's private to one agent, not citable, and has no evidence schema.

The fix is a **repo-tracked, evidence-schemaed, semantically-indexed ledger** composed of four layers, each open-source and free:

| Layer | Tool | Role | Cost |
|---|---|---|---|
| Source of truth | `docs/findings/*.md` + YAML frontmatter | Citable claims w/ evidence | git only |
| Queryable surface | Datasette over `findings.db` | Filter / facet / share | $0 (Apache 2.0) |
| Reproducible reports | Quarto `.qmd` in `docs/reports/` | Partner-facing PDFs that cite findings by id | $0 (MIT) |
| Dataset provenance | DVC (`.dvc` pointers) → R2 | Version external datasets findings cite | $0 CLI + ~cents/mo R2 |
| Semantic recall | gbrain (existing) | LLM retrieval over the ledger | $0 (local PG) |

Auto-memory **stays** but its role narrows: it captures *how the user works* (preferences, gotchas). Findings capture *what we found* (evidence-backed claims that survive session restart and bind any agent / tool / model).

## Why it matters

- **Survives session restart.** Future Claude / Codex / Cursor sessions read `docs/findings/INDEX.md` as bootstrap context; gbrain serves it on semantic recall.
- **Evidence chain.** Every claim cites primary sources. If a finding turns out wrong, you can trace why we believed it — and supersede it explicitly rather than silently overwriting.
- **One artifact, many uses.** A `.qmd` partner report can embed-and-cite findings by id; if the underlying numbers change, regenerating the report shows the delta.
- **No SaaS lock-in.** All four tools are local, open-source, and replaceable. The findings themselves are just markdown — readable in any editor for the next decade.

## What changes

Scaffolded in this commit:

- `docs/findings/` — README (schema), `_template.md`, `INDEX.md`, three seed findings (this one + test-prefix audit + error-attribution proposal)
- `scripts/findings_to_sqlite.py` — frontmatter parser → SQLite
- `datasette/metadata.yaml` — UI config
- `docs/reports/_quarto.yml` + `example.qmd` — Quarto starter
- `.dvc/` — `dvc init` artifacts
- `Makefile` — `findings` / `datasette` / `report` / `serve` targets
- `CLAUDE.md` — `## Findings ledger` pointer section

Not scaffolded (deferred until needed):

- R2 remote for DVC (config documented in `docs/findings/README.md`; wire when first dataset needs pushing)
- `/finding` skill for one-command finding creation (manual copy of `_template.md` works for v1)
- gbrain sync against `docs/findings/` (run `/sync-gbrain` once Datasette is verified loading)
- Per-finding supersession backlinks rendered in Datasette (Python script supports them; UI pass deferred)

## Open questions

- **`/finding` skill scope.** Just scaffold a new file from template, or also auto-populate evidence by introspecting git context? Latter is more magical, more failure modes. Defer.
- **Cross-repo findings.** Today the ledger is per-repo. If a finding spans Civica + an upstream dependency, where does it live? Probably here, with `evidence.kind: external` + URL; revisit if it becomes common.
- **Retention of superseded findings.** Forever, or prune after N years? Forever for now — disk is cheap and lineage is the whole point.

Related: [[2026-05-28-error-attribution-framework]] is the first substantive finding written under this schema; [[2026-05-28-test-prefix-empty]] is the simpler one that validates the format works for short audits too.
