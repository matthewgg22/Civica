# Civica Launch Runbook

## Goal
Ship tonight with stable auth/session handling, resilient Supabase writes, and validated RLS/migrations.

## Pre-Launch Go/No-Go
Go only if all are true:
- `scripts/launch_readiness_check.sh` passes.
- Supabase SQL bundle (`supabase/sql/launch_bundle.sql`) ran without errors.
- Smoke checklist (`docs/launch_smoke_checklist.md`) completed on at least one physical device.
- No open Critical launch blockers in auth, reminders, MAPC, or GovHelp.

No-Go triggers:
- Release build fails.
- Missing Supabase tables/policies remain.
- GovHelp endpoint fails consistently.
- Sign-out leaves stale personalized state or token ownership.

## Launch Sequence
1. Run `scripts/launch_readiness_check.sh`.
2. Run `supabase/sql/launch_bundle.sql` in Supabase SQL Editor.
3. Re-run key smoke checks (auth, reps, MAPV reminders, Why Call, GovHelp, feedback).
4. Publish release/TestFlight rollout.
5. Monitor logs and Supabase errors for first hour.

## Rollback Plan
If launch regresses:
1. Stop rollout in App Store Connect/TestFlight.
2. Disable high-risk edge paths first:
- Temporarily disable GovHelp edge function if abuse or failures spike.
- Keep read-only features active.
3. If DB policy issues occur:
- Re-run `supabase/sql/launch_bundle.sql`.
- If needed, revert most recent migration and restore last known-good policy set.
4. Publish hotfix build with only critical patch set.

## Incident Playbook
### A. Missing tables / migration errors
- Symptom: `table is missing` warnings, MAPC sums unavailable.
- Action: run `supabase/sql/launch_bundle.sql`, verify table + policy queries.

### B. Network instability spikes
- Symptom: transient timeout/connection lost errors.
- Action: confirm retry logic behavior; treat as degraded but non-fatal unless user flows hard-fail.

### C. Auth/session anomalies
- Symptom: writes failing with no session or wrong-context behavior.
- Action: force sign-out/in cycle, verify token rebind and session refresh path.

### D. Push token ownership drift
- Symptom: notifications not delivered after account switch.
- Action: verify token upsert/rebind path and sign-out disable path on next launch.

## Post-Launch 24h Checks
- Supabase error rate trend.
- GovHelp function rate/latency/error distribution.
- Reminder scheduling success rate.
- MAPC call analytics ingest and sums.
- User-reported auth/sign-out issues.
