# civica-web

Public B2C landing page for Civica — the CalFresh enrollment app for California
Community College, CSU, and UC students. Session G scaffold.

The page leads with the LPIE (Long-term Program Improvement Eligibility)
expansion message: "the rules changed, you probably qualify now," and captures
leads for the TestFlight cohort.

## Stack

- Next.js 16 (App Router) with `--webpack` (not Turbopack — workspace `.js →
  .ts` import workaround mirrors `apps/dashboard/`)
- React 19, TypeScript 5
- `@supabase/supabase-js` for lead persistence
- `zod` for request validation
- Vitest for tests (node environment)

## Local development

```bash
pnpm install                  # from repo root
pnpm --filter civica-web dev  # http://localhost:3000
```

## Environment variables

Create `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_TESTFLIGHT_URL=https://testflight.apple.com/join/<code>
```

If `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset, the
`/api/lead-capture` route returns 503 (so the UI can still be exercised in dev
without Supabase credentials).

## Lead persistence

POST `/api/lead-capture` writes to the `public.pilot_leads` table with
`source = 'student-lpie-web'`. The existing table requires `name` and
`organization` NOT NULL; until the form collects name, we synthesize `name`
from the email prefix and use the campus (or `'unspecified-campus'`) for
`organization`. Phone is stashed in `qc_process` for now. A follow-up should
either add nullable `phone`/`campus` columns or split out a dedicated
`student_leads` table.

## Tests

```bash
pnpm --filter civica-web test
```

Covers the API route happy path, validation, missing-env 503, Supabase 500,
and rate limiting. Component tests are intentionally skipped at pilot scope.

## Deployment

Vercel — same account as `apps/dashboard/`. Project not yet linked; the
`civica.app` domain decision is owner-only.

## Design tokens

CSS variables in `app/globals.css` mirror `CivicaDesignSystem` (Swift). The
body font is **Hanken Grotesk** via `next/font/google`, matching the iOS
typography stack registered in `CivicaTypography.swift`.
