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
├── apps/                      # Node-side applications (added Phase 0+)
│   ├── api/                   # Hono API server (replaces Flask in backend/)
│   ├── web-b2c/               # Next.js applicant-facing app
│   ├── dashboard/             # Next.js navigator dashboard
│   └── worker/                # OCR + background job worker
│
├── packages/                  # Shared Node packages
│   ├── config/                # tsconfig / ESLint / Prettier / Tailwind presets
│   ├── db/                    # Prisma schema, generated client, seed
│   ├── types/                 # Zod schemas + OpenAPI-derived TS types
│   ├── ui/                    # shadcn components shared by web apps
│   ├── ocr/                   # OCR provider abstraction (Textract fallback)
│   ├── pdf/                   # Readiness-packet PDF renderer
│   ├── logger/                # pino + PII redaction
│   ├── compliance/            # Forbidden-language registry (ported from Swift)
│   └── fixtures/              # Shared test fixtures
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

## Migration status

The Node monorepo is being introduced phase-by-phase. The Python Flask backend
at `backend/civic_api/` and root-level `api.py` remain authoritative until the
Hono port reaches feature parity (tracked in `migration/flask-inventory.md`,
added Phase 2a).

Until cutover, iOS clients continue to hit the Render-hosted Flask service via
`CIVIC_API_BASE_URL` in [`Civica-Info.plist`](Civica-Info.plist).
