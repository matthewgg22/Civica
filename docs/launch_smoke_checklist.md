# VoteNow Launch Smoke Checklist

## 1. Auth + Session
- Sign in (OTP) and verify home loads without auth errors.
- Sign out and verify personalized state is cleared.
- Sign in again with same account and verify reps/reminders rehydrate normally.

## 2. My Reps + Address Flow
- Enter a valid full US address and verify reps load.
- Enter ZIP-only input and verify state/city resolution works.
- Confirm no visible crashes or frozen loading state.

## 3. MAPV + Reminders
- Create/update plan-to-vote and verify no duplicate reminder spam.
- Verify reminder scheduling logs do not show hard failures for transient network cases.
- Re-run same plan update and verify dedupe behavior (no duplicate insert).

## 4. Why Call + MAPC
- Open Why Call and ensure summary stats load.
- Complete one call flow and verify completion event path runs.
- Confirm MAPC call sums can load when tables/migrations are present.

## 5. GovHelp
- Send a normal request and verify response returns.
- Simulate flaky network (toggle connectivity) and verify retry/fallback behavior is graceful.

## 6. Feedback
- Submit feedback once while online.
- Retry with intermittent network and confirm app handles failure without crash.

## 7. Push Tokens
- Fresh launch on device, confirm APNs registration path runs.
- Sign out and confirm token disable path is attempted.

## 8. Share + Primary Flows
- Share card renders and sends from system share sheet.
- Check Registration and key navigation tabs open without layout regressions.

## 9. Final Gate
- Debug build succeeds.
- Release build succeeds.
- Supabase launch SQL bundle completed successfully.
