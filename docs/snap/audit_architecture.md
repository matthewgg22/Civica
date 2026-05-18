# SNAP audit architecture

Civica audits mutations to PII-containing tables at the **database** layer (Postgres triggers), not the application layer (no `withAudit` wrapper required). This is a stronger guarantee — application code literally cannot bypass it, because every mutation traverses Postgres.

This doc explains the design, what's covered, and how to extend it without leaving compliance gaps.

---

## Two patterns

Every PII-containing table in `snap_enrollment` falls into one of two compliance patterns:

### Pattern 1: Mutable + audit trigger

The default. Tables that can be updated (e.g., `applicants`, `snap_packets`, `packet_answers`) get an `AFTER INSERT/UPDATE/DELETE FOR EACH ROW` trigger that writes a row to `snap_enrollment.audit_log_events` in the same transaction as the originating statement. PII columns are redacted to `[REDACTED]` via `snap_enrollment.redact_pii_json` before being written, using the `snap_enrollment.pii_columns` registry to know which columns to scrub.

Trigger function: `snap_enrollment.audit_row_change()` (migration 05).

### Pattern 2: Append-only + block-mutation trigger

For tables where every meaningful mutation is the creation of a new row (e.g., `user_consents` — revocations create a new row with `revoked_at`, not an UPDATE; `handoff_exports` — each export is a new immutable row), the row itself IS the audit trail. These tables get a `BEFORE UPDATE/DELETE` trigger that raises `42501` to make them physically append-only.

Block-mutation function: `snap_enrollment.block_audit_mutation()` (migration 04).

---

## Coverage today

**Pattern 1 (mutable + audit trigger), 11 tables:**

| Table | Trigger | PII columns redacted |
|---|---|---|
| `applicants` | `audit_applicants` | full_name, email, phone, dob, address (all `_ciphertext`) |
| `snap_packets` | `audit_snap_packets` | none (no PII columns) — audited for state transitions |
| `packet_answers` | `audit_packet_answers` | applicant_answer, original_ocr_value, navigator_confirmed_value |
| `packet_assignments` | `audit_packet_assignments` | none — audited for who got assigned what |
| `uploaded_documents` | `audit_uploaded_documents` | original_filename |
| `document_extractions` | `audit_document_extractions` | raw_ocr_ciphertext |
| `extraction_fields` | `audit_extraction_fields` | applicant_answer, original_ocr_value, navigator_confirmed_value |
| `required_document_items` | `audit_required_document_items` | none — slow-changing catalog, audited for changes |
| `missing_item_requests` | `audit_missing_item_requests` | message_ciphertext |
| `navigator_notes` | `audit_navigator_notes` | body_ciphertext |
| `staff_users` | `audit_staff_users` | display_name, email |

**Pattern 2 (append-only), 4 tables:**

| Table | Block triggers | Why append-only |
|---|---|---|
| `audit_log_events` | `audit_log_no_update`, `audit_log_no_delete` | The audit log itself — auditing the audit log creates a feedback loop |
| `user_consents` | `user_consents_no_update`, `user_consents_no_delete` | Consent revocations create a new row with `revoked_at`, not an UPDATE |
| `handoff_exports` | `handoff_exports_no_update`, `handoff_exports_no_delete` | Each export is an immutable record of what left the system |
| `packet_status_history` | `packet_status_history_no_update`, `packet_status_history_no_delete` | Each status transition is a new row; the row sequence IS the timeline |

**Operational config (no audit needed), 5 tables:**
- `pii_columns` — meta-registry of which columns hold PII
- `staff_orgs`, `staff_roles` — slow-changing operational config
- `enrollment_config` — feature flags
- `required_document_items` — listed as audited above; included here as borderline (catalog data that rarely changes; audited for paper trail anyway)

---

## How to add a new PII-containing table

1. Create the table in a new migration: `create table snap_enrollment.my_new_table (...)`.
2. Add a `comment on column snap_enrollment.my_new_table.<pii_col> is 'PII'` for each PII column.
3. Add each PII column to the `snap_enrollment.pii_columns` insert in migration 05 (or a new migration that appends).
4. **Then choose one:**
   - **Mutable:** add `create trigger audit_my_new_table after insert or update or delete on snap_enrollment.my_new_table ...` per the existing pattern.
   - **Append-only:** add block triggers for UPDATE and DELETE, AND add the table name to `APPEND_ONLY_TABLES` in `tests/snap/compliance/test_audit_trigger_coverage.py`.
5. `test_audit_trigger_coverage.py::test_every_pii_table_is_audited_or_appendonly` will fail until step 4 is done — by design.

---

## Why no application-level `withAudit`?

There IS a `withAudit` helper at `apps/api/src/audit/withAudit.ts`, but it's only used by the legacy `webhooks.ts` route against the now-dropped `public.snap_audit_log` table. The `snap_enrollment.audit_log_events` table is populated by triggers — no application code change required when adding new mutation routes.

If you find yourself wanting to add `withAudit` to a new route, ask first whether the database trigger isn't already covering you. The answer is almost always yes: any INSERT/UPDATE/DELETE on a snap_enrollment table emits an audit row, regardless of which application code path triggered it.

---

## Regression guard

`tests/snap/compliance/test_audit_trigger_coverage.py` is CI-blocking and asserts:

1. Every PII-registered table is either audit-triggered or on the append-only allowlist.
2. Every append-only table actually has block-mutation triggers (otherwise the "append-only" guarantee is fiction).
3. No table is both audit-triggered AND append-only (would cause double-logging).
4. Every audit trigger references a real table (catches drift if a table is renamed/dropped).
5. Every PII-registry entry references a real table (catches typos in the insert tuple).

When the test fails, the fix is in one of: migration 05 (add trigger), migration 04 (add block trigger), `APPEND_ONLY_TABLES` allowlist (mark intent).
