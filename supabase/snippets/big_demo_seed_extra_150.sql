-- +150 extension seed (run AFTER big_demo_seed_100.sql) to reach 250 total packets.
-- Adds 30 new applicants (so 90 distinct names) and 150 new packets with
-- a different UUID prefix (019f0301) to avoid collision.
--
-- Status mix for the +150: 15 Draft / 22 Submitted / 30 In Review / 15 Needs Docs /
--                          8 Needs Clarification / 15 Ready / 37 Handed Off / 8 Closed = 150
--
-- Run via: Supabase Studio → SQL Editor → paste & run. Idempotent.

set local snap_enrollment.actor_kind = 'system';
set local snap_enrollment.actor_id   = '019e3274-f69d-7592-b9c2-3e574a6ded60';

-- ============================================================================
-- 1. 30 ADDITIONAL APPLICANTS (cumulative: 90 distinct names)
-- ============================================================================
insert into snap_enrollment.applicants (applicant_id, state_code, full_name_ciphertext, preferred_language)
select
  ('019f0201-0000-7000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  'CA',
  'snap_v1::DEMO:' || (p.names)[idx],
  (p.langs)[idx]
from generate_series(1, 30) idx
cross join (select
  array[
    -- English (8)
    'Imani Wright','Devon Powell','Rachel Cohen','Trevor Mills','Sage Bennett',
    'Naomi Foster','Brandon Hall','Sienna Wood',
    -- Spanish (10)
    'Esteban Ruiz','Paloma Vega','Mateo Salazar','Daniela Romero','Adrian Cabrera',
    'Renata Aguilar','Ignacio Pena','Mariana Solis','Fernando Cruz','Bianca Navarro',
    -- Vietnamese (6)
    'Bao Truong','Hieu Dinh','Trang Cao','Thanh Mai','Vinh Ngo','Yen Doan',
    -- Chinese (6)
    'Lei Cheng','Qiang Huang','Jing Tang','Xin Liang','Rong Feng','Hao Jiang'
  ]::text[] as names,
  array[
    'en','en','en','en','en','en','en','en',
    'es','es','es','es','es','es','es','es','es','es',
    'vi','vi','vi','vi','vi','vi',
    'zh','zh','zh','zh','zh','zh'
  ]::text[] as langs) p
on conflict (applicant_id) do nothing;

-- ============================================================================
-- 2. +150 PACKETS — different UUID prefix (019f0301), cycle across all 90 applicants
-- ============================================================================
insert into snap_enrollment.snap_packets
  (packet_id, applicant_id, state_code, status, org_id, county, county_fips,
   submitted_at, handed_off_at, closed_at, created_at, updated_at)
select
  ('019f0301-0000-7000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  -- Cycle across the 90 applicants (first 60 use 019f0200 prefix, next 30 use 019f0201)
  case when ((idx - 1) % 90) < 60
       then ('019f0200-0000-7000-8000-' || lpad(to_hex(1 + ((idx - 1) % 90)), 12, '0'))::uuid
       else ('019f0201-0000-7000-8000-' || lpad(to_hex(1 + ((idx - 1) % 90) - 60), 12, '0'))::uuid
  end,
  'CA',
  (p.statuses)[idx]::snap_enrollment.packet_status,
  (select sp.org_id from snap_enrollment.snap_packets sp
     where sp.state_code = 'CA' and sp.deleted_at is null and sp.org_id is not null
     limit 1),
  (p.counties)[idx],
  (p.fips)[idx],
  case when (p.statuses)[idx] = 'Draft' then null
       else now() - (random() * interval '45 days' + interval '3 days') end,
  case when (p.statuses)[idx] in ('Handed Off', 'Closed')
       then now() - (random() * interval '25 days' + interval '1 day') end,
  case when (p.statuses)[idx] = 'Closed' then now() - (random() * interval '8 days') end,
  now() - (random() * interval '58 days' + interval '5 days'),
  now() - (random() * interval '14 days')
from generate_series(1, 150) idx
cross join (select
  -- 150-element status pool
  array[
    -- Draft × 15
    'Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft','Draft',
    -- Submitted for Review × 22
    'Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review','Submitted for Review',
    -- In Navigator Review × 30
    'In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review','In Navigator Review',
    -- Needs Documents × 15
    'Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents','Needs Documents',
    -- Needs Applicant Clarification × 8
    'Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification','Needs Applicant Clarification',
    -- Ready for Handoff × 15
    'Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff','Ready for Handoff',
    -- Handed Off × 37
    'Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off','Handed Off',
    -- Closed × 8
    'Closed','Closed','Closed','Closed','Closed','Closed','Closed','Closed'
  ]::text[] as statuses,
  -- 150-element county pool. Heavier on populous counties + some new less-common ones.
  array[
    -- LA × 30
    'Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles','Los Angeles',
    -- San Diego × 16
    'San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego','San Diego',
    -- Orange × 12
    'Orange','Orange','Orange','Orange','Orange','Orange','Orange','Orange','Orange','Orange','Orange','Orange',
    -- San Bernardino × 10
    'San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino','San Bernardino',
    -- Riverside × 10
    'Riverside','Riverside','Riverside','Riverside','Riverside','Riverside','Riverside','Riverside','Riverside','Riverside',
    -- Santa Clara × 9
    'Santa Clara','Santa Clara','Santa Clara','Santa Clara','Santa Clara','Santa Clara','Santa Clara','Santa Clara','Santa Clara',
    -- Alameda × 8
    'Alameda','Alameda','Alameda','Alameda','Alameda','Alameda','Alameda','Alameda',
    -- Sacramento × 8
    'Sacramento','Sacramento','Sacramento','Sacramento','Sacramento','Sacramento','Sacramento','Sacramento',
    -- Contra Costa × 6
    'Contra Costa','Contra Costa','Contra Costa','Contra Costa','Contra Costa','Contra Costa',
    -- San Francisco × 6
    'San Francisco','San Francisco','San Francisco','San Francisco','San Francisco','San Francisco',
    -- Fresno × 6
    'Fresno','Fresno','Fresno','Fresno','Fresno','Fresno',
    -- Kern × 5
    'Kern','Kern','Kern','Kern','Kern',
    -- San Mateo × 4
    'San Mateo','San Mateo','San Mateo','San Mateo',
    -- Ventura × 4
    'Ventura','Ventura','Ventura','Ventura',
    -- Stanislaus × 3, Sonoma × 3
    'Stanislaus','Stanislaus','Stanislaus','Sonoma','Sonoma','Sonoma',
    -- New counties for variety
    'Tulare','Tulare','Monterey','Monterey','San Joaquin','San Joaquin','Marin','Solano','Solano','Yolo','Santa Cruz','Imperial'
  ]::text[] as counties,
  array[
    -- LA 06037 × 30
    '06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037','06037',
    -- SD 06073 × 16
    '06073','06073','06073','06073','06073','06073','06073','06073','06073','06073','06073','06073','06073','06073','06073','06073',
    -- Orange 06059 × 12
    '06059','06059','06059','06059','06059','06059','06059','06059','06059','06059','06059','06059',
    -- SBer 06071 × 10
    '06071','06071','06071','06071','06071','06071','06071','06071','06071','06071',
    -- Riv 06065 × 10
    '06065','06065','06065','06065','06065','06065','06065','06065','06065','06065',
    -- SCl 06085 × 9
    '06085','06085','06085','06085','06085','06085','06085','06085','06085',
    -- Alameda 06001 × 8
    '06001','06001','06001','06001','06001','06001','06001','06001',
    -- Sac 06067 × 8
    '06067','06067','06067','06067','06067','06067','06067','06067',
    -- CC 06013 × 6
    '06013','06013','06013','06013','06013','06013',
    -- SF 06075 × 6
    '06075','06075','06075','06075','06075','06075',
    -- Fresno 06019 × 6
    '06019','06019','06019','06019','06019','06019',
    -- Kern 06029 × 5
    '06029','06029','06029','06029','06029',
    -- SMateo 06081 × 4
    '06081','06081','06081','06081',
    -- Ventura 06111 × 4
    '06111','06111','06111','06111',
    -- Stan 06099 × 3, Sonoma 06097 × 3
    '06099','06099','06099','06097','06097','06097',
    -- Tul 06107 × 2, Mont 06053 × 2, SJ 06077 × 2, Marin 06041, Solano 06095 × 2, Yolo 06113, Santa Cruz 06087, Imperial 06025
    '06107','06107','06053','06053','06077','06077','06041','06095','06095','06113','06087','06025'
  ]::text[] as fips
) p
on conflict (packet_id) do nothing;

-- ============================================================================
-- 3. ANSWERS — extend coverage to 40 more packets from the new batch
-- ============================================================================
insert into snap_enrollment.packet_answers
  (answer_id, packet_id, question_key, question_label, applicant_answer, answer_source)
select
  ('019f0401-0000-7000-8000-' || lpad(to_hex((p_idx - 1) * 6 + q.q_idx), 12, '0'))::uuid,
  ('019f0301-0000-7000-8000-' || lpad(to_hex(15 + p_idx), 12, '0'))::uuid,  -- skip first 15 Drafts
  q.question_key,
  q.question_label,
  'snap_v1::DEMO:' || q.demo_value,
  case when q.q_idx in (2,3) then 'ocr_extraction' else 'applicant_input' end
from generate_series(1, 40) p_idx
cross join (values
  (1, 'household_size',    'How many people live in your household?',     '4'),
  (2, 'monthly_income',    'Total household income (monthly)',            '$2,650'),
  (3, 'monthly_rent',      'Monthly rent or mortgage',                    '$1,800'),
  (4, 'has_children',      'Children under 18 in household?',             'Yes, 2 children'),
  (5, 'employment_status', 'Current employment status',                   'Full-time, food service'),
  (6, 'has_disability',    'Anyone in household with a disability?',      'No')
) as q(q_idx, question_key, question_label, demo_value)
on conflict (packet_id, question_key) do nothing;

-- ============================================================================
-- 4. UPLOADED DOCUMENTS — 3 per packet for 60 more packets = 180 docs
-- ============================================================================
insert into snap_enrollment.uploaded_documents
  (document_id, packet_id, applicant_id, storage_path, original_filename,
   document_kind, classification_confidence, processing_status, uploaded_at)
select
  ('019f0502-0000-7000-8000-' || lpad(to_hex((p_idx - 1) * 3 + d.d_idx), 12, '0'))::uuid,
  ('019f0301-0000-7000-8000-' || lpad(to_hex(15 + p_idx), 12, '0'))::uuid,
  case when ((14 + p_idx) % 90) < 60
       then ('019f0200-0000-7000-8000-' || lpad(to_hex(1 + ((14 + p_idx) % 90)), 12, '0'))::uuid
       else ('019f0201-0000-7000-8000-' || lpad(to_hex(1 + ((14 + p_idx) % 90) - 60), 12, '0'))::uuid
  end,
  'demo/p2_' || p_idx || '_' || d.d_idx || '.' || d.ext,
  d.filename,
  d.kind::snap_enrollment.document_kind,
  d.conf,
  d.status,
  now() - (random() * interval '25 days' + interval '1 day')
from generate_series(1, 60) p_idx
cross join (values
  (1, 'paystub_may.jpg',  'jpg', 'paystub',        0.91, 'confirmed'),
  (2, 'state_id.jpg',     'jpg', 'photo_id',       0.96, 'confirmed'),
  (3, 'utility_bill.pdf', 'pdf', 'utility_bill',   0.83, 'confirmed')
) as d(d_idx, filename, ext, kind, conf, status)
on conflict (document_id) do nothing;

-- ============================================================================
-- 5. STATUS HISTORY for new handed-off packets
-- ============================================================================
insert into snap_enrollment.packet_status_history
  (history_id, packet_id, from_status, to_status, changed_by_staff_id, occurred_at, reason)
select
  ('019f0601-0000-7000-8000-' || lpad(to_hex((p_idx - 1) * 5 + h.h_idx), 12, '0'))::uuid,
  -- Handed Off packets in the +150 batch start at index 113 (15+22+30+15+8+15+1 = 106... let me recompute)
  -- Status pool: 15 Draft (1-15), 22 Submitted (16-37), 30 In Review (38-67), 15 Needs Docs (68-82),
  --              8 Needs Clarification (83-90), 15 Ready (91-105), 37 Handed Off (106-142), 8 Closed (143-150)
  ('019f0301-0000-7000-8000-' || lpad(to_hex(105 + p_idx), 12, '0'))::uuid,
  h.from_status::snap_enrollment.packet_status,
  h.to_status::snap_enrollment.packet_status,
  null,
  now() - (interval '35 days' - (h.h_idx * interval '7 days')),
  h.reason
from generate_series(1, 30) p_idx
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
  (select count(*) from snap_enrollment.applicants where applicant_id::text like '019f020%') as total_applicants_in_seed,
  (select count(*) from snap_enrollment.snap_packets where packet_id::text like '019f030%') as total_packets_in_seed,
  (select count(distinct county_fips) from snap_enrollment.snap_packets where packet_id::text like '019f030%') as distinct_counties,
  (select count(distinct preferred_language) from snap_enrollment.applicants where applicant_id::text like '019f020%') as distinct_languages;

select status, count(*)
from snap_enrollment.snap_packets
where packet_id::text like '019f030%'
group by status
order by count(*) desc;
