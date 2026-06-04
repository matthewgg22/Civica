-- snap_enrollment — Migration: per-org QC flag-sensitivity preferences (#496).
--
-- Stores a CBO's flag-sensitivity choice — the TRIAGE layer that decides which
-- QC flags interrupt a navigator's workflow. This is presentation/triage only;
-- it NEVER feeds the eligibility determination, the benefit math, or the
-- measured payment error rate. The engine read-path (@civica/snap-qc-engine
-- resolveFlagInterrupts) applies these AFTER scoring, so two orgs with
-- different settings on identical packets still produce identical scores and
-- identical kpi/error-rate snapshots. That keeps measured PER comparable across
-- CBOs and audit-ready (#496 invariant; enforced by a unit test in the engine).
--
-- NOT APPLIED YET — operator step: paste into the Supabase SQL Editor (Civica
-- migrations are NOT applied via `supabase db push --linked`; the linked CLI
-- project is PROD). The table is inert until an authenticated CBO settings
-- surface writes to it and the navigator flow reads resolveFlagInterrupts.

CREATE TABLE snap_enrollment.org_qc_preferences (
  -- One preferences row per org. PK = FK so the row lives and dies with the org.
  org_id            uuid        PRIMARY KEY
                      REFERENCES snap_enrollment.staff_orgs(org_id) ON DELETE CASCADE,
  -- Discrete sensitivity level. Mirrors @civica/snap-qc-engine SensitivityLevel.
  -- Default 'balanced' = current behavior (high + medium flags interrupt).
  sensitivity_level text        NOT NULL DEFAULT 'balanced'
                      CHECK (sensitivity_level IN ('conservative', 'balanced', 'thorough')),
  -- Flows the CBO emphasizes — each surfaced one level more aggressively.
  -- Values are @civica/snap-qc-engine FlowKind. Array containment CHECK rejects
  -- any unknown flow so a typo can't silently disable a focus area.
  focus_flows       text[]      NOT NULL DEFAULT '{}'::text[]
                      CHECK (focus_flows <@ ARRAY[
                        'utility-sua',
                        'gig-income',
                        'shared-lease',
                        'assets',
                        'benefit-impact-projection'
                      ]::text[]),
  updated_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- Who last changed it (audit). SET NULL so the row survives a user deletion.
  updated_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE snap_enrollment.org_qc_preferences IS
  'Per-org QC flag-sensitivity preference (#496). Triage layer only — decides '
  'which flags interrupt a navigator; never affects determination, benefit, or '
  'measured PER. Read by @civica/snap-qc-engine resolveFlagInterrupts AFTER '
  'scoring.';

ALTER TABLE snap_enrollment.org_qc_preferences ENABLE ROW LEVEL SECURITY;

-- The refresh job / navigator backend (service_role) reads + writes freely.
CREATE POLICY org_qc_preferences_service_role_all
  ON snap_enrollment.org_qc_preferences
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Any active member of the org may READ their org's preferences (the navigator
-- UI needs the current setting to filter interrupts).
CREATE POLICY org_qc_preferences_member_read
  ON snap_enrollment.org_qc_preferences
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.caseworker_assignments a
      WHERE a.user_id = auth.uid()
        AND a.revoked_at IS NULL
        AND a.org_id = org_qc_preferences.org_id
    )
  );

-- Only an active ADMIN of the org may WRITE (insert/update) the preference.
-- Mirrors caseworker_assignments_org_admin_read's admin-scope pattern.
CREATE POLICY org_qc_preferences_admin_write
  ON snap_enrollment.org_qc_preferences
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.caseworker_assignments admin
      WHERE admin.user_id = auth.uid()
        AND admin.role_within_cbo = 'admin'
        AND admin.revoked_at IS NULL
        AND admin.org_id = org_qc_preferences.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM snap_enrollment.caseworker_assignments admin
      WHERE admin.user_id = auth.uid()
        AND admin.role_within_cbo = 'admin'
        AND admin.revoked_at IS NULL
        AND admin.org_id = org_qc_preferences.org_id
    )
  );

GRANT SELECT                         ON snap_enrollment.org_qc_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snap_enrollment.org_qc_preferences TO service_role;
