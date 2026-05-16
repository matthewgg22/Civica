# SNAP Enrollment-Readiness — Database Mission & Task Outline

**Status:** Outline / pre-implementation. Awaiting decisions on the open
questions in §7 before any migrations are written.
**Owner:** Matthew
**Drafted:** 2026-05-16

---

## 1. Mission

Design and deliver the shared Postgres schema (hosted on Supabase) that backs
a four-surface SNAP **enrollment-readiness** product:

| Surface | Stack | Role |
|---|---|---|
| iOS B2C app | SwiftUI (exists) | Applicant intake on phone |
| Web B2C app | Next.js (new) | Applicant intake on desktop |
| REST API | Hono on Node (new) | Sole writer; enforces invariants |
| Navigator dashboard | Next.js (new) | Staff review, confirm, hand off |

One Supabase Postgres instance. RLS is mandatory; the API uses the
service-role key and is the single intended writer, but RLS is
defense-in-depth so no leaked anon/auth token can bypass scoping rules.

### What this system **is**

A workflow tracker that captures an applicant's answers, ingests their
documents, lets a navigator review/confirm/correct, and produces a packet
the navigator hands off to the relevant state SNAP agency. The product's
job ends at "Handed Off" — the state agency makes the eligibility call.

### What this system **is NOT** (load-bearing)

- It does **not** decide whether anyone qualifies for SNAP.
- It does **not** store an "approved" / "denied" / "eligible" / "ineligible"
  outcome. Those words are banned in the schema, the API surface, and
  any UI copy that reads from this DB.
- The status enum (§3 invariant 2) is the *only* lifecycle vocabulary.

---

## 2. Architectural context (what already exists)

The repo currently has an **eligibility-screener** SNAP schema in
[supabase/migrations/20260510_add_snap_initial_schema.sql](supabase/migrations/20260510_add_snap_initial_schema.sql)
with these tables:

- `snap_sessions` (anonymous-first, magic-link recovery)
- `snap_conversation_turns` (Fernet-encrypted transcript)
- `snap_extracted_state` (rules-engine input snapshots)
- `snap_documents` (OCR + confirmation)
- `snap_eligibility_results` — **status enum includes `eligible`/`ineligible`/etc.**
- `snap_audit_log` (append-only via trigger)

This schema is the *eligibility-screener* product. The new
enrollment-readiness product is a different vertical. Treating them as
the same DB requires an explicit decision (§7, Q1).

Other relevant priors:
- Application-layer Fernet (`snap_v1::` prefix) encrypts every PII column;
  the backend refuses to start without `SNAP_FERNET_KEY`.
- 7-year retention, append-only audit log enforced by `BEFORE UPDATE/DELETE`
  triggers raising `42501`.
- RLS pattern: authenticated users see rows where they own the parent session.
- All writes today go through the FastAPI backend (Python). The new spec
  introduces a Hono/Node API — that's an additional service, not a
  replacement (§7, Q2).

---

## 3. Hard invariants (from spec — restated for the checklist)

1. **Three-value preservation** on every answerable field:
   `applicant_answer`, `original_ocr_value`, `navigator_confirmed_value`.
   First two are write-once; only the third is mutable.
2. **Status enum** on `snap_packets` is *exactly*:
   `Draft`, `Submitted for Review`, `Needs Documents`,
   `Needs Applicant Clarification`, `In Navigator Review`,
   `Ready for Handoff`, `Handed Off`, `Closed`.
   Enforced via `CHECK` + Postgres `ENUM` type. No outcome words anywhere.
3. **Audit-in-same-txn** for every mutation of a packet, answer, document,
   extraction, or status. Enforced via `AFTER INSERT/UPDATE/DELETE` triggers
   that write to `audit_log_events`.
4. **Status transition guard** — packet cannot enter `Ready for Handoff` if:
   (a) any `required_document_items` is unresolved,
   (b) any `extraction_fields.confidence < threshold` is unreviewed,
   (c) no current `user_consents` row.
   Enforced via `BEFORE UPDATE` trigger that raises on violation.
5. **State scoping** = {`CA`, `MA`} via `CHECK (state_code IN ('CA','MA'))`.
   (Matches the existing `SNAPAgencyDirectory` source of truth from the
   2026-05-13 MA→CA launch decision.)
6. **PII tagging** — every PII column gets `COMMENT 'PII'`. Grep-driven
   inventory.
7. **RLS scoping**:
   - applicants → own rows only (via `auth.uid()` join through `applicants`).
   - navigators → packets assigned to them OR in their org.
   - admins → all packets in their org.
   - Cross-org reads denied to everyone except a `service_role` /
     dedicated `auditor` role.

Additional house rules from spec:
- snake_case for tables & columns.
- UUID v7 PKs (requires `pg_uuidv7` extension or a `gen_uuidv7()` function — §7, Q3).
- All timestamps `timestamptz`, UTC.
- Soft-delete via `deleted_at` **except** for applicant-personal data,
  which is hard-deleted on consent withdrawal (FK `ON DELETE CASCADE`
  from `applicants`).

---

## 4. Deliverables (the four artifacts the spec asked for)

1. **Numbered, idempotent SQL migrations** under
   `supabase/migrations/2026MMDD_snap_enrollment_*.sql`, split as:
   - `..._01_types_and_extensions.sql` — extensions, enums, helper functions
   - `..._02_tables_core.sql` — applicants, snap_packets, packet_answers, status_history
   - `..._03_tables_documents.sql` — uploaded_documents, document_extractions, extraction_fields, required_document_items, missing_item_requests
   - `..._04_tables_staff.sql` — staff_users, staff_roles, packet_assignments, navigator_notes
   - `..._05_tables_compliance.sql` — handoff_exports, audit_log_events, user_consents
   - `..._06_triggers_audit.sql` — generic audit trigger + per-table attachments
   - `..._07_triggers_guards.sql` — three-value-preservation + status-transition guard
   - `..._08_rls_policies.sql` — RLS enabled + policies per role
2. **Mermaid ERD** at `docs/snap/enrollment_readiness_erd.md`.
3. **Seed script** at `supabase/seed/snap_enrollment_demo.sql` — ~20 packets
   across all 8 statuses × {CA, MA}, with realistic answers, doc rows, and
   extraction rows at varying confidence (≥3 below the review threshold so
   the guard can be exercised).
4. **README** at `docs/snap/enrollment_readiness_db_README.md` covering:
   - Local Supabase (`supabase start` / `supabase db reset`) apply path.
   - Hosted Supabase apply path (`supabase db push` + manual review).
   - Seed application command.
   - Rollback strategy per migration.
   - PII grep recipe (`grep -r "COMMENT 'PII'" supabase/migrations/`).

---

## 5. Task breakdown (phased)

Each phase is a discrete commit/PR, matching the plan-then-commit-per-step
workflow.

### Phase 0 — Decisions (this doc)
- [ ] Resolve §7 open questions with user.
- [ ] Confirm branch strategy (new feature branch off `codex/rebuild-feb18`,
      or land on `claude/civica-snap-v1` per branch-hygiene memory).

### Phase 1 — Skeleton & types
- [ ] Migration 01: extensions (`pgcrypto`, `pg_uuidv7` or local helper),
      enum types for status + role + consent_kind + document_kind,
      `gen_uuidv7()` helper.
- [ ] Verify locally with `supabase db reset`.

### Phase 2 — Core packet tables
- [ ] Migration 02: `applicants`, `snap_packets`, `packet_answers`
      (three-value columns + write-once guard placeholder), `packet_status_history`.
- [ ] Unit test: insert applicant + packet, assert status defaults to `Draft`.

### Phase 3 — Document pipeline tables
- [ ] Migration 03: `uploaded_documents`, `document_extractions`,
      `extraction_fields` (with `confidence`, `reviewed_at`, `reviewed_by`),
      `required_document_items`, `missing_item_requests`.

### Phase 4 — Staff & assignment tables
- [ ] Migration 04: `staff_roles` (seeded with navigator/admin/auditor),
      `staff_users` (FK to `auth.users`), `packet_assignments`,
      `navigator_notes`.

### Phase 5 — Compliance tables
- [ ] Migration 05: `handoff_exports` (immutable artifact pointer),
      `audit_log_events` (append-only via trigger),
      `user_consents` (versioned, supersede-on-rewithdrawal).

### Phase 6 — Audit triggers
- [ ] Migration 06: generic `audit_row_change()` function + per-table
      `AFTER INSERT/UPDATE/DELETE FOR EACH ROW` triggers. Same-txn
      guarantee: trigger raises if `audit_log_events` insert fails.

### Phase 7 — Guard triggers
- [ ] Migration 07:
    - `enforce_three_value_immutability()` BEFORE UPDATE on `packet_answers`
      and `extraction_fields`.
    - `enforce_status_transition()` BEFORE UPDATE on `snap_packets` — checks
      the three Ready-for-Handoff preconditions.
- [ ] Regression tests: each forbidden transition raises `P0001` with
      diagnostic message.

### Phase 8 — RLS policies
- [ ] Migration 08: `ENABLE ROW LEVEL SECURITY` on every table, then
      per-role policies. Cross-org isolation tested by spinning up two
      `auth.users` in different orgs and asserting `SELECT` returns zero
      rows.

### Phase 9 — Seed + ERD + README
- [ ] Seed script with deterministic fixtures (use fixed UUIDs).
- [ ] Mermaid ERD generated and reviewed for completeness.
- [ ] README walks through local + hosted apply, seed, rollback.

### Phase 10 — Cross-surface contract
- [ ] Generate TypeScript types from the schema (for Hono API + both
      Next.js apps) — likely via `supabase gen types typescript`.
- [ ] Update iOS layer: which Swift models change vs. stay screener-only
      depends on §7 Q1.

---

## 6. Risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Schema name collision with existing `snap_*` eligibility tables. | Prefix new tables with `snap_pkt_*` OR put in a `snap_enrollment` schema. Decision in §7 Q1. |
| R2 | Audit trigger fires inside the same txn → write amplification. | Acceptable cost for the compliance invariant; index `audit_log_events(occurred_at desc, packet_id)`. |
| R3 | Three-value immutability via trigger only catches direct UPDATEs; service-role can still `DELETE + INSERT`. | Add a `created_at` immutability check too; document the service-role responsibility in the README. |
| R4 | `pg_uuidv7` extension is not on Supabase's default allowlist. | Fallback: implement `gen_uuidv7()` in PL/pgSQL using `gen_random_bytes(10)`. |
| R5 | Status transition guard depends on rows in other tables — race conditions under concurrent navigator edits. | Use `SELECT ... FOR UPDATE` on the packet row inside the trigger; document the serialization expectation. |
| R6 | Spec says `COMMENT 'PII'` for PII but existing posture is Fernet-encrypted-at-rest. Downgrade risk. | §7 Q4 — must be explicitly chosen, not silently dropped. |
| R7 | Seed script in `public` schema with realistic PII-shaped data could leak into prod if applied to wrong env. | Guard with `\if :{?seed_demo}` and require `--variable seed_demo=1` to run. README spells out the guard. |

---

## 7. Open questions (need user decisions before Phase 1)

**Q1 — Coexistence with the existing eligibility-screener schema.**
The existing `snap_eligibility_results.status` includes `eligible`/`ineligible` —
banned in the new spec. Three options:
  - **(a)** New tables live alongside under `snap_pkt_*` prefix. Old screener
    tables untouched, used only by the existing eligibility-screener flow.
  - **(b)** New tables live in a separate `snap_enrollment` Postgres schema.
    Cleaner namespace but more cross-schema FK plumbing.
  - **(c)** Migrate the existing screener tables into the new model (the new
    `snap_packets` replaces `snap_sessions` + `snap_eligibility_results`).
    Biggest blast radius; requires backfill + iOS app update.

**Q2 — Hono vs. existing FastAPI.**
The repo currently has a FastAPI backend (`backend/civic_api`) that is the
sole writer for the eligibility-screener tables. The spec introduces a Hono
API. Is the Hono API:
  - **(a)** the new sole writer for the *enrollment* tables only (FastAPI
    keeps screener tables), or
  - **(b)** a replacement that will subsume the FastAPI surface over time, or
  - **(c)** writing to the same tables alongside FastAPI?
This affects RLS role design (one or two service-role principals?) and the
audit `actor_kind` enum.

**Q3 — UUID v7 source.**
Supabase Postgres ships pgcrypto but not `pg_uuidv7`. Prefer:
  - **(a)** request the extension be enabled via the Supabase dashboard, or
  - **(b)** implement a `gen_uuidv7()` PL/pgSQL helper (RFC 9562 reference)?

**Q4 — PII encryption posture.**
Spec says `COMMENT 'PII'`. Existing posture is application-layer Fernet on
every PII column, with a stated reason (a documented privacy decision
record). Choices:
  - **(a)** Continue Fernet for the new tables (consistent posture; iOS/web/Hono
    all need the key + helper).
  - **(b)** Drop to Supabase at-rest encryption only + `COMMENT 'PII'` marker
    (matches spec literally; lighter ops; but a posture downgrade that
    needs to be acknowledged).
  - **(c)** Hybrid — encrypt the highest-sensitivity columns (SSN, DOB) and
    leave routine PII (name, address) plaintext.

**Q5 — Confidence threshold for the §3 invariant 4(b) guard.**
The transition guard needs a numeric threshold for "low-confidence extraction
fields must be reviewed." Existing screener uses `0.0–1.0`. Suggested: `< 0.85`
must be `reviewed_at IS NOT NULL`. Confirm or specify.

**Q6 — Org model for staff.**
"Navigators see only packets in their org" implies a `staff_orgs` table the
spec didn't enumerate. Adding it (recommended). Single-org-per-staff or
many-to-many?

---

## 8. Out of scope for this mission

- Hono API implementation (separate task).
- Next.js apps (separate task).
- iOS app changes (separate task; depends on Q1).
- Production data migration from screener tables to enrollment tables
  (separate task if Q1 = (c)).
- Notification / messaging infrastructure for `missing_item_requests`
  (separate task — this DB just records the request).

---

## 9. Done definition

- All 8 migrations apply cleanly on `supabase db reset` from empty.
- All 8 migrations are idempotent (second `supabase db push` is a no-op).
- Seed script produces ≥20 packets covering all 8 statuses × {CA, MA}.
- Mermaid ERD renders and includes every table.
- RLS regression tests prove cross-org / cross-applicant isolation.
- Audit trigger regression tests prove every mutation lands in
  `audit_log_events` in the same txn.
- Status-transition guard regression tests cover all 3 Ready-for-Handoff
  preconditions.
- README walkthrough verified by a fresh `supabase start` on this machine.
- Branch lands per branch-hygiene memory (infra/migration commits separate
  from feature commits).
