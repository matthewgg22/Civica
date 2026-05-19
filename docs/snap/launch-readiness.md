# SNAP B2C v1 Launch Readiness

> **Scope:** California public launch. Last updated: 2026-05-18.
> This document is the single go/no-go gate. Update statuses here; do not duplicate detail — link to source docs.

---

## Prerequisites (current status)

### 1. E2E critical path passing nightly

**✅ Passing** — 14/14 tests pass as of 2026-05-17 (PRs [#99](https://github.com/matthewgg22/civica/pull/99), [#100](https://github.com/matthewgg22/civica/pull/100), [#101](https://github.com/matthewgg22/civica/pull/101), [#102](https://github.com/matthewgg22/civica/pull/102), [#104](https://github.com/matthewgg22/civica/pull/104)).

Workflow: [`.github/workflows/e2e-nightly.yml`](.github/workflows/e2e-nightly.yml) — runs at 04:00 UTC daily against staging. Covers applicant → navigator → handoff → document upload.

Verify before launch: `gh run list --workflow=e2e-nightly.yml --limit 1` — confirm `conclusion: success`.

Runbook: [`docs/snap/e2e.md`](e2e.md).

---

### 2. Lighthouse CI enforced on web PRs

**✅ Enforced** — [`.github/workflows/lighthouse-ci.yml`](.github/workflows/lighthouse-ci.yml) runs on every PR touching `web/**` and on pushes to `codex/rebuild-feb18`. Floors: mobile perf + a11y ≥ 0.9 on locale landing, sign-in, and resources pages. Config: [`web/lighthouserc.json`](../../web/lighthouserc.json).

Shipped in PR [#101](https://github.com/matthewgg22/civica/pull/101). Sign-in baseline is 100 in production.

---

### 3. Sentry secrets configured and receiving events — all 4 services

**✅ Complete** — DSNs set on all 5 services (2026-05-18). snap-engine verified via `/debug/sentry-check` — event confirmed in Sentry.

| Service | Platform | Status |
|---|---|---|
| `civica-snap-engine` | Fly.io | ✅ DSN set, event verified |
| `civica-enrollment-api` | Cloudflare Workers | ✅ DSN set |
| `civica-api` | Fly.io | ✅ DSN set |
| `civica-snap-api` | Fly.io | ✅ DSN set |
| `apps/dashboard` | Vercel | ✅ DSN + NEXT_PUBLIC_SENTRY_DSN + SENTRY_AUTH_TOKEN set |

For snap-engine verification details see [`docs/snap/observability.md`](observability.md).

---

### 4. Log drain configured and receiving

**⚠️ Operator action required** — Engineering setup guide added to [`docs/snap/deploy.md §7`](deploy.md#7-log-drain-setup-launch-blocker--required-before-beta). Covers Axiom (recommended) and alternatives for all three runtimes: Fly.io apps (Vector log-shipper), Cloudflare Workers (Logpush), Vercel (log drain integration). Engineering is done; operator must provision the aggregator account, set secrets, and verify events appear before flipping this to ✅.

Update this item to ✅ once: drain secrets are set on all services AND a test event appears in the aggregator for each runtime.

---

### 5. OBBBA Track 1 verified shipped; Tracks 2/3 status

**Track 1 — ✅ Shipped** — Merged via PR [#62](https://github.com/matthewgg22/civica/pull/62) on 2026-05-12. Covers 10 engineering-only findings (Q2, Q7, Q11, Q12, Q13, Q14, estimator constants, banned-phrase scanner, Keychain migration, coverage scope rule).

**Track 2 — ⏳ Counsel-blocked** — Q1 (ABAWD tribal exemption EN+ES), Q3 full §6 copy table, Q4 (§10108 noncitizen disclosure), Q5 (LLM retention policy), Q6 (pricing rule), Q12 stale-rules user copy.

**Track 3 — ⏳ External-blocked** — Q7–Q10 engineering reports, Q14 (written MA DTA authorization), Q15 (SOC 2), Q16 (App Store copy), Q17 (marketing site), Q18 (October refresh owner), Q19 (source-citation reviewers).

> Per audit Revision 2 §11: **no App Store review, external pilot, or estimator use until Q19 source-citation rows + FY26 number correction land.** This is a hard launch gate.

Full artifact: `COMPLIANCE_AUDIT_OBBBA.md` at repo root. Working doc: `docs/SNAP-source-citation-signoff.md`.

---

### 6. 9 compliance registry strings — counsel signoff

**❌ Blocking** — All 9 strings in [`Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift`](../../Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift) are `.pendingSignoff`. Do not edit ad-hoc.

Process: when counsel signs off on a string, the PR flips `status` to `.approved` and sets `approvedEnglish` + `approvedSpanish`. The production view reads via `SNAPComplianceCopyRegistry.approvedEnglish(for:)`.

---

### 7. Spanish parity — external review completed

**❌ Blocking** — 106 i18n keys exist and parity lint runs in CI, but no native Spanish speaker has reviewed translation quality. Quality is unknown.

Action required: route translations to an external reviewer before launch. Flag translations that changed post-review in the same PR as string approval.

---

### 8. Vercel production env vars confirmed (`NEXT_PUBLIC_API_BASE_URL`)

**✅ Confirmed** — `NEXT_PUBLIC_API_BASE_URL` verified in Vercel dashboard (2026-05-18) pointing to `https://civica-enrollment-api.civica-api.workers.dev` for the Production environment.

---

### 9. Vercel `civica-app` Root Directory misconfiguration resolved

**✅ Fixed** — Root Directory cleared in Vercel dashboard (2026-05-18). Production deploy confirmed green. Recovery guide if the setting drifts: [`docs/snap/vercel-deploy-fix.md`](vercel-deploy-fix.md).

---

### 10. Staging UAT completed

**❌ Blocking** — No UAT results on file. UAT script and feedback collector exist (commit `b3b10a48`, migration [`supabase/migrations/20260528_uat_feedback.sql`](../../supabase/migrations/20260528_uat_feedback.sql)), but no Silo H navigator session has run.

When complete, record results at `docs/snap/uat-results-<date>.md` and link here.

Pending: **Silo H navigator team**.

---

## Pre-launch checklist (go/no-go)

All **Required** items must be ✅ before flip. **Nice-to-have** items can follow in a fast-follow.

### Required (hard blocks — do not launch without these)

```
[ ] E2E nightly: most recent run is green (gh run list --workflow=e2e-nightly.yml --limit 1)
[x] Sentry DSN set and receiving test event on all 5 services (snap-engine, enrollment-api, civica-api, civica-snap-api, dashboard)
[ ] Log drain configured and showing structured logs
[ ] OBBBA Q19 source-citation signoff + FY26 number correction merged (estimator gate)
[ ] All 9 compliance registry strings: status = .approved with counsel signoff date
[ ] Spanish parity external review complete
[x] Vercel civica-app Root Directory misconfiguration resolved
[x] Vercel NEXT_PUBLIC_API_BASE_URL confirmed pointing to production enrollment gateway
[ ] Staging UAT sign-off from Silo H navigator team (results at docs/snap/uat-results-<date>.md)
[ ] OBBBA Track 2 counsel answers received (or explicit written deferral accepted by counsel)
[x] GitHub Actions secrets set: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ENROLLMENT_API_PROD_URL, API_PROD_URL
```

### Nice-to-have (can launch without, track as fast-follow)

```
[ ] OBBBA Track 3 external questions answered (Q15 SOC 2, Q16 App Store copy, Q17 marketing site)
[x] civica-snap-engine (FastAPI) Sentry instrumentation — shipped, see docs/snap/observability.md
[ ] Lighthouse production score monitored on live URL (not just CI)
[ ] October rules snapshot owner confirmed (Q18, deadline 2026-07-31)
[ ] Policy accuracy review by DTA-literate reviewer
```

---

## Day-of runbook

### On-point contacts

| Role | Person | Contact |
|---|---|---|
| Launch lead | TBD | TBD |
| iOS engineering | Matthew Greer-Gentis | matthewgg22 (GitHub) |
| Backend / infra | TBD | TBD |
| Counsel on-call | TBD | TBD |
| Sentry alert recipient | TBD | TBD |

### Order of operations

1. **T−60 min: final pre-flight**
   - Confirm E2E nightly passed within last 24h: `gh run list --workflow=e2e-nightly.yml --limit 1`
   - Confirm all Sentry DSNs are live (trigger test 500 on each service, verify in Sentry dashboard)
   - Confirm log drain is receiving (tail each service, verify logs appear in aggregator)
   - Confirm Vercel `NEXT_PUBLIC_API_BASE_URL` is production gateway

2. **T−30 min: notify team**
   - Post in `#snap-launch` (or equivalent): "Launch starting in 30 min — all services green?"
   - Confirm on-call contacts are reachable

3. **T−0: flip the switch**
   - Enable CA feature flag / remove any `isEnabled: false` gate for California users
   - If using Supabase RLS policy to gate: confirm row exists for CA in `SNAPCoveragePolicy`
   - iOS: confirm `SNAPCoveragePolicy` includes `"CA"` in `supportedStateCodes`

4. **T+0 → T+15 min: monitor**
   - Watch Sentry for new error events across all 4 services
   - Watch log drain for unexpected 4xx/5xx spikes
   - Confirm a test applicant can reach the SNAP question flow end-to-end

5. **T+15 min: go/no-go call**
   - If all green: post launch announcement to `#snap-launch` + statuspage
   - If red: execute rollback plan (see below) immediately; do not wait

### Comms

| Channel | Purpose |
|---|---|
| `#snap-launch` | Real-time launch coordination |
| `<statuspage URL>` | Public-facing status (fill in if applicable) |
| `#snap-incidents` | Any SEV-1/SEV-2 issues post-launch |

---

## Rollback plan

### Per-service rollback commits

No per-service version tags exist yet. Roll back by reverting to the commit SHA before the launch deploy:

| Service | Last known-good commit | Notes |
|---|---|---|
| `civica-enrollment-api` (CF Workers) | `07d290a0` | snap-rules v1 API fix |
| `apps/api` (Fly.io `civica-api`) | `f231ca64` | JWKS JWT verify fix |
| `apps/dashboard` (Fly.io `civica-snap-api`) | `68ff4e33` | OBBBA distress gate |
| `web/` (Vercel) | `56f56cca` | Lighthouse CI fix |
| iOS (App Store) | n/a | App Store rollback = expedited review request or TestFlight revert |

**Recommended:** tag each service directory at `v1.0.0-ca-launch` immediately before the deploy so rollback is `git checkout v1.0.0-ca-launch -- <service-dir>`.

### Rollback procedure by service

```bash
# CF Workers — redeploy prior version
git checkout <prior-sha> -- apps/enrollment-api
cd apps/enrollment-api && npx wrangler deploy

# Fly.io apps/api
git checkout <prior-sha> -- apps/api
flyctl deploy --config apps/api/fly.toml --remote-only --wait-timeout 120 --app civica-api

# Fly.io apps/dashboard / snap-api
git checkout <prior-sha> -- apps/dashboard
flyctl deploy --config apps/dashboard/fly.toml --remote-only --wait-timeout 120 --app civica-snap-api

# Vercel — revert via dashboard: Deployments → prior deploy → Redeploy (Promote to Production)
```

### Tagging before launch

Run `bash scripts/tag-launch.sh v1.0.0-ca-launch` from `codex/rebuild-feb18` immediately before starting the deploy sequence. The script validates the version format, refuses to run on a dirty tree or the wrong branch, and applies four annotated tags — `v1.0.0-ca-launch-enrollment-api`, `-api`, `-dashboard`, and `-web` — each carrying the timestamp, commit SHA, and deployer name in its message. It prints the tag list and the push command but does **not** push automatically; review the output, then run `git push origin --tags` when satisfied. If a service deploy goes wrong, roll back that directory alone with `git checkout v1.0.0-ca-launch-<service> -- apps/<service>` and redeploy, leaving the other services untouched.

### Secrets rotation (rollback due to suspected leak)

If rollback is triggered by a potential secret compromise:

1. Follow [`docs/snap/key_rotation.md`](key_rotation.md) — rotate `SNAP_FERNET_KEY` first (all ciphertext unreadable to prior key).
2. Rotate Supabase service-role key: Supabase dashboard → Project Settings → API → regenerate.
3. Rotate Sentry DSN on the affected service.
4. Rotate Cloudflare API token if enrollment-api worker was involved.
5. Notify counsel within 1 hour of any confirmed PII exposure (see [`docs/snap/incident_response.md`](incident_response.md)).

### Database migration — ⚠️ no down steps on any migration

**All 33 migrations in `supabase/migrations/` are irreversible.** None contain a down/rollback step. Database rollback means restoring from a Supabase point-in-time backup — not running SQL.

Migrations flagged as especially high-risk:

| Migration | Risk |
|---|---|
| [`20260524_drop_public_snap_legacy.sql`](../../supabase/migrations/20260524_drop_public_snap_legacy.sql) | Permanently drops `public.snap_*` tables. If applied to prod and a rollback is needed, data in those tables is gone unless the backup predates this migration. |
| [`20260528_snap_enrollment_12_storage_documents.sql`](../../supabase/migrations/20260528_snap_enrollment_12_storage_documents.sql) | Storage bucket + RLS for documents. Bucket contents survive migration reversal via backup, but re-applying the drop would delete them. |

**✅ PITR confirmed enabled** (2026-05-18) — verified in Supabase dashboard → Production project → Settings → Database → Backups. For any incident that requires DB rollback, open a Supabase support ticket immediately — PITR restores are time-sensitive.

---

## Post-launch monitoring

### First 24 hours

Watch the following continuously for the first 2 hours, then hourly for the remainder of day 1:

**Sentry (all 4 services)**
- Any new error events from real users (not the launch test applicant)
- Spike in `capture_exception` calls on enrollment-api
- Any `beforeSend` scrub failures (PII_KEYS appearing in event payloads)

**Log drain**
- HTTP 4xx rate on enrollment-api: baseline expected < 2% of requests
- HTTP 5xx rate: any sustained > 0 is a page-worthy incident
- Supabase RLS rejections (`42501` pg error code) — expected zero for valid sessions
- `SNAP_FERNET_KEY` decrypt failures — indicates a session written with a different key

**Lighthouse (production)**
- Run a manual Lighthouse on the production CA landing page and sign-in page
- Compare against CI baseline (100 on sign-in); flag any drop > 10 points

**E2E nightly**
- The night after launch, confirm the nightly run passes against production secrets
- A failure here is the earliest automated signal of a regression

### First week

| Day | Action |
|---|---|
| D+1 | Review Sentry for any recurring error patterns; triage any new issues |
| D+2 | Review log drain for anomalous traffic patterns or auth failures |
| D+3 | Run a manual Lighthouse on production; check Vercel Analytics if configured |
| D+7 | First-week retrospective: error rates, E2E pass rate, any compliance flags surfaced by users |
| D+7 | Confirm Q18 October rules snapshot owner is identified (deadline 2026-07-31) |

### Emergency rollback triggers

Initiate rollback immediately (no waiting on approval) if:

- Any confirmed PII leak (user data returned to wrong session, unencrypted PII in logs, Sentry event containing SSN/DOB/income fields)
- Enrollment-api 5xx rate sustained > 5% for more than 5 minutes
- Supabase RLS returning data to unauthorized actors (`42501` in an unexpected direction)
- `SNAP_FERNET_KEY` decrypt failures for > 1% of active sessions
- OBBBA compliance string appearing in production that counsel has not signed off

For all other incidents, follow [`docs/snap/incident_response.md`](incident_response.md).
