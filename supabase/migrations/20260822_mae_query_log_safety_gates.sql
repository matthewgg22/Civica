-- Safety-gate columns for mae_query_log (#927).
--
-- NOT APPLIED BY CODE. Paste this in the Supabase SQL editor (this project's
-- convention), THEN land the sink change that writes these. In that order:
-- writing a column that does not exist yet fails the whole insert, and this
-- table has a history of recording nothing at all while a migration sat
-- unapplied.
--
-- Why persist them: the crisis gate's v1 patterns deliberately leave
-- ambiguous phrasing out ("I can't do this anymore" on a benefits site is
-- usually about a form). Whether to widen them should be decided from real
-- messages, and that needs the gate's own decisions on the record. `distress`
-- has been on the audit RECORD since the F2 gate shipped but was never
-- written to a column, so the same question could never be asked of it.

alter table snap_enrollment.mae_query_log
  add column if not exists distress boolean,
  add column if not exists crisis text;

comment on column snap_enrollment.mae_query_log.distress is
  'F2 gate: acute food/housing crisis phrasing detected in the question.';
comment on column snap_enrollment.mae_query_log.crisis is
  '#927 gate: self_harm | abuse, or null. Recorded to measure the gate''s precision against real messages.';

-- Neither is PII: both are the gate's own classification, not the text.
