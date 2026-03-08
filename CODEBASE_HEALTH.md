# CODEBASE_HEALTH

Ongoing tracker for stability, readability, performance, and architecture findings.

## HIGH
- [x] `MyRepsViewModel` used `try!` for ZIP regex initialization (`USZipInputValidator.zipRegex`).
  - Resolved: switched to regex-string range matching; no force-throw initialization.
  - Location: `WeVote Information Page/Models/MyRepsViewModel.swift`

## MEDIUM
- [ ] RLS assumptions are not documented near each Supabase write path.
  - Risk: future schema/policy changes cause silent regressions (42501) with unclear ownership.
  - Suggested: per-table comments/docs for `device_tokens`, `scheduled_notifications`, `mapv_plans`, `address_search_events`, `feedback`.
  - Locations: `WeVote Information Page/Models/SupabaseManager.swift`, `WeVote Information Page/Models/PushTokenStore.swift`, `supabase/migrations`

- [ ] Supabase data access is split across multiple services with overlapping responsibilities.
  - Risk: inconsistent auth/error/retry conventions over time.
  - Suggested: define one canonical owner for write operations (e.g., `SupabaseManager`), keep `DatabaseService` as generic adapter only.
  - Locations: `WeVote Information Page/Models/SupabaseManager.swift`, `WeVote Information Page/Models/DatabaseService.swift`, `WeVote Information Page/Models/PushTokenStore.swift`

- [ ] Duplicate timestamp codecs exist (`SupabaseTimestampCodec` and `PostgresTimestampCodec`).
  - Risk: divergence in parsing/format behavior and subtle date bugs.
  - Suggested: consolidate into one shared codec utility.
  - Locations: `WeVote Information Page/Models/SupabaseManager.swift`, `WeVote Information Page/Models/DatabaseService.swift`

## LOW
- [x] `SupabaseConfig` contained a force unwrap for fallback URL construction.
  - Resolved: guarded fallback URL path without `!`.
  - Location: `WeVote Information Page/Models/SupabaseConfig.swift`

- [ ] Reminder scheduling creates a local `DateFormatter` per call.
  - Risk: low performance overhead.
  - Suggested: cache formatter if reminder scheduling frequency increases.
  - Location: `WeVote Information Page/Models/SupabaseManager.swift`

- [ ] `GovHelpService` had limited diagnostic context for decode/network failures.
  - Risk: low-to-medium debugging friction in production incidents.
  - Status: improved with targeted request/response/decode logs, but no request-id correlation yet.
  - Location: `WeVote Information Page/Models/GovHelpService.swift`
