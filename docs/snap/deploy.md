# Civica SNAP — Deployment & Secrets Guide

Three runtimes, three secret stores. This document covers each one end-to-end
plus post-deploy verification.

---

## 1. apps/enrollment-api — Cloudflare Workers

**Deploy command** (CI runs this automatically on push to `codex/rebuild-feb18`):
```bash
cd apps/enrollment-api
npx wrangler deploy
```

### GitHub Actions secrets required

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Workers deploy token. Create at dash.cloudflare.com → My Profile → API Tokens → *Edit Cloudflare Workers* template. Scope to the `civica-enrollment-api` worker. |
| `CLOUDFLARE_ACCOUNT_ID` | Found in the Cloudflare dashboard sidebar → Overview. |

### Worker secrets (set once per environment, not in wrangler.toml)

```bash
# Set each secret with wrangler — stored encrypted in Cloudflare, never in git.
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SNAP_FERNET_KEY
wrangler secret put SENTRY_DSN
```

`SUPABASE_URL` is a plain var in `wrangler.toml` (not a secret — it's a public endpoint).

### Sentry DSN — enrollment-api

1. Create a project in Sentry (Platform: **Cloudflare Workers**).
2. Copy the DSN from *Settings → Projects → [project] → Client Keys (DSN)*.
3. `wrangler secret put SENTRY_DSN` and paste the DSN when prompted.
4. Verify: tail the worker logs and trigger a 500 — the event should appear in Sentry within ~30 s.

---

## 2. apps/api — Fly.io (Hono / Node.js)

**Deploy command** (CI runs this automatically on push to `codex/rebuild-feb18`):
```bash
flyctl deploy --config apps/api/fly.toml --remote-only --wait-timeout 120
```

### GitHub Actions secrets required

| Secret | Description |
|--------|-------------|
| `FLY_API_TOKEN` | Create at fly.io → Account → Access Tokens. Scope to the `civica-api` app. |

### Fly.io app secrets (set once, stored encrypted)

```bash
fly secrets set \
  SUPABASE_URL="https://zgqphgcqfxsgviofsccs.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  SUPABASE_ANON_KEY="..." \
  SNAP_FERNET_KEY="..." \
  SENTRY_DSN="..." \
  --app civica-api
```

### Sentry DSN — apps/api

1. Create a project in Sentry (Platform: **Node.js** or **Hono**).
2. Copy the DSN.
3. Add it to Fly secrets: `fly secrets set SENTRY_DSN="https://xxx@oXXX.ingest.sentry.io/YYYY" --app civica-api`.
4. Verify: trigger an unhandled error route and confirm the event appears in Sentry.

---

## 3. apps/dashboard — Vercel (Next.js)

**Deploy**: Vercel auto-deploys on push via GitHub integration. No manual step needed.

### Vercel environment variables

Set these in the Vercel project dashboard → *Settings → Environment Variables*
(or via `vercel env add`).  Mark each as **Production**, **Preview**, and **Development** as appropriate.

| Variable | Where used | Notes |
|----------|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Public — safe to expose to browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Public anon key |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser bundle | Public — Sentry client-side DSN |
| `SENTRY_DSN` | Server / Edge runtime | Keep server-only (no `NEXT_PUBLIC_` prefix) |
| `SENTRY_ORG` | Build step (source map upload) | Your Sentry org slug |
| `SENTRY_PROJECT` | Build step (source map upload) | Your Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Build step (source map upload) | Create at sentry.io → Settings → Auth Tokens → *Add Internal Integration* with `project:releases` and `org:read` scopes |
| `ENROLLMENT_API_URL` | Server-only | Production enrollment-api base URL (no `/v1/enrollment`) |
| `NEXT_PUBLIC_API_URL` | Client + server | Production apps/api base URL |

### Sentry DSN — dashboard

1. Create a project in Sentry (Platform: **Next.js**).
2. Use **one DSN** for both client and server — set it as both `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`.
3. Source maps are uploaded automatically during `next build` when `SENTRY_AUTH_TOKEN` is set.
4. Verify: open the dashboard, cause a client-side error (e.g. `window.oops()`), confirm it appears in Sentry.

---

## 4. Post-deploy smoke tests

The `.github/workflows/post-deploy-smoke.yml` workflow runs automatically after a
successful deploy on `codex/rebuild-feb18`. It can also be triggered manually
(*Actions → Post-deploy smoke tests → Run workflow*).

### Additional GitHub Actions secrets required for smoke tests

| Secret | Value |
|--------|-------|
| `ENROLLMENT_API_PROD_URL` | e.g. `https://civica-enrollment-api.workers.dev` |
| `API_PROD_URL` | e.g. `https://civica-api.fly.dev` |

The smoke tests check:
- `enrollment-api /health` → 200 + `{"ok":true}`
- `enrollment-api /v1/enrollment/packets` (unauthenticated) → 401
- `apps/api /healthz` → 200
- `apps/api /` (root ping) → 200 + `{"ok":true}`
- `apps/api /navigator/sessions` (unauthenticated) → 401

CI turns red on any failure.

---

## 5. Dashboard /health page

After setting the Vercel env vars above, the internal health page is reachable at:

```
https://<your-dashboard-url>/health
```

It pings enrollment-api, apps/api, and Supabase Postgres and returns a
green/red status grid. Useful for:
- Confirming all three runtimes are healthy after a deploy
- Quick triage during incidents before pulling logs

The page is **force-dynamic** (no caching) so every load reflects current state.

---

## 6. Audit log backup

> **Status: not yet configured.** See `supabase/migrations/20260527_audit_log_retention.sql`
> for the full procedure. A daily backup job needs to be set up as a GitHub Actions
> cron or Supabase scheduled function.

Required once backup job is set up:
- Create a Supabase Storage bucket `audit-backups` (private, RLS-disabled for service role only)
- Add `DATABASE_URL` as a GitHub Actions (or Edge Function) secret
- Schedule `pg_dump snap_enrollment.audit_log_events → ss://audit-backups/daily/`
- Add a smoke check to verify the latest backup object is non-empty

---

## Secret rotation

- **SNAP_FERNET_KEY**: follow `docs/snap/key_rotation.md`
- **Supabase service-role key**: rotate in Supabase dashboard → API settings; update Fly, wrangler, and Vercel simultaneously
- **Sentry DSN**: rotation is low-risk (DSNs are semi-public); update all three runtimes' secrets

Always update secrets in all environments (staging + production) before the code
that uses them is deployed.
