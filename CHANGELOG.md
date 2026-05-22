# Changelog

User-facing and contributor-facing changes worth knowing about. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This file
starts at the `claude/compliance-session-2026-05-21` branch — earlier history
lives in `git log`.

Categories used:
- **Added** — new capability
- **Changed** — visible behavior change
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

### Changed
- `apps/enrollment-api`: `POST /navigator/packets/:id/error-risk` and
  `POST /me/packets/:id/error-risk` now call a single shared `scorePacketRisk()`
  in `src/lib/scoring.ts`. The navigator endpoint previously used a simplified
  proxy that diverged on HEAP + Full-SUA conflicts and missing OCR data —
  same packet, two scores. Navigator now sees the authoritative score the
  applicant view shows.
- `apps/enrollment-api`: `withActorContext` middleware issues one RPC instead
  of 3–4 sequential `set_config` round-trips. Saves ~60–80 ms on every
  mutating request.

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
