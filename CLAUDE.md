
## Findings ledger

Evidence-backed analytical findings live in `docs/findings/` — read [INDEX.md](docs/findings/INDEX.md) for the current list and [README.md](docs/findings/README.md) for the schema. Every claim cites a primary source (git ref, file:line, PR, dataset version, URL, or auto-memory id).

This is the source of truth for *what we know*, distinct from:
- auto-memory (`~/.claude/.../memory/`) — private session preferences, not findings
- plans / runbooks (`docs/plans/`, `docs/runbooks/`) — intent, not evidence
- code — implementation, not claims

When adding a new finding: copy `docs/findings/_template.md`, fill in evidence, append to `INDEX.md`, then `make findings` to rebuild `findings.db`. `make datasette` serves a queryable UI.

When superseding a finding: set the old one's `status: superseded` and `superseded_by: [new-id]` — do not delete. Lineage is the point.

## Open work / next-up

Actionable work items (bugs to fix, PRs to make, follow-ups) live as **GitHub issues** — not in auto-memory, not only in a session note. At the start of a work session — especially SNAP / eligibility / iOS-test work — check the queue:

- `gh issue list --state open` (or filter: `gh issue list --label bug`)
- The fixing PR closes it with `Closes #N` (auto-closes on merge).

This is the source of truth for *what to do next*, distinct from `docs/findings/` (*what we know*), auto-memory (*where a session left off*), and `docs/plans/` (*intent*). When you discover an out-of-scope issue mid-task, **file it** (`gh issue create`) rather than only noting it in auto-memory — issues are team-visible, survive across sessions, and a cold agent finds them in one command. Reserve auto-memory for genuine session handoff state.

## Commit message conventions

Test work is tracked in retros by commit-prefix grep. Tag accordingly:

- New or expanded test files → `test:` (or `test(<scope>):` to clarify — `test(qa):`, `test(design):`, `test(e2e):`).
- **Post-merge bug fixes: the fix PR MUST include a `test(qa): <regression>` commit** reproducing the bug, separate from the `fix:` commit. No exceptions, even for one-line fixes.
- Mixed feature + test diffs → split into a `feat:`/`fix:` commit and a `test:` commit so the prefix is greppable.

Retro/health metric: `git log --since=… --pretty=%s | grep -cE '^test(\(|:)'` — should be non-zero any week with test work.

## Design systems

Three, governing different surfaces. Read the right one before any visual or UI change.

- `apps/web/DEMETER-DESIGN.md` — the **Demeter public web product** (`/screen/ask`, `/questions`, `/guides/*`, `/verify`, `/sign-in`). The live consumer surface.
- `DESIGN.md` (repo root) — the **iOS app** (SwiftUI, Civica target).
- `apps/dashboard/DESIGN.md` — the navigator/CBO dashboard. **PARKED** — ask before touching.

They are allowed to differ: iOS carries the Civica brand, Demeter is its own product with its own name and palette. Do not "harmonize" them without asking.

Do not deviate from the governing file without explicit approval. In QA and review, flag code that contradicts it.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

## EBT module conventions

When working in `Civica/Features/SNAP/EBTBalance/` or `apps/enrollment-api/src/routes/ebt/`:
- iOS layering: per-concern Store + Repository (see `EBTBalanceRepository.swift` for template). Never add data-fetching to a Store.
- Strings: split per feature into `Strings/EBT{Concern}Strings.swift`. Every CivicaString MUST have both `.en` and `.es` (parity unit test in EBTStringParityTests catches drift at CI).
- Scrape errors: typed enum (`EBTScrapeError.swift`), wire format per plan §16.2.
- Gateway routes: one file per route under `apps/enrollment-api/src/routes/ebt/`, co-located `.test.ts`, mounted via `ebt/index.ts`.
- Scraper logic: lives in `fly/ebt-scraper/` (separate service), emits typed events to `/webhooks/ebt-scraper`.
- Tests: Swift Testing (`@Test`/`@Suite`). Suites with `nonisolated(unsafe)` static state get `@Suite(.serialized)`.
- Test fixtures: `Civica/Features/SNAP/EBTBalance/__fixtures__/`.

To add a new card processor: see `docs/plans/ebt-tracker-propel-parity.md` §16.4.
To add a new error variant: see §16.2.
To add a new push category: see §16.5.
