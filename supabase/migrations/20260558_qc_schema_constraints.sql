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
