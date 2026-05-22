-- Add 'buddy' to the audit actor kind enum.
-- ALTER TYPE ... ADD VALUE cannot be rolled back within a transaction;
-- this migration is intentionally isolated so the enum change commits before
-- the tables that use it (20260567) are created.
ALTER TYPE snap_enrollment.audit_actor_kind ADD VALUE IF NOT EXISTS 'buddy';
