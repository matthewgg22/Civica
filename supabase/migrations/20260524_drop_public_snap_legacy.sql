-- ---------------------------------------------------------------------------
-- Drop legacy public.snap_* tables (superseded by snap_enrollment schema).
--
-- apps/api navigator routes now read/write snap_enrollment.* via supabaseAdmin.
-- The FastAPI engine (backend/) never wrote to these tables in production;
-- the schema was defined in 20260516_add_navigator_workflow.sql but was never
-- applied to prod before snap_enrollment was introduced.
--
-- All equivalent tables exist in snap_enrollment:
--   public.snap_sessions              → snap_enrollment.snap_packets
--   public.snap_session_assignments   → snap_enrollment.packet_assignments
--   public.snap_navigator_notes       → snap_enrollment.navigator_notes
--   public.snap_missing_item_requests → snap_enrollment.missing_item_requests
--   public.snap_session_status_history→ snap_enrollment.packet_status_history
--   public.snap_handoff_exports       → snap_enrollment.handoff_exports
--   public.snap_audit_log             → snap_enrollment.audit_log_events
-- ---------------------------------------------------------------------------

drop table if exists public.snap_audit_log cascade;
drop table if exists public.snap_session_status_history cascade;
drop table if exists public.snap_missing_item_requests cascade;
drop table if exists public.snap_handoff_exports cascade;
drop table if exists public.snap_navigator_notes cascade;
drop table if exists public.snap_session_assignments cascade;
drop table if exists public.snap_sessions cascade;
