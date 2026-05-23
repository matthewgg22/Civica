-- Batch the per-request audit-context setup into a single Postgres function so
-- the Cloudflare Worker makes one RPC instead of 3-4 sequential set_config
-- round-trips. Each round-trip is ~20ms over the edge → Supabase link, so the
-- previous pattern added 60-80ms of dead time before every mutating endpoint
-- did any real work.
--
-- The audit_row_change() trigger reads these transaction-local settings to
-- attribute each row mutation to an actor. Setting all four in one call has
-- identical semantics — set_config is itself just SET LOCAL — but collapses
-- the network round-trips to one.
--
-- Surfaced by: /plan-eng-review 2026-05-22 (T4, P2).

CREATE OR REPLACE FUNCTION snap_enrollment.set_actor_context(
  p_actor_kind             TEXT,
  p_actor_id               TEXT,
  p_request_id             TEXT,
  p_buddy_relationship_id  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_catalog
AS $$
BEGIN
  PERFORM set_config('snap_enrollment.actor_kind', p_actor_kind, true);
  PERFORM set_config('snap_enrollment.actor_id',   p_actor_id,   true);
  PERFORM set_config('snap_enrollment.request_id', p_request_id, true);
  IF p_buddy_relationship_id IS NOT NULL THEN
    PERFORM set_config('snap_enrollment.buddy_relationship_id', p_buddy_relationship_id, true);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION snap_enrollment.set_actor_context(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snap_enrollment.set_actor_context(TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION snap_enrollment.set_actor_context(TEXT, TEXT, TEXT, TEXT) IS
  'Sets all snap_enrollment.actor_* transaction-local settings in one round-trip. Replaces the 3-4 sequential set_config RPCs in apps/enrollment-api/src/middleware/actorContext.ts (T4, /plan-eng-review 2026-05-22).';
