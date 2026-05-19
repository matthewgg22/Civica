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
