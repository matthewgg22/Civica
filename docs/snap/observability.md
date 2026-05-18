# SNAP Observability

> Covers Sentry error tracking for all services in the SNAP stack. Log drain setup is tracked separately in [`deploy.md`](deploy.md).

---

## Services and Sentry status

| Service | Location | Instrumentation |
|---|---|---|
| `civica-enrollment-api` | `apps/enrollment-api/` | PR [#88](https://github.com/matthewgg22/civica/pull/88) |
| `civica-api` (FastAPI/snap-engine) | `backend/civic_api/api.py` | PR [#105](https://github.com/matthewgg22/civica/pull/105) |
| `civica-snap-api` | `apps/api/` | PR [#88](https://github.com/matthewgg22/civica/pull/88) |
| `apps/dashboard` | `apps/dashboard/` | PR [#88](https://github.com/matthewgg22/civica/pull/88) |

---

## civica-api (snap-engine FastAPI)

### Configuration

`backend/civic_api/api.py` — `_init_sentry()` called at module load (line ~829). No-ops silently if `SENTRY_DSN` is unset.

**Required env vars** (set via `fly secrets set --app civica-api`):

| Variable | Purpose |
|---|---|
| `SENTRY_DSN` | Sentry ingest URL — get from Sentry project settings |
| `ENVIRONMENT` | Optional. Defaults to `"production"`. Set to `"staging"` on staging app. |

**SDK config:**
- Integrations: `StarletteIntegration`, `FastApiIntegration`
- `traces_sample_rate`: 0.1 (10% of requests)
- `send_default_pii`: `False`

### Setting secrets

```bash
# Production
fly secrets set SENTRY_DSN=https://...@sentry.io/... --app civica-api

# Staging
fly secrets set SENTRY_DSN=https://...@sentry.io/... ENVIRONMENT=staging --app civica-api-staging
```

### Verifying Sentry is receiving events

The `/debug/sentry-check` route is available in non-production environments only (`ENVIRONMENT != "production"`).

```bash
# Staging
curl https://<staging-host>/debug/sentry-check
# Expected: {"ok": true, "sentry_dsn_configured": true, "environment": "staging"}
```

A `capture_message` event at level `error` is sent on each call. Confirm it appears in the Sentry project within 30 seconds.

If `SENTRY_DSN` is not set the route returns `{"ok": false, "reason": "SENTRY_DSN not set"}` — the secret has not been applied.

### Verifying in production

The `/debug/sentry-check` route returns 404 in production. To verify production Sentry is live, trigger a real error (e.g., a malformed request that returns a 500) and confirm the event appears in Sentry. Alternatively, temporarily set `ENVIRONMENT=staging` on the production app, hit the check route, then restore.

---

## Other services

See [`deploy.md`](deploy.md) for secret setup instructions for enrollment-api (Cloudflare Workers), civica-snap-api (Fly.io), and dashboard (Vercel).
