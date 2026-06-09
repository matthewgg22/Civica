-- snap_enrollment — Migration: Mae query-log scope columns
--
-- Records which SURFACE each Mae query came from, so the audit cleanly shows
-- generalist vs application-specific usage (the original log had no such field):
--   mode        — 'general' (the generalist "Ask Mae") vs 'case' (opened from a
--                 specific application, "Ask Mae about this case")
--   scope_state — the state the query was scoped to (e.g. 'CA'); null = generalist
--   scope_ref   — internal packet reference for case-scoped queries; NEVER the
--                 county case number (that's PII — see the PII invariant on this
--                 table). Joinable to packets for an audit trail.
--
-- Idempotent: safe to run whether or not the columns already exist.

ALTER TABLE snap_enrollment.mae_query_log
  ADD COLUMN IF NOT EXISTS mode        TEXT,
  ADD COLUMN IF NOT EXISTS scope_state TEXT,
  ADD COLUMN IF NOT EXISTS scope_ref   TEXT;

-- Group/filter by surface (general vs case).
CREATE INDEX IF NOT EXISTS mae_query_log_mode_idx
  ON snap_enrollment.mae_query_log (mode);
