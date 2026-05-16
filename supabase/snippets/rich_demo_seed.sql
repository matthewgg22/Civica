-- Rich demo seed: adds diverse applicants (4 languages), varied packets, packet_answers,
-- uploaded_documents (with confidence scores), navigator_notes, and audit history.
--
-- Purpose: light up every dashboard widget for a confident demo —
--   • Language Equity donut shows 4 slices (en, es, vi, zh)
--   • Document AI shows real auto-extracted % + confidence
--   • Funnel / audit trail have realistic timestamps
--   • Packet detail pages have answers + notes + history (no more empty states)
--
-- Run via: Supabase Studio → SQL Editor → paste & run.
-- Idempotent: all inserts use ON CONFLICT DO NOTHING with deterministic UUIDs.

-- Set system actor for audit triggers
set local snap_enrollment.actor_kind = 'system';
set local snap_enrollment.actor_id   = '018f4e10-0000-7000-8000-000000000021';

-- ───────────────────────────────────────────────────────────────────────────
-- 0. Bootstrap org / role / staff dependencies (no-op if they already exist)
--    Required because packets FK org_id and notes FK staff_id.
-- ───────────────────────────────────────────────────────────────────────────
insert into snap_enrollment.staff_orgs (org_id, name, state_code, website) values
  ('018f4e10-0000-7000-8000-000000000001', 'Bay Area Community Action', 'CA', 'https://baca.example.org')
on conflict (org_id) do nothing;

insert into snap_enrollment.staff_roles (role_id, org_id, role_kind, label, can_view_pii, can_export, can_override_status) values
  ('018f4e10-0000-7000-8000-000000000010', '018f4e10-0000-7000-8000-000000000001', 'navigator', 'Case Manager',     true, false, false),
  ('018f4e10-0000-7000-8000-000000000011', '018f4e10-0000-7000-8000-000000000001', 'admin',     'Program Director', true, true,  true)
on conflict (role_id) do nothing;

-- NOTE: staff_users.auth_uid is NOT NULL with FK to auth.users, so we can't seed
-- fake staff. Notes below use a cross-join against whichever staff user already
-- exists in the DB (typically the demo navigator account you set up earlier).
-- If no staff_users exist, the notes insert is a no-op (zero rows).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Diverse applicants spanning all 4 supported languages
-- ───────────────────────────────────────────────────────────────────────────
insert into snap_enrollment.applicants (applicant_id, state_code, full_name_ciphertext, preferred_language) values
  ('018f4e10-0000-7000-8000-000000000200', 'CA', 'snap_v1::DEMO:Aisha Mahmoud',  'en'),
  ('018f4e10-0000-7000-8000-000000000201', 'CA', 'snap_v1::DEMO:David Chen',     'zh'),
  ('018f4e10-0000-7000-8000-000000000202', 'CA', 'snap_v1::DEMO:Linh Nguyen',    'vi'),
  ('018f4e10-0000-7000-8000-000000000203', 'CA', 'snap_v1::DEMO:Carlos Mendez',  'es'),
  ('018f4e10-0000-7000-8000-000000000204', 'CA', 'snap_v1::DEMO:Priya Patel',    'en'),
  ('018f4e10-0000-7000-8000-000000000205', 'CA', 'snap_v1::DEMO:Hong Tran',      'vi'),
  ('018f4e10-0000-7000-8000-000000000206', 'CA', 'snap_v1::DEMO:Sofia Reyes',    'es'),
  ('018f4e10-0000-7000-8000-000000000207', 'CA', 'snap_v1::DEMO:Wei Zhang',      'zh'),
  ('018f4e10-0000-7000-8000-000000000208', 'CA', 'snap_v1::DEMO:Marcus Brown',   'en')
on conflict (applicant_id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Packets across diverse counties + statuses, with realistic lifecycle timestamps
-- ───────────────────────────────────────────────────────────────────────────
insert into snap_enrollment.snap_packets
  (packet_id, applicant_id, state_code, status, org_id, county, county_fips, submitted_at, handed_off_at, created_at, updated_at)
values
  ('018f4e10-0000-7000-8000-000000002001', '018f4e10-0000-7000-8000-000000000200', 'CA', 'Handed Off',          '018f4e10-0000-7000-8000-000000000001', 'Alameda',       '06001', now() - interval '12 days', now() - interval '5 days',  now() - interval '15 days', now() - interval '5 days'),
  ('018f4e10-0000-7000-8000-000000002002', '018f4e10-0000-7000-8000-000000000201', 'CA', 'Handed Off',          '018f4e10-0000-7000-8000-000000000001', 'San Francisco', '06075', now() - interval '10 days', now() - interval '4 days',  now() - interval '14 days', now() - interval '4 days'),
  ('018f4e10-0000-7000-8000-000000002003', '018f4e10-0000-7000-8000-000000000202', 'CA', 'Ready for Handoff',   '018f4e10-0000-7000-8000-000000000001', 'Santa Clara',   '06085', now() - interval '8 days',  null,                       now() - interval '11 days', now() - interval '2 days'),
  ('018f4e10-0000-7000-8000-000000002004', '018f4e10-0000-7000-8000-000000000203', 'CA', 'In Navigator Review', '018f4e10-0000-7000-8000-000000000001', 'Los Angeles',   '06037', now() - interval '5 days',  null,                       now() - interval '7 days',  now() - interval '1 days'),
  ('018f4e10-0000-7000-8000-000000002005', '018f4e10-0000-7000-8000-000000000204', 'CA', 'Submitted for Review','018f4e10-0000-7000-8000-000000000001', 'San Diego',     '06073', now() - interval '2 days',  null,                       now() - interval '4 days',  now() - interval '2 days'),
  ('018f4e10-0000-7000-8000-000000002006', '018f4e10-0000-7000-8000-000000000205', 'CA', 'Needs Documents',     '018f4e10-0000-7000-8000-000000000001', 'Orange',        '06059', now() - interval '3 days',  null,                       now() - interval '6 days',  now() - interval '3 hours'),
  ('018f4e10-0000-7000-8000-000000002007', '018f4e10-0000-7000-8000-000000000206', 'CA', 'In Navigator Review', '018f4e10-0000-7000-8000-000000000001', 'Sacramento',    '06067', now() - interval '4 days',  null,                       now() - interval '6 days',  now() - interval '6 hours'),
  ('018f4e10-0000-7000-8000-000000002008', '018f4e10-0000-7000-8000-000000000207', 'CA', 'Handed Off',          '018f4e10-0000-7000-8000-000000000001', 'Fresno',        '06019', now() - interval '9 days',  now() - interval '2 days',  now() - interval '12 days', now() - interval '2 days'),
  ('018f4e10-0000-7000-8000-000000002009', '018f4e10-0000-7000-8000-000000000208', 'CA', 'Draft',               '018f4e10-0000-7000-8000-000000000001', 'Riverside',     '06065', null,                       null,                       now() - interval '1 days',  now() - interval '1 hours')
on conflict (packet_id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Application answers for submitted+ packets (so packet detail isn't empty)
-- ───────────────────────────────────────────────────────────────────────────
insert into snap_enrollment.packet_answers
  (answer_id, packet_id, question_key, question_label, applicant_answer, answer_source)
values
  -- Carlos Mendez packet (In Navigator Review)
  ('018f4e10-0000-7000-8000-000000003001', '018f4e10-0000-7000-8000-000000002004', 'household_size',     'How many people live in your household?', 'snap_v1::DEMO:4',                            'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003002', '018f4e10-0000-7000-8000-000000002004', 'monthly_income',     'Total household income (monthly)',         'snap_v1::DEMO:$2,400',                       'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003003', '018f4e10-0000-7000-8000-000000002004', 'monthly_rent',       'Monthly rent or mortgage',                 'snap_v1::DEMO:$1,650',                       'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003004', '018f4e10-0000-7000-8000-000000002004', 'has_children',       'Children under 18 in household?',           'snap_v1::DEMO:Yes, 2 children',              'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003005', '018f4e10-0000-7000-8000-000000002004', 'employment_status',  'Current employment status',                 'snap_v1::DEMO:Part-time, hospitality',       'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003006', '018f4e10-0000-7000-8000-000000002004', 'has_disability',     'Anyone in household with a disability?',    'snap_v1::DEMO:No',                           'applicant_input'),
  -- Priya Patel packet (Submitted for Review)
  ('018f4e10-0000-7000-8000-000000003011', '018f4e10-0000-7000-8000-000000002005', 'household_size',     'How many people live in your household?', 'snap_v1::DEMO:2',                            'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003012', '018f4e10-0000-7000-8000-000000002005', 'monthly_income',     'Total household income (monthly)',         'snap_v1::DEMO:$1,850',                       'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003013', '018f4e10-0000-7000-8000-000000002005', 'monthly_rent',       'Monthly rent or mortgage',                 'snap_v1::DEMO:$1,200',                       'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003014', '018f4e10-0000-7000-8000-000000002005', 'has_children',       'Children under 18 in household?',           'snap_v1::DEMO:No',                           'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003015', '018f4e10-0000-7000-8000-000000002005', 'employment_status',  'Current employment status',                 'snap_v1::DEMO:Full-time, retail',            'applicant_input'),
  -- Sofia Reyes packet (In Navigator Review)
  ('018f4e10-0000-7000-8000-000000003021', '018f4e10-0000-7000-8000-000000002007', 'household_size',     'How many people live in your household?', 'snap_v1::DEMO:3',                            'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003022', '018f4e10-0000-7000-8000-000000002007', 'monthly_income',     'Total household income (monthly)',         'snap_v1::DEMO:$2,100',                       'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003023', '018f4e10-0000-7000-8000-000000002007', 'monthly_rent',       'Monthly rent or mortgage',                 'snap_v1::DEMO:$1,450',                       'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003024', '018f4e10-0000-7000-8000-000000002007', 'has_children',       'Children under 18 in household?',           'snap_v1::DEMO:Yes, 1 child',                 'applicant_input'),
  -- Linh Nguyen packet (Ready for Handoff) — fully reviewed
  ('018f4e10-0000-7000-8000-000000003031', '018f4e10-0000-7000-8000-000000002003', 'household_size',     'How many people live in your household?', 'snap_v1::DEMO:1',                            'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003032', '018f4e10-0000-7000-8000-000000002003', 'monthly_income',     'Total household income (monthly)',         'snap_v1::DEMO:$1,400',                       'ocr_extraction'),
  ('018f4e10-0000-7000-8000-000000003033', '018f4e10-0000-7000-8000-000000002003', 'monthly_rent',       'Monthly rent or mortgage',                 'snap_v1::DEMO:$900',                         'applicant_input'),
  ('018f4e10-0000-7000-8000-000000003034', '018f4e10-0000-7000-8000-000000002003', 'employment_status',  'Current employment status',                 'snap_v1::DEMO:Self-employed, nail technician','applicant_input')
on conflict (packet_id, question_key) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Uploaded documents with realistic classification confidence
--    (Document AI panel needs these to show stats)
-- ───────────────────────────────────────────────────────────────────────────
insert into snap_enrollment.uploaded_documents
  (document_id, packet_id, applicant_id, storage_path, original_filename, document_kind, classification_confidence, processing_status, uploaded_at)
values
  -- Carlos Mendez packet
  ('018f4e10-0000-7000-8000-000000004001', '018f4e10-0000-7000-8000-000000002004', '018f4e10-0000-7000-8000-000000000203', 'demo/pay_stub_4001.jpg',  'pay_stub_april.jpg',     'paystub',     0.940, 'confirmed',             now() - interval '4 days'),
  ('018f4e10-0000-7000-8000-000000004002', '018f4e10-0000-7000-8000-000000002004', '018f4e10-0000-7000-8000-000000000203', 'demo/id_4002.jpg',        'drivers_license.jpg',    'photo_id',     0.987, 'confirmed',             now() - interval '4 days'),
  ('018f4e10-0000-7000-8000-000000004003', '018f4e10-0000-7000-8000-000000002004', '018f4e10-0000-7000-8000-000000000203', 'demo/lease_4003.pdf',     'apartment_lease.pdf',    'lease',        0.910, 'confirmed',             now() - interval '3 days'),
  -- Linh Nguyen packet
  ('018f4e10-0000-7000-8000-000000004011', '018f4e10-0000-7000-8000-000000002003', '018f4e10-0000-7000-8000-000000000202', 'demo/pay_stub_4011.jpg',  'tax_form_1099.jpg',      'paystub',     0.880, 'confirmed',             now() - interval '7 days'),
  ('018f4e10-0000-7000-8000-000000004012', '018f4e10-0000-7000-8000-000000002003', '018f4e10-0000-7000-8000-000000000202', 'demo/utility_4012.pdf',   'pge_bill_jan.pdf',       'utility_bill', 0.950, 'confirmed',             now() - interval '6 days'),
  -- Priya Patel packet
  ('018f4e10-0000-7000-8000-000000004021', '018f4e10-0000-7000-8000-000000002005', '018f4e10-0000-7000-8000-000000000204', 'demo/pay_stub_4021.jpg',  'paystub_target.jpg',     'paystub',     0.720, 'awaiting_confirmation', now() - interval '2 days'),
  ('018f4e10-0000-7000-8000-000000004022', '018f4e10-0000-7000-8000-000000002005', '018f4e10-0000-7000-8000-000000000204', 'demo/id_4022.jpg',        'state_id.jpg',           'photo_id',     0.965, 'confirmed',             now() - interval '2 days'),
  -- Sofia Reyes packet
  ('018f4e10-0000-7000-8000-000000004031', '018f4e10-0000-7000-8000-000000002007', '018f4e10-0000-7000-8000-000000000206', 'demo/utility_4031.pdf',   'water_bill.pdf',         'utility_bill', 0.920, 'confirmed',             now() - interval '4 days'),
  ('018f4e10-0000-7000-8000-000000004032', '018f4e10-0000-7000-8000-000000002007', '018f4e10-0000-7000-8000-000000000206', 'demo/pay_stub_4032.jpg',  'paycheck_3_28.jpg',      'paystub',     0.610, 'awaiting_confirmation', now() - interval '4 days'),
  ('018f4e10-0000-7000-8000-000000004033', '018f4e10-0000-7000-8000-000000002007', '018f4e10-0000-7000-8000-000000000206', 'demo/other_4033.pdf',     'random_scan.pdf',        'other',        0.430, 'rejected',              now() - interval '3 days')
on conflict (document_id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Navigator notes — use ANY existing staff member as the author
-- ───────────────────────────────────────────────────────────────────────────
insert into snap_enrollment.navigator_notes
  (note_id, packet_id, author_staff_id, body_ciphertext, is_internal, created_at)
select v.note_id::uuid, v.packet_id::uuid, su.staff_id, v.body, v.is_internal, v.created_at
from (values
  ('018f4e10-0000-7000-8000-000000005001', '018f4e10-0000-7000-8000-000000002004', 'snap_v1::DEMO:Verified income via paystub. Household composition matches lease.', true,  now() - interval '2 days'),
  ('018f4e10-0000-7000-8000-000000005002', '018f4e10-0000-7000-8000-000000002004', 'snap_v1::DEMO:Spoke with applicant in Spanish — confirmed dependent count.',     true,  now() - interval '1 days'),
  ('018f4e10-0000-7000-8000-000000005003', '018f4e10-0000-7000-8000-000000002007', 'snap_v1::DEMO:Awaiting clearer paystub upload — current image is blurry.',       false, now() - interval '6 hours'),
  ('018f4e10-0000-7000-8000-000000005004', '018f4e10-0000-7000-8000-000000002003', 'snap_v1::DEMO:All docs verified. Ready to submit to Santa Clara County office.', true,  now() - interval '2 days')
) as v(note_id, packet_id, body, is_internal, created_at)
cross join (select staff_id from snap_enrollment.staff_users limit 1) as su
on conflict (note_id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Audit trail / packet_status_history (one row per transition)
-- ───────────────────────────────────────────────────────────────────────────
insert into snap_enrollment.packet_status_history
  (history_id, packet_id, from_status, to_status, changed_by_staff_id, occurred_at, reason)
values
  -- Handed-off packets get full lifecycle
  ('018f4e10-0000-7000-8000-000000006001', '018f4e10-0000-7000-8000-000000002001', null,                   'Draft',                null, now() - interval '15 days', null),
  ('018f4e10-0000-7000-8000-000000006002', '018f4e10-0000-7000-8000-000000002001', 'Draft',                'Submitted for Review', null, now() - interval '12 days', null),
  ('018f4e10-0000-7000-8000-000000006003', '018f4e10-0000-7000-8000-000000002001', 'Submitted for Review', 'In Navigator Review',  null, now() - interval '10 days', 'Pulled from queue'),
  ('018f4e10-0000-7000-8000-000000006004', '018f4e10-0000-7000-8000-000000002001', 'In Navigator Review',  'Ready for Handoff',    null, now() - interval '7 days',  'All verifications complete'),
  ('018f4e10-0000-7000-8000-000000006005', '018f4e10-0000-7000-8000-000000002001', 'Ready for Handoff',    'Handed Off',           null, now() - interval '5 days',  'Submitted to Alameda County'),
  -- Ready-for-Handoff packet
  ('018f4e10-0000-7000-8000-000000006011', '018f4e10-0000-7000-8000-000000002003', null,                   'Draft',                null, now() - interval '11 days', null),
  ('018f4e10-0000-7000-8000-000000006012', '018f4e10-0000-7000-8000-000000002003', 'Draft',                'Submitted for Review', null, now() - interval '8 days',  null),
  ('018f4e10-0000-7000-8000-000000006013', '018f4e10-0000-7000-8000-000000002003', 'Submitted for Review', 'In Navigator Review',  null, now() - interval '6 days',  null),
  ('018f4e10-0000-7000-8000-000000006014', '018f4e10-0000-7000-8000-000000002003', 'In Navigator Review',  'Ready for Handoff',    null, now() - interval '2 days',  'Docs verified'),
  -- In-Navigator-Review packet
  ('018f4e10-0000-7000-8000-000000006021', '018f4e10-0000-7000-8000-000000002004', null,                   'Draft',                null, now() - interval '7 days',  null),
  ('018f4e10-0000-7000-8000-000000006022', '018f4e10-0000-7000-8000-000000002004', 'Draft',                'Submitted for Review', null, now() - interval '5 days',  null),
  ('018f4e10-0000-7000-8000-000000006023', '018f4e10-0000-7000-8000-000000002004', 'Submitted for Review', 'In Navigator Review',  null, now() - interval '1 days',  'Triaged')
on conflict (history_id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Verify
-- ───────────────────────────────────────────────────────────────────────────
select
  (select count(*) from snap_enrollment.applicants where applicant_id::text like '018f4e10-0000-7000-8000-0000000002%') as new_applicants,
  (select count(*) from snap_enrollment.snap_packets where packet_id::text like '018f4e10-0000-7000-8000-000000002%') as new_packets,
  (select count(*) from snap_enrollment.packet_answers where packet_id::text like '018f4e10-0000-7000-8000-000000002%') as answers,
  (select count(*) from snap_enrollment.uploaded_documents where packet_id::text like '018f4e10-0000-7000-8000-000000002%') as docs,
  (select count(*) from snap_enrollment.navigator_notes where packet_id::text like '018f4e10-0000-7000-8000-000000002%') as notes,
  (select count(*) from snap_enrollment.packet_status_history where packet_id::text like '018f4e10-0000-7000-8000-000000002%') as history_rows;
