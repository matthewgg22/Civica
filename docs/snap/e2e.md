# SNAP Enrollment E2E Runbook

End-to-end smoke test that proves the critical applicant→navigator→handoff path works against live staging services.

## What it covers

| Act | Who | Actions |
|-----|-----|---------|
| 1 | Applicant | `POST /me/packets` → answer questions → record consent → submit |
| 2 | Navigator | Assign packet → advance to *In Navigator Review* → *Ready for Handoff* |
| 3 | Handoff | `json_api` export → `csv_summary` export → signed download URL |
| 3b | Handoff (opt.) | PDF packet via `apps/api` (skipped if `E2E_API_URL` unset) |

After every run the test deletes all `e2e_test_*` rows it created, including auth users.

## Architecture

```
e2e/
├── package.json            @playwright/test + @supabase/supabase-js
├── playwright.config.ts    No browser, 120s timeout, 1 retry in CI
├── critical-path.spec.ts   The test (three acts + cleanup check)
├── fixtures/
│   ├── test-users.ts       Creates applicant + staff users per run
│   └── generate-pdf.ts     Minimal valid PDF bytes for doc upload
└── helpers/
    ├── api.ts              Typed fetch wrappers for both APIs
    └── cleanup.ts          Deletes all e2e_test_* rows after each run
```

## Required secrets

Add these in GitHub → Settings → Secrets → Actions:

| Secret | Description |
|--------|-------------|
| `E2E_SUPABASE_URL` | Staging Supabase project URL (`https://xxx.supabase.co`) |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | Staging service-role key (bypasses RLS for setup/teardown) |
| `E2E_SUPABASE_ANON_KEY` | Staging anon key (used for JWT sign-in) |
| `E2E_ENROLLMENT_API_URL` | Deployed enrollment-api base URL |
| `E2E_API_URL` | *(Optional)* Deployed apps/api URL — enables PDF handoff sub-test |

## Setting up the staging Supabase project

1. Create a new project in Supabase (or reuse an existing staging project).
2. Apply all migrations: `supabase db push --project-ref <ref>` or apply in order from `supabase/migrations/`.
3. Create the `handoffs` storage bucket (public: no; allowed MIME: `application/json, text/csv, application/pdf`).
4. Add the secrets above to GitHub Actions.

> The test creates its own throwaway auth users per run via the service-role admin API. No pre-seeded users are needed.

## Running locally

```sh
# Install e2e dependencies
cd e2e && pnpm install

# Export required vars
export E2E_SUPABASE_URL=https://xxx.supabase.co
export E2E_SUPABASE_SERVICE_ROLE_KEY=eyJ...
export E2E_SUPABASE_ANON_KEY=eyJ...
export E2E_ENROLLMENT_API_URL=https://enrollment-api.civica.dev
export E2E_API_URL=https://api.civica.dev   # optional

# Run
npx playwright test critical-path.spec.ts
# or just the test file
npx playwright test critical-path.spec.ts --reporter=list
```

Open the Playwright HTML report after a run: `npx playwright show-report`.

## Manual workflow_dispatch

1. Go to **Actions → E2E nightly (critical path) → Run workflow**.
2. Optionally override `enrollment_api_url` or `api_url` (leave blank to use the secret defaults).
3. Monitor the run. Playwright traces are uploaded as artifacts on failure.

## What to do when the nightly fails

### 1. Download the trace

From the failed run: **Artifacts → playwright-trace-\<run-id\>**.  
Open with `npx playwright show-trace trace.zip`.

### 2. Identify which act failed

| Act 1 fails | Act 2 fails | Act 3 fails |
|-------------|-------------|-------------|
| enrollment-api is down or auth broken | Status transition guard rejected an invariant | handoff_exports table or Storage bucket issue |
| Check `/health` endpoint | Check migration 06 triggers | Check Supabase Storage bucket config |
| Check Supabase Auth is reachable | Check `packet_assignments` FK setup | Check `exported_by_staff_id` FK |

### 3. Common failure modes

**`POST /me/packets` → 401**  
The test applicant sign-in failed. The staging Supabase `email_confirm = true` path might be broken, or the anon key is wrong.

**`PATCH /packets/:id` → 422 "privacy_notice consent not on file"**  
The `POST /me/packets/:id/consent` call in Act 1 failed silently. Check enrollment-api consent endpoint logs.

**`PATCH /packets/:id` → 422 "unresolved required document items"**  
Required document items were seeded for the packet (which shouldn't happen when using the applicant route `POST /me/packets`). Investigate whether `evaluateChecklist` is now also called in the applicant path.

**`POST /packets/:id/handoff` → 422 "privacy notice consent not on file"**  
The handoff pre-flight check in `handoff.ts → collectBlockers()` did not find a `privacy_notice` consent. The consent row may have been revoked or the `applicant_id` join is returning null.

**Assignment FK violation on `packet_assignments`**  
The `assignPacketToNavigator` helper inserts directly via service role. If this fails, a schema migration may have added a new NOT NULL column to `packet_assignments`.

### 4. Orphaned test rows

If the test crashes before `afterAll` fires (e.g., the runner is killed), rows beginning with `e2e_test_` may remain. To clean up manually:

```sql
-- Find test orgs
select org_id, name from snap_enrollment.staff_orgs where name like 'e2e_test_%';

-- Delete (cascades to staff_roles, staff_users)
delete from snap_enrollment.staff_orgs where name like 'e2e_test_%';

-- Find test packets (no cascade from staff_orgs, so must clean separately)
-- Packets created by test applicants won't be distinguishable by name alone;
-- use the applicant email pattern to find the auth user, then the applicant row.
select id, email from auth.users where email like 'e2e_test_%@civica-e2e.invalid';
```

## Known limitations / TODOs

- **Document upload not exercised**: the upload flow requires a pre-signed S3/Storage URL and a live file PUT. The test skips this by using the applicant `POST /me/packets` route (which doesn't auto-create required document items). A separate storage-focused integration test should cover this path.
- **PDF handoff skipped by default**: apps/api PDF rendering (`@react-pdf/renderer`) is slow and requires the Fly.io deployment to be live. Enable it by setting `E2E_API_URL`.
- **navigator.ts assignment FK bug**: `POST /navigator/sessions/:id/assign` in `apps/api` stores `c.var.staff.sub` (auth UID) in `assigned_by_staff_id`, which is a FK to `staff_users(staff_id)`. These UUIDs differ. The E2E test works around this by inserting the assignment directly via service role. See `e2e/helpers/api.ts` and `apps/api/src/routes/navigator.ts`.
