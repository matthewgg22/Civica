# Findings ledger

Evidence-backed, append-only record of analytical findings for Civica.

Findings are what we **know** (or have decided to believe) based on cited evidence — distinct from:
- **Code** — the implementation
- **Plans / runbooks** (`docs/plans/`, `docs/runbooks/`) — what we intend to do
- **Auto-memory** (`~/.claude/.../memory/`) — private to one Claude Code session, captures *how* the user works, not *what we found*

Every finding has a primary source. If it can't be cited, it doesn't go here.

## Why this exists

LLM sessions are stateless. Without a shared, citable ledger, every conversation rebuilds the same analyses from scratch and loses the evidence chain. This directory is the source of truth that survives any model, agent, or session restart — and feeds the gbrain semantic index so future sessions can recall it.

See [2026-05-28-evidence-ledger-architecture](2026-05-28-evidence-ledger-architecture.md) for the architectural rationale.

## File naming

`YYYY-MM-DD-short-slug.md` — date is when the finding was first written, not when the underlying evidence dates from. If a finding is superseded, the new file gets a new date and points back via `supersedes:`.

## Schema

Every finding starts with YAML frontmatter:

```yaml
---
id: 2026-05-28-test-prefix-empty                 # filename stem, no .md
date: 2026-05-28                                 # ISO date
scope: [conventions, retros]                     # free-tag list; pick from existing or coin new
confidence: high | medium | low                  # how sure are we?
status: active | superseded | retracted          # active is default
supersedes: [id-of-older-finding]                # empty list if none
superseded_by: [id-of-newer-finding]             # filled in by future findings
evidence:
  - kind: git                                    # git | file | url | dataset | pr | memory | external
    ref: "HEAD~100..HEAD"                        # git ref / path / URL / dataset@version
    note: "0/100 commits match ^test(\\(|:)"     # 1-line excerpt or justification
  - kind: file
    ref: CLAUDE.md
    line: 1
    note: "rule encoded here"
---
```

After the frontmatter, prose. Lead with the bottom line. Sections optional but `## What we found` / `## Why it matters` / `## What changes` is a good default.

Use `[[other-finding-id]]` to link sibling findings. The build script picks these up for graph rendering in Datasette later.

## Adding a finding

1. Copy [`_template.md`](_template.md) → `docs/findings/YYYY-MM-DD-your-slug.md`
2. Fill in frontmatter; **every claim in the prose needs an entry in `evidence:`**
3. Append a one-line entry to [`INDEX.md`](INDEX.md)
4. Run `make findings` to rebuild `findings.db`
5. Run `make datasette` to verify it loads cleanly

If you're superseding an existing finding, set the old one's `status: superseded` and `superseded_by: [your-new-id]` rather than deleting it. Lineage matters.

## Tooling

| Tool | What it does | How to run |
|---|---|---|
| `make findings` | Parse `*.md` frontmatter → `findings.db` (SQLite) | `make findings` |
| `make datasette` | Serve the queryable UI on :8001 | `make datasette` |
| `make report` | Render Quarto reports in `docs/reports/` | `make report` |
| DVC (data) | Version vendored datasets; findings cite `dataset@version` | `dvc add data-ops/sample/foo.csv` |

The findings DB is regenerated from source on every build — **don't edit `findings.db` directly**. The `.md` files are canonical.

## DVC remote setup (one-time)

DVC stores the actual data bytes outside git. Recommended remote: Cloudflare R2 (zero egress, ~$0.015/GB/month). Example config — fill in real bucket + creds:

```bash
dvc remote add -d civica-data s3://civica-data-dvc
dvc remote modify civica-data endpointurl https://<ACCOUNT_ID>.r2.cloudflarestorage.com
dvc remote modify --local civica-data access_key_id <R2_ACCESS_KEY>
dvc remote modify --local civica-data secret_access_key <R2_SECRET>
```

Until the remote is wired, `dvc add` still works locally — it just can't push.

## What does NOT belong here

- Code conventions (those live in `CLAUDE.md`)
- Implementation plans (`docs/plans/`)
- Runbooks (`docs/runbooks/`)
- Strategy decks (`docs/strategy/`)
- Compliance source documents (`docs/compliance/`)
- Audit *reports* (`docs/audits/`) — those are the *output* a finding might cite; the finding is the analytical claim *about* the audit

If you're not sure: a finding is a sentence that takes the form **"X is true, and here's why we believe that"** with at least one citation. Anything else lives somewhere else.
