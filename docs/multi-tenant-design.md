# Multi-Tenant Design — Civica QC Platform

**Status:** LOCKED 2026-05-18 via /plan-eng-review T3 design spike
**Pattern:** Schema-ready, behavior-deferred
**Owner:** Coordinator session (claude/clever-albattani-816917)

## Summary

Civica's data model supports multi-tenant CBO operation from day one at the schema level, but defaults all data to a single tenant (`org_id='civica'`) for MVP. Adding tenant #2 requires zero schema migrations — only `INSERT INTO orgs` and a per-session config switch.

For MVP: Civica is treated as a CBO (`org_type='cbo'`). Civica navigators are caseworkers of the Civica org. There is no "platform admin" concept yet. When CBO #2 signs, a second `orgs` row is added; RLS policies already scope correctly.

This document is the spec consumed by T2, T4, T5, T8, T10 build sessions.

## Decisions locked

| # | Decision | Source |
|---|----------|--------|
| D10 | CBO is top-level tenant; flat peer model (no state-as-parent hierarchy) | session 2026-05-18 |
| D11 | A caseworker belongs to exactly one tenant | session 2026-05-18 |
| D12 | Packets are portable; applicant owns data; org transfers are audit-logged + consent-gated | session 2026-05-18 |
| D13 | Civica is treated AS a CBO for MVP (`org_type='cbo'`); platform_admin concept deferred until tenant #2 | session 2026-05-18 |
| D14 | Audit log full attribution: `actor_user_id`, `actor_org_id`, `packet_org_id_at_time`, `on_behalf_of_org` | session 2026-05-18 |

## Schema

### New table — `snap_enrollment.orgs`

```sql
CREATE TABLE snap_enrollment.orgs (
  org_id        TEXT PRIMARY KEY,                     -- e.g. 'civica', 'cathchar-la'
  org_type      TEXT NOT NULL CHECK (org_type IN ('cbo', 'platform')),
  display_name  TEXT NOT NULL,
  contact_email TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB DEFAULT '{}'::jsonb
);

-- MVP seed
INSERT INTO snap_enrollment.orgs (org_id, org_type, display_name)
VALUES ('civica', 'cbo', 'Civica');
```

`org_type='platform'` is reserved for future cross-tenant Civica super-admin operation. Not used in MVP.

### Column rollout to operational tables

Add `org_id TEXT NOT NULL DEFAULT 'civica' REFERENCES snap_enrollment.orgs(org_id)` to:

- `snap_enrollment.applicants`
- `snap_enrollment.snap_packets`
- `snap_enrollment.packet_answers`
- `snap_enrollment.uploaded_documents`
- `snap_enrollment.missing_item_requests`
- `snap_enrollment.notes`
- `snap_enrollment.audit_log_events`
- `snap_enrollment.users` (caseworker accounts)

The `DEFAULT 'civica'` makes the migration zero-downtime — every existing row backfills to civica.

`snap_packets` additionally gets `current_org_id TEXT REFERENCES snap_enrollment.orgs(org_id)` — separate from `org_id` (which records intake) — to support portability (D12). For MVP, both equal `'civica'`.

### New table — `snap_enrollment.packet_transfers` (portability scaffold)

```sql
CREATE TABLE snap_enrollment.packet_transfers (
  transfer_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id          UUID NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id),
  from_org_id        TEXT NOT NULL REFERENCES snap_enrollment.orgs(org_id),
  to_org_id          TEXT NOT NULL REFERENCES snap_enrollment.orgs(org_id),
  initiated_by_user  UUID NOT NULL REFERENCES snap_enrollment.users(user_id),
  applicant_consent  BOOLEAN NOT NULL,
  consent_evidence   JSONB,                            -- consent capture record
  transferred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Table exists from migration day. Transfer endpoint NOT built for MVP. When CBO #2 signs and the first portability case arises, the endpoint flips `packets.current_org_id` and writes a row here.

### Audit log shape

`snap_enrollment.audit_log_events` gains:

- `actor_org_id TEXT REFERENCES snap_enrollment.orgs(org_id)` — the org the actor belongs to
- `packet_org_id_at_time TEXT REFERENCES snap_enrollment.orgs(org_id)` — the org owning the packet when this event happened
- `on_behalf_of_org TEXT REFERENCES snap_enrollment.orgs(org_id)` — populated only when actor's org differs from packet's org (cross-tenant action by Civica platform staff; NULL for MVP)

All three columns get DEFAULT `'civica'` except `on_behalf_of_org` which is nullable.

The existing `redact_pii_json` trigger function is unchanged — org columns are not PII.

## RLS pattern

Every table that gained `org_id` gets a policy:

```sql
CREATE POLICY tenant_scope_select ON snap_enrollment.applicants
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::text
  );

CREATE POLICY tenant_scope_modify ON snap_enrollment.applicants
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::text
  );
```

(One pair per CRUD verb, per table.)

For MVP `app.current_org_id` is always `'civica'`. The setting is established by enrollment-api session middleware (see below). Service-role connections bypass RLS as today.

**Why session variable, not JWT claim:** Supabase JWT claims work for auth.uid() but layering a tenant ID claim into Supabase Auth tokens adds friction. A session GUC set by the API gateway per request is the simplest cross-cutting solution and matches how other multi-tenant Postgres apps do it.

## Session middleware (enrollment-api)

Hono middleware in `apps/enrollment-api/src/middleware/tenant.ts`:

```typescript
export const tenantScope = createMiddleware<{ Variables: { orgId: string } }>(
  async (c, next) => {
    const user = c.get('user');                       // already set by auth middleware
    const orgId = user.org_id ?? 'civica';            // MVP default
    c.set('orgId', orgId);

    // Push org into PG session for this request
    await c.var.db.query('SELECT set_config($1, $2, true)', [
      'app.current_org_id',
      orgId,
    ]);

    await next();
  }
);
```

Mounted before every route group that uses Supabase tables. For MVP, every authenticated user has `org_id='civica'`, so the policy is effectively a no-op.

iOS does not need to change — it talks to enrollment-api over HTTPS, the API sets the tenant context server-side.

## Onboarding flow (MVP — manual)

No self-service tenant creation in MVP. To add a tenant (when CBO #2 signs):

```sql
-- 1. Create the org row
INSERT INTO snap_enrollment.orgs (org_id, org_type, display_name, contact_email)
VALUES ('cathchar-la', 'cbo', 'Catholic Charities Los Angeles', 'snap@cathchar-la.org');

-- 2. Create their first caseworker (Supabase Auth + users row)
-- Done via Supabase admin SDK; org_id set to 'cathchar-la'
```

That's the entire onboarding for MVP. Self-service UI is post-MVP.

## What this design does NOT include (deferred)

- **Platform_admin role / cross-tenant analytics views.** Built when tenant #2 onboards.
- **Packet transfer endpoint.** Built when first portability case arises.
- **Multi-org caseworker switcher UI.** Deferred unless needed (D11 locked single-org).
- **Per-tenant billing or feature flags.** Out of scope; commercial layer.
- **Tenant-scoped Supabase Auth signup flow.** Manual SQL onboarding is fine for first 2-3 partners.
- **Cross-tenant aggregate dashboards.** State-facing surface (T5) reads from analytical tier (T10), which can pre-aggregate without RLS gymnastics.

## Knock-on impact on other T-tasks

| Task | Impact | What it must do |
|------|--------|-----------------|
| T1 (confidence gate) | None | Operates per-request; tenant scope is invisible |
| T2 (extract QC engine) | None | Pure logic; no tenant awareness |
| T4 (defensibility tests) | Fixtures gain `org_id` column for forward compat | Use `org_id='civica'` in all golden fixtures |
| T5 (state-facing surface) | Reads pre-aggregated analytical tier; no live RLS | Build single-tenant; add tenant filter post-MVP |
| T6 (compliance copy) | None | Copy is global, not tenant-scoped |
| T7 (baseline pipeline) | None | Reads external data only |
| T8 (pilot instrumentation) | Events get `org_id` from session middleware | Aggregations correct from day one |
| T9 (state connectors) | None | External APIs; tenant-agnostic |
| T10 (analytics tier) | Parquet schemas SHOULD include `org_id` column | Even when MVP only has 'civica' values |

## Build order

1. Migration `20260530_orgs_table.sql` — orgs table + seed civica row
2. Migration `20260531_org_id_columns.sql` — add org_id to all listed tables with DEFAULT 'civica'
3. Migration `20260532_org_rls_policies.sql` — tenant_scope_* policies on each table
4. Migration `20260533_packet_transfers.sql` — portability scaffold
5. Migration `20260534_audit_org_attribution.sql` — three new audit columns
6. `apps/enrollment-api/src/middleware/tenant.ts` — session middleware
7. Wire middleware into all authenticated routes
8. Smoke test: confirm RLS is in effect (an arbitrary query without session var returns nothing)

Steps 1–7 land as one PR. No application behavior changes. Existing tests continue to pass because every query implicitly sees `org_id='civica'`.

## Open questions parked for tenant #2 onboarding

- **Platform_admin permission model.** What can Civica super-admins see/do across tenants?
- **Cross-tenant analytics ACL.** Who at Civica can see aggregated error-rate stats? Probably not all employees.
- **Tenant data isolation audits.** Periodic SQL probe to confirm no cross-tenant leaks; cron job worth designing before tenant #2.
- **Tenant offboarding / data export.** If a CBO leaves, what happens to their packets and audit history?
- **PII residency.** Does any tenant require region-specific Supabase project (e.g., a tribal nation, a state with data sovereignty rules)? Affects whether single Supabase project is the right long-term architecture.

These are real questions but answering them now is premature — actual partner conversations will shape them.

## Sign-off

Locked in `/plan-eng-review` coordinator session 2026-05-18. T3 deliverable complete. Build sessions consume this document as authoritative spec.
