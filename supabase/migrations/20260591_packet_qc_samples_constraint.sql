-- snap_enrollment — Fix packet_qc_samples constraint semantics.
--
-- Follow-up to migration 20260590. The original constraint
--   `submission_sample_pre_submit` required `sampled_at < submitted_at`
-- for submission-stage rows, intended as a "sample-bias guard" per
-- DES-D7 — preventing navigators from selectively flagging risky
-- packets after seeing them.
--
-- That constraint contradicts the actual writer architecture: the
-- internal-qc-sampler cron operates on ALREADY-SUBMITTED packets,
-- setting `sampled_at = now()` and `submitted_at = packet.submitted_at`
-- (a past timestamp). Every cron-driven insert therefore had
-- `sampled_at > submitted_at` and was rejected.
--
-- Cron output 2026-05-27T18:00:23Z:
--   "Error: packet_qc_samples insert failed: new row for relation
--    \"packet_qc_samples\" violates check constraint
--    \"submission_sample_pre_submit\""
--
-- Bias mitigation actually lives elsewhere and is unaffected by this
-- change:
--   - The sampler uses deterministic sha256(packet_id) % 10. A packet's
--     selection is fixed once its packet_id is known; nobody can
--     "pick" a packet by inspecting its risk score.
--   - INSERT/UPDATE policies are granted to service_role only. The
--     hourly cron is the only writer. Navigators read but cannot write.
--   - The sampler reads from `snap_packets` filtered to
--     `submitted_at IS NOT NULL`, so submission-stage rows always
--     reference a genuinely submitted packet.
--
-- Replacement constraint keeps the real semantic invariant ("a
-- submission-stage sample row references a submitted packet") while
-- dropping the impossible timestamp comparison.

ALTER TABLE snap_enrollment.packet_qc_samples
  DROP CONSTRAINT submission_sample_pre_submit;

ALTER TABLE snap_enrollment.packet_qc_samples
  ADD CONSTRAINT submission_sample_requires_submitted_at
  CHECK (
    sample_stage <> 'submission'
    OR submitted_at IS NOT NULL
  );

COMMENT ON CONSTRAINT submission_sample_requires_submitted_at
  ON snap_enrollment.packet_qc_samples IS
  'Submission-stage rows must reference a packet whose submitted_at is '
  'populated. Sample-bias guarantees move to: sampler determinism '
  '(sha256 modular hash), RLS (service_role-only writes), and the '
  'sampler''s candidate filter (`snap_packets.submitted_at IS NOT NULL`). '
  'Replaces submission_sample_pre_submit (migration 20260590), whose '
  '`sampled_at < submitted_at` clause contradicted the cron writer.';
