# @civica/benefitscal-cbo

BenefitsCal CBO portal submission pipeline. Two phases:

- **Phase 1 — navigator-review snapshot.** Pure-mapping `normalizeForPortal()`
  produces a `BenefitsCalPayload` from a Civica packet. The enrollment-api
  route `POST /benefitscal/prepare-export/:packetId` inserts a
  `benefitscal_submissions` row with `status='pending_review'` for the
  navigator to review in the dashboard.

- **Phase 2 — automated portal submission (Session M1).** `submitToBenefitsCal()`
  drives the BenefitsCal CBO Manager portal via Playwright to actually
  submit the packet. Triggered by `POST /benefitscal/submit/:packetId` and
  runs asynchronously via the Cloudflare Worker's `ctx.waitUntil`
  background lifecycle. NOT Cloudflare Queues — at pilot scale (~5
  submissions/month) Queues is over-engineering.

## Rollout gate

Phase 2 automation is **off by default**. v1 launch path is the manual
PDF export SOP (see Session F coordinator guide). Phase 2 switches on
per-packet only once **all** of the following are true:

- [x] Driver service wired — Browserless v1 (TODO-15)
- [ ] 5 successful sandbox submissions logged
- [ ] M2: `BENEFITSCAL_CBO_USERNAME` + `BENEFITSCAL_CBO_PASSWORD` secrets set in production
- [ ] 9 portal form-fill TODOs in `submitter.ts` completed
- [ ] ≥2 navigator-driven smoke tests pass against production portal

## Architecture

```
POST /benefitscal/submit/:packetId
        │
        ▼
  ┌──────────────────────────────┐
  │ enrollment-api route handler │  ← idempotency check, insert queued row
  └──────────────┬───────────────┘
                 │ ctx.waitUntil(...)
                 ▼
  ┌──────────────────────────────────────┐
  │ lib/benefitscal-submit.ts            │  ← marks running, calls submitter,
  │   runBenefitsCalSubmission(opts)     │    persists terminal state + transcript
  └──────────────┬───────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────┐
  │ @civica/benefitscal-cbo/submitter.ts │  ← browser lifecycle, login, transcript,
  │   submitToBenefitsCal(opts)          │    error handling — PORTAL FLOW TODO
  └──────────────┬───────────────────────┘
                 │ BrowserDriver (injected)
                 ▼
        ┌────────────────────┐
        │ Browserless / Node │  ← real Playwright (NOT in Worker)
        │ external service   │
        └────────────────────┘
```

### Why `BrowserDriver` is injected

Cloudflare Workers cannot run real Playwright / Chromium in-process. The
submitter takes a `BrowserDriverFactory` so production can wire to an
external browser service while tests inject fakes.

**v1 (current) — Browserless.io.** Set `BROWSERLESS_API_KEY` as a Worker
secret and the route auto-builds a `browserlessDriverFactory()`. Each
`BrowserDriverPage` method (`goto`, `fill`, `click`, `waitForURL`,
`textContent`, `screenshot`) becomes a POST to Browserless's `/function`
endpoint. Session continuity is preserved across calls via the
`browserWSEndpoint` returned by Browserless on the first call.

When `BROWSERLESS_API_KEY` is absent (dev, staging without secrets), the
route gracefully marks newly queued rows `failed` with a clear
`DRIVER_NOT_WIRED` message — the navigator UI shows this and falls back
to the manual PDF SOP.

**Setup (operator):**

```sh
# 1. Sign up at https://browserless.io — free tier (1000 units/month)
# 2. Copy the API key from the dashboard
# 3. Set as a Worker secret:
wrangler secret put BROWSERLESS_API_KEY --env production
# 4. Deploy:
wrangler deploy --env production
```

**v2 migration path — Fly.io sidecar.** Migrate when:

- Monthly submissions exceed ~500 (Browserless free tier is 1000
  units/month; a paid plan is fine up to ~5k but at that scale in-house
  is cheaper), OR
- A data-handling audit requires that BenefitsCal credentials never
  transit a third-party vendor's TLS pipeline.

Migration steps (sketch): new Fly app with Node + Playwright, expose a
REST API mirroring the Browserless `/function` shape, swap
`browserlessDriverFactory` for a `flyDriverFactory` keyed off a
`FLY_BROWSER_URL` secret. The submitter framework does not change.

A `nodePlaywrightDriverFactory()` helper is also exported for Node-side
tooling / offline iteration. Do NOT use this from the Worker.

## TODO list — portal flow

`submitter.ts` deliberately stubs the portal-specific UI flow. The framework
is complete; the steps below need real selectors captured from the live
CBO Manager portal once county approval lands.

Each step becomes a transcript entry; fill in selectors + assertions:

- [ ] `click_new_application` — "New CalFresh Application" button
- [ ] `fill_household_primary` — first/last name, DOB, SSN last 4, address
  (street/city/state/zip), phone (E.164)
- [ ] `fill_household_members` — loop `snapshot.household_members[]`:
  first_name, last_name, DOB, relationship
- [ ] `fill_income_sources` — loop `snapshot.income_sources[]`: income_type,
  income_amount, income_frequency (monthly/weekly/biweekly/annual/irregular)
- [ ] `fill_utility_allowance` — `snapshot.utility_allowance_type` →
  portal SUA selector (standard / limited / telephone_only / none)
- [ ] `upload_documents` — loop `snapshot.document_urls[]`: download from
  signed URL, attach via file input
- [ ] `fill_consent` — `snapshot.client_signature_type` +
  `telephonic_consent_recorded_at` when applicable
- [ ] `click_review_and_submit` — sanity-check review page, then submit
- [ ] `capture_confirmation` — read confirmation number from success page,
  populate `confirmation_number` + (if exposed) `benefitscal_application_id`

Field-name guesses live in `field-map.ts`; selectors must be **verified
against the live portal** before this code runs against production. **Do
NOT guess** at selectors. If you can't see the live portal yet, leave the
TODO.

## Local development

Two ways to iterate offline:

1. **Mocked driver (preferred for unit tests).** Inject a fake
   `BrowserDriverFactory` whose `BrowserDriverPage` methods are stubs.
   See `submitter.test.ts` for the pattern.

2. **Recorded Playwright trace.** Once selectors are filled in, run the
   submitter against a saved Playwright trace via
   `nodePlaywrightDriverFactory()`. Capture the trace with
   `--video=on --trace=on` while logged into a sandbox CBO account.
   Replay locally for iteration without hitting the live portal.

## Production credentials

Set as Cloudflare Worker secrets — never in `[vars]` or `.dev.vars` in
source control:

```sh
wrangler secret put BENEFITSCAL_CBO_USERNAME --env production
wrangler secret put BENEFITSCAL_CBO_PASSWORD --env production
# Optional override:
wrangler secret put BENEFITSCAL_BASE_URL --env production
```

## Status state machine

| Status            | Set by                          | Meaning |
|-------------------|---------------------------------|---------|
| `pending_review`  | `POST /prepare-export`          | Phase 1 snapshot awaiting navigator review |
| `queued`          | `POST /submit`                  | Phase 2 background task scheduled, not yet running |
| `running`         | `runBenefitsCalSubmission`      | Playwright driver actively driving the portal |
| `succeeded`       | `runBenefitsCalSubmission`      | Portal accepted submission; confirmation captured |
| `submitted`       | (legacy Phase 1)                | Kept for backwards compat with pre-M1 rows |
| `failed`          | `runBenefitsCalSubmission`      | Driver threw; transcript persisted; retryable |
| `cancelled`       | (legacy Phase 1)                | Navigator cancelled before submission |

Constraint defined in `supabase/migrations/20260557_benefitscal_async_status.sql`.
