-- Demo seed: sympathetic applicant cast for live navigator-dashboard demos.
--
-- Inserts 6 named applicants spanning the full packet lifecycle so the
-- navigator queue and ActivityTicker (apps/dashboard/components/ActivityTicker.tsx)
-- both feel like a live product instead of an empty UAT shell.
--
-- The placeholder ciphertext format `snap_v1::DEMO:<NAME>` is decoded by
-- apps/dashboard/lib/format.ts decryptDemoName() — no real Fernet decryption
-- needed, names render as written.
--
-- Cast (all California, mixed EN/ES, mixed statuses):
--   1. Maria Hernandez   — es — Submitted for Review — expedited — 1 missing item (rent receipt)
--   2. James Wilson      — en — In Navigator Review  — all docs confirmed
--   3. Aisha Johnson     — es — Closed                — consent withdrawn
--   4. Daniel Park       — en — Needs Applicant Clarification — income discrepancy, 1 missing item
--   5. Sarah Chen        — en — Draft                 — partial answers, no docs
--   6. Roberto Vasquez   — es — Ready for Handoff     — all docs extracted, PDF-ready
--
-- Prerequisites:
--   1. Create a Supabase Auth user for the demo navigator. Copy their UUID.
--   2. Paste the UUID into v_navigator_auth_uid below.
--   3. Run against staging only — guarded by a current_database() check.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/seed-demo-applicants.sql
--
-- Idempotent w/ wraparound: wrapped in a transaction; on re-run, the org
-- + role + staff_user are upserted but APPLICANTS are inserted fresh each
-- time (a second run will yield 12 applicants, etc). To start clean, run
-- scripts/seed-demo-applicants-CLEAR.sql first.

begin;

-- ── Safety: refuse to run in prod ───────────────────────────────────────────
do $$
begin
  if current_database() in ('prod', 'production', 'civica_prod', 'civica_production') then
    raise exception 'Refusing to run demo seed in production database: %', current_database();
  end if;
end $$;

do $$
declare
  -- ── CONFIGURE THIS ────────────────────────────────────────────────────────
  v_navigator_auth_uid uuid := '00000000-0000-0000-0000-000000000000';
  -- ──────────────────────────────────────────────────────────────────────────

  v_org_id     uuid;
  v_role_id    uuid;
  v_staff_id   uuid;

  v_maria_id     uuid; v_maria_packet     uuid;
  v_james_id     uuid; v_james_packet     uuid;
  v_aisha_id     uuid; v_aisha_packet     uuid;
  v_daniel_id    uuid; v_daniel_packet    uuid;
  v_sarah_id     uuid; v_sarah_packet     uuid;
  v_roberto_id   uuid; v_roberto_packet   uuid;
begin
  if v_navigator_auth_uid = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Paste the demo navigator auth.users UUID into v_navigator_auth_uid before running.';
  end if;

  -- ── Org / role / staff_user ─────────────────────────────────────────────
  select org_id into v_org_id from snap_enrollment.staff_orgs where name = 'Silo H (Demo)';
  if v_org_id is null then
    insert into snap_enrollment.staff_orgs (name, state_code)
    values ('Silo H (Demo)', 'CA')
    returning org_id into v_org_id;
  end if;

  select role_id into v_role_id
    from snap_enrollment.staff_roles
   where org_id = v_org_id and role_kind = 'navigator';
  if v_role_id is null then
    insert into snap_enrollment.staff_roles (org_id, role_kind, label)
    values (v_org_id, 'navigator', 'Demo Navigator')
    returning role_id into v_role_id;
  end if;

  select staff_id into v_staff_id
    from snap_enrollment.staff_users where auth_uid = v_navigator_auth_uid;
  if v_staff_id is null then
    insert into snap_enrollment.staff_users
      (auth_uid, org_id, role_id, display_name, email)
    values
      (v_navigator_auth_uid, v_org_id, v_role_id,
       'Demo Navigator', 'demo-navigator@civica-staging.internal')
    returning staff_id into v_staff_id;
  end if;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 1. Maria Hernandez — Spanish, expedited, just submitted, missing item
  -- ═══════════════════════════════════════════════════════════════════════
  insert into snap_enrollment.applicants
    (state_code, preferred_language,
     full_name_ciphertext, email_ciphertext, phone_ciphertext)
  values
    ('CA', 'es',
     'snap_v1::DEMO:Maria Hernandez',
     'snap_v1::DEMO:maria.hernandez@example.com',
     'snap_v1::DEMO:(213) 555-0142')
  returning applicant_id into v_maria_id;

  insert into snap_enrollment.snap_packets
    (applicant_id, state_code, status, org_id, county, county_fips,
     is_expedited, submitted_at)
  values
    (v_maria_id, 'CA', 'Submitted for Review', v_org_id,
     'Los Angeles', '06037', true, now() - interval '8 minutes')
  returning packet_id into v_maria_packet;

  insert into snap_enrollment.packet_status_history
    (packet_id, from_status, to_status, changed_by_applicant_id, reason, occurred_at)
  values
    (v_maria_packet, null,    'Draft',                v_maria_id, 'Started application', now() - interval '38 minutes'),
    (v_maria_packet, 'Draft', 'Submitted for Review', v_maria_id, 'Submitted by applicant', now() - interval '8 minutes');

  insert into snap_enrollment.packet_answers
    (packet_id, question_key, question_label, applicant_answer, answer_source)
  values
    (v_maria_packet, 'household_size',         'How many people are in your household?',     '3',    'applicant_input'),
    (v_maria_packet, 'state_code',             'Which state do you live in?',                 'CA',   'applicant_input'),
    (v_maria_packet, 'monthly_gross_income',   'Monthly household income before taxes',       '1450', 'applicant_input'),
    (v_maria_packet, 'monthly_rent',           'Monthly rent or mortgage',                    '1325', 'applicant_input'),
    (v_maria_packet, 'pays_utilities',         'Do you pay utilities separately from rent?',  'true', 'applicant_input'),
    (v_maria_packet, 'elderly_or_disabled',    'Is anyone in the household 60+ or disabled?', 'false','applicant_input'),
    (v_maria_packet, 'has_minor_in_household', 'Are there children under 18 in the household?','true', 'applicant_input');

  insert into snap_enrollment.uploaded_documents
    (packet_id, applicant_id, storage_path, original_filename,
     document_kind, processing_status, classification_confidence, uploaded_at)
  values
    (v_maria_packet, v_maria_id, 'demo/maria/paystub-oct.jpg', 'paystub_oct.jpg',
     'paystub', 'confirmed', 0.93, now() - interval '12 minutes');

  insert into snap_enrollment.missing_item_requests
    (packet_id, requested_by_staff_id, message_ciphertext, status, sent_at)
  values
    (v_maria_packet, v_staff_id,
     'snap_v1::DEMO:Please upload your most recent rent receipt (within the last 30 days).',
     'pending', now() - interval '5 minutes');

  -- ═══════════════════════════════════════════════════════════════════════
  -- 2. James Wilson — English, fully documented, mid-review
  -- ═══════════════════════════════════════════════════════════════════════
  insert into snap_enrollment.applicants
    (state_code, preferred_language,
     full_name_ciphertext, email_ciphertext, phone_ciphertext)
  values
    ('CA', 'en',
     'snap_v1::DEMO:James Wilson',
     'snap_v1::DEMO:j.wilson@example.com',
     'snap_v1::DEMO:(415) 555-0187')
  returning applicant_id into v_james_id;

  insert into snap_enrollment.snap_packets
    (applicant_id, state_code, status, org_id, county, county_fips,
     is_expedited, submitted_at)
  values
    (v_james_id, 'CA', 'In Navigator Review', v_org_id,
     'San Francisco', '06075', false, now() - interval '2 hours')
  returning packet_id into v_james_packet;

  insert into snap_enrollment.packet_status_history
    (packet_id, from_status, to_status,
     changed_by_applicant_id, changed_by_staff_id, reason, occurred_at)
  values
    (v_james_packet, null,                   'Draft',                v_james_id, null,       'Started application',     now() - interval '4 hours'),
    (v_james_packet, 'Draft',                'Submitted for Review', v_james_id, null,       'Submitted by applicant',  now() - interval '2 hours'),
    (v_james_packet, 'Submitted for Review', 'In Navigator Review',  null,       v_staff_id, 'Picked up by navigator',  now() - interval '45 minutes');

  insert into snap_enrollment.packet_answers
    (packet_id, question_key, question_label, applicant_answer, answer_source)
  values
    (v_james_packet, 'household_size',         'How many people are in your household?',     '1',    'applicant_input'),
    (v_james_packet, 'state_code',             'Which state do you live in?',                 'CA',   'applicant_input'),
    (v_james_packet, 'monthly_gross_income',   'Monthly household income before taxes',       '2100', 'applicant_input'),
    (v_james_packet, 'monthly_rent',           'Monthly rent or mortgage',                    '1850', 'applicant_input'),
    (v_james_packet, 'pays_utilities',         'Do you pay utilities separately from rent?',  'false','applicant_input'),
    (v_james_packet, 'elderly_or_disabled',    'Is anyone in the household 60+ or disabled?', 'false','applicant_input'),
    (v_james_packet, 'has_minor_in_household', 'Are there children under 18 in the household?','false','applicant_input');

  insert into snap_enrollment.uploaded_documents
    (packet_id, applicant_id, storage_path, original_filename,
     document_kind, processing_status, classification_confidence, uploaded_at)
  values
    (v_james_packet, v_james_id, 'demo/james/paystub-w2.jpg',       'paystub_recent.jpg',  'paystub',      'confirmed', 0.97, now() - interval '110 minutes'),
    (v_james_packet, v_james_id, 'demo/james/photo-id-front.jpg',   'CA_dl_front.jpg',     'photo_id',     'confirmed', 0.99, now() - interval '108 minutes'),
    (v_james_packet, v_james_id, 'demo/james/lease.pdf',            'lease_2026.pdf',      'lease',        'confirmed', 0.91, now() - interval '105 minutes');

  -- ═══════════════════════════════════════════════════════════════════════
  -- 3. Aisha Johnson — Spanish, consent withdrawn, packet closed
  -- ═══════════════════════════════════════════════════════════════════════
  insert into snap_enrollment.applicants
    (state_code, preferred_language,
     full_name_ciphertext, email_ciphertext, phone_ciphertext)
  values
    ('CA', 'es',
     'snap_v1::DEMO:Aisha Johnson',
     'snap_v1::DEMO:a.johnson@example.com',
     'snap_v1::DEMO:(510) 555-0103')
  returning applicant_id into v_aisha_id;

  insert into snap_enrollment.snap_packets
    (applicant_id, state_code, status, org_id, county, county_fips,
     submitted_at, closed_at)
  values
    (v_aisha_id, 'CA', 'Closed', v_org_id,
     'Alameda', '06001', now() - interval '2 days', now() - interval '23 hours')
  returning packet_id into v_aisha_packet;

  insert into snap_enrollment.packet_status_history
    (packet_id, from_status, to_status,
     changed_by_applicant_id, changed_by_staff_id, reason, occurred_at)
  values
    (v_aisha_packet, null,                   'Draft',                v_aisha_id, null,       'Started application',                       now() - interval '2 days 4 hours'),
    (v_aisha_packet, 'Draft',                'Submitted for Review', v_aisha_id, null,       'Submitted by applicant',                    now() - interval '2 days'),
    (v_aisha_packet, 'Submitted for Review', 'In Navigator Review',  null,       v_staff_id, 'Picked up by navigator',                    now() - interval '1 day 6 hours'),
    (v_aisha_packet, 'In Navigator Review',  'Closed',               v_aisha_id, null,       'Applicant withdrew consent',                now() - interval '23 hours');

  insert into snap_enrollment.packet_answers
    (packet_id, question_key, question_label, applicant_answer, answer_source)
  values
    (v_aisha_packet, 'household_size',         'How many people are in your household?', '2',    'applicant_input'),
    (v_aisha_packet, 'state_code',             'Which state do you live in?',             'CA',   'applicant_input'),
    (v_aisha_packet, 'monthly_gross_income',   'Monthly household income before taxes',   '1900', 'applicant_input');

  -- ═══════════════════════════════════════════════════════════════════════
  -- 4. Daniel Park — English, income discrepancy, navigator requested clarification
  -- ═══════════════════════════════════════════════════════════════════════
  insert into snap_enrollment.applicants
    (state_code, preferred_language,
     full_name_ciphertext, email_ciphertext, phone_ciphertext)
  values
    ('CA', 'en',
     'snap_v1::DEMO:Daniel Park',
     'snap_v1::DEMO:d.park@example.com',
     'snap_v1::DEMO:(619) 555-0178')
  returning applicant_id into v_daniel_id;

  insert into snap_enrollment.snap_packets
    (applicant_id, state_code, status, org_id, county, county_fips,
     submitted_at)
  values
    (v_daniel_id, 'CA', 'Needs Applicant Clarification', v_org_id,
     'San Diego', '06073', now() - interval '6 hours')
  returning packet_id into v_daniel_packet;

  insert into snap_enrollment.packet_status_history
    (packet_id, from_status, to_status,
     changed_by_applicant_id, changed_by_staff_id, reason, occurred_at)
  values
    (v_daniel_packet, null,                          'Draft',                            v_daniel_id, null,       'Started application',                                    now() - interval '8 hours'),
    (v_daniel_packet, 'Draft',                       'Submitted for Review',             v_daniel_id, null,       'Submitted by applicant',                                 now() - interval '6 hours'),
    (v_daniel_packet, 'Submitted for Review',        'In Navigator Review',              null,        v_staff_id, 'Picked up by navigator',                                 now() - interval '4 hours'),
    (v_daniel_packet, 'In Navigator Review',         'Needs Applicant Clarification',    null,        v_staff_id, 'OCR income on paystub differs from applicant entry',     now() - interval '90 minutes');

  insert into snap_enrollment.packet_answers
    (packet_id, question_key, question_label, applicant_answer, original_ocr_value, answer_source)
  values
    (v_daniel_packet, 'household_size',         'How many people are in your household?',  '2',    null,    'applicant_input'),
    (v_daniel_packet, 'state_code',             'Which state do you live in?',              'CA',   null,    'applicant_input'),
    (v_daniel_packet, 'monthly_gross_income',   'Monthly household income before taxes',    '1600', '2240',  'ocr_extraction'),
    (v_daniel_packet, 'monthly_rent',           'Monthly rent or mortgage',                 '1500', null,    'applicant_input'),
    (v_daniel_packet, 'pays_utilities',         'Do you pay utilities separately?',         'true', null,    'applicant_input');

  insert into snap_enrollment.uploaded_documents
    (packet_id, applicant_id, storage_path, original_filename,
     document_kind, processing_status, classification_confidence, uploaded_at)
  values
    (v_daniel_packet, v_daniel_id, 'demo/daniel/paystub.jpg', 'paystub.jpg', 'paystub', 'confirmed', 0.88, now() - interval '5 hours'),
    (v_daniel_packet, v_daniel_id, 'demo/daniel/id.jpg',      'id.jpg',      'photo_id','confirmed', 0.94, now() - interval '5 hours');

  insert into snap_enrollment.missing_item_requests
    (packet_id, requested_by_staff_id, message_ciphertext, status, sent_at)
  values
    (v_daniel_packet, v_staff_id,
     'snap_v1::DEMO:Your paystub shows $2,240/month but you entered $1,600. Please confirm or send a more recent paystub.',
     'pending', now() - interval '85 minutes');

  -- ═══════════════════════════════════════════════════════════════════════
  -- 5. Sarah Chen — English, draft only, partial answers, no docs
  -- ═══════════════════════════════════════════════════════════════════════
  insert into snap_enrollment.applicants
    (state_code, preferred_language,
     full_name_ciphertext, email_ciphertext)
  values
    ('CA', 'en',
     'snap_v1::DEMO:Sarah Chen',
     'snap_v1::DEMO:sarah.chen@example.com')
  returning applicant_id into v_sarah_id;

  insert into snap_enrollment.snap_packets
    (applicant_id, state_code, status, org_id, county, county_fips)
  values
    (v_sarah_id, 'CA', 'Draft', v_org_id,
     'Santa Clara', '06085')
  returning packet_id into v_sarah_packet;

  insert into snap_enrollment.packet_status_history
    (packet_id, from_status, to_status, changed_by_applicant_id, reason, occurred_at)
  values
    (v_sarah_packet, null, 'Draft', v_sarah_id, 'Started application', now() - interval '25 minutes');

  insert into snap_enrollment.packet_answers
    (packet_id, question_key, question_label, applicant_answer, answer_source)
  values
    (v_sarah_packet, 'household_size',         'How many people are in your household?', '1',    'applicant_input'),
    (v_sarah_packet, 'state_code',             'Which state do you live in?',             'CA',   'applicant_input'),
    (v_sarah_packet, 'monthly_gross_income',   'Monthly household income before taxes',   '1200', 'applicant_input'),
    (v_sarah_packet, 'monthly_rent',           'Monthly rent or mortgage',                '950',  'applicant_input');

  -- ═══════════════════════════════════════════════════════════════════════
  -- 6. Roberto Vasquez — Spanish, all docs extracted, ready for handoff
  -- ═══════════════════════════════════════════════════════════════════════
  insert into snap_enrollment.applicants
    (state_code, preferred_language,
     full_name_ciphertext, email_ciphertext, phone_ciphertext)
  values
    ('CA', 'es',
     'snap_v1::DEMO:Roberto Vasquez',
     'snap_v1::DEMO:r.vasquez@example.com',
     'snap_v1::DEMO:(323) 555-0166')
  returning applicant_id into v_roberto_id;

  insert into snap_enrollment.snap_packets
    (applicant_id, state_code, status, org_id, county, county_fips,
     submitted_at)
  values
    (v_roberto_id, 'CA', 'Ready for Handoff', v_org_id,
     'Los Angeles', '06037', now() - interval '1 day 4 hours')
  returning packet_id into v_roberto_packet;

  insert into snap_enrollment.packet_status_history
    (packet_id, from_status, to_status,
     changed_by_applicant_id, changed_by_staff_id, reason, occurred_at)
  values
    (v_roberto_packet, null,                   'Draft',                v_roberto_id, null,       'Started application',                                       now() - interval '1 day 6 hours'),
    (v_roberto_packet, 'Draft',                'Submitted for Review', v_roberto_id, null,       'Submitted by applicant',                                    now() - interval '1 day 4 hours'),
    (v_roberto_packet, 'Submitted for Review', 'In Navigator Review',  null,         v_staff_id, 'Picked up by navigator',                                    now() - interval '22 hours'),
    (v_roberto_packet, 'In Navigator Review',  'Ready for Handoff',    null,         v_staff_id, 'All fields confirmed, docs extracted, packet ready to send', now() - interval '35 minutes');

  insert into snap_enrollment.packet_answers
    (packet_id, question_key, question_label, applicant_answer, navigator_confirmed_value, answer_source)
  values
    (v_roberto_packet, 'household_size',         'How many people are in your household?',         '4',   '4',    'applicant_input'),
    (v_roberto_packet, 'state_code',             'Which state do you live in?',                     'CA',  'CA',   'applicant_input'),
    (v_roberto_packet, 'monthly_gross_income',   'Monthly household income before taxes',           '1820','1820', 'applicant_input'),
    (v_roberto_packet, 'monthly_rent',           'Monthly rent or mortgage',                        '1450','1450', 'applicant_input'),
    (v_roberto_packet, 'pays_utilities',         'Do you pay utilities separately from rent?',      'true','true', 'applicant_input'),
    (v_roberto_packet, 'elderly_or_disabled',    'Is anyone in the household 60+ or disabled?',     'true','true', 'applicant_input'),
    (v_roberto_packet, 'has_minor_in_household', 'Are there children under 18 in the household?',   'true','true', 'applicant_input');

  insert into snap_enrollment.uploaded_documents
    (packet_id, applicant_id, storage_path, original_filename,
     document_kind, processing_status, classification_confidence, uploaded_at)
  values
    (v_roberto_packet, v_roberto_id, 'demo/roberto/paystub-1.jpg', 'paystub_1.jpg',     'paystub',       'confirmed', 0.95, now() - interval '23 hours'),
    (v_roberto_packet, v_roberto_id, 'demo/roberto/paystub-2.jpg', 'paystub_2.jpg',     'paystub',       'confirmed', 0.96, now() - interval '23 hours'),
    (v_roberto_packet, v_roberto_id, 'demo/roberto/id.jpg',        'mx_consular_id.jpg','photo_id',      'confirmed', 0.92, now() - interval '23 hours'),
    (v_roberto_packet, v_roberto_id, 'demo/roberto/lease.pdf',     'lease_2025.pdf',    'lease',         'confirmed', 0.94, now() - interval '23 hours'),
    (v_roberto_packet, v_roberto_id, 'demo/roberto/utility.pdf',   'pge_bill.pdf',      'utility_bill',  'confirmed', 0.93, now() - interval '23 hours');

  -- ── Done ────────────────────────────────────────────────────────────────
  raise notice '════════════════════════════════════════════════════════════';
  raise notice 'Demo seed complete. 6 applicants + packets inserted.';
  raise notice '';
  raise notice '  org_id   = %', v_org_id;
  raise notice '  staff_id = % (Demo Navigator)', v_staff_id;
  raise notice '';
  raise notice '  Maria   (es, expedited, just submitted)         packet = %', v_maria_packet;
  raise notice '  James   (en, in review)                         packet = %', v_james_packet;
  raise notice '  Aisha   (es, closed — consent withdrawn)        packet = %', v_aisha_packet;
  raise notice '  Daniel  (en, needs clarification)               packet = %', v_daniel_packet;
  raise notice '  Sarah   (en, draft)                             packet = %', v_sarah_packet;
  raise notice '  Roberto (es, ready for handoff)                 packet = %', v_roberto_packet;
  raise notice '';
  raise notice 'Open the dashboard at /packets — all six should appear.';
  raise notice 'The ActivityTicker will have already received the inserts.';
  raise notice '════════════════════════════════════════════════════════════';
end $$;

commit;
