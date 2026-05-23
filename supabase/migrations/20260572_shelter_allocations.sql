-- snap_enrollment — Migration 72: shelter_allocations
--
-- Records the navigator-confirmed rent allocation for shared-lease households.
-- When classifyTenancy() returns shared_tenancy, the full lease rent cannot
-- be used as the household's shelter cost — it must be allocated by a navigator
-- based on bedroom count, equal split, or a documented roommate agreement.
--
-- This table is the audit record of that decision. evaluateSharedLease() reads
-- allocated_rent_usd from here instead of snap_packets.stated_monthly_rent
-- when an allocation exists.
--
-- Defensibility tier impact:
--   No allocation row present     → Weak  (unresolved shared lease)
--   Row present (navigator set)   → Moderate
--   Row + evidence_document_id    → Moderate-Strong (roommate agreement on file)

create table if not exists snap_enrollment.shelter_allocations (
  allocation_id         uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id             uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  total_lease_rent_usd  numeric(8,2) not null check (total_lease_rent_usd > 0),
  household_share_pct   numeric(5,4) not null check (household_share_pct > 0 and household_share_pct <= 1),
  allocated_rent_usd    numeric(8,2) not null check (allocated_rent_usd > 0),
  allocation_method     text        not null check (allocation_method in (
                          'bedroom_split',
                          'equal_split',
                          'dollar_amount',
                          'documented_roommate_agreement'
                        )),
  -- optional: uploaded roommate agreement or side letter
  evidence_document_id  uuid        references snap_enrollment.uploaded_documents(document_id) on delete set null,
  navigator_staff_id    uuid        not null references snap_enrollment.staff_users(staff_id) on delete restrict,
  allocated_at          timestamptz not null default clock_timestamp(),
  notes                 text,
  created_at            timestamptz not null default clock_timestamp(),
  updated_at            timestamptz not null default clock_timestamp()
);

comment on table snap_enrollment.shelter_allocations is
  'Navigator-confirmed rent allocation for shared-lease households. '
  'One row per packet; re-allocation replaces the previous row via upsert on packet_id.';

-- Only one active allocation per packet at a time
create unique index if not exists shelter_allocations_packet_unique
  on snap_enrollment.shelter_allocations(packet_id);

create index if not exists shelter_allocations_navigator_idx
  on snap_enrollment.shelter_allocations(navigator_staff_id, allocated_at desc);

drop trigger if exists shelter_allocations_updated_at on snap_enrollment.shelter_allocations;
create trigger shelter_allocations_updated_at
  before update on snap_enrollment.shelter_allocations
  for each row execute function snap_enrollment.set_updated_at();
