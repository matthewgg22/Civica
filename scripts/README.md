# scripts/

Operational tooling for Civica. Most scripts are domain-specific (data
ingestion, codegen helpers, migrations). The launch-readiness checker
deserves its own section.

## `launch-preflight.sh`

A single command that answers: *"Can we let the next pilot student enroll
right now?"*

The 2026-05-19 launch plan identifies ~10 gates between code-merged and
first-student-enrolled (reachability, CORS, feature flags, Sentry, log
drain, database invariants, compliance copy, operator secrets). This
script runs every gate in one shot and prints a color-coded
PASS/FAIL/SKIP/WARN report. Exits non-zero when any hard gate is red.

Source of truth: `docs/snap/launch-readiness.md`.

### Usage

```bash
bash scripts/launch-preflight.sh             # full run, all gates
bash scripts/launch-preflight.sh --help      # list every check
bash scripts/launch-preflight.sh --only=cors # filter by name substring
bash scripts/launch-preflight.sh --strict    # treat WARN as FAIL
bash scripts/launch-preflight.sh --verbose   # show raw command output
```

Exit codes: `0` = launch-ready, `1` = a hard gate failed,
`2` = missing prerequisite (`curl`, `jq`).

### What it checks

| Category | Check | Gate |
|---|---|---|
| A. Reachability | `enrollment-api-health`, `dashboard-reachable`, `snap-engine-reachable`, `civica-api-reachable` | hard |
| B. CORS allowlist | `cors-allowlist` (PR #197) | hard |
| C. Feature flags | `feature-flags-endpoint` (PR #197) | hard |
| D. Sentry | `sentry-drains` (5 services, last 24h) | hard\* |
| E. Log drain | `log-drain` (Axiom, Session H) | hard\* |
| F. Database | `db-feature-flags`, `db-pilot-leads-constraint`, `db-benefitscal-statuses` | hard\* |
| G. Compliance | `compliance-copy`, `lpie-acl-citation` | warn |
| H. Operator infra | `browserless-secret`, `benefitscal-credentials`, `vercel-civica-web` | warn |
| I. iOS builds | `ios-builds` | warn (opt-in via `--only=ios`) |

\* SKIPs (rather than FAILs) when its environment variable / CLI is
unavailable, so the script is usable from any laptop without secrets.

### Env vars that enable extended checks

| Variable | Enables |
|---|---|
| `SENTRY_AUTH_TOKEN` | Sentry recent-event query per service |
| `SENTRY_ORG` | Sentry org slug (defaults to `civica`) |
| `AXIOM_TOKEN` | Axiom log-drain liveness query |
| `AXIOM_ORG_ID`, `AXIOM_DATASET` | Axiom org + dataset overrides |
| `DATABASE_URL` | psql checks against Supabase |
| `LAUNCH_PREFLIGHT_DRY_RUN=true` | smoke-test mode (no network) |

### Recommended usage

- **Before any pilot enrollment goes live.** Single source of truth for
  "is this safe to send a student to right now?"
- **After any infrastructure change** — new secret rotated, CORS origin
  added, migration deployed, Sentry project moved. Run preflight, eyeball
  the diff against last green run.
- **As an ad-hoc smoke test** when on-call gets paged: which subsystem
  is actually down?

### Future: nightly CI workflow

This script is **not** currently wired to CI as a blocking check — too
many env vars to manage and most checks rely on secrets the CI runner
shouldn't see. A future enhancement is a nightly
`.github/workflows/launch-preflight.yml` that:

- Runs on a schedule (e.g. `0 7 * * *` PT)
- Injects `SENTRY_AUTH_TOKEN`, `AXIOM_TOKEN`, `DATABASE_URL` from repo
  secrets
- Posts results to `#launch-readiness` Slack if any hard gate fails

Not added in this PR — operational only for now.

### Tests

```bash
bash scripts/test-launch-preflight.sh
```

A smoke test that confirms `--help` runs, dry-run completes with exit 0,
and `--only=` filtering works. Not exhaustive — the script's value is
operational, not test coverage.
