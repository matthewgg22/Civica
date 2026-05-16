-- One-shot: backfill county + county_fips on the demo packets in the hosted DB
-- so the California Footprint map on the dashboard lights up.
--
-- Run via: Supabase Studio → SQL Editor → paste & run.
-- Safe to re-run (UPDATE by packet_id is idempotent).

update snap_enrollment.snap_packets set county = 'Los Angeles',   county_fips = '06037' where packet_id = '018f4e10-0000-7000-8000-000000001001';
update snap_enrollment.snap_packets set county = 'Orange',        county_fips = '06059' where packet_id = '018f4e10-0000-7000-8000-000000001002';
update snap_enrollment.snap_packets set county = 'San Diego',     county_fips = '06073' where packet_id = '018f4e10-0000-7000-8000-000000001003';
update snap_enrollment.snap_packets set county = 'Santa Clara',   county_fips = '06085' where packet_id = '018f4e10-0000-7000-8000-000000001004';
update snap_enrollment.snap_packets set county = 'San Francisco', county_fips = '06075' where packet_id = '018f4e10-0000-7000-8000-000000001005';
update snap_enrollment.snap_packets set county = 'Fresno',        county_fips = '06019' where packet_id = '018f4e10-0000-7000-8000-000000001006';
update snap_enrollment.snap_packets set county = 'Sacramento',    county_fips = '06067' where packet_id = '018f4e10-0000-7000-8000-000000001007';

update snap_enrollment.snap_packets set county = 'Suffolk',   county_fips = '25025' where packet_id = '018f4e10-0000-7000-8000-000000001008';
update snap_enrollment.snap_packets set county = 'Middlesex', county_fips = '25017' where packet_id = '018f4e10-0000-7000-8000-000000001009';
update snap_enrollment.snap_packets set county = 'Worcester', county_fips = '25027' where packet_id = '018f4e10-0000-7000-8000-000000001010';
update snap_enrollment.snap_packets set county = 'Essex',     county_fips = '25009' where packet_id = '018f4e10-0000-7000-8000-000000001011';
update snap_enrollment.snap_packets set county = 'Suffolk',   county_fips = '25025' where packet_id = '018f4e10-0000-7000-8000-000000001012';
update snap_enrollment.snap_packets set county = 'Middlesex', county_fips = '25017' where packet_id = '018f4e10-0000-7000-8000-000000001013';
update snap_enrollment.snap_packets set county = 'Hampden',   county_fips = '25013' where packet_id = '018f4e10-0000-7000-8000-000000001014';
update snap_enrollment.snap_packets set county = 'Bristol',   county_fips = '25005' where packet_id = '018f4e10-0000-7000-8000-000000001015';
update snap_enrollment.snap_packets set county = 'Norfolk',   county_fips = '25021' where packet_id = '018f4e10-0000-7000-8000-000000001016';
update snap_enrollment.snap_packets set county = 'Plymouth',  county_fips = '25023' where packet_id = '018f4e10-0000-7000-8000-000000001017';

-- Verify
select state_code, county, county_fips, count(*)
from snap_enrollment.snap_packets
where deleted_at is null
group by state_code, county, county_fips
order by state_code, county;
