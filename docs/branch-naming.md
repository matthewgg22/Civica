# Branch Naming Convention

## Quick reference

```
claude/<scope>-<slug>
```

| Pattern | Use for |
|---------|---------|
| `claude/civica-<feature>` | Civica-target feature work |
| `claude/votenow-<feature>` | VoteNow-target feature work |
| `claude/snap-<topic>` | SNAP feature or compliance work |
| `claude/infra-<topic>` | CI, build, config, deploy |
| `claude/fix-<ticket-or-symptom>` | Bug fixes |
| `claude/docs-<topic>` | Documentation only |
| `claude/tokens-<topic>` | Design tokens / style changes |

## Rules

1. **Use intent-revealing names.** `claude/snap-retailer-supabase` tells you what the branch does at a glance. `claude/charming-pasteur-b3f15e` does not.

2. **Prefix with `claude/`.** All Claude-Code-spawned branches live under `claude/` so they're easy to filter and audit.

3. **Keep slugs short and lowercase.** 2–4 hyphen-separated words. No camelCase.

4. **One concern per branch.** Don't mix a feature change with an infra change. Land them separately so PRs stay reviewable.

5. **Never commit directly to `codex/rebuild-feb18`.** Always open a PR from your `claude/` branch.

## Examples

```
# Good
claude/snap-expedited-legal-hardening
claude/civica-interview-coach-ui
claude/infra-github-actions-build
claude/tokens-spacing-radius-strict
claude/fix-keychain-ci-skip
claude/docs-branch-naming

# Avoid
claude/charming-pasteur-b3f15e   ← random name, no signal
claude/claude                    ← no signal at all
main                             ← never branch off this name
feature/xyz                      ← not the Civica prefix convention
```

## When Claude Code auto-generates a name

Claude Code worktrees default to adjective-surname hashes (e.g. `gifted-napier-92a392`). You can override with the `--branch` flag, or rename after the fact:

```sh
git branch -m claude/gifted-napier-92a392 claude/snap-retailer-supabase
```

The worktree keeps working after a rename.

## Archiving stale branches

Once a branch is merged and its worktree is removed, delete it:

```sh
git branch -d claude/<branch>          # safe; refuses unmerged
git push origin --delete claude/<branch>  # remove from remote too
```

Run `docs/branch-audit.md` whenever local branch count exceeds ~25 to keep things tidy.
