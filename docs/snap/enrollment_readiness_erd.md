# SNAP Enrollment-Readiness — ERD

Schema: `snap_enrollment`

```mermaid
erDiagram

  staff_orgs {
    uuid org_id PK
    text name
    launch_state state_code
    text website
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  staff_roles {
    uuid role_id PK
    uuid org_id FK
    staff_role_kind role_kind
    text label
    boolean can_view_pii
    boolean can_export
    boolean can_override_status
    timestamptz created_at
  }

  staff_users {
    uuid staff_id PK
    uuid auth_uid FK
    uuid org_id FK
    uuid role_id FK
    text display_name "PII"
    text email "PII"
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  applicants {
    uuid applicant_id PK
    uuid auth_uid FK
    launch_state state_code
    text full_name_ciphertext "PII"
    text email_ciphertext "PII"
    text phone_ciphertext "PII"
    text date_of_birth_ciphertext "PII"
    text address_ciphertext "PII"
    text preferred_language
    timestamptz created_at
    timestamptz updated_at
  }

  snap_packets {
    uuid packet_id PK
    uuid applicant_id FK
    launch_state state_code
    packet_status status
    uuid org_id FK
    text county
    char county_fips
    text notes_for_applicant
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
    timestamptz submitted_at
    timestamptz handed_off_at
    timestamptz closed_at
  }

  packet_status_history {
    uuid history_id PK
    uuid packet_id FK
    packet_status from_status
    packet_status to_status
    uuid changed_by_staff_id FK
    uuid changed_by_applicant_id FK
    text reason
    timestamptz occurred_at
  }

  packet_answers {
    uuid answer_id PK
    uuid packet_id FK
    text question_key
    text question_label
    text applicant_answer "PII write-once"
    text original_ocr_value "PII write-once"
    text navigator_confirmed_value "PII mutable"
    text answer_source
    uuid reviewed_by_staff_id FK
    timestamptz reviewed_at
    text review_note
    timestamptz created_at
    timestamptz updated_at
  }

  packet_assignments {
    uuid assignment_id PK
    uuid packet_id FK
    uuid staff_id FK
    uuid assigned_by_staff_id FK
    timestamptz assigned_at
    timestamptz unassigned_at
    boolean is_current
  }

  uploaded_documents {
    uuid document_id PK
    uuid packet_id FK
    uuid applicant_id FK
    text storage_path
    text original_filename "PII"
    document_kind document_kind
    numeric classification_confidence
    boolean on_device_quality_passed
    text processing_status
    text rejected_reason
    timestamptz uploaded_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  document_extractions {
    uuid extraction_id PK
    uuid document_id FK
    text extractor_model
    text extractor_version
    numeric overall_confidence
    text raw_ocr_ciphertext "PII"
    jsonb extraction_flags
    timestamptz extracted_at
  }

  extraction_fields {
    uuid field_id PK
    uuid extraction_id FK
    uuid packet_id FK
    text field_key
    text field_label
    text applicant_answer "PII write-once"
    text original_ocr_value "PII write-once"
    text navigator_confirmed_value "PII mutable"
    numeric confidence
    boolean needs_review
    uuid reviewed_by_staff_id FK
    timestamptz reviewed_at
    text review_note
    timestamptz created_at
    timestamptz updated_at
  }

  required_document_items {
    uuid item_id PK
    uuid packet_id FK
    launch_state state_code
    document_kind document_kind
    text label
    boolean is_required
    uuid waived_by_staff_id FK
    timestamptz waived_at
    uuid resolved_document_id FK
    timestamptz resolved_at
    timestamptz created_at
    timestamptz updated_at
  }

  missing_item_requests {
    uuid request_id PK
    uuid packet_id FK
    uuid required_item_id FK
    uuid requested_by_staff_id FK
    text message_ciphertext "PII"
    missing_item_status status
    timestamptz sent_at
    timestamptz resolved_at
    uuid resolved_by_staff_id FK
    timestamptz updated_at
  }

  navigator_notes {
    uuid note_id PK
    uuid packet_id FK
    uuid author_staff_id FK
    text body_ciphertext "PII"
    boolean is_internal
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  user_consents {
    uuid consent_id PK
    uuid applicant_id FK
    consent_kind consent_kind
    text policy_version
    timestamptz consented_at
    text consent_method
    text ip_address "PII"
    timestamptz revoked_at
    text revoke_reason
  }

  handoff_exports {
    uuid export_id PK
    uuid packet_id FK
    uuid exported_by_staff_id FK
    handoff_format format
    text storage_path
    text checksum_sha256
    text agency_reference
    timestamptz exported_at
  }

  audit_log_events {
    uuid audit_id PK
    uuid packet_id
    uuid applicant_id
    audit_actor_kind actor_kind
    text actor_id
    text table_name
    uuid row_id
    text operation
    text[] changed_columns
    jsonb old_values
    jsonb new_values
    text request_id
    text ip_address "PII"
    text user_agent
    timestamptz occurred_at
  }

  enrollment_config {
    text key PK
    text value
    text note
  }

  %% Relationships
  staff_orgs       ||--o{ staff_roles         : "defines"
  staff_orgs       ||--o{ staff_users          : "employs"
  staff_roles      ||--o{ staff_users          : "assigned to"
  staff_orgs       ||--o{ snap_packets         : "manages"

  applicants       ||--o{ snap_packets         : "owns"
  applicants       ||--o{ uploaded_documents   : "uploads"
  applicants       ||--o{ user_consents        : "provides"

  snap_packets     ||--o{ packet_status_history  : "logs"
  snap_packets     ||--o{ packet_answers          : "has"
  snap_packets     ||--o{ packet_assignments      : "assigned via"
  snap_packets     ||--o{ uploaded_documents      : "contains"
  snap_packets     ||--o{ required_document_items : "requires"
  snap_packets     ||--o{ missing_item_requests   : "requests"
  snap_packets     ||--o{ navigator_notes         : "annotated by"
  snap_packets     ||--o{ handoff_exports         : "exported as"
  snap_packets     ||--o{ extraction_fields       : "has fields from"

  uploaded_documents ||--o{ document_extractions  : "processed into"
  document_extractions ||--o{ extraction_fields   : "produces"

  required_document_items ||--o{ missing_item_requests : "triggers"
  required_document_items }o--|| uploaded_documents     : "resolved by"

  staff_users ||--o{ packet_assignments     : "assigned"
  staff_users ||--o{ navigator_notes        : "authors"
  staff_users ||--o{ handoff_exports        : "exports"
  staff_users ||--o{ packet_status_history  : "records"
  staff_users ||--o{ extraction_fields      : "reviews"
  staff_users ||--o{ missing_item_requests  : "sends"
```

## Key design notes

- **Status lifecycle** (`snap_packets.status`): `Draft` → `Submitted for Review` → `In Navigator Review` → `Ready for Handoff` → `Handed Off` → `Closed`. Detours via `Needs Documents` / `Needs Applicant Clarification` are allowed. Enforced by a `BEFORE UPDATE` trigger.
- **Three-value preservation**: `applicant_answer` and `original_ocr_value` are write-once on both `packet_answers` and `extraction_fields`. `navigator_confirmed_value` is the only mutable value column.
- **`needs_review`** is a generated column (`confidence < 0.85`). The guard trigger counts rows where `needs_review = true AND reviewed_at IS NULL`.
- **Audit log**: `audit_log_events` is append-only (mutation blocked by trigger). `packet_id` and `applicant_id` are denormalised (not FK) so audit records survive hard-delete of applicant data.
- **Consent withdrawal** = hard-delete on `applicants` row → cascades to `snap_packets`, `uploaded_documents`, `packet_answers`, `extraction_fields`, `user_consents`. `audit_log_events` is intentionally NOT cascaded.
- **`handoff_exports`**, **`user_consents`**, **`packet_status_history`** are append-only via `BEFORE UPDATE/DELETE` triggers.
- **PII grep recipe**: `grep -rn "COMMENT 'PII'" supabase/migrations/`
