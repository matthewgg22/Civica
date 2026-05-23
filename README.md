# Civica

Monorepo containing the Civica iOS app, web apps, and supporting services.

## Layout

```
.
├── Civica.xcodeproj/          # Xcode project: Civica + VoteNow targets
├── Civica/                    # iOS app source (SwiftUI)
├── CivicaDesignSystem/        # Shared Swift design system package
├── WidgetExtension/           # iOS widget target
├── WeVote Information Page/   # VoteNow target source
├── Civica Tests/              # XCTest target
│
├── apps/                      # Node-side applications
│   ├── api/                   # Hono gateway on Fly.io (in front of FastAPI engine)
│   ├── enrollment-api/        # Hono on Cloudflare Workers (SNAP enrollment + buddy)
│   ├── web/                   # Next.js applicant-facing app
│   ├── dashboard/             # Next.js navigator dashboard
│   └── snap-verification-prototype/  # Internal scratch / spike app
│
├── packages/                  # Shared Node packages
│   ├── snap-rules/            # JSON DSL + evaluator (eligibility, SUA, work req)
│   ├── snap-qc-engine/        # Defensibility scoring + error-risk engine
│   ├── snap-calculator/       # Federal calc chain (deductions, allotment)
│   ├── snap-handoff/          # PDF / CSV exports for navigator handoff
│   ├── snap-compliance-copy/  # Forbidden-language registry (ported from Swift)
│   ├── snap-enums/            # Shared enum constants (kept in lockstep with Postgres enums)
│   ├── recert-engine/         # Recertification scheduling + outreach
│   ├── analytics-engine/      # DuckDB-over-Parquet typed query API (tier-3)
│   ├── benefitscal-cbo/       # BenefitsCal Playwright submitter
│   ├── state-connectors/      # USPS / Smarty / future state APIs
│   ├── cfr-273/               # 7 CFR 273 Parquet index for citations
│   ├── api-types/             # Shared API request/response types
│   ├── db-types/              # Supabase-generated DB row types
│   ├── fixtures/              # Shared test fixtures + schemas
│   ├── ui/                    # shadcn components shared by web apps
│   ├── config/                # tsconfig / ESLint / Prettier / Tailwind presets
│   └── db/                    # Prisma schema (mostly dead code; Supabase is authoritative)
│
├── backend/                   # LEGACY Python Flask (being ported to apps/api)
├── supabase/migrations/       # Authoritative DB migrations (Supabase CLI)
├── docs/                      # Architecture, runbooks, compliance notes
└── .github/workflows/         # CI (Swift today, Node jobs added Phase 7)
```

## Toolchain

- **Node:** 22 LTS (see `.nvmrc`)
- **Package manager:** pnpm 9 (see `packageManager` in `package.json`)
- **Task runner:** Turborepo 2
- **iOS:** Xcode 26, iOS 26 SDK

## Common commands

```bash
pnpm install              # Install all Node deps
pnpm build                # Turbo: build all packages/apps
pnpm typecheck            # Turbo: typecheck everything
pnpm lint                 # Turbo: lint everything
pnpm test                 # Turbo: run all tests
pnpm --filter @civica/api dev   # Run a single package/app
```

iOS builds continue to use Xcode and the existing CI workflow at
[`.github/workflows/civica-test.yml`](.github/workflows/civica-test.yml).

## Two API services — which one are you touching?

The repo has two Hono servers. They are different deployments with different
purposes; new contributors regularly confuse them.

| | `apps/api` | `apps/enrollment-api` |
|---|---|---|
| Runtime | Node on Fly.io | V8 isolates on Cloudflare Workers |
| Role | Gateway in front of the FastAPI engine (`backend/civic_api/`). Civic-tier routes ported from Flask. | SNAP enrollment, packets, navigator, buddy, recert, OCR webhooks. |
| Dev command | `docker compose up` (brings up Postgres + the Fly app) | `pnpm --filter @civica/enrollment-api dev` (uses `wrangler dev`) |
| Local config | `.env.local` (see `.env.example`) | `apps/enrollment-api/.dev.vars` (wrangler convention) |
| OpenAPI | Yes, at `GET /openapi.json` | Yes, at `GET /openapi.json` (iOS-facing surface) |
| Calls FastAPI engine | Yes, via `ENGINE_BASE_URL` | No |

If you are adding a route the iOS app or dashboard hits for enrollment,
packets, navigator inbox, work-requirements, buddy access, recertification,
or BenefitsCal submission, it lives in `apps/enrollment-api/`.

If you are adding a civic-tier route (assistant, examples, issue-classify),
it lives in `apps/api/`.

## Local dev — `apps/enrollment-api` (Cloudflare Workers)

```bash
# Copy and fill secrets — wrangler reads .dev.vars (NOT .env.local).
cp .env.example apps/enrollment-api/.dev.vars
# At minimum, set:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
#   BUDDY_JWT_SECRET (any 32-byte base64 string for local dev)

pnpm install
pnpm --filter @civica/enrollment-api dev
# Server runs on http://localhost:8787

# Run the tests in another terminal:
pnpm --filter @civica/enrollment-api test
```

To deploy: `cd apps/enrollment-api && wrangler deploy` (requires Cloudflare
account access). The cron trigger declared in `wrangler.toml` activates on
deploy.

## Local dev — `apps/api` (Fly.io Hono gateway)

```bash
cp .env.example .env.local       # Set DATABASE_URL, SUPABASE_*, INTERNAL_HMAC_SECRET
docker compose up                # Postgres + apps/api on :3000
# In another terminal, run the FastAPI engine from backend/civic_api/
```

## Migration status

The Node monorepo is being introduced phase-by-phase. The Python Flask backend
at `backend/civic_api/` and root-level `api.py` remain authoritative until the
Hono port reaches feature parity (tracked in `migration/flask-inventory.md`,
added Phase 2a).

Until cutover, iOS clients continue to hit the Render-hosted Flask service via
`CIVIC_API_BASE_URL` in [`Civica-Info.plist`](Civica-Info.plist).
