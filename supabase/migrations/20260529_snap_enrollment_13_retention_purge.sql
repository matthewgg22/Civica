-- Retention purge for snap_enrollment data.
--
-- Replaces the broken legacy `public.purge_snap_retention()` which
-- targets `public.snap_sessions` / `public.snap_audit_log` — both
-- of which were dropped in 20260524_drop_public_snap_legacy.sql.
-- Calling the legacy function today raises "relation does not exist."
--
-- This migration:
--   1. Drops the broken legacy purge function (was no-op-on-error,
--      effectively a documentation bug masquerading as a feature).
--   2. Creates `snap_enrollment.purge_snap_retention()` targeting
--      the current schema — purges snap_packets older than 7 years;
--      FK cascades take care of children (packet_answers,
--      packet_status_history, document_extractions,
--      uploaded_documents, missing_item_requests, navigator_notes,
--      packet_assignments, handoff_exports).
--   3. Does NOT touch snap_enrollment.audit_log_events — that table
--      has append-only triggers (migration 04) and a separate counsel-
--      authorized purge process per docs/snap/retention_policy.md.
--   4. Schedules a daily cron job (pg_cron) to invoke the function
--      at 04:00 UTC. Idempotent — uses `cron.unschedule` then
--      `cron.schedule` so re-runs don't double up.
--
-- 7-year retention matches the longest applicable record requirement
-- across state agency contracts and federal SNAP regulations.

-- ===========================================================================
-- 1. Drop the broken legacy function.
-- ===========================================================================

drop function if exists public.purge_snap_retention();

-- ===========================================================================
-- 2. New purge function targeting snap_enrollment.
-- ===========================================================================

create or replace function snap_enrollment.purge_snap_retention()
returns void
language sql
security definer
set search_path = snap_enrollment
as $$
  delete from snap_enrollment.snap_packets
    where created_at < now() - interval '7 years';
  -- audit_log_events is intentionally NOT purged here. It carries
  -- compliance value beyond the 7-year session retention and is
  -- append-only by design (block_audit_mutation trigger). Bulk
  -- removal requires counsel sign-off — see docs/snap/retention_policy.md
  -- "Audit log purge procedure" before bypassing the trigger.
$$;

comment on function snap_enrollment.purge_snap_retention() is
  '7-year SNAP packet retention purge. Cascades take care of packet '
  'children. Audit log retained separately (append-only, counsel-'
  'authorized purge only). Scheduled daily 04:00 UTC via pg_cron.';

-- ===========================================================================
-- 3. Enable pg_cron + schedule the daily job.
-- ===========================================================================
--
-- pg_cron creates its functions in the dedicated `cron` schema. The
-- extension metadata can live in `extensions` per Supabase convention,
-- but the callable is always `cron.schedule(...)` / `cron.unschedule(...)`.
-- supabase/config.toml extra_search_path already includes `extensions`,
-- so the unqualified `cron.*` form resolves.

create extension if not exists pg_cron with schema extensions;

-- Remove any prior schedule with this job name so re-running the
-- migration doesn't double-schedule. cron.unschedule errors when the
-- job doesn't exist, so guard with a do block.
do $$
begin
  perform cron.unschedule('snap-purge-retention-daily');
exception when others then
  -- Job didn't exist; that's fine on first install.
  null;
end;
$$;

select cron.schedule(
  'snap-purge-retention-daily',
  '0 4 * * *',  -- 04:00 UTC every day
  $job$ select snap_enrollment.purge_snap_retention(); $job$
);
