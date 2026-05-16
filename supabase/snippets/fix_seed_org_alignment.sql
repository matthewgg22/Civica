-- Fix: the rich_demo_seed packets aren't visible because their org_id doesn't
-- match the staff_users.org_id of your logged-in account.
--
-- RLS policy `packets_staff_select` requires:
--   exists (staff_users su join staff_roles sr where su.auth_uid = auth.uid()
--           and su.org_id = packet.org_id)
--
-- The OLD packets ARE visible → so their org_id matches your staff org.
-- We copy that org_id onto the NEW packets.
--
-- Run via: Supabase Studio → SQL Editor → paste & run.

-- 1. Diagnostic: confirm there's a single CA staff-visible org and what its id is
select 'visible_org_for_ca' as label, org_id::text, count(*) as old_packets
from snap_enrollment.snap_packets
where state_code = 'CA'
  and deleted_at is null
  and packet_id::text not like '018f4e10-0000-7000-8000-000000002%'
  and org_id is not null
group by org_id;

-- 2. Align the new seeded packets to the same org
update snap_enrollment.snap_packets
set org_id = (
  select sp.org_id
  from snap_enrollment.snap_packets sp
  where sp.state_code = 'CA'
    and sp.deleted_at is null
    and sp.packet_id::text not like '018f4e10-0000-7000-8000-000000002%'
    and sp.org_id is not null
  limit 1
)
where packet_id::text like '018f4e10-0000-7000-8000-000000002%'
  and exists (
    select 1 from snap_enrollment.snap_packets sp
    where sp.state_code = 'CA'
      and sp.deleted_at is null
      and sp.packet_id::text not like '018f4e10-0000-7000-8000-000000002%'
      and sp.org_id is not null
  );

-- 3. Verify the rewrite
select org_id::text, count(*) as packets
from snap_enrollment.snap_packets
where packet_id::text like '018f4e10-0000-7000-8000-000000002%'
  and deleted_at is null
group by org_id;
