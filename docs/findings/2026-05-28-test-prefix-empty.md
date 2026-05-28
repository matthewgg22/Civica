---
id: 2026-05-28-test-prefix-empty
date: 2026-05-28
scope: [conventions, retros, ci]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: git
    ref: "git log --since='7 days ago' --pretty='%h %s' | grep -cE '^[a-f0-9]+ test(\\(|:)' → 0 of 100"
    note: "Window: 2026-05-21..2026-05-28. Zero commits match the test-prefix convention; nearest miss is '1900aa52 test+docs(ebt): …' which uses a compound prefix no greppable convention catches."
  - kind: file
    ref: CLAUDE.md
    line: 1
    note: "Commit-prefix conventions section added in commit 4fc19035 to encode the rule."
  - kind: memory
    ref: feedback_regression_test_commits
    note: "Personal-memory mirror of the same rule for Claude Code sessions."
---

## What we found

Across the last 100 commits on `codex/rebuild-feb18` and its descendants, **zero** match the conventional `test:` / `test(qa|design|e2e):` commit-message prefix — despite ~18k lines of test code shipping in that window. The convention isn't just under-used; it had not been invented in this repo before 2026-05-28.

## Why it matters

- **Retro signal blindness.** `/retro` and `/health` can't surface test investment if there's no prefix to grep. Test work is currently invisible at the commit-history level.
- **No regression forensics.** When a bug regresses, we have no commit-prefix trail showing the original test that should have caught it. This breaks down badly as the team scales past one engineer.
- **Defensibility.** Partner / counsel / B2G audiences read commit logs. A repo with `feat:` + `fix:` but no `test:` looks like a repo without test discipline, even when the test discipline is real.

## What changes

1. **CLAUDE.md** (commit `4fc19035`) now requires `test:` / `test(<scope>):` for any test-touching commit and requires every post-merge bug fix PR to include a `test(qa): <regression>` commit.
2. **Retro/health metric** (queued, not yet wired): the one-liner `git log --since=… --pretty=%s | grep -cE '^test(\(|:)'` becomes a tracked KPI; should be non-zero any week with test work.
3. **Backfill audit** (optional, not yet run): grep the same 100 commits for diffs touching `*.test.ts` / `*Tests.swift` / `__tests__/` to identify which commits *should* have been `test:` commits. Establishes a baseline for the next retro.

## Open questions

- Is `test(qa):` strict enough, or do we want `test(regression):` as a separate sub-prefix for post-merge fixes specifically? Argument for splitting: regression coverage is the most defensible category; argument against: extra cognitive overhead before the habit even exists.
- Should the convention be enforced by a `commit-msg` hook, or kept as a CLAUDE.md / human-discipline rule? Defer until the habit is in place — premature enforcement burns goodwill.

Related: [[2026-05-28-evidence-ledger-architecture]] — this finding is the first concrete output of the ledger and validates the schema.
