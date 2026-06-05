# Changelog

User-facing and contributor-facing changes worth knowing about. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This file
starts at the `claude/compliance-session-2026-05-21` branch — earlier history
lives in `git log`.

Categories used:
- **Added** — new capability
- **Changed** — visible behavior change

## [0.2.5.0] - 2026-06-05

### Changed
- **Applicant home navigation** — "Apply" is now a dominant button pinned to the top-right of the nav, with a chevron dropdown holding Sign in and the iPhone-app download (Anthropic-style split button, in Civica pine). The floating app-download card that popped up over the page has been retired; the app lives in the dropdown now. The dropdown is a native control, so it works with the keyboard and without JavaScript.

## [0.2.3.0] - 2026-06-05

### Added
- **Microsoft / Entra ID sign-in for staff** — a "Sign in with Microsoft" button on the navigator login page, alongside Google. Lets caseworkers at counties and CBOs that run Microsoft 365 sign in with their work account. Requires operator activation (register an Entra app + enable the Azure provider in Supabase).

## [0.2.2.0] - 2026-06-05

### Added
- **Two-factor authentication for staff** — navigators can enable TOTP 2FA from `/auth/mfa/setup` (scan a QR code with Google Authenticator, Authy, or 1Password). Once enrolled, a 6-digit code from the authenticator app is required on every sign-in. Optional to enroll, mandatory once enrolled. Requires the Supabase TOTP factor to be enabled in the project's auth settings.

## [0.2.1.0] - 2026-06-05

### Added
- **Google OAuth for staff dashboard** — navigators can now sign in with a Google account via the "Sign in with Google" button on the Civica Navigator login page. Requires operator activation (Google provider in Supabase console + redirect URI in Google Cloud). Staff role gate (`app_metadata.role`) still enforced — unapproved Google accounts are rejected.
- **OTP rate limiting** — `/api/auth/otp` now blocks more than 5 OTP requests per IP per 10-minute window with a 429 response. Mirrors the enrollment-api rate limiting pattern (PR #248).
- **BenefitsCal Expenses wiring** — Expenses section (ABAPH rent, utilities, dependent care, medical) fully wired to the selector-map; `scopePayloadForExpenseType` scopes payload per expense type (issue #499, #314).

### Changed
- **Web auth migrated to `@supabase/ssr`** — replaced the custom cookie-based session stack (`persistSession`/`clearSession`/`refreshWithToken`) with the standard `@supabase/ssr` SDK. Fixes a concurrent token-refresh race condition that could silently drop sessions under load. Existing sessions will require a one-time re-login.
- **"Sign in to send" redirect fixed** — after completing the SNAP application wizard unauthenticated, the "Sign in to send" CTA now returns to `/apply/review` (not `/status`), so the draft is actually submitted after login.

### Fixed
- **International phone numbers** — the OTP route no longer silently maps ambiguous 10-digit non-US numbers to a wrong `+1` number. Numbers without an explicit `+` country-code prefix that aren't 10-digit US format now return a `non_us_phone` error with actionable copy in English and Spanish.

## [0.2.0.0] - 2026-06-04

### Added
- **Request access form** — `/sign-up` page lets navigators and CBOs submit their name, org, and email to request a Civica Navigator account; submissions stored in `access_requests` Supabase table.
- **Password reset callback** — `/auth/reset-password` handles Supabase PKCE reset links, exchanges the `?code=` token, and lets users set a new password. Previously this page was a 404.
- **SNAP applicant welcome page** — `/welcome` on `apps/web` introduces Civica with trust copy (what it does, data privacy, navigator review) and a bilingual en/es CTA before asking for a phone number.

### Fixed
- **Forgot password redirect loop** — clicking "Forgot password?" without entering an email no longer shows a red error; it now opens an inline reset section with its own email field (`mode: "signin" | "forgot" | "sent"` state machine).
- **"Request access" 404** — the link on the login page previously led to a missing route; it now resolves to the new `/sign-up` form.
- **Unauthenticated `/auth/*` and `/sign-up` redirect loop** — middleware now permits `/auth/` and `/sign-up` without a session; previously these routes bounced unauthenticated visitors back to `/login` in a loop.
- **WCAG AA contrast regression** — `AppHeader` "Navigator" label changed from `text-muted` to `text-graphite` at 10px per DESIGN.md §6.6.

### Changed
- **Landing page CTA** — `apps/web` hero "Start your application" now routes to `/welcome` (trust page) instead of directly to `/sign-in`.
- **Deprecated** — still works, will be removed
- **Removed** — gone
- **Fixed** — bug fix
- **Security** — access-control or data-protection change

When you ship something a contributor or downstream consumer would want to
know about, add a one-line entry under `## [Unreleased]`. Don't restate the
commit subject — say what changed for the reader of this file.

---

## [Unreleased]

### Added
- `apps/civica-submitter-extension`: the extension now fills BenefitsCal
  application pages for real (previously every field was a `todo` no-op). Driven
  by a typed selector map captured from the live CBO portal walk, with a
  React-safe fill primitive (writes through the native value setter so
  React-controlled inputs register the change), a label-first DOM resolver, and
  county-name→ordinal + phone E.164→10-digit transforms. A human still reviews
  and clicks submit; unknown/absent fields surface as needs-review rather than
  being silently defaulted.
- `@civica/benefitscal-cbo`: new `./core` subpath export (browser-safe selector
  map, field-map, normalize, schemas — no Playwright) and `./driver` subpath
  (server-side Playwright submitter, deferred to v2). Adds `core/selector-map.ts`
  (28 portal pages), `core/fill.ts` (React-safe fill), `core/locate.ts` (label
  resolver), `core/transforms.ts` (county/phone).
- `@civica/benefitscal-cbo`: `BenefitsCalPayload` gains `address.county`,
  `is_homeless`, `is_college_student`, `marital_status`, `citizenship_status`,
  and optional `sex_assigned_at_birth` / `gender`. Eligibility-critical fields
  are optional and omitted when intake lacks an answer — never silently
  defaulted. `ssn_last4` remains the only SSN field stored.
- `supabase`: `v_qc_pillar_coverage` view caches per-pillar engagement
  rates (income / shelter / SUA flags / OBBBA chain) used by the `/qc`
  Error Rate Intelligence page. Re-computes from `snap_packets`,
  `argyle_connections`, `uploaded_documents`, and `packet_answers` so
  FormulaHero, PillarTracking, and IncomingDataFeed read a single
  authoritative engagement vector. Migration `20260583_qc_pillar_coverage_view.sql`.
- `apps/enrollment-api`: `GET /openapi.json` publishes the OpenAPI 3.1 spec
  covering the iOS-facing surface (me, me-packets, me-inbox, me-argyle,
  me-work-hours, buddy, recert, feature-flags). Drift test in
  `src/openapi/spec.test.ts` keeps the registry honest. See
  `apps/enrollment-api/src/openapi/spec.ts`.
- `apps/enrollment-api`: 5-minute Cloudflare Cron Trigger clears
  `app_metadata.role` for completed/revoked buddy relationships so a revoked
  buddy JWT stops authenticating as `kind='buddy'` within the sweep interval
  instead of the JWT TTL (~1h). See `src/cron/buddy-app-metadata-cleanup.ts`.
- `apps/enrollment-api`: 500 responses include `trace_id` matching the
  `request_id` in Sentry/Axiom logs so a user-reported failure can be grepped
  to the exact server-side event.
- `apps/dashboard`: 29 unit tests across the `lib/analytics/` modules
  (`section10105`, `obbba`, `civica-outcomes`, `snap-framework`) that produce
  the dollar figures and outcome rows shown on `/compliance`.
- `supabase`: `set_actor_context()` Postgres function batches the per-request
  audit-context setup. Migration `20260571_set_actor_context_function.sql`.
- `supabase`: `buddy_packet_summary_view` exposes only safe columns
  (packet_id, status, state_code, current_section, updated_at). Migration
  `20260570_buddy_packet_summary_view.sql`.
- `CHANGELOG.md`, `CONTRIBUTING.md` — first contributor docs (linked from
  README).

### Changed
- `apps/dashboard`: `/qc` Error Rate Intelligence page restructured
  from a single 466-line file into composable section components
  (`ThesisAggregatesSection`, `IncomingDataFeedSection`,
  `CalibrationSection`) so each surface reads its own slice of
  the `v_qc_pillar_coverage` engagement vector and can evolve
  independently. No visual change for the operator.
- `apps/enrollment-api`: `POST /navigator/packets/:id/error-risk` and
  `POST /me/packets/:id/error-risk` now call a single shared `scorePacketRisk()`
  in `src/lib/scoring.ts`. The navigator endpoint previously used a simplified
  proxy that diverged on HEAP + Full-SUA conflicts and missing OCR data —
  same packet, two scores. Navigator now sees the authoritative score the
  applicant view shows.
- `apps/enrollment-api`: `withActorContext` middleware issues one RPC instead
  of 3–4 sequential `set_config` round-trips. Saves ~60–80 ms on every
  mutating request.

### Fixed
- `Civica` (SNAP intake): the CalFresh student-status survey now asks whether
  the applicant is in an employment & training or student-support program
  (SNAP E&T, WIOA, EOPS/CARE, CalWORKs, Cal Grant). Before this, a half-time
  student whose only exemption was such a program was screened as "you may not
  qualify," a false disqualification, since 7 CFR 273.5(b) recognizes the
  program path federally. The new `inApprovedJobProgram` answer maps to
  `ExemptionReason.employmentTrainingProgram` in the federal rules engine, which
  every state conformer (including CA) inherits. See `PARITY-AUDIT.md` Gap 1.

### Security
- `supabase`: dropped `buddy_read_active_packet` policy from `snap_packets`
  (it granted SELECT on the full row, including SSN ciphertext, income, and
  household composition). Buddies now read through `buddy_packet_summary_view`
  via the anon client; the view's `SECURITY DEFINER` function predicate-checks
  against `buddy_relationship` for the calling `auth.uid()`.

---

## Migration / deploy notes

- New supabase migrations (`20260570`, `20260571`) must be applied before the
  `set_actor_context()` RPC fires or buddies can read the summary view.
- `wrangler deploy` from `apps/enrollment-api/` activates the new cron trigger
  (`crons = ["*/5 * * * *"]`).
