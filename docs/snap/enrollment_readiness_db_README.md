# SNAP Enrollment-Readiness — Database Setup

All enrollment tables live in the `snap_enrollment` Postgres schema on the shared Supabase instance. They coexist with the existing eligibility-screener tables in `public`.

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 1.170
- Local Docker for `supabase start`
- `SUPABASE_DB_PASSWORD` set for hosted apply commands

---

## Local development

### First-time setup

```bash
supabase start          # starts local Postgres + Studio
supabase db reset       # applies all migrations in order, then runs supabase/seed/*.sql
```

`supabase db reset` is fully idempotent — run it any time you want a clean slate.

### Applying just the enrollment migrations

```bash
# Apply only new migrations (incremental)
supabase db push --local
```

### Applying the demo seed

The seed script is **opt-in** and requires an explicit flag to prevent accidental runs against production.

```bash
psql "$(supabase db url --local)" \
  --variable seed_demo=1 \
  -f supabase/seed/snap_enrollment_demo.sql
```

After the seed runs, a verification query prints the packet count per status × state. Expected output:

```
status                        | state_code | packet_count
------------------------------+------------+--------------
Draft                         | CA         | 2
Draft                         | MA         | 2
Handed Off                    | CA         | 1
In Navigator Review           | CA         | 1
In Navigator Review           | MA         | 1
Needs Applicant Clarification | CA         | 1
Needs Applicant Clarification | MA         | 1
Needs Documents               | CA         | 1
Needs Documents               | MA         | 1
Ready for Handoff             | CA         | 1
Submitted for Review          | CA         | 1
Submitted for Review          | MA         | 2
Closed                        | MA         | 1
```

---

## Hosted Supabase (production)

### Review before pushing

```bash
# Dry-run: show what would be applied
supabase db diff --linked
```

### Apply migrations

```bash
# Link project (one-time)
supabase link --project-ref <your-project-ref>

# Push all pending migrations
supabase db push
```

Migrations run inside a single transaction per file. If any file fails, it rolls back and leaves the DB in the last successful state.

### Seed on hosted (staging only — never production)

```bash
psql "$STAGING_DATABASE_URL" \
  --variable seed_demo=1 \
  -f supabase/seed/snap_enrollment_demo.sql
```

---

## Migration inventory

| File | What it does |
|---|---|
| `20260516_snap_enrollment_01_types_and_extensions.sql` | `snap_enrollment` schema, `gen_uuidv7()`, all enum types, `enrollment_config` |
| `20260516_snap_enrollment_02_tables_core.sql` | `staff_orgs`, `staff_roles`, `staff_users`, `applicants`, `snap_packets`, `packet_status_history`, `packet_answers`, `packet_assignments` |
| `20260516_snap_enrollment_03_tables_documents.sql` | `uploaded_documents`, `document_extractions`, `extraction_fields`, `required_document_items`, `missing_item_requests` |
| `20260516_snap_enrollment_04_tables_compliance.sql` | `navigator_notes`, `user_consents`, `handoff_exports`, `audit_log_events` |
| `20260516_snap_enrollment_05_triggers_audit.sql` | Generic `audit_row_change()` trigger + PII redaction; attached to all mutable tables |
| `20260516_snap_enrollment_06_triggers_guards.sql` | Three-value immutability guard + status transition guard + Ready-for-Handoff preconditions |
| `20260516_snap_enrollment_07_rls_policies.sql` | RLS enabled on all tables; applicant / navigator / admin / auditor policies |

---

## Rollback strategy

Each migration is idempotent on re-apply. For a hard rollback:

```sql
-- Drop the entire schema (DANGEROUS — deletes all enrollment data)
drop schema snap_enrollment cascade;
```

For targeted rollbacks, drop individual tables in reverse dependency order:
```
audit_log_events → handoff_exports → user_consents → navigator_notes →
missing_item_requests → required_document_items → extraction_fields →
document_extractions → uploaded_documents → packet_assignments →
packet_answers → packet_status_history → snap_packets →
applicants → staff_users → staff_roles → staff_orgs
```

Then drop functions and types:
```sql
drop function snap_enrollment.gen_uuidv7() cascade;
drop type snap_enrollment.packet_status cascade;
-- ... repeat for all types
```

---

## Setting actor context for writes

Every write that mutates a packet, answer, document, extraction, or status must set transaction-local variables so the audit trigger can record the actor. The Hono API must do this at the start of each request transaction:

```sql
set local snap_enrollment.actor_kind = 'navigator';     -- or 'applicant', 'admin', 'system'
set local snap_enrollment.actor_id   = '<staff_id>';    -- UUID as text
set local snap_enrollment.request_id = '<request_uuid>';
```

For status transitions, optionally add:
```sql
set local snap_enrollment.transition_reason = 'Navigator confirmed all documents';
```

---

## PII inventory

Find every PII column across all migrations:

```bash
grep -rn "COMMENT 'PII'" supabase/migrations/20260516_snap_enrollment_*.sql
```

All PII values should be Fernet-encrypted at the application layer with the `snap_v1::` prefix before being written to the database. The `SNAP_FERNET_KEY` env var must be set in the backend. See [security_model.md](security_model.md) for the encryption policy.

---

## Confidence threshold

The `Ready for Handoff` guard blocks transition if any `extraction_fields.confidence < 0.85` and `reviewed_at IS NULL`. The threshold is stored in:

```sql
select value from snap_enrollment.enrollment_config
where key = 'extraction_confidence_review_threshold';
```

To change the threshold without a migration:
```sql
update snap_enrollment.enrollment_config
  set value = '0.90'
  where key = 'extraction_confidence_review_threshold';
```

Note: `needs_review` is a **generated column** (`confidence < 0.85` hardcoded). If you change the config threshold you must also write a migration to alter the generated column expression.

---

## TypeScript types

Generate Supabase TypeScript types for use in the Hono API and Next.js apps:

```bash
supabase gen types typescript --local \
  --schema snap_enrollment \
  > packages/db-types/snap_enrollment.ts
```

Re-run this after any schema migration.

---

## Generating a new migration

Follow the existing naming convention:

```
20260516_snap_enrollment_NN_description.sql
```

Where `NN` is the next sequential number. All statements must be idempotent (`CREATE IF NOT EXISTS`, `OR REPLACE`, `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`, etc.).
