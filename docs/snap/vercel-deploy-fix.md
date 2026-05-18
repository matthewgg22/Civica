# Vercel deploy: Root Directory recovery guide

> **Status:** Reference doc. The Root Directory misconfig was resolved on 2026-05-18 (see [`launch-readiness.md`](launch-readiness.md) §9). Keep this doc as the recovery procedure if the dashboard setting drifts again, or if the Vercel project is re-created.

## Background

The Next.js web app lives in [`web/`](../../web/). It deploys to Vercel via the team's project (named `civica-api` as of 2026-05-18 — see [`web/.vercel/project.json:1`](../../web/.vercel/project.json)). Earlier audits referenced a project named `civica-app`; that project no longer exists in the team. If you see references to `civica-app` in older docs or commit messages, treat them as referring to the same web deployment, now under `civica-api`.

The historical failure mode: the Vercel project's **Root Directory** was set to a path that no longer matched the repo layout, so every PR preview deploy showed a red ✗ even though the PR itself was fine.

## How to confirm the current state

Inspect what is in the repo:

- [`web/.vercel/project.json:1`](../../web/.vercel/project.json) — local CLI link. Currently:
  ```json
  {"projectId":"prj_1XCWm4rVkaySM20yrAxtXUb8i5I5","orgId":"team_8cWic3JZvSea7AQQkFrXisOo","projectName":"civica-api"}
  ```
- [`web/vercel.json`](../../web/vercel.json) — declares `framework: "nextjs"`, `installCommand: "npm ci"`, `buildCommand: "npm run gen:api && npm run build"`, `outputDirectory: ".next"`, plus security headers.
- [`web/package.json`](../../web/package.json) — `name: "web"`, `build: "next build"`, depends on Next.js / next-intl / Sentry.
- [`web/app/`](../../web/app/) — App Router with `[locale]/`, `api/`, `layout.tsx`, `page.tsx`.

If you can run `npx vercel` locally, also useful:
```bash
cd web && npx vercel inspect <deployment-url>
```

## Dashboard fix steps

Only a human with Vercel access can change this. The repo cannot drive it.

1. Open [vercel.com](https://vercel.com/) → switch to the `civica-app` team (the team slug; the projects within it are named separately).
2. Open the project that builds the web app (currently `civica-api` per `web/.vercel/project.json`). If that project name is wrong, link the right one with `cd web && npx vercel link` and re-commit `web/.vercel/project.json`.
3. **Project Settings → Build & Development Settings → Root Directory**.
   - Set to: `web`
   - Leave "Include source files outside of the Root Directory in the Build Step" **unchecked** unless a future build legitimately needs repo-root files. (Currently no — `web/` is self-contained.)
4. **Framework Preset**: Next.js (auto-detected from `web/vercel.json`'s `framework: "nextjs"`).
5. **Build & Output Settings**: leave the per-field overrides empty. Vercel will pick them up from [`web/vercel.json`](../../web/vercel.json):
   - Install Command: `npm ci`
   - Build Command: `npm run gen:api && npm run build`
   - Output Directory: `.next`
6. **Environment Variables** — confirm `NEXT_PUBLIC_API_BASE_URL` is set for Production (should already be `https://civica-enrollment-api.civica-api.workers.dev` per launch-readiness §8). Add any others your Sentry/Supabase config needs.
7. Click **Save**, then **Deployments → Redeploy** the latest commit on `codex/rebuild-feb18` to validate the new config.

## What "correct" looks like

After the fix, every PR touching `web/**` should produce a green Vercel preview check, and the project Settings page should show:

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Framework Preset | Next.js |
| Install Command | `npm ci` (from `vercel.json`) |
| Build Command | `npm run gen:api && npm run build` (from `vercel.json`) |
| Output Directory | `.next` (from `vercel.json`) |
| Node.js Version | Default (≥ 20.x) |

## Verifying post-fix

1. Open the most recent PR touching `web/` (or push a no-op commit to a feature branch off `codex/rebuild-feb18`).
2. Wait for Vercel to comment with the preview URL.
3. Open `<preview-url>/en/sign-in` — confirm the sign-in page renders (English copy, Tailwind styled, no 500/404).
4. Also confirm `<preview-url>/es/sign-in` renders the Spanish locale.
5. Check the **Deployments** tab in Vercel for Status: **Ready** with no build warnings about missing files.
6. Optional smoke: hit `<preview-url>/api/health` (if defined) or whatever route the gateway proxies through.

If any of those fail, capture the Vercel build log and check first that Root Directory is actually `web` (the setting can be silently reverted on project re-creation).
