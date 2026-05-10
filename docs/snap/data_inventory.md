# civicaSNAP data inventory

Every PII field that the SNAP vertical collects, processes, or stores. This is the input to data-processing agreements, deletion requests, and the annual privacy review.

---

## Storage locations

### Supabase Postgres

| Table | PII columns | Encryption | Retention |
|-------|-------------|------------|-----------|
| `snap_sessions` | `state`, `language`, `partner_id` (not PII per se but tied to user) | At-rest only | 7 years |
| `snap_conversation_turns` | `content_ciphertext` (every user utterance + assistant question) | Fernet (app) + at-rest | 7 years |
| `snap_extracted_state` | `snapshot_ciphertext` (Pydantic-serialized PartialHousehold) | Fernet (app) + at-rest | 7 years |
| `snap_documents` | `extracted_payload_ciphertext`, `user_corrections_ciphertext`, plus blob in Storage | Fernet (app) + at-rest | 7 years |
| `snap_eligibility_results` | `household_snapshot_ciphertext`, `result_ciphertext` | Fernet (app) + at-rest | 7 years |
| `snap_audit_log` | `session_id`, `actor_id`, `reason` (no PII content; metadata only) | At-rest only | 7 years (no cascade delete) |

### Supabase Storage

Encrypted document blobs land in a private bucket. Object paths are referenced from `snap_documents.storage_path`. Bucket policy is service-role-only; signed URLs are minted per-read.

### iOS device

- `SNAPApplicationDraft` and `PartialHousehold` cache: in-memory only (never UserDefaults / Keychain / files).
- Application-PDF blob: written to `FileManager.temporaryDirectory` with file-protection class `completeFileProtectionUnlessOpen`. The system reaps temp directory contents; we don't keep a long-lived copy.
- Conversation transcript: held in `SNAPConversationViewModel`'s `transcript` array, in-memory only.

### LLM provider (Anthropic / OpenAI fallback)

- User utterances are sent to the LLM as part of every Interpreter and Script-Writer call.
- Document images are sent to the LLM as part of every classifier and extractor call.
- The LLM provider's BAA covers retention and processing. Civica does not store the raw provider exchanges separately — only the structured output is persisted in `snap_conversation_turns`.

---

## Field-level inventory

### Conversation pipeline

| Field | Origin | Storage | Encrypted at app layer |
|-------|--------|---------|------------------------|
| User utterance text | iOS user input | `snap_conversation_turns.content_ciphertext` | Yes |
| Assistant question text | LLM Script-Writer output | `snap_conversation_turns.content_ciphertext` | Yes |
| Member age | Interpreter extraction | `snap_extracted_state.snapshot_ciphertext` (JSON) | Yes |
| Member citizenship | Interpreter extraction | `snap_extracted_state.snapshot_ciphertext` | Yes |
| Member student status / exemption | Interpreter extraction | `snap_extracted_state.snapshot_ciphertext` | Yes |
| Income source amounts | Interpreter extraction | `snap_extracted_state.snapshot_ciphertext` | Yes |
| Rent / utilities / shelter expenses | Interpreter extraction | `snap_extracted_state.snapshot_ciphertext` | Yes |
| Cash-program receipt flags | Interpreter extraction | `snap_extracted_state.snapshot_ciphertext` | Yes |

### Documents

| Field | Origin | Storage | Encrypted at app layer |
|-------|--------|---------|------------------------|
| Document image bytes | iOS camera | Supabase Storage encrypted bucket | At-rest only |
| Document classification (type + confidence) | Vision LLM classifier | `snap_documents.extracted_payload_ciphertext` (JSON) | Yes |
| Paystub extracted fields (employer, period, wages, deductions) | Vision LLM extractor | `snap_documents.extracted_payload_ciphertext` (JSON) | Yes |
| User corrections | iOS confirmation UI | `snap_documents.user_corrections_ciphertext` (JSON) | Yes |
| Validator flags | Pure-Python validator | `snap_documents.validator_errors` (JSON) | No (codes + messages only, no values) |

### Application PDF

| Field | Origin | Storage | Encrypted at app layer |
|-------|--------|---------|------------------------|
| Generated PDF bytes | Backend ReportLab renderer | NOT persisted; streamed to iOS | N/A |
| `populated_field_paths` | Data assembly | Recorded in audit row `reason` field | N/A (paths only, no values) |
| Eligibility result | Rules engine | `snap_eligibility_results.result_ciphertext` | Yes |

---

## Categorical PII that is NOT collected

The SNAP module deliberately avoids these even though some state forms ask for them. Avoiding them at the source eliminates entire risk categories:

- Social Security Number (SSN)
- Bank account number / routing number
- Full immigration document numbers (only categorical citizenship status)
- Document image data inlined in any non-`_ciphertext` column

The privacy-boundary tests in `WeVote Information PageTests/SNAPPrivacyBoundaryTests.swift` enforce this for the iOS-side draft model.

---

## Subject-access requests

When a user (or someone on their behalf) requests a copy of their data:

1. Identify all sessions tied to the user via magic-link recovery records.
2. Pull all rows from `snap_sessions`, `snap_conversation_turns`, `snap_extracted_state`, `snap_documents`, and `snap_eligibility_results` for those session IDs.
3. Decrypt every `_ciphertext` column using the active `SNAP_FERNET_KEY`.
4. Provide as JSON + the original document image blobs from Storage.
5. Include the audit log entries for those sessions so the user can see what was accessed and by whom.

A CLI helper for steps 2–5 lives in `bin/snap_audit` (planned, not yet built — see [incident_response.md](incident_response.md)).

---

## Subject-deletion requests

The retention policy gives users a 7-year window during which records exist; deletion before that window is supported via the `purge_snap_retention()` Postgres function with a session-id filter.

When a user requests deletion before the natural retention window:

1. Confirm the request via magic-link to the channel of record (matches the recovery flow).
2. Delete from `snap_sessions` — cascades to conversation_turns, extracted_state, documents, eligibility_results.
3. Delete the blobs from Supabase Storage (separate, scripted step).
4. **Do NOT delete from `snap_audit_log`** — the trigger blocks it, by design. The audit trail outlives the session for compliance review. Deletion of the session is itself an audit event.

See [retention_policy.md](retention_policy.md) for the deletion runbook.
