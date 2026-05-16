-- snap_enrollment — Migration 03: document pipeline tables
--
-- Tables created here:
--   uploaded_documents
--   document_extractions
--   extraction_fields
--   required_document_items
--   missing_item_requests
--
-- Idempotent: CREATE TABLE IF NOT EXISTS throughout.

-- ---------------------------------------------------------------------------
-- uploaded_documents: one row per file the applicant uploads
--
-- The encrypted blob lives in Supabase Storage; this table tracks metadata,
-- classification, and processing state.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.uploaded_documents (
  document_id       uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id         uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  applicant_id      uuid        not null references snap_enrollment.applicants(applicant_id) on delete cascade,
  storage_path      text        not null,  -- Supabase Storage path (encrypted blob)
  original_filename text,                  -- COMMENT 'PII'
  document_kind     snap_enrollment.document_kind not null default 'other',
  classification_confidence numeric(4,3) check (classification_confidence between 0 and 1),
  on_device_quality_passed  boolean not null default true,
  processing_status text not null default 'uploaded'
    check (processing_status in (
      'uploaded', 'classifying', 'extracting',
      'awaiting_confirmation', 'confirmed', 'rejected'
    )),
  rejected_reason   text,
  uploaded_at       timestamptz not null default clock_timestamp(),
  updated_at        timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz
);

comment on column snap_enrollment.uploaded_documents.original_filename is 'PII';

create index if not exists uploaded_docs_packet_idx
  on snap_enrollment.uploaded_documents(packet_id, uploaded_at desc) where deleted_at is null;
create index if not exists uploaded_docs_status_idx
  on snap_enrollment.uploaded_documents(processing_status, updated_at desc);

drop trigger if exists uploaded_docs_updated_at on snap_enrollment.uploaded_documents;
create trigger uploaded_docs_updated_at
  before update on snap_enrollment.uploaded_documents
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- document_extractions: one row per OCR/extraction pass on a document
--
-- A document may be re-extracted after a model upgrade, so there can be
-- multiple extraction rows per document. extraction_fields rows point here.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.document_extractions (
  extraction_id   uuid        primary key default snap_enrollment.gen_uuidv7(),
  document_id     uuid        not null references snap_enrollment.uploaded_documents(document_id) on delete cascade,
  extractor_model text        not null,   -- e.g. 'claude-opus-4-7', 'vision-v2'
  extractor_version text      not null,   -- semver of the extraction pipeline
  overall_confidence numeric(4,3) not null check (overall_confidence between 0 and 1),
  raw_ocr_ciphertext text,                -- COMMENT 'PII' — full OCR text, Fernet-encrypted
  extraction_flags jsonb       not null default '[]'::jsonb,
  extracted_at    timestamptz  not null default clock_timestamp()
);

comment on column snap_enrollment.document_extractions.raw_ocr_ciphertext is 'PII';

create index if not exists doc_extractions_document_idx
  on snap_enrollment.document_extractions(document_id, extracted_at desc);

-- ---------------------------------------------------------------------------
-- extraction_fields: granular field-level results from an extraction pass
--
-- Hard invariant (enforced by trigger in migration 07):
--   applicant_answer and original_ocr_value are WRITE-ONCE.
--   navigator_confirmed_value is the only mutable value column.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.extraction_fields (
  field_id        uuid        primary key default snap_enrollment.gen_uuidv7(),
  extraction_id   uuid        not null references snap_enrollment.document_extractions(extraction_id) on delete cascade,
  packet_id       uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  field_key       text        not null,   -- canonical key e.g. 'gross_monthly_income', 'employer_name'
  field_label     text        not null,
  -- Three-value columns (invariant 1)
  applicant_answer          text,  -- COMMENT 'PII' — applicant correction if they reviewed this field; write-once
  original_ocr_value        text,  -- COMMENT 'PII' — raw value from OCR; write-once
  navigator_confirmed_value text,  -- COMMENT 'PII' — navigator's confirmed/corrected value; mutable
  -- Confidence & review state
  confidence      numeric(4,3) not null check (confidence between 0 and 1),
  needs_review    boolean      not null generated always as (confidence < 0.85) stored,
  reviewed_by_staff_id uuid   references snap_enrollment.staff_users(staff_id) on delete set null,
  reviewed_at     timestamptz,
  review_note     text,
  -- Timestamps
  created_at      timestamptz  not null default clock_timestamp(),
  updated_at      timestamptz  not null default clock_timestamp()
);

comment on column snap_enrollment.extraction_fields.applicant_answer          is 'PII';
comment on column snap_enrollment.extraction_fields.original_ocr_value        is 'PII';
comment on column snap_enrollment.extraction_fields.navigator_confirmed_value is 'PII';

create index if not exists extraction_fields_extraction_idx
  on snap_enrollment.extraction_fields(extraction_id);
create index if not exists extraction_fields_packet_unreviewed_idx
  on snap_enrollment.extraction_fields(packet_id, reviewed_at)
  where needs_review = true and reviewed_at is null;

drop trigger if exists extraction_fields_updated_at on snap_enrollment.extraction_fields;
create trigger extraction_fields_updated_at
  before update on snap_enrollment.extraction_fields
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- required_document_items: what docs each state requires for a packet
--
-- Populated automatically when a packet is created (by application logic),
-- and updated when state rules change. A packet cannot move to
-- 'Ready for Handoff' if any row here has resolved_at IS NULL.
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.required_document_items (
  item_id         uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id       uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  state_code      snap_enrollment.launch_state not null,
  document_kind   snap_enrollment.document_kind not null,
  label           text        not null,   -- e.g. "Proof of income — most recent paystub"
  is_required     boolean     not null default true,
  waived_by_staff_id uuid     references snap_enrollment.staff_users(staff_id) on delete set null,
  waived_at       timestamptz,
  waive_reason    text,
  resolved_document_id uuid   references snap_enrollment.uploaded_documents(document_id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz  not null default clock_timestamp(),
  updated_at      timestamptz  not null default clock_timestamp()
);

create index if not exists required_docs_packet_unresolved_idx
  on snap_enrollment.required_document_items(packet_id, resolved_at)
  where resolved_at is null;

drop trigger if exists required_doc_items_updated_at on snap_enrollment.required_document_items;
create trigger required_doc_items_updated_at
  before update on snap_enrollment.required_document_items
  for each row execute function snap_enrollment.set_updated_at();

-- ---------------------------------------------------------------------------
-- missing_item_requests: navigator sends "please upload X" to applicant
-- ---------------------------------------------------------------------------

create table if not exists snap_enrollment.missing_item_requests (
  request_id      uuid        primary key default snap_enrollment.gen_uuidv7(),
  packet_id       uuid        not null references snap_enrollment.snap_packets(packet_id) on delete cascade,
  required_item_id uuid       references snap_enrollment.required_document_items(item_id) on delete set null,
  requested_by_staff_id uuid  not null references snap_enrollment.staff_users(staff_id) on delete restrict,
  message_ciphertext text,    -- COMMENT 'PII' — optional personal note to applicant, Fernet-encrypted
  status          snap_enrollment.missing_item_status not null default 'pending',
  sent_at         timestamptz  not null default clock_timestamp(),
  resolved_at     timestamptz,
  resolved_by_staff_id uuid   references snap_enrollment.staff_users(staff_id) on delete set null,
  updated_at      timestamptz  not null default clock_timestamp()
);

comment on column snap_enrollment.missing_item_requests.message_ciphertext is 'PII';

create index if not exists missing_item_requests_packet_idx
  on snap_enrollment.missing_item_requests(packet_id, status);

drop trigger if exists missing_item_requests_updated_at on snap_enrollment.missing_item_requests;
create trigger missing_item_requests_updated_at
  before update on snap_enrollment.missing_item_requests
  for each row execute function snap_enrollment.set_updated_at();
