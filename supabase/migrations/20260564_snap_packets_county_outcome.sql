-- ---------------------------------------------------------------------------
-- Add county_outcome to snap_packets
--
-- County decisions (approved / denied / pending_decision) are separate from
-- the internal packet lifecycle (status column). A packet reaches 'Closed'
-- internally and then the county issues its decision. This column captures
-- the actual CalFresh enrollment outcome so the QC dashboard can compare
-- Civica-assisted applicant approval rates against the CDSS statewide baseline.
-- ---------------------------------------------------------------------------

do $$ begin
  create type snap_enrollment.county_outcome as enum (
    'approved',
    'denied',
    'pending_decision'
  );
exception when duplicate_object then null;
end $$;

alter table snap_enrollment.snap_packets
  add column if not exists county_outcome   snap_enrollment.county_outcome,
  add column if not exists county_decision_date timestamptz;

create index if not exists snap_packets_county_outcome_idx
  on snap_enrollment.snap_packets (county_outcome, updated_at desc)
  where deleted_at is null;

-- Navigators and admin can update the outcome after a county decision arrives.
-- The existing snap_enrollment RLS policies allow navigators to update packets
-- they own. No new policy is required — the column inherits existing row access.

comment on column snap_enrollment.snap_packets.county_outcome is
  'Final CalFresh county decision. null = outcome not yet recorded. '
  'pending_decision = handed off to county, awaiting result. '
  'Used by the QC dashboard denial-rate panel to compare Civica cohort '
  'outcomes against the CDSS statewide CalFresh baseline.';

comment on column snap_enrollment.snap_packets.county_decision_date is
  'Date the county issued its approval or denial. Used to compute '
  'time-to-decision and tie outcomes to the correct USDA QC cycle.';
