# Prod Activation Operator Checklist — 2026-05

Sequenced operator queue to take Civica's already-merged engineering work to a live, prod-protected state. Each step is human-only (auth-gated send / paste / dashboard click) and 5–30 min. Steps are ordered by precondition — do not skip ahead unless flagged "parallelizable".

**Scope:** California pilot launch. Branch reference: `codex/rebuild-feb18`.

**Pair this runbook with:**
- `docs/outreach/counsel-batch-2026-05-19.md` (and `docs/outreach/sends/`) for the counsel item.
- `TODOS.md` (look for `DEPLOY PENDING` / `SECRET PENDING` markers).
- Memory note: Civica Supabase migrations apply via **dashboard SQL Editor paste**, not `supabase db push --linked` (linked CLI project is PROD).

**Hard deadline tracker:** counsel signoff 2026-06-02 (Item 1). Everything else is "before first prod traffic / App Store submit".

---

## Step 0 — Parallelizable soft prerequisites (do today)

These have no code dependencies and unblock outreach. Kick them off first because they have human-side wait times.

### 0.1 — CDSS ACL check (TODO-21) — ~30 min
- **Precondition:** none.
- **Action:** Visit https://www.cdss.ca.gov/inforesources/letters-regulations/letters-and-notices/all-county-letters. Search ACLs published after 2025-07-04 for any of: "§10102", "ABAWD", "OBBBA", "student exemption", "LPIE". Note the ACL number(s) for the LPIE expansion effective 2026-06-01.
- **Verification:** ACL number recorded in this section below, and grepped against the codebase TODO:
  ```
  grep -rn "actual CA CDSS ACL number" Civica apps packages
  ```
  Replace at every site once known. (Counsel item 4 also asks for this — whichever returns first wins.)
- **Rollback:** N/A (read-only research).
- **Recorded ACL #:** _______

### 0.2 — Send counsel outreach (TODO-10) — ~15 min, human send
- **Precondition:** none. Three send-ready drafts already on disk.
- **Action:** Open each file, copy/paste body into the mail client, attach the two background docs called out in each draft, send. The drafts are:
  - `docs/outreach/sends/2026-05-20-counsel-crla.md` → `crice@crla.org`, cc `msousa@crla.org`
  - `docs/outreach/sends/2026-05-20-counsel-western-center.md`
  - `docs/outreach/sends/2026-05-20-counsel-bay-area-legal-aid.md`
- **Attachments (per draft):**
  - `docs/outreach/counsel-batch-2026-05-19.md`
  - `docs/outreach/counsel-prep-analysis-2026-05-19.md`
- **Verification:** Fill the tracking table at the bottom of `docs/outreach/counsel-batch-2026-05-19.md` with send timestamp + recipient. Reply-handle goes in inbox; first signoff lands by 2026-06-02.
- **Rollback:** N/A (sent emails are sent). If recipient declines, fall back to NLADA referral network or Public Counsel (listed in `counsel-batch-2026-05-19.md` under "Candidate channels").

### 0.3 — `BROWSERLESS_API_KEY` signup (TODO-15) — ~10 min
- **Precondition:** none.
- **Action:** Sign up at https://www.browserless.io/ (free tier = 1000 units/mo). Copy the API key into 1Password under `civica/browserless`. Do **not** paste it into source files. The `wrangler secret put` happens in Step 5.
- **Verification:** key stored in 1Password; do not deploy yet.
- **Rollback:** delete the Browserless account.

### 0.4 — Argyle webhook secret (TODO-23) — ~5 min
- **Precondition:** Argyle production account.
- **Action:** Argyle dashboard → Webhooks → Signing secret. Copy to 1Password under `civica/argyle-webhook`. Apply in Step 5.
- **Verification:** key in 1Password.
- **Rollback:** rotate via dashboard.

---

## Step 1 — Apply Supabase migrations (TODO-26, PR #245 + PR #273)

**Precondition:** none. Engineering code already merged; the worker will fail on mutating requests until this lands.

**Migrations to apply, in order** (paste in this exact order — `set_actor_context_function` last because RLS policies in 20260568 reference it and the buddy view in 20260570 reads from tables defined earlier):

| Order | Filename | Lines | What it does |
|---|---|---|---|
| 1 | `supabase/migrations/20260565_work_requirement_hour_logs.sql` | 88 | Work-requirement hour-log table + RLS |
| 2 | `supabase/migrations/20260566_buddy_actorkind.sql` | 5 | Adds `buddy` enum value to `actor_kind` |
| 3 | `supabase/migrations/20260567_buddy_tables.sql` | 58 | `buddy_relationship`, `buddy_invite` tables |
| 4 | `supabase/migrations/20260568_buddy_rls.sql` | 45 | Buddy RLS policies |
| 5 | `supabase/migrations/20260569_buddy_autorevoke_trigger.sql` | 28 | Auto-revoke trigger on expiry/withdraw |
| 6 | `supabase/migrations/20260570_buddy_packet_summary_view.sql` | 83 | Column-level PII restriction view |
| 7 | `supabase/migrations/20260571_set_actor_context_function.sql` | 39 | `set_actor_context()` RPC used on every mutating request |
| 8 | `supabase/migrations/20260590_packet_qc_samples.sql` | 147 | QC sampler table (PR #273) |
| 9 | `supabase/migrations/20260591_packet_qc_samples_constraint.sql` | 52 | Replaces impossible CHECK constraint from #8 |

**Action (per environment — STAGING FIRST):**
1. Open the staging Supabase project in dashboard → SQL Editor → New query.
2. For each file in order: paste contents, run, confirm "Success. No rows returned" or migration log. Do **not** batch all nine into one paste — keep them separate so a mid-list failure is bounded.
3. Repeat for PROD only after worker deploy is verified on staging (Step 6).

**Verification:**
- `select * from pg_proc where proname = 'set_actor_context';` returns one row.
- `select count(*) from buddy_packet_summary_view;` returns 0 (view exists, empty).
- `select unnest(enum_range(NULL::actor_kind));` includes `buddy`.
- `\d packet_qc_samples` shows the table with the non-impossible CHECK.

**Rollback:** Each migration is forward-only. If a step fails mid-list, do not auto-revert earlier steps — read the error, fix in a new `2026059X_*.sql` migration, and apply on top. Don't `DROP` newly-created tables on staging without checking that no downstream worker has already started writing to them.

---

## Step 2 — Provision CF rate-limit bindings (TODO-2)

**Precondition:** none (independent of migrations).

The worker declares two rate-limit bindings in `apps/enrollment-api/wrangler.toml`:
```
RL_STRICT     namespace_id = 1001   10 req / 60s
RL_STANDARD   namespace_id = 1002   60 req / 60s
```

**Action:**
1. Cloudflare dashboard → Workers & Pages → Rate Limiting → "Create namespace".
2. Create namespace ID **1001** (RL_STRICT), then ID **1002** (RL_STANDARD). Limits/periods are set in `wrangler.toml`; the dashboard provisions the namespace, not the values.

**Verification:** Both namespaces show in the dashboard. `wrangler deploy` (Step 6) will fail loudly if either is missing.

**Rollback:** Delete namespace in dashboard — but only after `unsafe.bindings` entry is removed from `wrangler.toml`, otherwise subsequent deploys fail.

---

## Step 3 — Resolve CF cron budget (free plan cap)

**Precondition:** none. Currently 6 cron triggers declared, free plan allows 5.

**Current `[triggers]` from `apps/enrollment-api/wrangler.toml`:**
```
crons = ["*/5 * * * *", "0 14 * * *", "0 17 * * 7", "0 14 * * 7", "0 4 * * *", "0 * * * *"]
```

Mapped roles:
- `*/5 * * * *` — buddy app_metadata cleanup (PR #245 T2)
- `0 14 * * *` — daily EBT structural probe (T5)
- `0 17 * * 7` / `0 14 * * 7` — weekly digest, two shards (B-T7)
- `0 4 * * *` — daily push log purge (X-T5)
- `0 * * * *` — hourly QC sampler (T4)

**Action — pick one:**
- **(A) Upgrade to Workers Paid ($5/mo).** Cloudflare dashboard → Workers & Pages → plan upgrade. Recommended; unblocks all 6 crons + future ones with no churn.
- **(B) Drop one cron.** Lowest-value-to-drop candidate is one of the weekly digest shards (DST limitation already documented) — but verify with Matthew before dropping.

**Verification:** `wrangler deploy --dry-run` (Step 6 dry run) succeeds without "exceeded cron limit" error.

**Rollback:** plan downgrade has no data impact; dropping a cron requires re-adding to `wrangler.toml`.

---

## Step 4 — Vercel project for `apps/web/` (TODO-16)

**Precondition:** none.

**Action:**
1. https://vercel.com/new → Import git repo → select the Civica repo → set **Root Directory** to `apps/web`.
2. Framework preset: Next.js (auto-detected from `apps/web/next.config.ts`).
3. Build command: leave default (`pnpm build` resolves to `next build --webpack` from `apps/web/package.json`).
4. Set environment variables (Project Settings → Environment Variables):

   | Key | Scope | Value source |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview | `https://zgqphgcqfxsgviofsccs.supabase.co` (same as worker `[vars]`) |
   | `NEXT_PUBLIC_TESTFLIGHT_URL` | Production + Preview | TestFlight public URL (paste from App Store Connect) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Production only | 1Password → `civica/supabase-service-role` |

5. Project name: `civica-web` (matches `apps/web/package.json#name`).

**Verification:**
- First deploy completes with no errors.
- Open the production URL; landing page renders; TestFlight CTA link is non-empty.

**Rollback:** Vercel → Project → Settings → Delete project. Free tier 100-deploy/day limit applies (per memory `reference_vercel_civica_app.md`).

---

## Step 5 — Set CF Worker secrets

**Precondition:** Steps 0.3 + 0.4 keys staged in 1Password.

Run from `apps/enrollment-api/`. Each command prompts for the value; paste from 1Password and press enter. Do **not** echo secrets to terminal history.

```sh
cd apps/enrollment-api

# Observability (per project_observability_pr88)
wrangler secret put SENTRY_DSN                # 1Password: civica/sentry-enrollment-api

# Submission Phase 2 (TODO-15)
wrangler secret put BROWSERLESS_API_KEY       # 1Password: civica/browserless

# Argyle webhook signature verification (TODO-23)
wrangler secret put ARGYLE_WEBHOOK_SECRET     # 1Password: civica/argyle-webhook

# Buddy invite JWT signing (PR #245)
wrangler secret put BUDDY_JWT_SECRET          # Generate: openssl rand -base64 32

# AI coaching (already enabled in [vars])
wrangler secret put ANTHROPIC_API_KEY         # 1Password: civica/anthropic-api
```

**Conditional — set only if the matching `[vars]` flag is being flipped to true on the next deploy:**

```sh
# Twilio recert outreach (T14) — only if RECERT_TWILIO_ENABLED=true
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_FROM_NUMBER

# USPS address validation (T9) — only if ENABLE_ADDRESS_VALIDATION=true
wrangler secret put USPS_CLIENT_ID
wrangler secret put USPS_CLIENT_SECRET

# Canvas OAuth proxy (T-DR3-9) — only if Canvas integration enabled
wrangler secret put CANVAS_CLIENT_ID
wrangler secret put CANVAS_CLIENT_SECRET
wrangler secret put CANVAS_INSTANCE_URL
wrangler secret put CANVAS_REDIRECT_URI

# BenefitsCal CBO Manager credentials (Session M1) — required once Phase 2 submitter is enabled per-packet
wrangler secret put BENEFITSCAL_CBO_USERNAME
wrangler secret put BENEFITSCAL_CBO_PASSWORD

# APNs (EBT push) — already deployed per Lane D, refresh only if rotating
# wrangler secret put APNS_KEY_P8
# wrangler secret put APNS_KEY_ID
# wrangler secret put APNS_TEAM_ID
# wrangler secret put APNS_TOPIC
# wrangler secret put APNS_ENV
# wrangler secret put EBT_SCRAPER_WEBHOOK_SECRET
```

**Verification:** `wrangler secret list` shows each set secret. Values are not retrievable post-set (by design).

**Rollback:** `wrangler secret delete <NAME>` — but note the matching feature degrades (Browserless missing = `DRIVER_NOT_WIRED`; Argyle missing = signature verification skipped; Sentry missing = no error reporting).

---

## Step 6 — `wrangler deploy` the enrollment API

**Precondition:** Step 1 (staging) + Step 2 + Step 3 + Step 5.

**Action:**
```sh
cd apps/enrollment-api

# Dry-run first (catches cron-limit + binding errors without publishing)
npx wrangler deploy --dry-run --outdir=dist

# Real deploy
npx wrangler deploy
```

**What this activates** (per `apps/enrollment-api/wrangler.toml` and memory `project_pr245_buddy_work_hours.md` / `project_pr248_rate_limiting.md`):
- 5-min buddy app_metadata cleanup cron (PR #245 T2)
- Daily EBT probe + push-log purge crons
- Weekly digest crons (two shards)
- Hourly QC sampler (PR #273 T4)
- Rate-limit middleware (PR #248) on 9 endpoints
- `/openapi.json` publication (PR #245)
- `set_actor_context` call wired on mutating requests

**Verification (smoke tests):**
1. `curl https://civica-enrollment-api.civica-api.workers.dev/openapi.json | jq .info.title` → returns `"Civica Enrollment API"`.
2. `curl -i https://civica-enrollment-api.civica-api.workers.dev/v1/enrollment/oauth/start` rapid-fire 15× from one IP → returns `429` on the 11th request (RL_STRICT enforcing).
3. Cloudflare dashboard → Workers → civica-enrollment-api → Triggers → confirm 6 (or 5 after Step 3 decision) cron entries listed.
4. Sentry → Projects → civica-enrollment-api → "Issues" page reachable (no `MISSING_DSN` self-check failure).
5. Run any seeded mutating request (e.g., navigator UAT flow per `project_uat_credentials.md`) — should succeed, not `set_actor_context not found`.

**Rollback:** `npx wrangler rollback` reverts to the previous deployment. Crons remain registered with whichever version Cloudflare last accepted; if rollback is to a pre-cron version some crons may disappear (re-deploy current to restore).

---

## Step 7 — Set Vercel `SENTRY_DSN` on `civica-dashboard`

**Precondition:** none (project already exists per `reference_vercel_civica_app.md`).

**Action:**
1. https://vercel.com/ → `civica-dashboard` project → Settings → Environment Variables.
2. Add `SENTRY_DSN` (Production + Preview), value from 1Password under `civica/sentry-dashboard`.
3. (If not already present) add `NEXT_PUBLIC_SENTRY_DSN` with the same value — `apps/dashboard/sentry.client.config.ts` reads the public one.
4. Trigger a redeploy (Deployments → latest → "Redeploy") so the env vars take effect.

**Verification:** Open `apps/dashboard` production URL → Sentry "Issues" page in the dashboard shows incoming events. Or: visit `/admin/sentry-check` if such a probe route exists; otherwise check the Sentry project for any errored route.

**Rollback:** Remove the env var + redeploy. Dashboard continues to function; only Sentry reporting stops.

---

## Step 8 — Apply PR #273 follow-ups

**Precondition:** Step 6 verified.

**Action:**
1. **`civica-analytics` Supabase Storage bucket** — confirm exists; if not, dashboard → Storage → New bucket → name `civica-analytics`, public=false, RLS on. (No code change; the QC sampler writes here.)
2. **Re-confirm `fly status` for `civica-snap-api`** to clear the "unknown SENTRY_DSN" item in `project_observability_pr88.md`:
   ```sh
   fly status -a civica-snap-api
   fly secrets list -a civica-snap-api | grep SENTRY_DSN
   ```
   If missing: `fly secrets set SENTRY_DSN=<paste> -a civica-snap-api`. Run from `~/Developer/Civica` (not a worktree — see memory `feedback_fly_deploy_worktree`).

**Verification:** bucket listed in Supabase Storage; `fly secrets list` shows SENTRY_DSN.

**Rollback:** delete bucket (if empty) / `fly secrets unset SENTRY_DSN -a civica-snap-api`.

---

## Step 9 — Promote staging → prod

**Precondition:** Steps 1–8 verified on staging; iOS smoke ran the navigator UAT flow end-to-end without errors.

**Action:**
1. Re-run Step 1 (migrations) on PROD Supabase project.
2. Re-run Step 6 (`wrangler deploy`) against the prod worker environment (default `wrangler deploy` deploys to the production environment unless `--env staging` is passed — confirm `wrangler.toml` doesn't gate behind `[env.production]` overrides before running).
3. Flip `BUDDY_ADD_ENABLED = "true"` in `wrangler.toml` (currently `"false"`) **only after** counsel has signed off on the buddy invite copy strings — that gate is enforced per memory `project_pr245_buddy_work_hours.md`.

**Verification:** repeat Step 6 smoke tests against prod URL.

**Rollback:** `wrangler rollback`. Migrations are forward-only — do not attempt to revert; instead halt deploys and write a forward fix.

---

## Tracking checklist (tick as you go)

- [ ] 0.1 CDSS ACL recorded
- [ ] 0.2 Three counsel emails sent
- [ ] 0.3 Browserless key in 1Password
- [ ] 0.4 Argyle webhook secret in 1Password
- [ ] 1   Migrations 20260565–71, 20260590–91 applied to STAGING
- [ ] 2   RL_STRICT (1001) + RL_STANDARD (1002) namespaces created
- [ ] 3   Workers plan upgraded OR one cron dropped
- [ ] 4   Vercel `civica-web` project created + first deploy green
- [ ] 5   Worker secrets set (SENTRY_DSN, BROWSERLESS_API_KEY, ARGYLE_WEBHOOK_SECRET, BUDDY_JWT_SECRET, ANTHROPIC_API_KEY)
- [ ] 6   `wrangler deploy` staging green; smoke tests pass
- [ ] 7   Vercel `civica-dashboard` SENTRY_DSN set + redeployed
- [ ] 8   `civica-analytics` bucket exists; `civica-snap-api` Sentry DSN confirmed
- [ ] 9   Repeat on PROD; flip `BUDDY_ADD_ENABLED` after counsel signoff

---

## What this runbook does NOT cover

- BenefitsCal portal selectors (TODO-14) — requires live Assister account, 2–4wk county approval. Track separately.
- Pilot cohort definition (TODO-12) — product decision, not a deploy step.
- FNS FOIA (TODO-22) — file-and-wait, not gating.
- App Store submission — gated on counsel item 2 (App Store listing copy) signoff.
