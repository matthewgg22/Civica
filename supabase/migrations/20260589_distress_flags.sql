-- Distress flags — the load-bearing primitive for the offer-platform's
-- visible-honor swap (per plan E3 + E8).
--
-- Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T1e).
-- Counsel sign-off WAIVED 2026-05-26 by user — internal review only.
--
-- DESIGN CONTRACT (silent honor):
--   When a user has an active distress flag, the offer resolver returns
--   { offers: [], free_resources: [...] } instead of partner offers. The
--   iOS perks card renders the free-resources rows in the EXACT same
--   shelf structure (per design review D7) — the user has NO way to tell
--   from the UI that they've been segmented. The brick palette signals
--   "human support is here" per DESIGN.md §2.2, but never "you are flagged".
--
-- PRIVACY: per-user, service-role only. No RLS SELECT policy = applicant
-- never queries this table. DSR via ON DELETE CASCADE on auth.users.
--
-- RE-CHECK PATTERN: resolver + every event write (impression / click /
-- redeem) re-queries the partial index — sub-millisecond — to defeat race
-- conditions between fetch and write (per outside-voice F-series fix).
--
-- v1 SCOPE (per E8 split): this migration ships the table only. Per-source
-- emitters land separately:
--   - B-T1e-emit-obbba (P1, v1)    : OBBBA navigator gate writes flag
--   - B-T1e-emit-recert (P2, v1.1) : recert_lapse_14d daily cron
--   - B-T1e-emit-appeal (P2, v1.1) : POST /appeals creates flag
--   - B-T1e-emit-manual (P2, v1.1) : navigator manual flag UI action

SET search_path TO snap_enrollment, public;

DO $$ BEGIN
  CREATE TYPE snap_enrollment.distress_signal_source AS ENUM (
    'obbba_distress_prompt',  -- existing OBBBA §10102(a) navigator gate
    'recert_lapse_14d',       -- recert window expires within 14d
    'denial_appeal_opened',   -- household opened a denial appeal flow
    'navigator_manual'        -- CDSS/CBO worker manually flagged
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS snap_enrollment.distress_flags (
  flag_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL
               REFERENCES auth.users(id) ON DELETE CASCADE,
  source       snap_enrollment.distress_signal_source NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true,
  raised_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  resolved_at  TIMESTAMPTZ,  -- null = still active
  metadata     JSONB         -- source-specific context (appeal id, recert date, etc.)
);

-- Partial index on active flags only — the resolver's hot path is a single
-- EXISTS check that hits this index. Sub-millisecond guaranteed.
CREATE INDEX IF NOT EXISTS idx_distress_flags_active_user
  ON snap_enrollment.distress_flags (user_id)
  WHERE active = true;

-- RLS: service-role only. User must NOT be able to see they're flagged.
ALTER TABLE snap_enrollment.distress_flags ENABLE ROW LEVEL SECURITY;
-- Intentionally no SELECT/INSERT/UPDATE/DELETE policies for authenticated role.

COMMENT ON TABLE snap_enrollment.distress_flags IS
  'Load-bearing primitive for offer-platform silent visible-honor swap. Service-role only. User MUST NOT see they are flagged. Resolver + every event write re-checks the partial index. Source: 2026-05-26-ebt-offer-moment-platform.md (E3/E8). Counsel sign-off waived by user 2026-05-26.';

COMMENT ON COLUMN snap_enrollment.distress_flags.metadata IS
  'Source-specific context. obbba_distress_prompt: {gate_session_id}. recert_lapse_14d: {recert_id, due_date}. denial_appeal_opened: {appeal_id}. navigator_manual: {navigator_id, note_text}.';
