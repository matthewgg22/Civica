-- 100-packet demo seed for Civica Navigator dashboard.
-- Auto-aligns org_id to your visible staff org (no follow-up snippet needed).
-- Idempotent (all inserts use ON CONFLICT DO NOTHING).
--
-- After running, refresh /dashboard and /packets:
--   • Funnel + buckets show real cohort counts (~10/15/20/15/10/25/5 by stage)
--   • Map shades 20+ CA counties weighted toward LA / SD / SF Bay
--   • Language donut shows en (25%) / es (33%) / vi (20%) / zh (22%)
--   • Document AI shows confidence stats across paystubs / IDs / leases / etc.
--   • Time-to-handoff sparkline trends across 60 days
--
-- Run via: Supabase Studio → SQL Editor → paste & run.

set local snap_enrollment.actor_kind = 'system';
set local snap_enrollment.actor_id   = '019e3274-f69d-7592-b9c2-3e574a6ded60';

-- ============================================================================
-- 1. APPLICANTS (60 unique, 4 languages — 15 en / 20 es / 12 vi / 13 zh)
-- ============================================================================
insert into snap_enrollment.applicants (applicant_id, state_code, full_name_ciphertext, preferred_language)
select
  ('019f0200-0000-7000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  'CA',
  'snap_v1::DEMO:' || (p.names)[idx],
  (p.langs)[idx]
from generate_series(1, 60) idx
cross join (select
  array[
    -- English (15)
    'Aisha Mahmoud','Marcus Brown','Priya Patel','Sarah Kim','David Smith',
    'Linda Park','Aaron Cohen','Jasmine Williams','Tyrone Jackson','Olivia Davis',
    'Maya Singh','Ethan Garcia','Hannah Lee','Samuel Ross','Grace Johnson',
    -- Spanish (20)
    'Carlos Mendez','Sofia Reyes','Maria Lopez','Jose Hernandez','Carmen Diaz',
    'Luis Ramirez','Ana Torres','Diego Vargas','Isabela Cruz','Miguel Soto',
    'Lucia Herrera','Pedro Rivera','Elena Castro','Hugo Morales','Andrea Jimenez',
    'Roberto Flores','Valentina Ortiz','Mateo Ruiz','Camila Vasquez','Javier Mendoza',
    -- Vietnamese (12)
    'Linh Nguyen','Hong Tran','Minh Pham','Thi Le','Anh Vu',
    'Quan Hoang','Mai Phan','Tuan Bui','Lan Do','Khanh Vo',
    'Phuong Ly','Nam Dang',
    -- Chinese (13)
    'David Chen','Wei Zhang','Mei Lin','Jun Wang','Hua Liu',
    'Xiao Wu','Yan Zhou','Ming Yang','Hui Sun','Bing Guo',
    'Ling Ma','Tao Xu','Fang He'
  ]::text[] as names,
  array[
    'en','en','en','en','en','en','en','en','en','en','en','en','en','en','en',
    'es','es','es','es','es','es','es','es','es','es','es','es','es','es','es','es','es','es','es','es',
    'vi','vi','vi','vi','vi','vi','vi','vi','vi','vi','vi','vi',
    'zh','zh','zh','zh','zh','zh','zh','zh','zh','zh','zh','zh','zh'
  ]::text[] as langs) p
on conflict (applicant_id) do nothing;

-- ============================================================================
-- 2. PACKETS (100, weighted by status and county)
--    Status mix: 10 Draft / 15 Submitted / 20 In Review / 10 Needs Docs /
--                5 Needs Clarification / 10 Ready / 25 Handed Off / 5 Closed
--    Counties: LA × 20, SD × 12, Orange × 9, SBer × 7, Riv × 6, SCl × 6,
--              Alameda × 6, Sac × 5, CC × 4, SF × 4, Fresno × 4, Kern × 3,
--              SMateo × 3, Ventura × 3, Stan × 2, Sonoma × 2, Tul/Mont/SJ/Marin × 1
-- ============================================================================
insert into snap_enrollment.snap_packets
  (packet_id, applicant_id, state_code, status, org_id, county, county_fips,
   submitted_at, handed_off_at, closed_at, created_at, updated_at)
select
  ('019f0300-0000-7000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  ('019f0200-0000-7000-8000-' || lpad(to_hex(1 + ((idx - 1) % 60)), 12, '0'))::uuid,
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
  case when (p.statuses)[idx] = 'Closed' then now() - (random() * interval '7 days') end,
  now() - (random() * interval '55 days' + interval '5 days'),
  now() - (random() * interval '10 days')
from generate_series(1, 100) idx
cross join (select
  array[
    'Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft',
    'Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review',
    'In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review',
    'Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents',
    'Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification',
    'Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff',
    'Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off',
    'Closed','Closed','Closed','Closed','Closed'
  ]::text[] as statuses,
  array[
    -- Los Angeles × 20
    'Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles',
    -- San Diego × 12
    'San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego',
    -- Orange × 9
    'Orange','Orange','Orange','Orange','Orange','Orange','Orange','Orange','Orange',
    -- San Bernardino × 7
    'San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino',
    -- Riverside × 6
    'Riverside','Riverside','Riverside','Riverside','Riverside','Riverside',
    -- Santa Clara × 6
    'Santa Clara','Santa Clara','Santa Clara','Santa Clara','Santa Clara','Santa Clara',
    -- Alameda × 6
    'Alameda','Alameda','Alameda','Alameda','Alameda','Alameda',
    -- Sacramento × 5
    'Sacramento','Sacramento','Sacramento','Sacramento','Sacramento',
    -- Contra Costa × 4
    'Contra Costa','Contra Costa','Contra Costa','Contra Costa',
    -- San Francisco × 4
    'San Francisco','San Francisco','San Francisco','San Francisco',
    -- Fresno × 4
    'Fresno','Fresno','Fresno','Fresno',
    -- Kern × 3
    'Kern','Kern','Kern',
    -- San Mateo × 3
    'San Mateo','San Mateo','San Mateo',
    -- Ventura × 3
    'Ventura','Ventura','Ventura',
    -- Stanislaus × 2, Sonoma × 2
    'Stanislaus','Stanislaus','Sonoma','Sonoma',
    -- Tulare, Monterey, San Joaquin, Marin × 1 each
    'Tulare','Monterey','San Joaquin','Marin'
  ]::text[] as counties,
  array[
    '06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037',
    '06073','06073','06073','06073','06073','06073','06073','06073','06073','06073','06073','06073',
    '06059','06059','06059','06059','06059','06059','06059','06059','06059',
    '06071','06071','06071','06071','06071','06071','06071',
    '06065','06065','06065','06065','06065','06065',
    '06085','06085','06085','06085','06085','06085',
    '06001','06001','06001','06001','06001','06001',
    '06067','06067','06067','06067','06067',
    '06013','06013','06013','06013',
    '06075','06075','06075','06075',
    '06019','06019','06019','06019',
    '06029','06029','06029',
    '06081','06081','06081',
    '06111','06111','06111',
    '06099','06099','06097','06097',
    '06107','06053','06077','06041'
  ]::text[] as fips
) p
on conflict (packet_id) do nothing;

-- ============================================================================
-- 3. ANSWERS (6 per packet for 25 non-Draft packets = 150 answer rows)
-- ============================================================================
insert into snap_enrollment.packet_answers
  (answer_id, packet_id, question_key, question_label, applicant_answer, answer_source)
select
  ('019f0400-0000-7000-8000-' || lpad(to_hex((p_idx - 1) * 6 + q.q_idx), 12, '0'))::uuid,
  ('019f0300-0000-7000-8000-' || lpad(to_hex(10 + p_idx), 12, '0'))::uuid,  -- skip first 10 Drafts
  q.question_key,
  q.question_label,
  'snap_v1::DEMO:' || q.demo_value,
  case when q.q_idx in (2,3) then 'ocr_extraction' else 'applicant_input' end
from generate_series(1, 25) p_idx
cross join (values
  (1, 'household_size',    'How many people live in your household?',     '3'),
  (2, 'monthly_income',    'Total household income (monthly)',            '$2,100'),
  (3, 'monthly_rent',      'Monthly rent or mortgage',                    '$1,450'),
  (4, 'has_children',      'Children under 18 in household?',             'Yes, 1 child'),
  (5, 'employment_status', 'Current employment status',                   'Part-time, retail'),
  (6, 'has_disability',    'Anyone in household with a disability?',      'No')
) as q(q_idx, question_key, question_label, demo_value)
on conflict (packet_id, question_key) do nothing;

-- ============================================================================
-- 4. UPLOADED DOCUMENTS (3 per packet for 30 packets = 90 docs)
--    with realistic classification confidence (range 0.60–0.99)
-- ============================================================================
insert into snap_enrollment.uploaded_documents
  (document_id, packet_id, applicant_id, storage_path, original_filename,
   document_kind, classification_confidence, processing_status, uploaded_at)
select
  ('019f0500-0000-7000-8000-' || lpad(to_hex((p_idx - 1) * 3 + d.d_idx), 12, '0'))::uuid,
  ('019f0300-0000-7000-8000-' || lpad(to_hex(10 + p_idx), 12, '0'))::uuid,
  ('019f0200-0000-7000-8000-' || lpad(to_hex(1 + ((9 + p_idx) % 60)), 12, '0'))::uuid,
  'demo/p' || p_idx || '_' || d.d_idx || '.' || d.ext,
  d.filename,
  d.kind::snap_enrollment.document_kind,
  d.conf,
  d.status,
  now() - (random() * interval '20 days' + interval '1 day')
from generate_series(1, 30) p_idx
cross join (values
  (1, 'paystub_april.jpg', 'jpg', 'paystub',      0.94, 'confirmed'),
  (2, 'photo_id.jpg',      'jpg', 'photo_id',     0.97, 'confirmed'),
  (3, 'lease_signed.pdf',  'pdf', 'lease',        0.86, 'awaiting_confirmation')
) as d(d_idx, filename, ext, kind, conf, status)
on conflict (document_id) do nothing;

-- ============================================================================
-- 5. SOME ADDITIONAL DOCS (utility bills + bank statements for variety)
-- ============================================================================
insert into snap_enrollment.uploaded_documents
  (document_id, packet_id, applicant_id, storage_path, original_filename,
   document_kind, classification_confidence, processing_status, uploaded_at)
select
  ('019f0501-0000-7000-8000-' || lpad(to_hex(p_idx), 12, '0'))::uuid,
  ('019f0300-0000-7000-8000-' || lpad(to_hex(10 + p_idx), 12, '0'))::uuid,
  ('019f0200-0000-7000-8000-' || lpad(to_hex(1 + ((9 + p_idx) % 60)), 12, '0'))::uuid,
  'demo/util_' || p_idx || '.pdf',
  'utility_bill.pdf',
  case when p_idx % 3 = 0 then 'bank_statement' else 'utility_bill' end::snap_enrollment.document_kind,
  0.60 + (random() * 0.35),
  case when p_idx % 5 = 0 then 'awaiting_confirmation' else 'confirmed' end,
  now() - (random() * interval '15 days')
from generate_series(1, 20) p_idx
on conflict (document_id) do nothing;

-- ============================================================================
-- 6. STATUS HISTORY (a few rows per handed-off packet to make the audit trail
--    rich on those packet detail pages)
-- ============================================================================
insert into snap_enrollment.packet_status_history
  (history_id, packet_id, from_status, to_status, changed_by_staff_id, occurred_at, reason)
select
  ('019f0600-0000-7000-8000-' || lpad(to_hex((p_idx - 1) * 5 + h.h_idx), 12, '0'))::uuid,
  ('019f0300-0000-7000-8000-' || lpad(to_hex(70 + p_idx), 12, '0'))::uuid,  -- packets 71–90 are Handed Off
  h.from_status::snap_enrollment.packet_status,
  h.to_status::snap_enrollment.packet_status,
  null,
  now() - (interval '30 days' - (h.h_idx * interval '6 days')),
  h.reason
from generate_series(1, 20) p_idx
cross join (values
  (1, null,                    'Draft',                'started by applicant'),
  (2, 'Draft',                 'Submitted for Review', 'submitted via mobile app'),
  (3, 'Submitted for Review',  'In Navigator Review',  'pulled from queue'),
  (4, 'In Navigator Review',   'Ready for Handoff',    'all verifications complete'),
  (5, 'Ready for Handoff',     'Handed Off',           'submitted to county office')
) as h(h_idx, from_status, to_status, reason)
on conflict (history_id) do nothing;

-- ============================================================================
-- Verify
-- ============================================================================
select
  (select count(*) from snap_enrollment.applicants where applicant_id::text like '019f0200-%') as applicants_seeded,
  (select count(*) from snap_enrollment.snap_packets where packet_id::text like '019f0300-%') as packets_seeded,
  (select count(*) from snap_enrollment.packet_answers where answer_id::text like '019f0400-%') as answers_seeded,
  (select count(*) from snap_enrollment.uploaded_documents where document_id::text like '019f050%') as docs_seeded,
  (select count(*) from snap_enrollment.packet_status_history where history_id::text like '019f0600-%') as history_seeded,
  (select count(distinct county_fips) from snap_enrollment.snap_packets where packet_id::text like '019f0300-%') as distinct_counties,
  (select count(distinct preferred_language) from snap_enrollment.applicants where applicant_id::text like '019f0200-%') as distinct_languages;

-- Status distribution check
select status, count(*)
from snap_enrollment.snap_packets
where packet_id::text like '019f0300-%'
group by status
order by count(*) desc;
