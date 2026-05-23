# Contributing to Civica

This is an internal document for Civica contributors (team members and
contractors). It captures the conventions that the codebase assumes you know.

## TL;DR

```bash
git checkout -b claude/<scope>-<slug>      # see docs/branch-naming.md
pnpm install                                # one-time
pnpm typecheck && pnpm test                 # before your first commit
# Make a change, run the test command for the package you touched
git commit -m "feat(<package>): <one-line subject>"
git push -u origin HEAD
gh pr create --base codex/rebuild-feb18 --fill
```

Detailed steps below.

---

## Before your first PR — read these

1. **[docs/branch-naming.md](docs/branch-naming.md)** — Branches are named
   `claude/<scope>-<slug>`. PRs target `codex/rebuild-feb18`, not `main`.
2. **[docs/brand_voice.md](docs/brand_voice.md)** — Every user-facing string
   (iOS screen, SMS, email, error message) gets weighed against this doc.
   "Plain. Specific. Adult. Never sunny, never sorry, never bureaucratic."
3. **[README.md](README.md)** — Project layout, toolchain, and the
   apps/api vs apps/enrollment-api distinction (these are different services).
4. **[CHANGELOG.md](CHANGELOG.md)** — When you ship something a contributor
   or downstream consumer would want to know about, add an entry under
   `[Unreleased]`.

## Which package are you touching?

| If your change affects… | …land it in… | …run tests with… |
|---|---|---|
| SNAP eligibility rules (CA/MA, ABAWD, SUA, HEAP) | `packages/snap-rules/` | `pnpm --filter @civica/snap-rules test` |
| Error-risk / defensibility scoring | `packages/snap-qc-engine/` | `pnpm --filter @civica/snap-qc-engine test` |
| Federal calc chain (deductions, allotment) | `packages/snap-calculator/` | `pnpm --filter @civica/snap-calculator test` |
| Recertification scheduling | `packages/recert-engine/` | `pnpm --filter @civica/recert-engine test` |
| iOS UI / SwiftUI | `Civica/` | Xcode test target |
| Enrollment API routes (packets, navigator, buddy, recert) | `apps/enrollment-api/` | `pnpm --filter @civica/enrollment-api test` |
| Civic API routes (assistant, examples, issue-classify) | `apps/api/` | `pnpm --filter @civica/api test` |
| Navigator dashboard | `apps/dashboard/` | `pnpm --filter dashboard test` |
| Applicant-facing web app | `apps/web/` | `pnpm --filter @civica/web test` |
| `/compliance` dashboard data (PER, OBBBA, outcomes) | `apps/dashboard/lib/analytics/` | `pnpm --filter dashboard test lib/analytics` |
| DB schema | `supabase/migrations/` | `supabase db push` (staging first) |

## Commit conventions

- Conventional Commits: `<type>(<scope>): <subject>`
- Types: `feat`, `fix`, `perf`, `docs`, `test`, `refactor`, `chore`
- Scope is the package or app name (`snap-rules`, `enrollment-api`, `dashboard`, `supabase`, `ios`).
- Subject is one line, imperative mood, under 72 chars.
- Body explains the *why*, not the *what*. The diff already shows the what.

Examples:
```
fix(enrollment-api): unify navigator + applicant error-risk scoring
perf(enrollment-api): batch withActorContext set_config RPCs into one call
feat(supabase): buddy_packet_summary_view restricts PII at the DB layer
```

## Before pushing

```bash
pnpm typecheck                              # workspace-wide
pnpm --filter <package> test                # the package you touched
```

If you touched any user-facing copy (iOS screen, web view, SMS, email):
re-read `docs/brand_voice.md` and check your strings against the
six rules and the "words we don't use" list.

If you touched anything in `supabase/migrations/`:
- Migrations are append-only. Never rewrite an applied migration; add a new one.
- Run `supabase db push` against staging before merging.
- If the migration changes RLS, add a pgTAP test in `supabase/tests/`.

If you touched `wrangler.toml` or added a `[triggers]` entry:
- Update the local-dev section in README if the new trigger needs setup.
- Verify with `wrangler deploy --dry-run` from `apps/enrollment-api/`.

## What the review will ask

We run interactive reviews via the `/plan-eng-review` skill before
implementation. If your change is non-trivial (architecture, security, or
data flow), expect the reviewer to ask about:

- Test coverage — happy path + at least one error path + at least one
  regression test if you fixed a bug.
- Failure modes — for each new code path, what realistic production failure
  could happen (timeout, null reference, race condition), and whether the
  user would see a clear error or a silent failure.
- DRY — flag repetition aggressively. The scoring divergence between
  navigator and applicant endpoints (May 2026) is the canonical example of
  why duplicated logic is a real cost.
- DB-layer defenses — for buddy / staff-cross-org / multi-tenant access:
  application-layer filters are not enough. RLS + views or RLS + service-role
  application checks are required.

See the cognitive patterns at the top of `~/.claude/skills/gstack/plan-eng-review/SKILL.md` for the full set.

## TODOS

Deferred work lives in `TODOS.md`. Add new items as `## TODO-N` headings.
Never delete a TODO — mark it `DONE` with a backlink to the PR that closed it.

## Questions

- Open a draft PR early and tag a teammate.
- For sensitive product/compliance questions (SNAP rules, PII handling,
  state-specific overlays), CC the compliance owner — don't merge first.
