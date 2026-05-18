# Civica SNAP — Observability Runbook

Covers wiring Sentry + structured logs across all four services, plus how to verify
instrumentation works on staging before merging.

For secret store mechanics and deploy commands, see [deploy.md](./deploy.md).

---

## Services at a glance

| Service | Runtime | Fly app / CF worker | Sentry SDK |
|---------|---------|---------------------|------------|
| `apps/api` | Hono / Node.js | `civica-snap-api` (fly.api.toml) + legacy `civica-api` (apps/api/fly.toml) | `@sentry/node` — `initSentry()` at startup |
| `backend` | FastAPI / Python | `civica-snap-engine` (fly.engine.toml) | `sentry-sdk[fastapi]` — `_init_sentry()` at module load |
| `apps/enrollment-api` | Hono / Cloudflare Workers | `civica-enrollment-api` | `@sentry/cloudflare` — `withSentry()` wrapper |
| `apps/dashboard` | Next.js / Vercel | see note below | `@sentry/nextjs` — `sentry.{server,client,edge}.config.ts` |

> **Vercel note**: the `civica-app` Vercel project is misconfigured (Root Directory = `web/`, which no longer exists).
> The live dashboard project is a separate Vercel project pointed at `apps/dashboard/`.
> Confirm the correct project name in the Vercel dashboard before setting env vars.

---

## Step 1 — Create Sentry projects

Create one project per service at [sentry.io](https://sentry.io):

| Project name (suggested) | Platform |
|--------------------------|---------|
| `civica-snap-api` | Node.js |
| `civica-snap-engine` | Python / FastAPI |
| `civica-enrollment-api` | Cloudflare Workers |
| `civica-dashboard` | Next.js |

Copy each DSN from **Settings → Projects → [project] → Client Keys (DSN)**.

---

## Step 2 — Set secrets

### civica-snap-api (Fly)

```bash
fly secrets set SENTRY_DSN="<snap-api DSN>" --config fly.api.toml
```

Verify it was set:

```bash
fly secrets list --config fly.api.toml
```

### civica-api (Fly, legacy app name)

Same source code as civica-snap-api. Set independently if both apps are still running:

```bash
fly secrets set SENTRY_DSN="<snap-api DSN>" --app civica-api
```

### civica-snap-engine (Fly)

```bash
fly secrets set SENTRY_DSN="<engine DSN>" --config fly.engine.toml
```

### civica-enrollment-api (Cloudflare Workers)

```bash
cd apps/enrollment-api
wrangler secret put SENTRY_DSN
# Paste the DSN when prompted
```

### civica-dashboard (Vercel)

In the Vercel project dashboard → **Settings → Environment Variables**, add:

| Variable | Value | Environments |
|----------|-------|-------------|
| `SENTRY_DSN` | server DSN | Production, Preview |
| `NEXT_PUBLIC_SENTRY_DSN` | same DSN | Production, Preview |
| `SENTRY_ORG` | your Sentry org slug | Production, Preview |
| `SENTRY_PROJECT` | `civica-dashboard` | Production, Preview |
| `SENTRY_AUTH_TOKEN` | token with `project:releases` + `org:read` scopes | Production, Preview |

Secrets reload on the next deploy — no code change needed.

---

## Step 3 — Redeploy each service

```bash
# civica-snap-api
fly deploy --config fly.api.toml --remote-only --wait-timeout 120

# civica-snap-engine
fly deploy --config fly.engine.toml --remote-only --wait-timeout 120

# civica-enrollment-api
cd apps/enrollment-api && npx wrangler deploy
```

Vercel redeploys automatically on push.

---

## Step 4 — Verify instrumentation

### 4a. Enable the debug route (temporarily)

```bash
# civica-snap-api
fly secrets set SENTRY_CHECK_ENABLED=1 --config fly.api.toml

# civica-snap-engine
fly secrets set SENTRY_CHECK_ENABLED=1 --config fly.engine.toml

# civica-enrollment-api
cd apps/enrollment-api && wrangler secret put SENTRY_CHECK_ENABLED
# Type: 1

# civica-dashboard: add SENTRY_CHECK_ENABLED=1 in Vercel env vars, then redeploy
```

### 4b. Trigger a test error

```bash
# civica-snap-api (replace with your actual Fly hostname)
curl -i https://civica-snap-api.fly.dev/debug/sentry-check

# civica-snap-engine
curl -i https://civica-snap-engine.fly.dev/debug/sentry-check

# civica-enrollment-api
curl -i https://civica-enrollment-api.workers.dev/debug/sentry-check

# civica-dashboard
curl -i https://<your-vercel-preview-url>/api/debug/sentry-check
```

Each call should return a 500. Open Sentry and confirm an event appeared in each project
within ~30 seconds.

### 4c. Confirm structured JSON in logs

```bash
fly logs --app civica-snap-api | head -20
fly logs --app civica-snap-engine | head -20
```

Each log line from the Node.js service should be a JSON object (pino format). The Python
engine emits uvicorn access logs; structured JSON per-request is added via the SNAP router
middleware.

Hit `/healthz` on each service and confirm a 200:

```bash
curl -s https://civica-snap-api.fly.dev/healthz | jq .
curl -s https://civica-snap-engine.fly.dev/healthz | jq .
curl -s https://civica-enrollment-api.workers.dev/health | jq .
```

### 4d. Remove debug secrets

After confirming events in Sentry, unset the debug flag and remove the route code:

```bash
fly secrets unset SENTRY_CHECK_ENABLED --config fly.api.toml
fly secrets unset SENTRY_CHECK_ENABLED --config fly.engine.toml
cd apps/enrollment-api && wrangler secret delete SENTRY_CHECK_ENABLED
# Remove SENTRY_CHECK_ENABLED from Vercel env vars via dashboard
```

Remove the route files before merging:
- `apps/api/src/routes/debug.ts`
- `apps/api/src/app.ts` — remove the `debugRouter` import + registration line
- `apps/enrollment-api/src/index.ts` — remove the `/debug/sentry-check` block
- `apps/enrollment-api/src/types.ts` — remove `SENTRY_CHECK_ENABLED?` from Env
- `backend/civic_api/api.py` — remove the `sentry_check` endpoint block
- `apps/dashboard/app/api/debug/sentry-check/route.ts`

---

## Incident response

### Sentry event not appearing

1. Confirm `SENTRY_DSN` is set: `fly secrets list --config <toml>`.
2. Check that the DSN project platform matches the runtime (wrong platform silently drops events).
3. Tail logs for the service and look for Sentry transport errors.

### Log drain gaps (Fly)

Fly ships stdout to its log infrastructure. If you need to forward to an external sink (e.g.
Datadog, Papertrail), configure a drain in the Fly dashboard:
**App → Monitoring → Log Drains → Add Drain**.

### Supabase backups

> **Pre-launch gate**: project is on the Free plan as of 2026-05-18. Scheduled backups and PITR are not enabled.
> Upgrade to Supabase Pro before launch to get 7-day scheduled backups and PITR.
> Once upgraded, verify via Settings → Backups and record the earliest recovery point here.

### High error rate

1. Open the Sentry project → Issues → sort by Last Seen.
2. Use `fly logs --app <name>` to correlate timestamps.
3. Roll back via `fly releases --app <name>` and `fly deploy --image <sha>`.
