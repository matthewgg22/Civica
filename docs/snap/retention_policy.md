# civicaSNAP retention policy

The 7-year retention window matches the longest applicable benefits record requirement across state agency contracts and federal SNAP regulations. Audit log entries outlive sessions for compliance review.

---

## Default retention windows

| Data | Window | Mechanism |
|------|--------|-----------|
| `snap_enrollment.snap_packets` | 7 years from `created_at` | `snap_enrollment.purge_snap_retention()` daily cron (04:00 UTC, migration 13) |
| `snap_enrollment.packet_answers` | Cascades with packet deletion | FK `on delete cascade` |
| `snap_enrollment.packet_status_history` | Cascades with packet deletion | FK `on delete cascade` |
| `snap_enrollment.document_extractions` | Cascades with packet deletion | FK `on delete cascade` |
| `snap_enrollment.uploaded_documents` | Cascades with packet deletion | FK `on delete cascade` |
| `snap_enrollment.missing_item_requests` | Cascades with packet deletion | FK `on delete cascade` |
| `snap_enrollment.navigator_notes` | Cascades with packet deletion | FK `on delete cascade` |
| `snap_enrollment.handoff_exports` | Cascades with packet deletion | FK `on delete cascade` |
| Document blobs in `documents` Storage bucket | 7 years from upload | Supabase Storage lifecycle rule (configured separately) |
| `snap_enrollment.audit_log_events` | 7 years from `occurred_at` (no cascade) | Append-only by trigger; purge requires counsel sign-off (see below) |

The cron job runs once per day at 04:00 UTC. Mid-window deletion (subject-deletion request, see below) is on-demand.

**Audit log purge procedure.** `snap_enrollment.audit_log_events` is protected by the `block_audit_mutation` trigger which raises on any UPDATE/DELETE. Removing audit rows past their 7-year window requires (1) written counsel authorization, (2) temporary disabling of the trigger inside a single transaction, (3) bounded DELETE with explicit `event_at < now() - interval '7 years'` filter, (4) trigger re-enabled before commit. The daily retention purge function does NOT touch this table.

---

## Subject-initiated deletion request

When a user requests deletion of their data before the 7-year window:

### Step 1 — Confirm the request

Reply to the request via the same channel the user used to recover their session originally (phone if magic-link was SMS, email if magic-link was email). The reply requires the user to click a confirmation link. Without confirmation, no deletion happens — this prevents impersonation-driven data destruction.

### Step 2 — Identify all packet IDs for the applicant

```sql
select packet_id
from snap_enrollment.snap_packets
where applicant_id = (
  select applicant_id from snap_enrollment.applicants where auth_uid = $1
);
```

For pre-recovery anonymous packets (auth_uid IS NULL), use the magic-link issuance log to find the applicant_id the user originally created.

### Step 3 — Run the deletion

```sql
delete from snap_enrollment.snap_packets
where packet_id = any($1::uuid[]);
```

Cascades take care of packet_answers, packet_status_history, document_extractions, uploaded_documents, missing_item_requests, navigator_notes, packet_assignments, handoff_exports.

### Step 4 — Storage blob cleanup

```bash
# Path convention: documents/{applicant_id}/{packet_id}/{filename}
supabase storage rm documents/<applicant_id>/<packet_id>/* --recursive
```

### Step 5 — Audit log preservation

The `snap_enrollment.block_audit_mutation` trigger prevents row deletion from `audit_log_events`. The audit trail of what was accessed during the user's session lifetime remains until its own 7-year window passes. This is intentional; SOC 2 audits depend on the audit log existing for the full period.

The deletion event itself produces a final audit row:

```python
audit_logger.log(
    session_id=session_id,
    action=AuditAction.SESSION_DELETED,  # add this enum value if implementing
    actor_kind="admin",
    actor_id=operator_id,
    reason="user-requested deletion via channel <phone|email>",
)
```

(Note: `AuditAction.SESSION_DELETED` doesn't yet exist in `audit/logger.py`. Add when wiring the deletion runbook to a CLI.)

### Step 6 — Confirm to the user

Send a final confirmation to the channel of record stating the deletion has completed. Include the session reference and the deletion timestamp. Do NOT include the audit log entries (those reference internal actor IDs).

---

## Legal hold

If any session is subject to a legal hold (subpoena, ongoing litigation, regulatory request), it is excluded from the natural-retention purge AND from subject-initiated deletion. Legal holds are recorded outside this codebase — check with counsel before responding to any deletion request.

The `purge_snap_retention()` function does NOT currently honor legal holds. Before relying on it in production, add a `legal_hold` column to `snap_sessions` and a `not legal_hold` filter in the function.

---

## Backup retention

Supabase point-in-time recovery covers ~7 days of database state. PITR snapshots are governed by the Supabase project's data-residency contract; treat them as inheriting the same retention as the underlying data.

When a user's data is deleted, PITR snapshots from before the deletion will still contain it for the PITR window. Subject-deletion requests that must purge backups too require the user to wait the PITR window (~7 days) and then we re-confirm. This is documented in the deletion confirmation message.

---

## What's NOT covered by this policy

- iOS device-local state. The user controls retention on their own device. Uninstalling the Civica app removes everything iOS-side.
- LLM provider retention. Anthropic and OpenAI retain prompt content per their respective BAAs (typically 30 days for non-zero-retention enterprise tiers).
- Aggregate analytics. The SNAP analytics events are step_name / step_index / topic only — no PII. Retention is the analytics provider's default.
