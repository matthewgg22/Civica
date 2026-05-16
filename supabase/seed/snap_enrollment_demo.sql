-- snap_enrollment demo seed
--
-- Guard: must be run with --variable seed_demo=1 to prevent accidental
-- application against production.
--
--   psql "$DATABASE_URL" --variable seed_demo=1 -f supabase/seed/snap_enrollment_demo.sql
--
-- Creates:
--   2 navigator orgs (1 CA, 1 MA)
--   2 staff roles per org
--   4 staff users (1 navigator + 1 admin per org)
--   10 applicants (6 CA, 4 MA)
--   20 packets distributed across all 8 statuses in both states
--   Realistic answers, uploaded doc rows, and extraction rows at varying
--   confidence — including ≥3 fields below the 0.85 threshold so guard
--   tests can exercise the precondition checks.

\if :{?seed_demo}
\else
  \warn 'ERROR: Set --variable seed_demo=1 to run this seed against a non-production DB.'
  \quit
\endif

begin;

-- Use service_role context (no RLS restrictions during seed).
-- In psql this is assumed; in Supabase Studio run as service_role.

-- ---------------------------------------------------------------------------
-- Orgs
-- ---------------------------------------------------------------------------

insert into snap_enrollment.staff_orgs (org_id, name, state_code, website) values
  ('018f4e10-0000-7000-8000-000000000001', 'Bay Area Community Action',  'CA', 'https://baca.example.org'),
  ('018f4e10-0000-7000-8000-000000000002', 'Boston SNAP Navigator Network', 'MA', 'https://bsnn.example.org')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Staff roles
-- ---------------------------------------------------------------------------

insert into snap_enrollment.staff_roles (role_id, org_id, role_kind, label, can_view_pii, can_export, can_override_status) values
  ('018f4e10-0000-7000-8000-000000000010', '018f4e10-0000-7000-8000-000000000001', 'navigator',  'Case Manager',     true,  false, false),
  ('018f4e10-0000-7000-8000-000000000011', '018f4e10-0000-7000-8000-000000000001', 'admin',      'Program Director', true,  true,  true),
  ('018f4e10-0000-7000-8000-000000000012', '018f4e10-0000-7000-8000-000000000002', 'navigator',  'Benefits Navigator', true, false, false),
  ('018f4e10-0000-7000-8000-000000000013', '018f4e10-0000-7000-8000-000000000002', 'admin',      'Site Supervisor',  true,  true,  true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Synthetic auth.users rows required by the staff_users and applicants FKs.
-- These are demo-only identities; real deploys use actual Supabase auth sign-ups.
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
  created_at, updated_at
) values
  ('018f4e10-0000-7000-8000-000000000030', 'mlopez@baca.example.org',    '', now(), '{}', '{}', false, 'authenticated', 'authenticated', now(), now()),
  ('018f4e10-0000-7000-8000-000000000031', 'jokafor@baca.example.org',   '', now(), '{}', '{}', false, 'authenticated', 'authenticated', now(), now()),
  ('018f4e10-0000-7000-8000-000000000032', 'psharma@bsnn.example.org',   '', now(), '{}', '{}', false, 'authenticated', 'authenticated', now(), now()),
  ('018f4e10-0000-7000-8000-000000000033', 'dnguyen@bsnn.example.org',   '', now(), '{}', '{}', false, 'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

-- Staff users (auth_uid is synthetic for seed; replace with real auth.users
-- IDs when seeding against a live Supabase instance with auth enabled)
-- ---------------------------------------------------------------------------

insert into snap_enrollment.staff_users (staff_id, auth_uid, org_id, role_id, display_name, email) values
  ('018f4e10-0000-7000-8000-000000000020', '018f4e10-0000-7000-8000-000000000030', '018f4e10-0000-7000-8000-000000000001', '018f4e10-0000-7000-8000-000000000010', 'Maria Lopez',    'mlopez@baca.example.org'),
  ('018f4e10-0000-7000-8000-000000000021', '018f4e10-0000-7000-8000-000000000031', '018f4e10-0000-7000-8000-000000000001', '018f4e10-0000-7000-8000-000000000011', 'James Okafor',   'jokafor@baca.example.org'),
  ('018f4e10-0000-7000-8000-000000000022', '018f4e10-0000-7000-8000-000000000032', '018f4e10-0000-7000-8000-000000000002', '018f4e10-0000-7000-8000-000000000012', 'Priya Sharma',   'psharma@bsnn.example.org'),
  ('018f4e10-0000-7000-8000-000000000023', '018f4e10-0000-7000-8000-000000000033', '018f4e10-0000-7000-8000-000000000002', '018f4e10-0000-7000-8000-000000000013', 'Derek Nguyen',   'dnguyen@bsnn.example.org')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Applicants (PII stored as plaintext for demo; real deploys use Fernet)
-- ---------------------------------------------------------------------------

insert into snap_enrollment.applicants (applicant_id, state_code, full_name_ciphertext, email_ciphertext, phone_ciphertext, preferred_language) values
  ('018f4e10-0000-7000-8000-000000000100', 'CA', 'snap_v1::DEMO:Elena Vasquez',    'snap_v1::DEMO:evasquez@example.com', 'snap_v1::DEMO:+14155550101', 'en'),
  ('018f4e10-0000-7000-8000-000000000101', 'CA', 'snap_v1::DEMO:David Kim',        'snap_v1::DEMO:dkim@example.com',     'snap_v1::DEMO:+14155550102', 'en'),
  ('018f4e10-0000-7000-8000-000000000102', 'CA', 'snap_v1::DEMO:Rosa Mendez',      'snap_v1::DEMO:rmendez@example.com',  'snap_v1::DEMO:+14155550103', 'es'),
  ('018f4e10-0000-7000-8000-000000000103', 'CA', 'snap_v1::DEMO:James Porter',     'snap_v1::DEMO:jporter@example.com',  'snap_v1::DEMO:+14155550104', 'en'),
  ('018f4e10-0000-7000-8000-000000000104', 'CA', 'snap_v1::DEMO:Amara Osei',       'snap_v1::DEMO:aosei@example.com',    'snap_v1::DEMO:+14155550105', 'en'),
  ('018f4e10-0000-7000-8000-000000000105', 'CA', 'snap_v1::DEMO:Mei-Lin Chen',     'snap_v1::DEMO:mlchen@example.com',   'snap_v1::DEMO:+14155550106', 'zh'),
  ('018f4e10-0000-7000-8000-000000000106', 'MA', 'snap_v1::DEMO:Carlos Reyes',     'snap_v1::DEMO:creyes@example.com',   'snap_v1::DEMO:+16175550201', 'es'),
  ('018f4e10-0000-7000-8000-000000000107', 'MA', 'snap_v1::DEMO:Fatima Al-Hassan', 'snap_v1::DEMO:falhassan@example.com','snap_v1::DEMO:+16175550202', 'en'),
  ('018f4e10-0000-7000-8000-000000000108', 'MA', 'snap_v1::DEMO:Tyler Brooks',     'snap_v1::DEMO:tbrooks@example.com',  'snap_v1::DEMO:+16175550203', 'en'),
  ('018f4e10-0000-7000-8000-000000000109', 'MA', 'snap_v1::DEMO:Ingrid Svensson',  'snap_v1::DEMO:isvensson@example.com','snap_v1::DEMO:+16175550204', 'en')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Consent records for applicants that need them (status ≥ Submitted)
-- ---------------------------------------------------------------------------

insert into snap_enrollment.user_consents (consent_id, applicant_id, consent_kind, policy_version, consent_method) values
  ('018f4e10-0000-7000-8000-000000000200', '018f4e10-0000-7000-8000-000000000100', 'privacy_notice', '2026-05-01', 'ios_checkbox'),
  ('018f4e10-0000-7000-8000-000000000201', '018f4e10-0000-7000-8000-000000000101', 'privacy_notice', '2026-05-01', 'ios_checkbox'),
  ('018f4e10-0000-7000-8000-000000000202', '018f4e10-0000-7000-8000-000000000102', 'privacy_notice', '2026-05-01', 'web_checkbox'),
  ('018f4e10-0000-7000-8000-000000000203', '018f4e10-0000-7000-8000-000000000103', 'privacy_notice', '2026-05-01', 'ios_checkbox'),
  ('018f4e10-0000-7000-8000-000000000204', '018f4e10-0000-7000-8000-000000000104', 'privacy_notice', '2026-05-01', 'web_checkbox'),
  ('018f4e10-0000-7000-8000-000000000205', '018f4e10-0000-7000-8000-000000000105', 'privacy_notice', '2026-05-01', 'ios_checkbox'),
  ('018f4e10-0000-7000-8000-000000000206', '018f4e10-0000-7000-8000-000000000106', 'privacy_notice', '2026-05-01', 'ios_checkbox'),
  ('018f4e10-0000-7000-8000-000000000207', '018f4e10-0000-7000-8000-000000000107', 'privacy_notice', '2026-05-01', 'web_checkbox'),
  ('018f4e10-0000-7000-8000-000000000208', '018f4e10-0000-7000-8000-000000000108', 'privacy_notice', '2026-05-01', 'ios_checkbox'),
  ('018f4e10-0000-7000-8000-000000000209', '018f4e10-0000-7000-8000-000000000109', 'privacy_notice', '2026-05-01', 'web_checkbox')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Packets — 20 rows, all 8 statuses, both states
-- Set actor context so status-history trigger fires correctly.
-- ---------------------------------------------------------------------------

set local snap_enrollment.actor_kind = 'system';
set local snap_enrollment.actor_id   = '018f4e10-0000-7000-8000-000000000021';

-- Insert as Draft first, then UPDATE to target status (triggers fire on UPDATE).

insert into snap_enrollment.snap_packets (packet_id, applicant_id, state_code, status, org_id, county, county_fips) values
  -- CA packets — spread across recognizable counties for the dashboard map
  ('018f4e10-0000-7000-8000-000000001001', '018f4e10-0000-7000-8000-000000000100', 'CA', 'Draft', '018f4e10-0000-7000-8000-000000000001', 'Los Angeles',   '06037'),
  ('018f4e10-0000-7000-8000-000000001002', '018f4e10-0000-7000-8000-000000000101', 'CA', 'Draft', '018f4e10-0000-7000-8000-000000000001', 'Orange',        '06059'),
  ('018f4e10-0000-7000-8000-000000001003', '018f4e10-0000-7000-8000-000000000102', 'CA', 'Draft', '018f4e10-0000-7000-8000-000000000001', 'San Diego',     '06073'),
  ('018f4e10-0000-7000-8000-000000001004', '018f4e10-0000-7000-8000-000000000103', 'CA', 'Draft', '018f4e10-0000-7000-8000-000000000001', 'Santa Clara',   '06085'),
  ('018f4e10-0000-7000-8000-000000001005', '018f4e10-0000-7000-8000-000000000104', 'CA', 'Draft', '018f4e10-0000-7000-8000-000000000001', 'San Francisco', '06075'),
  ('018f4e10-0000-7000-8000-000000001006', '018f4e10-0000-7000-8000-000000000105', 'CA', 'Draft', '018f4e10-0000-7000-8000-000000000001', 'Fresno',        '06019'),
  ('018f4e10-0000-7000-8000-000000001007', '018f4e10-0000-7000-8000-000000000100', 'CA', 'Draft', '018f4e10-0000-7000-8000-000000000001', 'Sacramento',    '06067'),
  -- MA packets
  ('018f4e10-0000-7000-8000-000000001008', '018f4e10-0000-7000-8000-000000000106', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Suffolk',   '25025'),
  ('018f4e10-0000-7000-8000-000000001009', '018f4e10-0000-7000-8000-000000000107', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Middlesex', '25017'),
  ('018f4e10-0000-7000-8000-000000001010', '018f4e10-0000-7000-8000-000000000108', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Worcester', '25027'),
  ('018f4e10-0000-7000-8000-000000001011', '018f4e10-0000-7000-8000-000000000109', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Essex',     '25009'),
  ('018f4e10-0000-7000-8000-000000001012', '018f4e10-0000-7000-8000-000000000106', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Suffolk',   '25025'),
  ('018f4e10-0000-7000-8000-000000001013', '018f4e10-0000-7000-8000-000000000107', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Middlesex', '25017'),
  ('018f4e10-0000-7000-8000-000000001014', '018f4e10-0000-7000-8000-000000000108', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Hampden',   '25013'),
  ('018f4e10-0000-7000-8000-000000001015', '018f4e10-0000-7000-8000-000000000109', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Bristol',   '25005'),
  ('018f4e10-0000-7000-8000-000000001016', '018f4e10-0000-7000-8000-000000000108', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Norfolk',   '25021'),
  ('018f4e10-0000-7000-8000-000000001017', '018f4e10-0000-7000-8000-000000000109', 'MA', 'Draft', '018f4e10-0000-7000-8000-000000000002', 'Plymouth',  '25023'),
  ('018f4e10-0000-7000-8000-000000001018', '018f4e10-0000-7000-8000-000000000104', 'CA', 'Draft',                        '018f4e10-0000-7000-8000-000000000001'),
  ('018f4e10-0000-7000-8000-000000001019', '018f4e10-0000-7000-8000-000000000105', 'CA', 'Draft',                        '018f4e10-0000-7000-8000-000000000001'),
  ('018f4e10-0000-7000-8000-000000001020', '018f4e10-0000-7000-8000-000000000103', 'CA', 'Draft',                        '018f4e10-0000-7000-8000-000000000001')
on conflict do nothing;

-- Advance packets through statuses using UPDATE (triggers record history).
-- Packet 1001 stays Draft.
-- Packet 1002 → Submitted for Review
update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001002';
-- 1003 → Submitted → Needs Documents
update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001003';
update snap_enrollment.snap_packets set status = 'Needs Documents'
  where packet_id = '018f4e10-0000-7000-8000-000000001003';
-- 1004 → Submitted → Needs Applicant Clarification
update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001004';
update snap_enrollment.snap_packets set status = 'Needs Applicant Clarification'
  where packet_id = '018f4e10-0000-7000-8000-000000001004';
-- 1005 → Submitted → In Navigator Review
update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001005';
update snap_enrollment.snap_packets set status = 'In Navigator Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001005';
-- MA: 1008 stays Draft; 1009 → Submitted; 1010 → Needs Docs; 1011 → Needs Clarification
update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001009';
update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001010';
update snap_enrollment.snap_packets set status = 'Needs Documents'
  where packet_id = '018f4e10-0000-7000-8000-000000001010';
update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001011';
update snap_enrollment.snap_packets set status = 'Needs Applicant Clarification'
  where packet_id = '018f4e10-0000-7000-8000-000000001011';
-- 1012 → Submitted → In Navigator Review
update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001012';
update snap_enrollment.snap_packets set status = 'In Navigator Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001012';

-- ---------------------------------------------------------------------------
-- Required document items (so Ready for Handoff preconditions can be met)
-- ---------------------------------------------------------------------------

insert into snap_enrollment.required_document_items (item_id, packet_id, state_code, document_kind, label) values
  -- 1005 (In Navigator Review — CA): paystub required, resolved; photo_id resolved
  ('018f4e10-0000-7000-8000-000000002001', '018f4e10-0000-7000-8000-000000001005', 'CA', 'paystub',  'Proof of income — most recent paystub'),
  ('018f4e10-0000-7000-8000-000000002002', '018f4e10-0000-7000-8000-000000001005', 'CA', 'photo_id', 'Government-issued photo ID'),
  -- 1006 (will become Ready for Handoff — CA): all resolved
  ('018f4e10-0000-7000-8000-000000002003', '018f4e10-0000-7000-8000-000000001006', 'CA', 'paystub',  'Proof of income — most recent paystub'),
  ('018f4e10-0000-7000-8000-000000002004', '018f4e10-0000-7000-8000-000000001006', 'CA', 'photo_id', 'Government-issued photo ID'),
  -- 1012 MA in navigator review
  ('018f4e10-0000-7000-8000-000000002005', '018f4e10-0000-7000-8000-000000001012', 'MA', 'paystub',  'Proof of income — most recent paystub'),
  ('018f4e10-0000-7000-8000-000000002006', '018f4e10-0000-7000-8000-000000001012', 'MA', 'lease',    'Proof of residency — lease or utility bill')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Uploaded documents
-- ---------------------------------------------------------------------------

insert into snap_enrollment.uploaded_documents (document_id, packet_id, applicant_id, storage_path, document_kind, classification_confidence, processing_status) values
  ('018f4e10-0000-7000-8000-000000003001', '018f4e10-0000-7000-8000-000000001005', '018f4e10-0000-7000-8000-000000000104', 'snap-enrollment/018f.../paystub_1.pdf', 'paystub',  0.96, 'confirmed'),
  ('018f4e10-0000-7000-8000-000000003002', '018f4e10-0000-7000-8000-000000001005', '018f4e10-0000-7000-8000-000000000104', 'snap-enrollment/018f.../photoid_1.pdf', 'photo_id', 0.99, 'confirmed'),
  ('018f4e10-0000-7000-8000-000000003003', '018f4e10-0000-7000-8000-000000001006', '018f4e10-0000-7000-8000-000000000105', 'snap-enrollment/018f.../paystub_2.pdf', 'paystub',  0.94, 'confirmed'),
  ('018f4e10-0000-7000-8000-000000003004', '018f4e10-0000-7000-8000-000000001006', '018f4e10-0000-7000-8000-000000000105', 'snap-enrollment/018f.../photoid_2.pdf', 'photo_id', 0.98, 'confirmed'),
  ('018f4e10-0000-7000-8000-000000003005', '018f4e10-0000-7000-8000-000000001003', '018f4e10-0000-7000-8000-000000000102', 'snap-enrollment/018f.../paystub_3.pdf', 'paystub',  0.71, 'awaiting_confirmation'),
  ('018f4e10-0000-7000-8000-000000003006', '018f4e10-0000-7000-8000-000000001012', '018f4e10-0000-7000-8000-000000000106', 'snap-enrollment/018f.../paystub_4.pdf', 'paystub',  0.88, 'confirmed')
on conflict do nothing;

-- Resolve required items for packets 1005 and 1006
update snap_enrollment.required_document_items
  set resolved_document_id = '018f4e10-0000-7000-8000-000000003001',
      resolved_at          = now()
  where item_id = '018f4e10-0000-7000-8000-000000002001';

update snap_enrollment.required_document_items
  set resolved_document_id = '018f4e10-0000-7000-8000-000000003002',
      resolved_at          = now()
  where item_id = '018f4e10-0000-7000-8000-000000002002';

update snap_enrollment.required_document_items
  set resolved_document_id = '018f4e10-0000-7000-8000-000000003003',
      resolved_at          = now()
  where item_id = '018f4e10-0000-7000-8000-000000002003';

update snap_enrollment.required_document_items
  set resolved_document_id = '018f4e10-0000-7000-8000-000000003004',
      resolved_at          = now()
  where item_id = '018f4e10-0000-7000-8000-000000002004';

-- ---------------------------------------------------------------------------
-- Extractions and fields at varying confidence
-- ---------------------------------------------------------------------------

insert into snap_enrollment.document_extractions (extraction_id, document_id, extractor_model, extractor_version, overall_confidence) values
  ('018f4e10-0000-7000-8000-000000004001', '018f4e10-0000-7000-8000-000000003001', 'claude-opus-4-7', '1.0.0', 0.95),
  ('018f4e10-0000-7000-8000-000000004002', '018f4e10-0000-7000-8000-000000003003', 'claude-opus-4-7', '1.0.0', 0.91),
  ('018f4e10-0000-7000-8000-000000004003', '018f4e10-0000-7000-8000-000000003005', 'claude-opus-4-7', '1.0.0', 0.62)
on conflict do nothing;

insert into snap_enrollment.extraction_fields (field_id, extraction_id, packet_id, field_key, field_label, original_ocr_value, confidence) values
  -- 1005: paystub — all high confidence (will be reviewable → Ready for Handoff)
  ('018f4e10-0000-7000-8000-000000005001', '018f4e10-0000-7000-8000-000000004001', '018f4e10-0000-7000-8000-000000001005', 'employer_name',       'Employer Name',         'snap_v1::DEMO:Acme Corp',       0.97),
  ('018f4e10-0000-7000-8000-000000005002', '018f4e10-0000-7000-8000-000000004001', '018f4e10-0000-7000-8000-000000001005', 'gross_monthly_income', 'Gross Monthly Income',  'snap_v1::DEMO:2850.00',         0.93),
  ('018f4e10-0000-7000-8000-000000005003', '018f4e10-0000-7000-8000-000000004001', '018f4e10-0000-7000-8000-000000001005', 'pay_period_end_date',  'Pay Period End Date',   'snap_v1::DEMO:2026-04-30',      0.88),
  -- 1006: high confidence — all will be marked reviewed so guard can pass
  ('018f4e10-0000-7000-8000-000000005004', '018f4e10-0000-7000-8000-000000004002', '018f4e10-0000-7000-8000-000000001006', 'employer_name',       'Employer Name',         'snap_v1::DEMO:Sunrise Bakery',  0.96),
  ('018f4e10-0000-7000-8000-000000005005', '018f4e10-0000-7000-8000-000000004002', '018f4e10-0000-7000-8000-000000001006', 'gross_monthly_income', 'Gross Monthly Income',  'snap_v1::DEMO:1420.00',         0.90),
  -- 1003: LOW confidence — exercises unreviewed guard (needs_review = true)
  ('018f4e10-0000-7000-8000-000000005006', '018f4e10-0000-7000-8000-000000004003', '018f4e10-0000-7000-8000-000000001003', 'employer_name',       'Employer Name',         'snap_v1::DEMO:???',             0.41),
  ('018f4e10-0000-7000-8000-000000005007', '018f4e10-0000-7000-8000-000000004003', '018f4e10-0000-7000-8000-000000001003', 'gross_monthly_income', 'Gross Monthly Income',  'snap_v1::DEMO:1200.??',         0.58),
  ('018f4e10-0000-7000-8000-000000005008', '018f4e10-0000-7000-8000-000000004003', '018f4e10-0000-7000-8000-000000001003', 'pay_period_end_date',  'Pay Period End Date',   'snap_v1::DEMO:2026-03-??',      0.72)
on conflict do nothing;

-- Mark 1006 extraction fields as reviewed (so Ready for Handoff guard can pass).
update snap_enrollment.extraction_fields
  set reviewed_by_staff_id = '018f4e10-0000-7000-8000-000000000020',
      reviewed_at          = now(),
      navigator_confirmed_value = original_ocr_value
  where field_id in (
    '018f4e10-0000-7000-8000-000000005004',
    '018f4e10-0000-7000-8000-000000005005'
  );

-- ---------------------------------------------------------------------------
-- Packet answers
-- ---------------------------------------------------------------------------

insert into snap_enrollment.packet_answers (answer_id, packet_id, question_key, question_label, applicant_answer, answer_source) values
  ('018f4e10-0000-7000-8000-000000006001', '018f4e10-0000-7000-8000-000000001005', 'household_size',  'Household size',   'snap_v1::DEMO:3', 'applicant_input'),
  ('018f4e10-0000-7000-8000-000000006002', '018f4e10-0000-7000-8000-000000001005', 'monthly_income',  'Monthly income',   'snap_v1::DEMO:2850.00', 'applicant_input'),
  ('018f4e10-0000-7000-8000-000000006003', '018f4e10-0000-7000-8000-000000001006', 'household_size',  'Household size',   'snap_v1::DEMO:1', 'applicant_input'),
  ('018f4e10-0000-7000-8000-000000006004', '018f4e10-0000-7000-8000-000000001006', 'monthly_income',  'Monthly income',   'snap_v1::DEMO:1420.00', 'applicant_input'),
  ('018f4e10-0000-7000-8000-000000006005', '018f4e10-0000-7000-8000-000000001001', 'household_size',  'Household size',   'snap_v1::DEMO:4', 'applicant_input'),
  ('018f4e10-0000-7000-8000-000000006006', '018f4e10-0000-7000-8000-000000001008', 'household_size',  'Household size',   'snap_v1::DEMO:2', 'applicant_input'),
  ('018f4e10-0000-7000-8000-000000006007', '018f4e10-0000-7000-8000-000000001009', 'household_size',  'Household size',   'snap_v1::DEMO:5', 'applicant_input'),
  ('018f4e10-0000-7000-8000-000000006008', '018f4e10-0000-7000-8000-000000001012', 'household_size',  'Household size',   'snap_v1::DEMO:2', 'applicant_input'),
  ('018f4e10-0000-7000-8000-000000006009', '018f4e10-0000-7000-8000-000000001012', 'monthly_income',  'Monthly income',   'snap_v1::DEMO:1900.00', 'applicant_input')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Advance 1006 to Ready for Handoff (all preconditions now met)
-- ---------------------------------------------------------------------------

update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001006';
update snap_enrollment.snap_packets set status = 'In Navigator Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001006';
update snap_enrollment.snap_packets set status = 'Ready for Handoff'
  where packet_id = '018f4e10-0000-7000-8000-000000001006';

-- ---------------------------------------------------------------------------
-- Advance 1007 (CA) → Handed Off
-- ---------------------------------------------------------------------------

update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001007';
update snap_enrollment.snap_packets set status = 'In Navigator Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001007';

-- Add required docs + answer for 1007 so guard passes
insert into snap_enrollment.required_document_items (item_id, packet_id, state_code, document_kind, label, resolved_at)
  values ('018f4e10-0000-7000-8000-000000002010', '018f4e10-0000-7000-8000-000000001007', 'CA', 'paystub', 'Proof of income', now())
on conflict do nothing;

update snap_enrollment.snap_packets set status = 'Ready for Handoff'
  where packet_id = '018f4e10-0000-7000-8000-000000001007';
update snap_enrollment.snap_packets set status = 'Handed Off'
  where packet_id = '018f4e10-0000-7000-8000-000000001007';

-- Handoff export row
insert into snap_enrollment.handoff_exports (export_id, packet_id, exported_by_staff_id, format, agency_reference) values
  ('018f4e10-0000-7000-8000-000000007001', '018f4e10-0000-7000-8000-000000001007', '018f4e10-0000-7000-8000-000000000020', 'pdf_packet', 'CDSS-2026-001234')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Advance 1013 (MA) → Closed
-- ---------------------------------------------------------------------------

update snap_enrollment.snap_packets set status = 'Submitted for Review'
  where packet_id = '018f4e10-0000-7000-8000-000000001013';
update snap_enrollment.snap_packets set status = 'Closed'
  where packet_id = '018f4e10-0000-7000-8000-000000001013';

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------

insert into snap_enrollment.packet_assignments (assignment_id, packet_id, staff_id, is_current) values
  ('018f4e10-0000-7000-8000-000000008001', '018f4e10-0000-7000-8000-000000001005', '018f4e10-0000-7000-8000-000000000020', true),
  ('018f4e10-0000-7000-8000-000000008002', '018f4e10-0000-7000-8000-000000001006', '018f4e10-0000-7000-8000-000000000020', true),
  ('018f4e10-0000-7000-8000-000000008003', '018f4e10-0000-7000-8000-000000001012', '018f4e10-0000-7000-8000-000000000022', true),
  ('018f4e10-0000-7000-8000-000000008004', '018f4e10-0000-7000-8000-000000001009', '018f4e10-0000-7000-8000-000000000022', true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Navigator notes
-- ---------------------------------------------------------------------------

insert into snap_enrollment.navigator_notes (note_id, packet_id, author_staff_id, body_ciphertext, is_internal) values
  ('018f4e10-0000-7000-8000-000000009001', '018f4e10-0000-7000-8000-000000001005', '018f4e10-0000-7000-8000-000000000020', 'snap_v1::DEMO:Paystub uploaded; employer confirmed by phone. Income matches stated amount.', true),
  ('018f4e10-0000-7000-8000-000000009002', '018f4e10-0000-7000-8000-000000001006', '018f4e10-0000-7000-8000-000000000020', 'snap_v1::DEMO:All docs verified. Ready to submit to CalFresh.', false),
  ('018f4e10-0000-7000-8000-000000009003', '018f4e10-0000-7000-8000-000000001003', '018f4e10-0000-7000-8000-000000000020', 'snap_v1::DEMO:OCR confidence low on paystub — asked applicant to re-upload cleaner scan.', true)
on conflict do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Verification query — run after seeding to confirm counts
-- ---------------------------------------------------------------------------

select
  status,
  state_code,
  count(*) as packet_count
from snap_enrollment.snap_packets
where deleted_at is null
group by status, state_code
order by state_code, status;
