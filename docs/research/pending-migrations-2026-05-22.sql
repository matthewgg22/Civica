-- ============================================================================
-- Civica pending Supabase migrations — captured 2026-05-22
-- Source: codex/rebuild-feb18 (PR #245 + 10 locally-tracked migrations)
--
-- Apply order is alphabetical within the same timestamp prefix (default
-- Supabase ordering). Duplicate timestamps below are listed in alphabetical
-- order; if you want a different order, reorder the blocks before applying.
--
-- Strongly recommended:
--   1) Take a Supabase logical backup BEFORE applying any of this.
--   2) Apply via Supabase SQL editor (or `psql`) in a transaction per block
--      so partial failures roll back cleanly.
--   3) After each block, verify via the post-apply queries at the end.
--
-- Total: 17 migrations, ~960 SQL lines.
-- ============================================================================



-- ============================================================================
-- 20260555_error_rate_engine.sql
-- ============================================================================

-- snap_enrollment — Migration: pre-submission error risk engine tables
--
-- packet_error_risk: cached scoring output from scoreErrorRisk().
--   Multiple rows per packet are expected (one per engine version).
--   Query for current score: ORDER BY created_at DESC LIMIT 1.
--
-- qc_outcomes: navigator-logged QC sampling results.
--   Only QC-sampled cases (qc_sampled = true) have error_found set.
--   Unsampled cases must have error_found = NULL — unsampled ≠ clean.
--   The Phase 2 retraining pipeline filters to qc_sampled = true only.

-- ── packet_error_risk ────────────────────────────────────────────────────────

CREATE TABLE snap_enrollment.packet_error_risk (
  risk_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id      UUID        NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  engine_version TEXT        NOT NULL,
  score          INT,
  factors        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  tier           TEXT        NOT NULL CHECK (tier IN ('high', 'medium', 'low', 'incomplete')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.packet_error_risk (packet_id, created_at DESC);

ALTER TABLE snap_enrollment.packet_error_risk ENABLE ROW LEVEL SECURITY;

-- Applicants can read their own packet's risk score
CREATE POLICY "applicant can read own packet risk score"
  ON snap_enrollment.packet_error_risk FOR SELECT
  USING (
    packet_id IN (
      SELECT packet_id FROM snap_enrollment.snap_packets WHERE applicant_id = auth.uid()
    )
  );

-- Service role writes (scoreErrorRisk cache, no direct user writes)
GRANT SELECT ON snap_enrollment.packet_error_risk TO authenticated;
GRANT SELECT, INSERT ON snap_enrollment.packet_error_risk TO service_role;

-- ── qc_outcomes ──────────────────────────────────────────────────────────────

CREATE TABLE snap_enrollment.qc_outcomes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id       UUID        NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  org_id          UUID        NOT NULL,
  qc_sampled      BOOLEAN     NOT NULL,
  -- error_found must be NULL when qc_sampled = false (not reviewed ≠ clean)
  error_found     BOOLEAN,
  error_type      TEXT,
  error_amount    NUMERIC(10, 2),
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  logged_by       UUID        REFERENCES auth.users(id)
);

ALTER TABLE snap_enrollment.qc_outcomes ADD CONSTRAINT qc_outcomes_unsampled_no_error
  CHECK (qc_sampled OR error_found IS NULL);

CREATE INDEX ON snap_enrollment.qc_outcomes (packet_id);
CREATE INDEX ON snap_enrollment.qc_outcomes (org_id, logged_at DESC);
-- Retraining pipeline query: filtered to sampled cases only
CREATE INDEX ON snap_enrollment.qc_outcomes (qc_sampled, logged_at DESC) WHERE qc_sampled = true;

ALTER TABLE snap_enrollment.qc_outcomes ENABLE ROW LEVEL SECURITY;

-- Navigators can INSERT and SELECT outcomes for their own org
CREATE POLICY "navigator can manage own org qc outcomes"
  ON snap_enrollment.qc_outcomes FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM snap_enrollment.navigator_outreach_queue
      WHERE created_by = auth.uid()::text
      LIMIT 1
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM snap_enrollment.navigator_outreach_queue
      WHERE created_by = auth.uid()::text
      LIMIT 1
    )
  );

-- Service role bypasses RLS (used by retraining pipeline)
GRANT SELECT, INSERT ON snap_enrollment.qc_outcomes TO service_role;
GRANT SELECT ON snap_enrollment.qc_outcomes TO authenticated;


-- ============================================================================
-- 20260555_feature_flags.sql
-- ============================================================================

-- public — Migration: feature_flags table (Session A — LPIE rule kill switch)
--
-- Lightweight server-side feature-flag store. Both the iOS app and the
-- TypeScript snap-rules engine read these flags via
-- GET /v1/enrollment/feature-flags before applying state-specific
-- overrides. Flipping `lpie_auto_exempt_enabled` to false instantly
-- reverts the LPIE half-time-degree exemption override on both surfaces
-- without redeploying code.
--
-- Schema lives in `public` (not snap_enrollment) so it can be read
-- without role escalation — the values themselves are non-sensitive
-- product config.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text        PRIMARY KEY,
  enabled     boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed the LPIE override flag in the on position. Operators can flip it
-- off via the dashboard or `psql` if the override must be disabled.
INSERT INTO public.feature_flags (key, enabled)
VALUES ('lpie_auto_exempt_enabled', true)
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 20260556_pilot_leads_student_audience.sql
-- ============================================================================

-- Loosen pilot_leads to serve both CBO-shaped leads (name+organization required)
-- and student-shaped leads (email+campus required) under different source tags.

ALTER TABLE public.pilot_leads
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN organization DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS campus text;

-- Source-conditional shape: enforce the right fields per audience.
-- CBO leads need name+organization; student leads need email+campus.
ALTER TABLE public.pilot_leads
  ADD CONSTRAINT pilot_leads_audience_shape
  CHECK (
    (source = 'student-lpie-web' AND email IS NOT NULL AND campus IS NOT NULL)
    OR
    (source != 'student-lpie-web' AND name IS NOT NULL AND organization IS NOT NULL)
  );

COMMENT ON COLUMN public.pilot_leads.phone IS 'Optional. Used by student-audience leads. Do NOT use qc_process for phone numbers — that column is for CBO QC workflow state.';
COMMENT ON COLUMN public.pilot_leads.campus IS 'Optional. Campus name (CCC / CSU / UC) for student-audience leads.';


-- ============================================================================
-- 20260557_benefitscal_async_status.sql
-- ============================================================================

-- snap_enrollment — Migration: BenefitsCal Phase 2 async submission state machine
--
-- Phase 2 async submission (Session M1) introduces additional status values
-- beyond the Phase 1 'pending_review' / 'submitted' states. The async flow is:
--
--   pending_review (Phase 1, navigator review snapshot)
--        │
--        │ navigator clicks "Submit"
--        ▼
--   queued      — POST /benefitscal/submit/:packetId returned 202; the
--                 ctx.waitUntil background task has been scheduled but the
--                 Playwright driver has not yet started.
--        ▼
--   running     — Playwright is actively driving the CBO portal.
--        ▼
--   succeeded   — Submission accepted by BenefitsCal; confirmation number captured.
--   submitted   — Legacy Phase 1 terminal state (kept for backwards compat).
--   failed      — Playwright threw; transcript persisted for navigator retry.
--   cancelled   — Navigator cancelled before submission (legacy from Phase 1).
--
-- The existing 'submitted' state is preserved so historical rows remain valid.
-- Phase 2 rows will use 'succeeded' as the terminal success state.

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'benefitscal_submissions_status_check'
      and table_schema = 'snap_enrollment'
  ) then
    alter table snap_enrollment.benefitscal_submissions
      drop constraint benefitscal_submissions_status_check;
  end if;
end $$;

alter table snap_enrollment.benefitscal_submissions
  add constraint benefitscal_submissions_status_check
  check (status in (
    'pending_review',
    'queued',
    'running',
    'succeeded',
    'submitted',
    'failed',
    'cancelled'
  ));

-- Playwright transcript: step-by-step actions, screenshots-as-base64 (small),
-- final state, and error trace if status=failed. Append-only after each step.
alter table snap_enrollment.benefitscal_submissions
  add column if not exists playwright_log jsonb;

comment on column snap_enrollment.benefitscal_submissions.playwright_log is
  'Phase 2 async submission transcript: ordered step list, screenshots (base64, small), final state, error trace if status=failed.';

-- started_at: when the ctx.waitUntil background task transitioned 'queued' → 'running'.
-- submitted_at already exists (set when terminal 'succeeded'/'submitted' is reached).
alter table snap_enrollment.benefitscal_submissions
  add column if not exists started_at timestamptz;

comment on column snap_enrollment.benefitscal_submissions.started_at is
  'When the Playwright driver actually began running (status transitioned queued → running).';

-- initiated_by_staff_id: navigator/staff who clicked Submit. Distinct from
-- submitted_by (which is set when the submission completes successfully).
alter table snap_enrollment.benefitscal_submissions
  add column if not exists initiated_by_staff_id uuid;

comment on column snap_enrollment.benefitscal_submissions.initiated_by_staff_id is
  'Staff actor who initiated the Phase 2 submission via POST /benefitscal/submit/:packetId.';


-- ============================================================================
-- 20260557_fix_qc_outcomes_rls.sql
-- ============================================================================

-- Fix qc_outcomes RLS: the original policy matched created_by = auth.uid()::text,
-- but created_by stores staff_id (not auth_uid), so no navigator could ever read
-- their own org's outcomes. Replace with is_navigator_in_org(org_id) consistent
-- with packet_answers, uploaded_documents, and other navigator-readable tables.

DROP POLICY IF EXISTS "navigator can manage own org qc outcomes" ON snap_enrollment.qc_outcomes;

CREATE POLICY "navigator can manage own org qc outcomes"
  ON snap_enrollment.qc_outcomes FOR ALL
  USING  (snap_enrollment.is_navigator_in_org(org_id))
  WITH CHECK (snap_enrollment.is_navigator_in_org(org_id));


-- ============================================================================
-- 20260558_qc_schema_constraints.sql
-- ============================================================================

-- QC schema integrity constraints
-- packet_error_risk: enforce score range and controlled vocabulary for tier
ALTER TABLE snap_enrollment.packet_error_risk
  ADD CONSTRAINT chk_error_risk_score
    CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  ADD CONSTRAINT chk_error_risk_tier
    CHECK (tier IN ('low', 'medium', 'high', 'incomplete'));

-- qc_outcomes: controlled vocabulary for error_type and tier values
ALTER TABLE snap_enrollment.qc_outcomes
  ADD CONSTRAINT chk_qc_outcomes_error_type
    CHECK (error_type IS NULL OR error_type IN (
      'income_mismatch',
      'sua_overclaim',
      'address_invalid',
      'missing_doc',
      'heap_sua_conflict',
      'other'
    ));


-- ============================================================================
-- 20260560_recert_practice_scores.sql
-- ============================================================================

-- snap_enrollment — Migration: recert_practice_scores table
--
-- End-of-session scoring for AI-assisted practice interviews. One row per
-- completed practice session (UNIQUE on session_id makes generation
-- idempotent — repeat POST .../score returns the existing row).
--
-- Score generation is driven by Claude Haiku via packages/recert-engine
-- scorer.ts. The applicant sees the result in iOS ReviewSummaryView.

CREATE TABLE snap_enrollment.recert_practice_scores (
  score_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL UNIQUE REFERENCES snap_enrollment.recert_practice_sessions(session_id) ON DELETE CASCADE,
  overall_score   SMALLINT    NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  strengths       JSONB       NOT NULL,
  improvements    JSONB       NOT NULL,
  summary_en      TEXT        NOT NULL,
  summary_es      TEXT        NOT NULL,
  engine_version  TEXT        NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recert_practice_scores_session ON snap_enrollment.recert_practice_scores(session_id);

ALTER TABLE snap_enrollment.recert_practice_scores ENABLE ROW LEVEL SECURITY;

-- Navigator policies — mirror recert_practice_sessions.
-- Join through sessions → recertifications → packets for org gate.
DROP POLICY IF EXISTS "navigator can view own org practice scores" ON snap_enrollment.recert_practice_scores;
CREATE POLICY "navigator can view own org practice scores"
  ON snap_enrollment.recert_practice_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_scores.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

DROP POLICY IF EXISTS "navigator can insert practice scores for own org" ON snap_enrollment.recert_practice_scores;
CREATE POLICY "navigator can insert practice scores for own org"
  ON snap_enrollment.recert_practice_scores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_scores.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

-- Applicant policies — practice is applicant-facing; an applicant must be
-- able to read + insert the score for their own session. Ownership flows
-- session → recertification → packet → applicant.auth_uid.
DROP POLICY IF EXISTS "applicant can view own practice scores" ON snap_enrollment.recert_practice_scores;
CREATE POLICY "applicant can view own practice scores"
  ON snap_enrollment.recert_practice_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_scores.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can insert own practice scores" ON snap_enrollment.recert_practice_scores;
CREATE POLICY "applicant can insert own practice scores"
  ON snap_enrollment.recert_practice_scores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_scores.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );


-- ============================================================================
-- 20260561_recertifications_applicant_select.sql
-- ============================================================================

-- snap_enrollment — Migration: applicant SELECT on recertifications
--
-- The recertifications table previously had only navigator policies (PR T11).
-- The applicant-facing practice flow needs to fetch the user's own active
-- recert. Add a SELECT policy that joins through packets → applicants.

DROP POLICY IF EXISTS "applicant can view own recertifications" ON snap_enrollment.recertifications;
CREATE POLICY "applicant can view own recertifications"
  ON snap_enrollment.recertifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.snap_packets p
      WHERE p.packet_id = recertifications.packet_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

-- Same gap on recert_practice_sessions: PR #215 opened the route to
-- applicants but no applicant SELECT/INSERT/UPDATE policies were added.
-- RLS would silently 404 those calls in production. Add them now.

DROP POLICY IF EXISTS "applicant can view own practice sessions" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "applicant can view own practice sessions"
  ON snap_enrollment.recert_practice_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recertifications r
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE r.recert_id = recert_practice_sessions.recert_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can insert own practice sessions" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "applicant can insert own practice sessions"
  ON snap_enrollment.recert_practice_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recertifications r
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE r.recert_id = recert_practice_sessions.recert_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can update own practice sessions" ON snap_enrollment.recert_practice_sessions;
CREATE POLICY "applicant can update own practice sessions"
  ON snap_enrollment.recert_practice_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recertifications r
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE r.recert_id = recert_practice_sessions.recert_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recertifications r
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE r.recert_id = recert_practice_sessions.recert_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );


-- ============================================================================
-- 20260563_recert_practice_turns.sql
-- ============================================================================

-- snap_enrollment — Migration: recert_practice_turns table
--
-- Per-turn transcript persistence for the practice chatbot. Each row stores
-- one caseworker question + (optional) applicant response + coaching tip.
--
-- Why: the score endpoint previously read the transcript from the in-memory
-- orchestrator (packages/recert-engine). If the Cloudflare Worker that
-- handled `respond` (setting done=true) was different from the Worker that
-- handled `score`, the in-memory state was gone and the score endpoint
-- returned 410 "transcript lost". Persisting each turn to this child table
-- makes scoring resilient to Worker restarts.

CREATE TABLE snap_enrollment.recert_practice_turns (
  turn_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID        NOT NULL REFERENCES snap_enrollment.recert_practice_sessions(session_id) ON DELETE CASCADE,
  turn_index           SMALLINT    NOT NULL CHECK (turn_index >= 0),
  caseworker_question  TEXT        NOT NULL,
  applicant_response   TEXT,        -- nullable: the very first turn has no response yet
  coaching             JSONB,       -- nullable: only present after the first user response
  audio_bytes_duration INT4,        -- nullable; optional voice-input signal
  asked_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at         TIMESTAMPTZ, -- nullable until applicant responds
  UNIQUE (session_id, turn_index)
);

CREATE INDEX idx_recert_practice_turns_session
  ON snap_enrollment.recert_practice_turns(session_id, turn_index);

ALTER TABLE snap_enrollment.recert_practice_turns ENABLE ROW LEVEL SECURITY;

-- Navigator policies — mirror recert_practice_sessions (org-gated via is_navigator_in_org).
-- Join through sessions → recertifications to resolve org_id.
DROP POLICY IF EXISTS "navigator can view own org practice turns" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "navigator can view own org practice turns"
  ON snap_enrollment.recert_practice_turns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_turns.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

DROP POLICY IF EXISTS "navigator can insert practice turns for own org" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "navigator can insert practice turns for own org"
  ON snap_enrollment.recert_practice_turns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_turns.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

DROP POLICY IF EXISTS "navigator can update practice turns for own org" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "navigator can update practice turns for own org"
  ON snap_enrollment.recert_practice_turns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_turns.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      WHERE s.session_id = recert_practice_turns.session_id
        AND snap_enrollment.is_navigator_in_org(s.org_id)
    )
  );

-- Applicant policies — practice is applicant-facing; the applicant owns the
-- turns for their own session. Ownership flows session → recert → packet
-- → applicant.auth_uid (mirrors the score / session policies).
DROP POLICY IF EXISTS "applicant can view own practice turns" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "applicant can view own practice turns"
  ON snap_enrollment.recert_practice_turns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_turns.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can insert own practice turns" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "applicant can insert own practice turns"
  ON snap_enrollment.recert_practice_turns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_turns.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );

DROP POLICY IF EXISTS "applicant can update own practice turns" ON snap_enrollment.recert_practice_turns;
CREATE POLICY "applicant can update own practice turns"
  ON snap_enrollment.recert_practice_turns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_turns.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.recert_practice_sessions s
      JOIN snap_enrollment.recertifications r ON r.recert_id = s.recert_id
      JOIN snap_enrollment.snap_packets p ON p.packet_id = r.packet_id
      WHERE s.session_id = recert_practice_turns.session_id
        AND p.applicant_id = (
          SELECT applicant_id FROM snap_enrollment.applicants
          WHERE auth_uid = auth.uid() LIMIT 1
        )
    )
  );


-- ============================================================================
-- 20260564_snap_packets_county_outcome.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Add county_outcome to snap_packets
--
-- County decisions (approved / denied / pending_decision) are separate from
-- the internal packet lifecycle (status column). A packet reaches 'Closed'
-- internally and then the county issues its decision. This column captures
-- the actual CalFresh enrollment outcome so the QC dashboard can compare
-- Civica-assisted applicant approval rates against the CDSS statewide baseline.
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.county_outcome as enum (
    'approved',
    'denied',
    'pending_decision'
  );
exception when duplicate_object then null;
end $$;

alter table snap_enrollment.snap_packets
  add column if not exists county_outcome   snap_enrollment.county_outcome,
  add column if not exists county_decision_date timestamptz;

create index if not exists snap_packets_county_outcome_idx
  on snap_enrollment.snap_packets (county_outcome, updated_at desc)
  where deleted_at is null;

-- Navigators and admin can update the outcome after a county decision arrives.
-- The existing snap_enrollment RLS policies allow navigators to update packets
-- they own. No new policy is required — the column inherits existing row access.

comment on column snap_enrollment.snap_packets.county_outcome is
  'Final CalFresh county decision. null = outcome not yet recorded. '
  'pending_decision = handed off to county, awaiting result. '
  'Used by the QC dashboard denial-rate panel to compare Civica cohort '
  'outcomes against the CDSS statewide CalFresh baseline.';

comment on column snap_enrollment.snap_packets.county_decision_date is
  'Date the county issued its approval or denial. Used to compute '
  'time-to-decision and tie outcomes to the correct USDA QC cycle.';


-- ============================================================================
-- 20260565_work_requirement_hour_logs.sql  (from origin/codex/rebuild-feb18, PR #245)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Work requirement hour logs — OBBBA §10102 / 7 CFR 273.24
--
-- Per-session hours log for SNAP recipients subject to the 80-hour/month
-- work requirement. Applicant-writable (RLS allows own rows). Monthly
-- rollup is SUM(hours) WHERE work_date IN current month.
--
-- Compliance citations:
--   7 CFR 273.24   — time limit + hours documentation requirement
--   7 CFR 273.12(c) — 10-day change reporting (alert computed from rollup)
--   7 CFR 273.7(g)  — written notice (surfaced at subject determination)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS snap_enrollment.work_requirement_hour_logs (
  log_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wr_status_id    UUID        NOT NULL
                              REFERENCES snap_enrollment.work_requirement_statuses(wr_status_id)
                              ON DELETE CASCADE,
  packet_id       UUID        NOT NULL
                              REFERENCES snap_enrollment.snap_packets(packet_id)
                              ON DELETE CASCADE,
  applicant_id    UUID        NOT NULL,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  work_date       DATE        NOT NULL,
  hours           NUMERIC(4,1) NOT NULL
                              CHECK (hours > 0 AND hours <= 24),
  activity_type   TEXT        NOT NULL
                              CHECK (activity_type IN (
                                'work', 'training', 'volunteering', 'job_search'
                              )),
  employer_name   TEXT,
  -- Nullable FK to uploaded_documents — attached pay stub / employer letter.
  -- The applicant logs hours first; doc can be attached immediately or later.
  document_id     UUID
                              REFERENCES snap_enrollment.uploaded_documents(document_id)
                              ON DELETE SET NULL,
  notes           TEXT        CHECK (char_length(notes) <= 2000)
);

-- Fast monthly rollup: SUM(hours) WHERE packet_id = X AND work_date >= first_of_month
CREATE INDEX work_requirement_hour_logs_packet_month
  ON snap_enrollment.work_requirement_hour_logs (packet_id, work_date DESC);

-- ---------------------------------------------------------------------------
-- RLS — applicants can insert + select their own rows only.
--       Navigators (staff role) can select all rows for packets in their org.
-- ---------------------------------------------------------------------------
ALTER TABLE snap_enrollment.work_requirement_hour_logs ENABLE ROW LEVEL SECURITY;

-- Applicant: full access to own rows
CREATE POLICY "applicant_own_hour_logs"
  ON snap_enrollment.work_requirement_hour_logs
  FOR ALL
  USING (applicant_id = auth.uid())
  WITH CHECK (applicant_id = auth.uid());

-- Navigator / staff: read all logs for packets in their org
CREATE POLICY "navigator_read_hour_logs"
  ON snap_enrollment.work_requirement_hour_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.snap_packets p
      JOIN snap_enrollment.org_members om
        ON om.org_id = p.org_id
       AND om.user_id = auth.uid()
      WHERE p.packet_id = work_requirement_hour_logs.packet_id
    )
  );

-- ---------------------------------------------------------------------------
-- Helper view: monthly rollup per packet
-- Used by the API's monthly_summary response and navigator dashboard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW snap_enrollment.work_requirement_monthly_summary AS
SELECT
  packet_id,
  wr_status_id,
  applicant_id,
  date_trunc('month', work_date)::date                    AS month_start,
  to_char(work_date, 'YYYY-MM')                           AS month,
  COALESCE(SUM(hours), 0)                                 AS total_hours,
  80.0                                                    AS target_hours,
  COUNT(*)                                                AS entries_count,
  COUNT(*) FILTER (WHERE document_id IS NOT NULL) > 0     AS has_documentation
FROM snap_enrollment.work_requirement_hour_logs
GROUP BY packet_id, wr_status_id, applicant_id, date_trunc('month', work_date), to_char(work_date, 'YYYY-MM');


-- ============================================================================
-- 20260566_buddy_actorkind.sql  (from origin/codex/rebuild-feb18, PR #245)
-- ============================================================================

-- Add 'buddy' to the audit actor kind enum.
-- ALTER TYPE ... ADD VALUE cannot be rolled back within a transaction;
-- this migration is intentionally isolated so the enum change commits before
-- the tables that use it (20260567) are created.
ALTER TYPE snap_enrollment.audit_actor_kind ADD VALUE IF NOT EXISTS 'buddy';


-- ============================================================================
-- 20260567_buddy_tables.sql  (from origin/codex/rebuild-feb18, PR #245)
-- ============================================================================

-- Buddy Add: core tables
-- Depends on 20260566_buddy_actorkind.sql (enum must exist before use).

SET search_path TO snap_enrollment, public;

-- BuddyOrg: labor union / employer org that sponsors buddy relationships
CREATE TABLE IF NOT EXISTS snap_enrollment.buddy_org (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  org_code              TEXT NOT NULL UNIQUE,
  org_code_expires_at   TIMESTAMPTZ NOT NULL,
  created_by            UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BuddyInvite: single-use signed token, hashed for storage
CREATE TABLE IF NOT EXISTS snap_enrollment.buddy_invite (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id     UUID NOT NULL,
  token_hash            TEXT NOT NULL UNIQUE,
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BuddyRelationship: live link between a buddy and an applicant
CREATE TABLE IF NOT EXISTS snap_enrollment.buddy_relationship (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id                 UUID NOT NULL,
  buddy_user_id                     UUID NOT NULL,
  org_id                            UUID REFERENCES snap_enrollment.buddy_org(id) ON DELETE SET NULL,
  status                            TEXT NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'pending', 'completed', 'revoked')),
  notifications_enabled             BOOLEAN NOT NULL DEFAULT true,
  -- stall-checker dedup: updated after each notification send (TODO-18 / PR3)
  last_stall_notification_sent_at   TIMESTAMPTZ,
  -- app_metadata cleanup tracking (TODO-18 / PR3 cron)
  app_metadata_cleared_at           TIMESTAMPTZ,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_user_id, buddy_user_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_buddy_relationship_buddy_user_id
  ON snap_enrollment.buddy_relationship (buddy_user_id);

CREATE INDEX IF NOT EXISTS idx_buddy_relationship_applicant_user_id
  ON snap_enrollment.buddy_relationship (applicant_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buddy_invite_token_hash
  ON snap_enrollment.buddy_invite (token_hash);

-- Partial index used by the stall-checker cron (PR3) to efficiently find
-- active relationships without scanning completed/revoked rows.
CREATE INDEX IF NOT EXISTS idx_buddy_relationship_active
  ON snap_enrollment.buddy_relationship (applicant_user_id)
  WHERE status = 'active';


-- ============================================================================
-- 20260568_buddy_rls.sql  (from origin/codex/rebuild-feb18, PR #245)
-- ============================================================================

-- Buddy Add: RLS policies
-- Depends on 20260567_buddy_tables.sql.

ALTER TABLE snap_enrollment.buddy_relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.buddy_invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.buddy_org ENABLE ROW LEVEL SECURITY;

-- BuddyInvite: service_role only — no authenticated-user reads.
-- The invite token is a secret; clients never need to list invite rows.
CREATE POLICY "buddy_invite_service_role_only" ON snap_enrollment.buddy_invite
  FOR ALL USING (false);

-- BuddyRelationship: buddy sees their own rows; applicant sees rows where
-- they are the applicant.
CREATE POLICY "buddy_relationship_read_own" ON snap_enrollment.buddy_relationship
  FOR SELECT USING (
    buddy_user_id = auth.uid() OR applicant_user_id = auth.uid()
  );

-- Packet access for buddy: buddy may SELECT the applicant's active packet
-- when an active BuddyRelationship exists.
-- NOTE: this grants the full snap_packets row to a buddy-authenticated query.
-- Column restriction (TODO-19) will add a buddy_packet_summary_view before
-- App Store launch so that future developers can't accidentally expose PII.
CREATE POLICY "buddy_read_active_packet" ON snap_enrollment.snap_packets
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM snap_enrollment.buddy_relationship br
      WHERE br.buddy_user_id = auth.uid()
        AND br.applicant_user_id = snap_enrollment.snap_packets.user_id
        AND br.status = 'active'
        AND snap_enrollment.snap_packets.status NOT IN ('submitted', 'approved')
    )
  );

-- BuddyOrg: members can read the org they belong to; admin-only writes.
CREATE POLICY "buddy_org_read_member" ON snap_enrollment.buddy_org
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM snap_enrollment.buddy_relationship br
      WHERE br.org_id = snap_enrollment.buddy_org.id
        AND br.buddy_user_id = auth.uid()
    )
  );


-- ============================================================================
-- 20260569_buddy_autorevoke_trigger.sql  (from origin/codex/rebuild-feb18, PR #245)
-- ============================================================================

-- Buddy Add: auto-revoke trigger
-- When a packet reaches a terminal state (approved / denied / withdrawn),
-- all active BuddyRelationship rows for that applicant are set to 'completed'.
-- NOTE: this trigger cannot call the Supabase Admin API to clear
-- app_metadata.role='buddy' on the auth user. That gap is tracked as TODO-18
-- and handled by the PR3 stall-checker cron.

CREATE OR REPLACE FUNCTION snap_enrollment.buddy_auto_revoke_on_terminal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('approved', 'denied', 'withdrawn') AND
     (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE snap_enrollment.buddy_relationship
    SET    status     = 'completed',
           updated_at = now()
    WHERE  applicant_user_id = NEW.user_id
      AND  status            = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS buddy_auto_revoke ON snap_enrollment.snap_packets;

CREATE TRIGGER buddy_auto_revoke
  AFTER UPDATE ON snap_enrollment.snap_packets
  FOR EACH ROW
  EXECUTE FUNCTION snap_enrollment.buddy_auto_revoke_on_terminal();


-- ============================================================================
-- 20260570_buddy_packet_summary_view.sql  (from origin/codex/rebuild-feb18, PR #245)
-- ============================================================================

-- Buddy Add: column-level PII restriction via summary view.
--
-- Why: the existing buddy_read_active_packet policy in 20260568_buddy_rls.sql
-- grants SELECT on the entire snap_packets row (SSN ciphertext, income, household
-- composition, citizenship status) to a buddy-authenticated query. The API layer
-- in buddy.ts narrows to a safe summary, but any new buddy-scoped route that
-- queries snap_packets directly would inherit full PII access by default.
--
-- This migration moves the buddy access path to a view (buddy_packet_summary_view)
-- that exposes only the columns a buddy should see, and removes the buddy branch
-- from the snap_packets RLS policy so direct queries no longer leak.
--
-- Applicants retain direct snap_packets access via user_id = auth.uid().
--
-- Surfaced by: /plan-eng-review 2026-05-22 (T3, P2).
-- Closes: TODO-19, rls-row-vs-column-restriction pitfall.

-- 1. Replace the policy so buddies no longer read snap_packets rows directly.
--    Applicants keep their own-row SELECT. Buddies now go through the view.
DROP POLICY IF EXISTS "buddy_read_active_packet" ON snap_enrollment.snap_packets;

CREATE POLICY "applicant_read_own_packet" ON snap_enrollment.snap_packets
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- 2. Buddy summary view — only the columns a buddy needs.
--    SECURITY INVOKER (default in Postgres 15+) means the view runs as the
--    calling role, but we predicate-check inside the view body. Combined with
--    the policy above, buddies cannot bypass column restriction by querying
--    the base table.
--
--    NOTE: SECURITY INVOKER respects RLS on the underlying table. Since the
--    new policy only lets the applicant read their own snap_packets row, a
--    buddy-as-invoker would see zero rows through the view too. We work around
--    this with security_definer + a SECURITY DEFINER function call so the view
--    can resolve the applicant's row for the buddy, but the view body still
--    enforces the buddy_relationship predicate.
CREATE OR REPLACE FUNCTION snap_enrollment.buddy_packet_summary_rows()
RETURNS TABLE (
  packet_id          UUID,
  applicant_user_id  UUID,
  status             TEXT,
  state_code         TEXT,
  current_section    TEXT,
  updated_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = snap_enrollment, pg_catalog
AS $$
  SELECT
    p.packet_id,
    p.user_id          AS applicant_user_id,
    p.status,
    p.state_code,
    p.current_section,
    p.updated_at,
    p.created_at
  FROM snap_enrollment.snap_packets p
  WHERE EXISTS (
    SELECT 1
    FROM snap_enrollment.buddy_relationship br
    WHERE br.buddy_user_id     = auth.uid()
      AND br.applicant_user_id = p.user_id
      AND br.status            = 'active'
  )
  AND p.status NOT IN ('submitted', 'approved', 'denied', 'withdrawn')
  AND p.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION snap_enrollment.buddy_packet_summary_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snap_enrollment.buddy_packet_summary_rows() TO authenticated;

CREATE OR REPLACE VIEW snap_enrollment.buddy_packet_summary_view AS
  SELECT * FROM snap_enrollment.buddy_packet_summary_rows();

REVOKE ALL ON snap_enrollment.buddy_packet_summary_view FROM PUBLIC;
GRANT SELECT ON snap_enrollment.buddy_packet_summary_view TO authenticated;

COMMENT ON VIEW snap_enrollment.buddy_packet_summary_view IS
  'Column-restricted buddy access to snap_packets. Buddies cannot read the base table directly (see policy applicant_read_own_packet); they must query this view. The underlying function is SECURITY DEFINER + STABLE so the auth.uid() check happens against the calling buddy.';


-- ============================================================================
-- 20260571_set_actor_context_function.sql  (from origin/codex/rebuild-feb18, PR #245)
-- ============================================================================

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


-- ============================================================================
-- POST-APPLY VERIFICATION QUERIES
-- ============================================================================
-- Run these after the migrations land. Each should return what's commented.

-- 1) Confirm buddy view + new RLS policy (PR #245 T3)
SELECT viewname FROM pg_views
WHERE schemaname = 'snap_enrollment'
  AND viewname  = 'buddy_packet_summary_view';
-- expected: 1 row

SELECT policyname FROM pg_policies
WHERE schemaname = 'snap_enrollment'
  AND tablename  = 'snap_packets'
  AND policyname IN ('applicant_read_own_packet', 'buddy_read_active_packet');
-- expected: 1 row, named applicant_read_own_packet
-- (buddy_read_active_packet should be GONE — dropped by 20260570)

-- 2) Confirm batched audit-context RPC (PR #245 T4)
SELECT proname FROM pg_proc
WHERE pronamespace = 'snap_enrollment'::regnamespace
  AND proname      = 'set_actor_context';
-- expected: 1 row

-- 3) Confirm work-hours table (PR #245)
SELECT tablename FROM pg_tables
WHERE schemaname = 'snap_enrollment'
  AND tablename  = 'work_requirement_hour_logs';
-- expected: 1 row

-- 4) Confirm buddy tables + actor_kind enum value
SELECT tablename FROM pg_tables
WHERE schemaname = 'snap_enrollment'
  AND tablename IN ('buddy_invite','buddy_relationship','buddy_org');
-- expected: 3 rows

-- 5) Confirm migrations registered in supabase_migrations.schema_migrations
SELECT version FROM supabase_migrations.schema_migrations
WHERE version >= '20260555'
ORDER BY version;
-- expected: 17 rows (or 15 if duplicate-timestamp pairs collapse).
