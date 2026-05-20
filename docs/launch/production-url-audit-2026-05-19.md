# Production URL audit — 2026-05-19

Triggered by `scripts/launch-preflight.sh` (PR #211) catching 3 production endpoints
returning 404. This is a **read-only diagnosis**. No production infrastructure
was touched. No code paths were changed.

## TL;DR

All three "404s" are documentation/configuration bugs, not deployment outages.
The underlying apps are all up and healthy:

| Documented (broken) | Reality | Root cause |
|---|---|---|
| `https://civica-dashboard.vercel.app` | Vercel project does not exist (`DEPLOYMENT_NOT_FOUND`). Real dashboard lives at **`https://civica-api.vercel.app`**. | Wrong URL in docs + preflight script + enrollment-api CORS allowlist. |
| `https://civica-snap-engine.fly.dev/health` | App is up; health route is **`/healthz`**, not `/health`. | Wrong path in docs/preflight. |
| `https://civica-api.fly.dev/health` | App is up; health route is **`/healthz`**, not `/health`. | Wrong path in docs/preflight. |

CLI auth available: `fly` (used). `vercel` CLI not installed — Vercel inspection
done via HTTP probes only.

## Tooling availability

| Tool | Available? | Notes |
|---|---|---|
| `fly` CLI | Yes (authenticated) | Used `fly apps list` + `fly status -a <name>` |
| `vercel` CLI | **No** (command not found) | Skipped `vercel ls`. Vercel state inferred from HTTP headers (`x-vercel-error`, `x-vercel-id`, `server: Vercel`). |

## Findings

### 1. Dashboard URL — wrong hostname in docs

- **Documented URL:** `https://civica-dashboard.vercel.app`
- **HTTP probe:**
  - `GET /` → `HTTP/2 404` with header `x-vercel-error: DEPLOYMENT_NOT_FOUND`
  - DNS does resolve (Vercel's wildcard edge), but no Vercel project owns this hostname.
- **Actual deployment:** `https://civica-api.vercel.app`
  - `GET /` → `HTTP/2 307` → `Location: /login` (Next.js middleware redirect — expected for unauthenticated dashboard root)
  - Header `server: Vercel`, no `DEPLOYMENT_NOT_FOUND` error.
  - This matches the existing MEMORY note: "Vercel project is `civica-api`
    (confusingly named — it hosts the dashboard, not the API)."
- **Action needed:**
  1. Update `docs/snap/launch-readiness.md`, `docs/snap/runbook.md`, and
     `scripts/launch-preflight.sh` (in PR #211) to use
     `https://civica-api.vercel.app` (or, better, set up a custom domain like
     `https://dashboard.civica.app` and point Vercel + docs at it).
  2. Update `apps/enrollment-api/src/index.ts` CORS allowlist — see §4 below.

### 2. `civica-snap-engine` Fly app — wrong health path

- **Documented URL:** `https://civica-snap-engine.fly.dev/health`
- **Fly app exists?** Yes (`fly apps list` shows it; status: `deployed`).
- **App status:** Up (1 machine started in `iad`, 1 check passing, last deploy 2026-05-18T15:46:24Z).
- **`/health` route present?** **No.**
  - `GET /health` → `HTTP/2 404` with body `{"detail":"Not Found"}` (FastAPI's default 404 shape — confirms the app is responding, route is just unregistered).
- **Actual health endpoint:** `/healthz`
  - `GET /healthz` → `HTTP/2 200` body `{"ok":true}`
- **`GET /`** also returns 200: `{"ok":true,"service":"Civica Civic API","version":"1.0.0"}` — useful as a simpler liveness signal too.
- **Action needed:** Update `scripts/launch-preflight.sh` to probe `/healthz` (or `/`), not `/health`.

### 3. `civica-api` Fly app — wrong health path

- **Documented URL:** `https://civica-api.fly.dev/health`
- **Fly app exists?** Yes. App config in repo: `apps/api/fly.toml`.
- **App status:** Up (1 machine started, 1 check passing, last deploy ~13 min before audit).
- **`/health` route present?** **No.**
  - `GET /health` → `HTTP/2 404 application/json` (Hono's 404).
- **Actual health endpoint:** `/healthz` (matches `apps/api/fly.toml` line: `[[http_service.checks]] path = "/healthz"`).
  - `GET /healthz` → `HTTP/2 200` body `{"status":"ok","service":"@civica/api","timestamp":"…"}`
- **`GET /`** also returns 200: `{"ok":true,"service":"Civica Civic API","version":"1.0.0"}`.
- **Action needed:** Same as §2 — update preflight to use `/healthz`.

### 4. CORS allowlist references a non-existent origin

`apps/enrollment-api/src/index.ts` (on `origin/codex/rebuild-feb18`, post PR #197) hardcodes:

```ts
const CORS_ALLOWED_ORIGINS = [
  "https://civica-dashboard.vercel.app",   // <-- does not exist
  "https://civica.app",
  "http://localhost:3000",
];
```

Verified via preflight (`OPTIONS` on `https://civica-enrollment-api.civica-api.workers.dev/v1/enrollment/feature-flags`):

- `Origin: https://civica-dashboard.vercel.app` → response includes
  `access-control-allow-origin: https://civica-dashboard.vercel.app` (allowed,
  but the origin is fictitious).
- `Origin: https://civica-api.vercel.app` (the **real** dashboard) →
  **no `access-control-allow-origin` header** → browsers will block the
  cross-origin request.

This means the real dashboard cannot call the enrollment API from the browser
in production today. (CORS does not block server-side calls / no-Origin
requests, so feature flags / SSR fetch may still work; client-side mutations
from the browser will fail.)

`CORS_VERCEL_PREVIEW` regex `^https:\/\/civica-dashboard-.*\.vercel\.app$`
likewise targets the wrong project — preview deploys of the actual project
will be hostnames like `civica-api-<hash>-<scope>.vercel.app`.

## Recommended fixes (no infra changes made here)

In rough priority order. None of these were applied in this worktree; they
require separate PRs.

1. **`apps/enrollment-api/src/index.ts`** — update `CORS_ALLOWED_ORIGINS` to
   include the real production dashboard origin and adjust
   `CORS_VERCEL_PREVIEW` to match the real Vercel project. Recommended set:

   ```ts
   const CORS_ALLOWED_ORIGINS = [
     "https://civica-api.vercel.app",   // real dashboard (Vercel project: civica-api)
     "https://civica.app",
     "http://localhost:3000",
   ];
   const CORS_VERCEL_PREVIEW = /^https:\/\/civica-api-.*\.vercel\.app$/;
   ```

   (Or, before changing code: set up a stable custom domain like
   `dashboard.civica.app` and put **that** in the allowlist so renames don't
   break CORS again.)

2. **`scripts/launch-preflight.sh`** (PR #211, currently only on remote — not on
   this worktree) — change the three probed URLs:
   - `https://civica-dashboard.vercel.app` → `https://civica-api.vercel.app`
     (expect `307 -> /login`, not `200`)
   - `https://civica-snap-engine.fly.dev/health` → `…/healthz`
   - `https://civica-api.fly.dev/health` → `…/healthz`

3. **`docs/snap/launch-readiness.md`** and **`docs/snap/runbook.md`** — replace
   `civica-dashboard.vercel.app` references with the real dashboard URL, and
   add the `/healthz` path where Fly health endpoints are mentioned.

4. **Custom domain (optional, recommended):** assign a stable custom domain
   (e.g. `dashboard.civica.app`) to the `civica-api` Vercel project. The
   Vercel-project-name-as-hostname is fragile (the project was renamed from
   `civica-api` → it should arguably move to `civica-dashboard`, but
   doing so would mint a new `*.vercel.app` and require Sentry/env updates).
   A custom domain decouples docs/code from Vercel internals.

5. **Deploy state:** no missing deployments — every documented app exists and
   is healthy. Nothing needs to be redeployed to fix the preflight; this is
   purely a docs + config alignment task.

## What to do next

1. Open one PR against `codex/rebuild-feb18` titled
   *"fix(launch): correct preflight URLs + CORS allowlist for real dashboard"*
   that does items 1, 2, 3 from "Recommended fixes" above. This is small
   (3 files, ~10 lines) and unblocks PR #211's preflight.
2. Separately, file an issue for item 4 (custom domain) — not urgent, but
   pays down the "Vercel project named civica-api hosts the dashboard"
   confusion.
3. Re-run `scripts/launch-preflight.sh` after #1 lands; expect all green.

## Raw evidence

```text
$ fly apps list
 civica-api            │ deployed  │ 13m18s ago
 civica-snap-api       │ deployed  │ May 18 2026 15:46
 civica-snap-engine    │ deployed  │ May 18 2026 15:46

$ curl -sI https://civica-dashboard.vercel.app/
HTTP/2 404
x-vercel-error: DEPLOYMENT_NOT_FOUND

$ curl -sI https://civica-api.vercel.app/
HTTP/2 307
location: /login
server: Vercel

$ curl https://civica-snap-engine.fly.dev/healthz
{"ok":true}

$ curl https://civica-api.fly.dev/healthz
{"status":"ok","service":"@civica/api","timestamp":"2026-05-20T00:59:46.325Z"}

$ curl -sI -X OPTIONS -H "Origin: https://civica-api.vercel.app" \
    -H "Access-Control-Request-Method: GET" \
    https://civica-enrollment-api.civica-api.workers.dev/v1/enrollment/feature-flags
HTTP/2 204
vary: Origin
# No access-control-allow-origin header → blocked by browsers.

$ curl -sI -X OPTIONS -H "Origin: https://civica-dashboard.vercel.app" ...
HTTP/2 204
access-control-allow-origin: https://civica-dashboard.vercel.app
# Allowed — but for an origin that does not exist.
```
