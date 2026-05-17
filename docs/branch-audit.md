# Branch Audit — 2026-05-17

Audited against `codex/rebuild-feb18` at `dc2a62b5`.  
All branches belong to `matthewgg22`. None are older than 8 days, so no "abandoned >30 days" entries apply.

## Merged — deletable

These are fully merged into `codex/rebuild-feb18`. Delete with `git branch -d`.

| Branch | Notes |
|--------|-------|
| `claude/gifted-mestorf-fb648f` | Merged via PR #78 (2026-05-17). Safe to delete. |

> `claude/practical-cerf-f4c5c0` is also merged but has an **active worktree** at `.claude/worktrees/practical-cerf-f4c5c0`. Git will refuse `-d` until the worktree is removed.

---

## Active worktrees — do not touch

These branches are checked out in live worktrees. Don't delete them.

| Branch | Worktree path |
|--------|--------------|
| `claude/civica-interview-rehearsal` | `.claude/worktrees/civica-interview-rehearsal` |
| `claude/condescending-shaw-e4b675` | `.claude/worktrees/condescending-shaw-e4b675` |
| `claude/gifted-napier-92a392` | `.claude/worktrees/gifted-napier-92a392` *(this branch)* |
| `claude/peaceful-dewdney-e020ee` | `.claude/worktrees/peaceful-dewdney-e020ee` |
| `claude/practical-cerf-f4c5c0` | `.claude/worktrees/practical-cerf-f4c5c0` |

---

## Unmerged — needs PR

Substantial, coherent work that appears ready (or near-ready) to open a pull request.

| Branch | Commits ahead | Last activity | Subject | Recommendation |
|--------|:---:|---|---|---|
| `claude/charming-ritchie-f339c8` | 15 | 2026-05-12 | Merge rebuild into branch (up-to-date base) | Open PR — base is already synced |
| `claude/modest-mendeleev-6d8d38` | 14 | 2026-05-11 | SNAP legal-review hardening (captures + expedited) | Open PR |
| `claude/funny-carson-469610` | 11 | 2026-05-11 | Practice session VM, chat UI, review summary | Open PR (Interview Coach feature) |
| `claude/affectionate-bhabha-94dbfc` | 7 | 2026-05-10 | IssueCallCenterViewModel → boundary protocols | Open PR |
| `claude/quirky-burnell-e6cf35` | 5 | 2026-05-10 | Stub mapcV3ResolvedSessionID in mock API client | Open PR (small, pairs with above) |
| `claude/brave-allen-e6a3a4` | 4 | 2026-05-11 | GitHub Actions workflow for Civica scheme build + test | Open PR (infra) |
| `claude/inspiring-chaum-557ecb` | 3 | 2026-05-10 | Collapse 17 MAPC fields → MAPCv3State struct | Open PR |

---

## Unmerged — WIP / needs review

Work in progress or small cleanup that needs a decision before merging.

| Branch | Commits ahead | Last activity | Subject | Recommendation |
|--------|:---:|---|---|---|
| `claude/wire-worker-url` | 1 | 2026-05-16 | Dashboard: fields review, document-items, consents in packet detail | Very recent — review then PR or squash into next batch |
| `claude/silly-dijkstra-40b672` | 1 | 2026-05-13 | FindHelp: simplify pass — cache fixtures, trim no-op state | Review then PR |
| `claude/heuristic-blackburn-b6c6ff` | 2 | 2026-05-10 | Route hardcoded `Text()` through catalog + regression guards | Review then PR |
| `claude/hardcore-chatelet-7afe2a` | 1 | 2026-05-11 | Voice-first intake skeleton on VoteNow SNAP — reference only | Decide: prototype to keep as reference, or delete |

---

## Unmerged — design/token spikes

Four branches from 2026-05-09 that may represent sequential iterations of the same design-token work. Review for supersession before deciding which to land.

| Branch | Commits ahead | Subject |
|--------|:---:|---|
| `claude/xenodochial-sanderson-36ab52` | 1 | Tokens: prune aliases, normalize status alphas, add spacing/radius scales |
| `claude/typography-civica` | 1 | Typography: introduce CivicaTypography semantic layer |
| `claude/typography-extended` | 2 | Typography: extend CivicaTypography with weight-tier variants, absorb 299 sites |
| `claude/spacing-radius-strict` | 2 | Spacing/Radius: strict canonical migration to CivicaSpacing/CivicaRadius |

**Recommendation**: `typography-extended` likely supersedes `typography-civica`; `spacing-radius-strict` likely supersedes the token base. Confirm and close the intermediate branches.

---

## Unmerged — single-commit feature stubs

Small, focused changes. Each is a candidate to either open a quick PR or squash into a related feature branch.

| Branch | Commits ahead | Last activity | Subject | Recommendation |
|--------|:---:|---|---|---|
| `claude/state-legislator-headshots-to-api` | 1 | 2026-05-09 | Drop bundled headshots in favor of OpenStates image URLs | PR (size reduction) |
| `claude/sweet-agnesi-efb9ed` | 1 | 2026-05-10 | Wire polling places to BallotReady with vote.gov fallback | PR |
| `claude/view-decomp-sprint` | 1 | 2026-05-09 | Split MyRepsView + extract IssueCallCenterViewModel | PR (pairs with `affectionate-bhabha`) |

---

## Noise — delete

| Branch | Commits ahead | Notes |
|--------|:---:|---|
| `claude/tender-pascal-37de34` | 1 | Commit message is literally `"claude"` — no meaningful content. Delete. |

```sh
git branch -d claude/tender-pascal-37de34
```
