-- snap_enrollment — Migration: supervised-cohort study instrumentation (#588)
--
-- The measurement pipeline for Civica's first supervised user cohort (n≈30).
-- Spec: docs/plans/supervised-test-kpi-spec.md.
--
-- WHY THIS EXISTS AND WHAT IT IS NOT:
-- n≈30 CANNOT prove an interview-completion lift. Against LA County's ~11%
-- missed-interview baseline (7,235 denials / 66,031 applications per month),
-- even 0 misses out of 30 yields a Wilson 95% CI of [0%, 11.4%] — which does
-- not exclude the baseline. A powered test needs n≈135–320. This is therefore a
-- MECHANISM study: it exists to learn WHERE and WHY people fail, to record the
-- agency-vs-applicant attribution of each failure, and to leave behind a
-- measurement pipeline that stages 2–3 reuse UNCHANGED. Any outcome rate
-- computed from these rows is DIRECTIONAL and must be reported with its
-- interval, never as a bare point estimate.
--
-- PII INVARIANT (load-bearing): participants are identified by cohort_ref — an
-- opaque study handle — never by name. No SSN, date of birth, full address,
-- phone, or email may be written to any column here, including payload. The
-- demographic columns are deliberately COARSE bands, and even so, at n≈30 a
-- (age_band, language, county) triple can be re-identifying: treat every read
-- of this table as sensitive and never join it to applicant PII for reporting.
--
-- FIDELITY: mirrors the packet_outcomes discriminator pattern (20260600).
-- `human_intervened` marks any event where a Civica operator unblocked the
-- participant. The readout MUST be able to report interview-completion rate
-- both WITH and WITHOUT intervened participants — an operator rescuing someone
-- is not the product working, and conflating the two would overstate the result.
--
-- Written by service_role only (the app event writer); read is restricted to
-- admin/operator for study analysis.

-- ---------------------------------------------------------------------------
-- Participants — enrollment, consent, and the skew record
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snap_enrollment.cohort_participants (
  participant_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Opaque study handle (e.g. 'C-014'). NEVER a name or case number.
  cohort_ref       TEXT        NOT NULL UNIQUE,
  study_name       TEXT        NOT NULL DEFAULT 'supervised-cohort-1',

  -- Optional link to the packet this participant is working. Nullable because a
  -- participant is enrolled before any packet exists.
  packet_id        UUID        REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE SET NULL,

  enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  consented_at     TIMESTAMPTZ,             -- explicit, informed; null = not yet consented
  withdrawn_at     TIMESTAMPTZ,             -- participant left; they keep all help
  withdrawn_reason TEXT,

  -- ONE surface per participant. Mixing web/iOS at n≈30 makes attribution
  -- impossible (spec §8), so this is recorded and expected to be constant.
  surface          TEXT        NOT NULL CHECK (surface IN ('web', 'ios', 'assisted')),

  -- Coarse skew record, compared against the LA caseload in the readout
  -- (60+ ≈ 25%, non-English ≈ 30%, Spanish ≈ 19.7%). Selection bias in this
  -- cohort is SEVERE and known; these columns exist to quantify and disclose
  -- it, not to enable subgroup claims (n is far too small for that).
  age_band         TEXT        CHECK (age_band IN ('18-24','25-39','40-59','60-64','65plus')),
  primary_language TEXT,                    -- ISO-ish short code, e.g. 'en','es'
  county           TEXT,

  -- Terminal disposition, mirrored from packet_outcomes when known.
  final_disposition TEXT       CHECK (final_disposition IN (
                       'approved', 'denied', 'withdrawn', 'pending', 'unknown')),
  disposition_reason TEXT,                  -- county reason code / label, no PII

  notes            TEXT,                    -- researcher notes; NO applicant PII
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE snap_enrollment.cohort_participants IS
  'Supervised-cohort study roster (#588). cohort_ref is an opaque handle — never a name. Coarse demographics exist to DISCLOSE selection skew, not to support subgroup claims at n≈30.';

-- ---------------------------------------------------------------------------
-- Events — the observational stream
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snap_enrollment.cohort_events (
  event_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id   UUID        NOT NULL
                     REFERENCES snap_enrollment.cohort_participants(participant_id) ON DELETE CASCADE,
  packet_id        UUID        REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE SET NULL,

  -- Open vocabulary, deliberately (mirrors notifications.event_type, 20260605):
  -- the schema must absorb new event kinds without a migration. The known set is
  -- documented in packages/snap-qc-engine/src/scoring/cohort-readout.ts
  -- (COHORT_EVENT_TYPES) — onboarding (session_start, section_completed,
  -- mae_question_asked, doc_uploaded, error_flag_raised, application_submitted)
  -- and the interview lifecycle (interview_scheduled, interview_prep_viewed,
  -- phone_verified, interview_attempted, interview_completed, interview_missed,
  -- nomi_received, recovery_initiated, interview_completed_after_reschedule,
  -- decision_received).
  event_type       TEXT        NOT NULL,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- THE load-bearing field. On any interview_missed event this records whether
  -- the failure was the applicant's or the agency's. The CDSS Management
  -- Evaluation corpus says agency-side dominates (county never called, NOMI sent
  -- after a completed interview, no NOMI at all, denial before day 30); if that
  -- reproduces here it is the strongest single result this cohort can produce,
  -- and it decides whether prep or an advocacy/recovery loop is the product.
  -- Typed as a column rather than buried in payload precisely because it is the
  -- primary analytic variable.
  miss_attribution TEXT        CHECK (miss_attribution IN (
                       'applicant_no_answer',      -- didn't answer the call
                       'applicant_unaware',        -- didn't know an interview was required
                       'applicant_unavailable',    -- knew, could not attend
                       'agency_never_called',      -- no contact attempt made
                       'agency_wrong_number',      -- called a number not on file
                       'agency_no_notice',         -- no appointment letter / NOMI
                       'agency_method_refused',    -- preferred method not honored
                       'agency_language',          -- notice in the wrong language
                       'unknown')),

  -- TRUE when a Civica operator directly unblocked the participant on this
  -- event. The readout reports outcomes with AND without these (spec §5.3).
  human_intervened BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Free-form typed detail. PII INVARIANT applies: no names, SSNs, DOBs,
  -- addresses, phones, emails. Question text must be PII-scrubbed by
  -- apps/dashboard/lib/mae/pii.ts before it lands here.
  payload          JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Idempotency for retried writers (mirrors notifications.dedupe_key).
  dedupe_key       TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN snap_enrollment.cohort_events.miss_attribution IS
  'Agency-vs-applicant cause of a missed interview. The primary analytic variable — the ME corpus says agency-side dominates, and confirming that decides prep-vs-recovery as the product.';

CREATE INDEX IF NOT EXISTS cohort_events_participant_idx
  ON snap_enrollment.cohort_events (participant_id, occurred_at);
CREATE INDEX IF NOT EXISTS cohort_events_type_idx
  ON snap_enrollment.cohort_events (event_type, occurred_at DESC);
-- The attribution slice is read on every readout; index the non-null rows only.
CREATE INDEX IF NOT EXISTS cohort_events_attribution_idx
  ON snap_enrollment.cohort_events (miss_attribution)
  WHERE miss_attribution IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cohort_events_dedupe_idx
  ON snap_enrollment.cohort_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS — service_role writes; admin/operator reads. No applicant self-read:
-- this is research telemetry, not a user-facing record.
-- ---------------------------------------------------------------------------
ALTER TABLE snap_enrollment.cohort_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.cohort_events       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cohort_participants_admin_read ON snap_enrollment.cohort_participants;
CREATE POLICY cohort_participants_admin_read
  ON snap_enrollment.cohort_participants FOR SELECT
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'operator'));

DROP POLICY IF EXISTS cohort_events_admin_read ON snap_enrollment.cohort_events;
CREATE POLICY cohort_events_admin_read
  ON snap_enrollment.cohort_events FOR SELECT
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'operator'));

-- ---------------------------------------------------------------------------
-- Raw-count view. Deliberately returns COUNTS ONLY — no rates, no intervals.
-- The Wilson math lives in the engine (packages/snap-qc-engine wilsonInterval),
-- mirroring v_qc_error_rate_by_slice: the view supplies numerators and
-- denominators, the engine owns the formula so it is unit-tested and identical
-- for every consumer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW snap_enrollment.v_cohort_interview_counts AS
SELECT
  p.study_name,
  COUNT(DISTINCT p.participant_id) FILTER (
    WHERE EXISTS (SELECT 1 FROM snap_enrollment.cohort_events e
                  WHERE e.participant_id = p.participant_id
                    AND e.event_type = 'interview_scheduled')
  ) AS reached_interview_stage,
  COUNT(DISTINCT p.participant_id) FILTER (
    WHERE EXISTS (SELECT 1 FROM snap_enrollment.cohort_events e
                  WHERE e.participant_id = p.participant_id
                    AND e.event_type IN ('interview_completed',
                                         'interview_completed_after_reschedule'))
  ) AS completed_interview,
  COUNT(DISTINCT p.participant_id) FILTER (
    WHERE EXISTS (SELECT 1 FROM snap_enrollment.cohort_events e
                  WHERE e.participant_id = p.participant_id
                    AND e.event_type = 'interview_missed')
  ) AS missed_interview,
  COUNT(DISTINCT p.participant_id) FILTER (
    WHERE EXISTS (SELECT 1 FROM snap_enrollment.cohort_events e
                  WHERE e.participant_id = p.participant_id
                    AND e.human_intervened)
  ) AS had_human_intervention,
  COUNT(DISTINCT p.participant_id) FILTER (WHERE p.withdrawn_at IS NOT NULL) AS withdrew
FROM snap_enrollment.cohort_participants p
GROUP BY p.study_name;

COMMENT ON VIEW snap_enrollment.v_cohort_interview_counts IS
  'Raw numerators/denominators for the cohort readout. Returns COUNTS ONLY — the Wilson interval is computed in packages/snap-qc-engine so the formula is unit-tested and single-sourced.';
