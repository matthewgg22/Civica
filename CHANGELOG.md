# Changelog

User-facing and contributor-facing changes worth knowing about. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This file
starts at the `claude/compliance-session-2026-05-21` branch — earlier history
lives in `git log`.

Categories used:
- **Added** — new capability
- **Changed** — visible behavior change

## [0.2.10.1] - 2026-06-06

### Changed
- **CBO preview Applications — utility-density pass** — replaced the floating rounded stat-chips with a single hairline-divided metric strip (label over number, tabular), tightened row + section padding, dropped the soft tinted fill on the expanded record in favor of a thin pine accent rail, squared the radius, and compacted the dropdown into a denser field:value record. Palette unchanged — this is an operations-density treatment within the existing design system, so the staff/CBO tool reads like a case-management panel rather than a marketing surface.

## [0.2.10.0] - 2026-06-06

### Changed
- **CBO preview queue — de-faked + history + editable** — the navigator queue dropdown now runs each synthetic applicant's answers through the **real rules engine** (`packetAnswersToFacts` → `computeBenefit`/`confirmForVerdict` in `lib/cbo/demo-pipeline.ts`): the **Engine determination** (estimated benefit) and **Verification needed** checklist are genuinely computed, not hand-set (synthetic input, real engine output). Adds an **application-history timeline** per case and an **inline edit** affordance on each answer (ephemeral demo — local only, not saved; real persisted editing is the next step on the authenticated `/packets/[id]` dashboard). Search now also matches answer text. Replaces the hand-authored `APP_QUEUE` data.

## [0.2.9.0] - 2026-06-06

### Added
- **CBO preview — application responses in the queue dropdown** — expanding an application in the navigator pipeline now shows the applicant's **questions and answers**, grouped by survey section (Where you're applying · Your household · Income · Monthly expenses · Student status · Documents), mirroring the `snap_enrollment.packet_answers` shape (question_label → applicant_answer). Engine-flagged answers (e.g. SSN mismatch, rent over area norm, missing proof of income) render in brick with a ⚑. Search now also matches answer text. The engine pipeline + flags panels move below the responses. Synthetic data — no real applicant information.

## [0.2.8.0] - 2026-06-06

### Added
- **CBO preview — searchable, expandable applications queue** — the navigator pipeline on `/cbo-preview` is now a searchable list (filter by case ID, name, county, status, or flag) with a column header (Case ID · Applicant · County · Status · Completion · Flags · Risk). Each application expands to a dropdown showing the full engine pipeline (8 steps from Eligibility screener → Submitted to county, each marked done / in-progress / pending), a derived completion rate with a progress bar, and the specific flags the engine raised (e.g. "Income verification documents missing", "SSN does not match SSA records"). New client component `ApplicationsQueue.tsx`; synthetic demo data, no real applicant information.

## [0.2.7.6] - 2026-06-06

### Changed
- **CBO preview applications — professional case IDs + structured rows** — replaced the name-derived pseudo-identifiers (`JASMINE`, `9ELENA`, `CARLOS`…) in the navigator queue with structured CalFresh case IDs (`CF-2026-####`), consistent across the Overview preview and the full Applications view. Each queue row now leads with the case ID (mono) as the canonical reference, then applicant name and "{County} County, CA", so the pipeline reads like a real case-management system.

## [0.2.7.5] - 2026-06-06

### Fixed
- **Why Civica hero load + convergence** — the scroll hero now renders the static line field on the server (immediately visible) instead of flashing blank before the animation chunk loads. The turbulent "mess" field no longer collapses all lines onto one exact point with a flat overlapping tail; lines now resolve into a soft bundle that flows into the app, removing the unnatural razor-pinch at the end.

## [0.2.7.4] - 2026-06-06

### Added
- **Privacy Policy footer link + placeholder page** — applicant footers (`/welcome`, `/why-civica`) now show a "Privacy Policy" link alongside the copyright, pointing to a new `/privacy` placeholder page (real policy copy TBD with counsel).

## [0.2.7.3] - 2026-06-06

### Changed
- **Root URL redirects to /welcome** — the applicant portal's `/` now 307-redirects to the polished `/welcome` page, so there's one canonical applicant landing instead of an older, separately-maintained marketing page at the root. Temporary redirect — reversible if a distinct marketing page is built later.

## [0.2.7.2] - 2026-06-06

### Changed
- **Wider applicant layout** — the "What is SNAP" explainer (`/welcome`) and the Why Civica feature grid now use the full page width (`min(1280px, 92vw)`) instead of the narrow 720–840px reading column. The "what you can buy" can-list + map row, the income table panel, and the FAQ all widen accordingly; the 3-up Why Civica feature cards go from ~220px to ~390px each. Body paragraphs keep a readable measure.

## [0.2.7.1] - 2026-06-06

### Removed
- **Dead applicant welcome copy** — removed 15 unused i18n keys (75 lines across all 5 locales) left over from prior `/welcome` versions: the old "how it works" steps (`home_how_*`), the retired app-island promo (`home_app_label`/`home_app_sub`), the standalone "Could I qualify?" block (`home_what_qualify`), the orphaned `home_buy_cant_label`, and the unused `home_nav_how`/`home_nav_status` tabs. No rendered change — these strings were defined but never referenced by the current page.

## [0.2.7.0] - 2026-06-05

### Changed
- **Applicant welcome hero polish** — sticky frosted nav on `/welcome` and `/`; the hero phone mockup now shows an iOS-faithful status screen (Dynamic Island, status bar, "Your CalFresh" timeline with amber/pine/ghost step markers mirroring `CivicaStatusTimeline`). Copy and the household-size estimator sit in two content-sized frosted cards over the (de-blurred) Van Gogh wheatfield background. Removed the decorative `$292` watermark behind the phone. Language picker height now matches the "Apply now" button (40px).

### Added
- **USDA SNAP credibility markers** — hero shows a "USDA SNAP — Federal Program" badge (links to fns.usda.gov) plus the full "Supplemental Nutrition Assistance Program · formerly known as Food Stamps" subtitle.
- **"Find food near you" map hover** — the three sample pins (Grocery store / EBT accepted / Free meals) now scale, lift, and show a label tooltip on hover; repositioned so none clip the map edge.
- **Mae CTA after FAQ** — an "Any other questions?" section routes to the Mae AI guide, with a disclaimer citing 7 CFR 273, real application experiences, and caseworker review (and noting answers may be wrong). Mae floating help button now appears on the welcome page.

## [0.2.6.0] - 2026-06-05

### Changed
- **Staff dashboard utility redesign** — Applications, Outreach, Renewals, and CBO Preview pages now follow a single-color-per-signal rule. Stat cards use one warning accent (Needs Attention only); all others are neutral. Status badge circles are now neutral gray — status information lives in the text pill, not the avatar placeholder. Section header bars, engine KPI banner dots, and risk tier dots are all removed. Risk is text-only (medium/high only; low is silent). Renewals bucket cards no longer use colored left-borders or colored backgrounds. Outreach urgency dots removed; urgency badge text is the only signal per row.
- **Buddy invite flow** — the "Get help from a navigator" banner in the applicant web app now generates a shareable invite link. Click the button to create a link; copy it to share with a navigator or CBO partner who can then access the application packet with you. Includes multilingual copy (EN/ES/ZH/VI/TL) and a graceful limit-reached state (max 3 active helpers).

### Added
- **StatefulButton component** — shared loading/confirmed button with inline spinner and double-click guard. Used by the buddy invite flow and the Missing Item Request panel.

## [0.2.5.0] - 2026-06-05

### Changed
- **Applicant home navigation** — "Apply" is now a dominant button pinned to the top-right of the nav, with a chevron dropdown holding Sign in and the iPhone-app download (Anthropic-style split button, in Civica pine). The floating app-download card that popped up over the page has been retired; the app lives in the dropdown now. The dropdown is a native control, so it works with the keyboard and without JavaScript.

## [0.2.4.0] - 2026-06-05

### Changed
- **Microsoft sign-in button hidden until configured** — the "Sign in with Microsoft" button now appears only when `NEXT_PUBLIC_ENABLE_MICROSOFT_OAUTH=true`. It shipped before the Entra provider was set up, so it would have dead-ended on "provider not enabled." Flip the env var once Entra is registered to reveal it. Google sign-in is unaffected.

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
