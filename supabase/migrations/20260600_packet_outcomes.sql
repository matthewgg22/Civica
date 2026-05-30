-- snap_enrollment — Migration: KPI lagging-outcome input (packet_outcomes).
--
-- Locked by /plan-eng-review 2026-05-30. packet_outcomes is the per-packet
-- lagging-outcome input the kpi-snapshot builder (20260599) aggregates. It
-- references snap_packets(packet_id); the builder runs as service_role.
--
-- packet_outcomes — what happened to the application (lagging outcome).
--   Written either by the applicant self-reporting (POST /me/packets/:id/outcome,
--   source=self_report, RLS-scoped to their own packet) or, later, by an
--   authoritative county/QC signed webhook running as service_role (TODO-44).
--
--   FIDELITY (premise P2 / CRITICAL): `source` is the discriminator that keeps
--   self-reported outcomes out of the measured PER. A self_report row may
--   NEVER carry error_dollars / per_pct (CHECK enforced) and the builder reads
--   PER only from county_authoritative / qc_sample rows. Self-report still
--   feeds denial_rate / churn_rate (those are honestly self-reportable).
--
-- NOTE — no packet_cpr_capture table: the Pillar-1 LEADING proxy (Clean-Packet
-- Rate) does NOT need a new table. The packet-submit path already scores every
-- packet best-effort into snap_enrollment.packet_error_risk (20260555) via
-- me-packets.ts scoreAndPersist() at submit — that row carries tier / score /
-- factors / engine_version, everything the CPR builder needs (1a from tier, 1b
-- from factors, 1c = 65/35 applied at aggregate). The kpi-snapshot builder reads
-- packet_error_risk for submitted packets. Do not reintroduce a duplicate
-- capture table — single-source the scoring through snap-qc-engine + the existing
-- scoreAndPersist call.

CREATE TABLE snap_enrollment.packet_outcomes (
  outcome_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id     UUID        NOT NULL
                  REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  -- Fidelity discriminator. Self-report is leading-quality; the other two are
  -- authoritative and are the ONLY sources allowed to move measured PER.
  source        TEXT        NOT NULL CHECK (source IN (
                  'self_report',          -- applicant told us (in-app prompt)
                  'county_authoritative', -- county/CDSS confirmed (future webhook, TODO-44)
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

-- Applicants may read outcomes for their OWN packets (mirrors packets_own_select:
-- snap_packets.applicant_id is an FK to applicants.applicant_id, which maps to
-- auth.uid() via applicants.auth_uid — NOT applicant_id = auth.uid() directly).
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
