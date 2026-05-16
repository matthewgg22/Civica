-- +34 packets to round total to 284 with two purposes:
--   1. 18 packets in NEW rural / less-populous CA counties → map shades many more dots
--   2. 16 Handed Off packets with handed_off_at spanning 1–15 months ago
--      → populates the Enrollments tracker tab (Active / Expiring / Expired buckets
--      based on 12-month SNAP recertification period)
--
-- Run via: Supabase Studio → SQL Editor → paste & run. Idempotent.

set local snap_enrollment.actor_kind = 'system';
set local snap_enrollment.actor_id   = '019e3274-f69d-7592-b9c2-3e574a6ded60';

-- ============================================================================
-- A. 18 PACKETS in rural / under-shaded counties (varied statuses)
--    Brings total distinct CA counties on the map up to 40+.
-- ============================================================================
insert into snap_enrollment.snap_packets
  (packet_id, applicant_id, state_code, status, org_id, county, county_fips,
   submitted_at, handed_off_at, closed_at, created_at, updated_at)
select
  ('019f0302-0000-7000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  -- Cycle through first 18 applicants for variety
  ('019f0200-0000-7000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  'CA',
  (p.statuses)[idx]::snap_enrollment.packet_status,
  (select sp.org_id from snap_enrollment.snap_packets sp
     where sp.state_code = 'CA' and sp.deleted_at is null and sp.org_id is not null
     limit 1),
  (p.counties)[idx],
  (p.fips)[idx],
  case when (p.statuses)[idx] = 'Draft' then null
       else now() - (random() * interval '40 days' + interval '3 days') end,
  case when (p.statuses)[idx] in ('Handed Off', 'Closed')
       then now() - (random() * interval '20 days' + interval '1 day') end,
  null,
  now() - (random() * interval '50 days' + interval '5 days'),
  now() - (random() * interval '12 days')
from generate_series(1, 18) idx
cross join (select
  array[
    'In Navigator Review','Submitted for Review','Draft','Needs Documents',
    'Ready for Handoff','In Navigator Review','Handed Off','Submitted for Review',
    'Draft','In Navigator Review','Needs Applicant Clarification','Ready for Handoff',
    'Submitted for Review','Handed Off','In Navigator Review','Needs Documents',
    'Draft','Submitted for Review'
  ]::text[] as statuses,
  array[
    'Humboldt','Mendocino','Shasta','Butte','Yuba','El Dorado','Placer','Lake',
    'Tehama','Nevada','Calaveras','Tuolumne','Madera','Merced','Imperial','Inyo',
    'San Benito','Amador'
  ]::text[] as counties,
  array[
    '06023','06045','06089','06007','06115','06017','06061','06033',
    '06103','06057','06009','06109','06039','06047','06025','06027',
    '06069','06005'
  ]::text[] as fips
) p
on conflict (packet_id) do nothing;

-- ============================================================================
-- B. 16 ENROLLED packets with handed_off_at spanning 1–15 months ago.
--    Demonstrates the Enrollments tracker bucket logic:
--      • Active        — handoff < 11 months ago
--      • Expiring Soon — handoff 11–12 months ago (within 30 days of recert)
--      • Expired       — handoff > 12 months ago
-- ============================================================================
insert into snap_enrollment.snap_packets
  (packet_id, applicant_id, state_code, status, org_id, county, county_fips,
   submitted_at, handed_off_at, closed_at, created_at, updated_at)
select
  ('019f0303-0000-7000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  ('019f0200-0000-7000-8000-' || lpad(to_hex(20 + idx), 12, '0'))::uuid,
  'CA',
  (p.statuses)[idx]::snap_enrollment.packet_status,
  (select sp.org_id from snap_enrollment.snap_packets sp
     where sp.state_code = 'CA' and sp.deleted_at is null and sp.org_id is not null
     limit 1),
  (p.counties)[idx],
  (p.fips)[idx],
  -- Submitted 2 weeks before handoff
  (now() - (p.months_ago)[idx] * interval '1 month') - interval '14 days',
  -- Handed off N months ago
  now() - (p.months_ago)[idx] * interval '1 month',
  -- Some Closed packets (treated as "recertified successfully")
  case when (p.statuses)[idx] = 'Closed'
       then now() - (p.months_ago)[idx] * interval '1 month' + interval '11 months 28 days'
       else null end,
  (now() - (p.months_ago)[idx] * interval '1 month') - interval '30 days',
  now() - interval '5 days'
from generate_series(1, 16) idx
cross join (select
  -- Mix of Handed Off (still on active benefits) and Closed (recertified)
  array[
    'Handed Off','Handed Off','Handed Off','Handed Off','Handed Off',
    'Handed Off','Handed Off','Handed Off','Handed Off','Handed Off',
    'Handed Off','Handed Off','Closed','Closed','Closed','Closed'
  ]::text[] as statuses,
  -- Months ago — spread across buckets
  array[
    1, 2, 3, 5, 7,        -- Active (5 packets, 1-7 months in)
    9, 10,                -- Active but ramping (2 packets)
    11, 11,               -- Expiring Soon (2 packets, < 30d to recert)
    12, 13, 14, 15,       -- Expired (4 packets, recert overdue)
    13, 14, 15            -- Closed = recertified (3 packets)
  ]::int[] as months_ago,
  array[
    'Los Angeles','San Diego','Orange','Fresno','Sacramento',
    'Riverside','Alameda','San Bernardino','Santa Clara','Kern',
    'San Francisco','Contra Costa','Los Angeles','San Diego','Orange','Santa Clara'
  ]::text[] as counties,
  array[
    '06037','06073','06059','06019','06067',
    '06065','06001','06071','06085','06029',
    '06075','06013','06037','06073','06059','06085'
  ]::text[] as fips
) p
on conflict (packet_id) do nothing;

-- ============================================================================
-- C. Audit trail for the 13 newly-enrolled Handed Off packets
-- ============================================================================
insert into snap_enrollment.packet_status_history
  (history_id, packet_id, from_status, to_status, changed_by_staff_id, occurred_at, reason)
select
  ('019f0602-0000-7000-8000-' || lpad(to_hex((p_idx - 1) * 5 + h.h_idx), 12, '0'))::uuid,
  ('019f0303-0000-7000-8000-' || lpad(to_hex(p_idx), 12, '0'))::uuid,
  h.from_status::snap_enrollment.packet_status,
  h.to_status::snap_enrollment.packet_status,
  null,
  -- Use the packet's own timeline (months_ago value mapped to date)
  (now() - (months_ago)[p_idx] * interval '1 month') - ((5 - h.h_idx) * interval '5 days'),
  h.reason
from generate_series(1, 16) p_idx
cross join (values
  (1, null,                    'Draft',                'started by applicant'),
  (2, 'Draft',                 'Submitted for Review', 'submitted via mobile app'),
  (3, 'Submitted for Review',  'In Navigator Review',  'pulled from queue'),
  (4, 'In Navigator Review',   'Ready for Handoff',    'all verifications complete'),
  (5, 'Ready for Handoff',     'Handed Off',           'submitted to county office')
) as h(h_idx, from_status, to_status, reason)
cross join (select array[1, 2, 3, 5, 7, 9, 10, 11, 11, 12, 13, 14, 15, 13, 14, 15]::int[] as months_ago) m
on conflict (history_id) do nothing;

-- ============================================================================
-- Verify
-- ============================================================================
select
  (select count(*) from snap_enrollment.snap_packets where state_code = 'CA' and deleted_at is null) as total_ca_packets,
  (select count(distinct county_fips) from snap_enrollment.snap_packets where state_code = 'CA' and deleted_at is null) as distinct_counties,
  (select count(*) from snap_enrollment.snap_packets where status = 'Handed Off' and deleted_at is null) as active_enrollments,
  (select count(*) from snap_enrollment.snap_packets where status = 'Closed' and deleted_at is null) as closed_enrollments,
  (select count(*) from snap_enrollment.snap_packets
   where status = 'Handed Off' and handed_off_at < now() - interval '11 months' and handed_off_at >= now() - interval '12 months') as expiring_soon,
  (select count(*) from snap_enrollment.snap_packets
   where status = 'Handed Off' and handed_off_at < now() - interval '12 months') as expired_no_recert;
