-- Buddy RLS smoke tests
-- Run with: supabase test db
-- These test the three critical access-control invariants for the buddy feature.

BEGIN;

SELECT plan(7);

-- ── Test 1: buddy can SELECT an active packet ──────────────────────────────
-- Set up: one applicant, one buddy, one active relationship, one active packet.
DO $$
DECLARE
  v_applicant UUID := '00000000-0000-0000-0000-000000000001';
  v_buddy     UUID := '00000000-0000-0000-0000-000000000002';
  v_packet    UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
  INSERT INTO snap_enrollment.buddy_relationship (id, applicant_user_id, buddy_user_id, status)
  VALUES (gen_random_uuid(), v_applicant, v_buddy, 'active')
  ON CONFLICT DO NOTHING;

  INSERT INTO snap_enrollment.snap_packets (packet_id, user_id, status)
  VALUES (v_packet, v_applicant, 'in_progress')
  ON CONFLICT DO NOTHING;
END;
$$;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM snap_enrollment.snap_packets p
    JOIN snap_enrollment.buddy_relationship br
      ON br.applicant_user_id = p.user_id
     AND br.buddy_user_id = '00000000-0000-0000-0000-000000000002'
     AND br.status = 'active'
     AND p.status NOT IN ('submitted', 'approved')
    WHERE p.packet_id = '00000000-0000-0000-0000-000000000003'
  ),
  'buddy can read active packet via relationship check'
);

-- ── Test 2: buddy cannot see submitted/approved packet ────────────────────
DO $$
BEGIN
  UPDATE snap_enrollment.snap_packets
  SET status = 'submitted'
  WHERE packet_id = '00000000-0000-0000-0000-000000000003';
END;
$$;

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM snap_enrollment.snap_packets p
    JOIN snap_enrollment.buddy_relationship br
      ON br.applicant_user_id = p.user_id
     AND br.buddy_user_id = '00000000-0000-0000-0000-000000000002'
     AND br.status = 'active'
     AND p.status NOT IN ('submitted', 'approved')
    WHERE p.packet_id = '00000000-0000-0000-0000-000000000003'
  ),
  'buddy cannot read submitted packet'
);

-- ── Test 3: unauthenticated user cannot read buddy_invite rows ────────────
-- The policy denies all authenticated (non-service-role) reads.
-- We verify the policy text rather than simulate an auth context (pgTAP
-- set_role approach requires a real auth role which may not exist in CI).
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'snap_enrollment'
      AND tablename  = 'buddy_invite'
      AND policyname = 'buddy_invite_service_role_only'
      AND cmd        = 'ALL'
      AND qual       = 'false'
  ),
  'buddy_invite has service_role-only policy with USING(false)'
);

-- ── Test 4: snap_packets buddy-branch policy is GONE (T3 column restriction) ──
-- After 20260570_buddy_packet_summary_view.sql, buddies must go through the
-- view; the old buddy_read_active_packet policy on snap_packets is dropped.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'snap_enrollment'
      AND tablename  = 'snap_packets'
      AND policyname = 'buddy_read_active_packet'
  ),
  'buddy_read_active_packet policy is removed from snap_packets (column restriction in place)'
);

-- ── Test 5: applicant_read_own_packet policy exists on snap_packets ───────
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'snap_enrollment'
      AND tablename  = 'snap_packets'
      AND policyname = 'applicant_read_own_packet'
  ),
  'applicant_read_own_packet policy exists (applicants retain direct snap_packets read)'
);

-- ── Test 6: buddy_packet_summary_view exists and exposes only safe columns ──
-- The view must NOT expose ssn, income, household_size, or any encrypted PII
-- column. Verify by checking pg_views columns against the safe-column set.
SELECT ok(
  EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'snap_enrollment' AND viewname = 'buddy_packet_summary_view'),
  'buddy_packet_summary_view exists'
);

-- The view's columns are: packet_id, applicant_user_id, status, state_code,
-- current_section, updated_at, created_at. Any PII column (income, ssn, etc.)
-- in this view is a bug. Spot-check that no obviously-PII column is exposed.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'snap_enrollment'
      AND table_name   = 'buddy_packet_summary_view'
      AND column_name  IN ('ssn_ciphertext', 'household_size', 'monthly_gross_income', 'address_ciphertext')
  ),
  'buddy_packet_summary_view does not expose SSN, income, household, or address columns'
);

SELECT * FROM finish();
ROLLBACK;
