-- snap_enrollment — Migration: KPI raw inputs (packet_outcomes + packet_cpr_capture).
--
-- Locked by /plan-eng-review 2026-05-30. These are the two per-packet input
-- tables the kpi-snapshot builder (20260599) aggregates. Both reference
-- snap_packets(packet_id); the builder runs as service_role and reads them.
--
-- 1) packet_outcomes  — what happened to the application (lagging outcome).
--    Written either by the applicant self-reporting (POST /me/packets/:id/outcome,
--    source=self_report, RLS-scoped to their own packet) or, later, by an
--    authoritative county/QC signed webhook running as service_role.
--
--    FIDELITY (premise P2 / CRITICAL): `source` is the discriminator that keeps
--    self-reported outcomes out of the measured PER. A self_report row may
--    NEVER carry error_dollars / per_pct (CHECK enforced) and the builder reads
--    PER only from county_authoritative / qc_sample rows. Self-report still
--    feeds denial_rate / churn_rate (those are honestly self-reportable).
--
-- 2) packet_cpr_capture — the at-submission Clean-Packet-Rate stamp (Pillar 1
--    leading proxy). Computed best-effort by @civica/snap-qc-engine at submit
--    time; a scoring failure must NEVER block submission (handled in the route).
--    Internal QC signal (risk score, element triggers are gameable) — exposed
--    to service_role only, never to applicants.

-- ===========================================================================
-- packet_outcomes
-- ===========================================================================
CREATE TABLE snap_enrollment.packet_outcomes (
  outcome_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id     UUID        NOT NULL
                  REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  -- Fidelity discriminator. Self-report is leading-quality; the other two are
  -- authoritative and are the ONLY sources allowed to move measured PER.
  source        TEXT        NOT NULL CHECK (source IN (
                  'self_report',          -- applicant told us (in-app prompt)
                  'county_authoritative', -- county/CDSS confirmed (future webhook)
                  'qc_sample'             -- pulled into a QC review
                )),
  -- Wire-compatible with iOS CountyOutcomeSelection + dashboard CountyOutcomeButton.
  outcome       TEXT        NOT NULL CHECK (outcome IN (
                  'approved',
                  'denied',
                  'pending_decision'
                )),
  -- Dollar error + PER, ONLY meaningful for authoritative sources. The CHECK
  -- below guarantees a self_report can never carry these (fidelity firewall).
  error_dollars NUMERIC(12, 2),
  per_pct       NUMERIC(6, 3),
  -- Who reported it (the applicant for self_report; null/service for webhook).
  reported_by   UUID        REFERENCES auth.users(id),
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  inserted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- FIDELITY FIREWALL: a self-reported outcome carries no authoritative dollars.
  CONSTRAINT ck_packet_outcomes_self_report_no_dollars
    CHECK (source <> 'self_report' OR (error_dollars IS NULL AND per_pct IS NULL)),
  -- Idempotency: at most one outcome per packet per source. A re-report (prompt
  -- re-fires, two tabs) upserts ON CONFLICT (packet_id, source) — never double-counts.
  CONSTRAINT uq_packet_outcomes_packet_source UNIQUE (packet_id, source)
);

-- Builder aggregates by source over a recent window.
CREATE INDEX ON snap_enrollment.packet_outcomes (source, reported_at DESC);

ALTER TABLE snap_enrollment.packet_outcomes ENABLE ROW LEVEL SECURITY;

-- Applicants may read outcomes for their OWN packets (mirrors packets_own_select).
CREATE POLICY packet_outcomes_own_select
  ON snap_enrollment.packet_outcomes FOR SELECT TO authenticated
  USING (
    packet_id IN (
      SELECT p.packet_id FROM snap_enrollment.snap_packets p
      WHERE p.applicant_id = (
        SELECT applicant_id FROM snap_enrollment.applicants
        WHERE auth_uid = auth.uid() LIMIT 1
      )
    )
  );

-- Applicants may INSERT a self_report ONLY, and ONLY on their own packet. This
-- WITH CHECK is the safety net behind the route's ownership check: even a route
-- bug cannot let a user write an authoritative (PER-moving) row or touch another
-- packet. Authoritative rows arrive via service_role (webhook), bypassing RLS.
CREATE POLICY packet_outcomes_self_report_insert
  ON snap_enrollment.packet_outcomes FOR INSERT TO authenticated
  WITH CHECK (
    source = 'self_report'
    AND packet_id IN (
      SELECT p.packet_id FROM snap_enrollment.snap_packets p
      WHERE p.applicant_id = (
        SELECT applicant_id FROM snap_enrollment.applicants
        WHERE auth_uid = auth.uid() LIMIT 1
      )
    )
  );

-- ...and may correct their own self_report (approved -> denied) on conflict upsert.
CREATE POLICY packet_outcomes_self_report_update
  ON snap_enrollment.packet_outcomes FOR UPDATE TO authenticated
  USING (
    source = 'self_report'
    AND packet_id IN (
      SELECT p.packet_id FROM snap_enrollment.snap_packets p
      WHERE p.applicant_id = (
        SELECT applicant_id FROM snap_enrollment.applicants
        WHERE auth_uid = auth.uid() LIMIT 1
      )
    )
  )
  WITH CHECK (
    source = 'self_report'
    AND packet_id IN (
      SELECT p.packet_id FROM snap_enrollment.snap_packets p
      WHERE p.applicant_id = (
        SELECT applicant_id FROM snap_enrollment.applicants
        WHERE auth_uid = auth.uid() LIMIT 1
      )
    )
  );

GRANT SELECT, INSERT, UPDATE ON snap_enrollment.packet_outcomes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON snap_enrollment.packet_outcomes TO service_role;

COMMENT ON TABLE snap_enrollment.packet_outcomes IS
  'Per-packet application outcomes (lagging KPI input). source is the fidelity '
  'discriminator: self_report (applicant-told, no dollars — CHECK enforced) vs '
  'county_authoritative / qc_sample (authoritative, the ONLY sources that move '
  'measured PER). One row per (packet_id, source); re-reports upsert. RLS: '
  'applicants read/write self_report on their own packets only.';

-- ===========================================================================
-- packet_cpr_capture
-- ===========================================================================
CREATE TABLE snap_enrollment.packet_cpr_capture (
  capture_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id         UUID        NOT NULL
                      REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  -- snap-qc-engine version that scored the packet (weights evolve → provenance).
  engine_version    TEXT        NOT NULL,
  -- Binary CPR contribution: did the packet score below the "clean" threshold?
  is_clean          BOOLEAN     NOT NULL,
  -- Continuous error-risk score (scorePacketRisk) — 1c's continuous cousin.
  risk_score        NUMERIC(6, 3),
  -- Which QC elements tripped, for 1b Element-Clean Rate. Array of
  -- {element, weight, ...} objects produced by the engine.
  element_triggers  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Share of this packet's risk that is operationally addressable (the 65/35),
  -- for 1c Operational-Addressable Clean Rate.
  operational_share NUMERIC(6, 3),
  -- When the stamp was taken (at submission).
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- One CPR capture per packet (the at-submission snapshot). Re-submit upserts.
  CONSTRAINT uq_packet_cpr_capture_packet UNIQUE (packet_id)
);

-- Builder aggregates CPR over a recent submission window.
CREATE INDEX ON snap_enrollment.packet_cpr_capture (captured_at DESC);

ALTER TABLE snap_enrollment.packet_cpr_capture ENABLE ROW LEVEL SECURITY;

-- Internal QC signal only. RLS is ENABLED with NO authenticated policy →
-- authenticated users get nothing (risk scores / element triggers are gameable;
-- the design flags this). Written and read by the submit path + cron builder,
-- both service_role (which bypasses RLS). No grants to authenticated.
GRANT SELECT, INSERT, UPDATE ON snap_enrollment.packet_cpr_capture TO service_role;

COMMENT ON TABLE snap_enrollment.packet_cpr_capture IS
  'At-submission Clean-Packet-Rate stamp (Pillar 1 leading proxy). Computed '
  'best-effort by @civica/snap-qc-engine at submit time; never blocks submission. '
  'Internal QC signal (risk_score / element_triggers are gameable) — service_role '
  'only, no applicant access. One row per packet; re-submit upserts.';
