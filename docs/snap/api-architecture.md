# SNAP API Architecture

**Status:** Accepted  
**Date:** 2026-05-17  
**Authors:** Platform team

---

## Summary

The SNAP backend is split across two intentionally separate services:

| Service | Directory | Runtime | Deployed on |
|---|---|---|---|
| **Gateway** | `apps/api/` | Node.js (Hono) | Fly.io |
| **Enrollment API** | `apps/enrollment-api/` | Cloudflare Workers (Hono) | Cloudflare |

These services have different audiences, auth models, and deployment constraints. **Do not merge them.**

---

## apps/api — Gateway (Fly Node)

### Responsibility

The gateway is the primary API host for the Civica iOS app, the admin dashboard, and webhook integrations. It owns routes that require Node.js runtime features (network calls to external APIs, heavy crypto, persistent DB connections) or operate on the `public` schema tables managed by the FastAPI engine.

### Route map

| Prefix | File | Description |
|---|---|---|
| `GET /healthz` | `routes/health.ts` | Health check |
| `/me/*` | `routes/applicant.ts` | Applicant self-service (legacy) |
| `/navigator/sessions` | `routes/navigator.ts` | Navigator session queue |
| `/navigator/sessions/:id/status` | `routes/navigator.ts` | Status transitions |
| `/navigator/sessions/:id/notes` | `routes/navigator.ts` | Navigator notes |
| `/navigator/sessions/:id/missing-items` | `routes/navigator.ts` | Missing-item requests |
| `/navigator/sessions/:id/handoff` | `routes/navigator.ts` | Handoff export |
| `/webhooks/*` | `routes/webhooks/` | OCR result ingestion |
| `/api/v1/snap/*` | `routes/snap/` | SNAP legacy routes |
| `/api/v1/webhooks/ocr` | `routes/webhooks/ocr.ts` | OCR webhook handler |
| `/openstates/*` | `routes/openstates/` | OpenStates legislator proxy |
| Civic routes (`/history`, `/calls`, etc.) | `routes/civic/` | Flask → Hono migration stubs |

### Auth model

- **Applicant routes (`/me`):** Supabase JWT issued by `supabase.auth.signInWithOtp`. Verified with `jose` + Supabase JWKS.
- **Navigator/staff routes (`/navigator`):** Supabase JWT with `app_metadata.role ∈ {navigator, supervisor, admin}`. Enforced by `requireStaffJwt` middleware. Rate-limited per IP via `navigatorRateLimit`.
- **Webhooks:** HMAC signature verified against `OCR_WEBHOOK_SECRET`. No user JWT.

### Database

- Connects to Supabase via the service-role key (`SUPABASE_SERVICE_ROLE_KEY`).
- Uses Kysely (`packages/db`) typed against the `public` schema.
- Reads `public.snap_sessions`, `public.snap_missing_item_requests`, `public.snap_handoff_exports` — populated by the FastAPI engine.
- Audit trail written by `withAudit()` in `apps/api/src/audit/`.

### Config files

- `fly.api.toml` — Fly.io app config
- `apps/api/Dockerfile`

---

## apps/enrollment-api — Enrollment API (CF Workers)

### Responsibility

The enrollment API handles the full lifecycle of a SNAP enrollment packet: creation, document upload, answer collection, navigator notes, consents, handoff, and applicant self-service inbox. It operates exclusively on the `snap_enrollment` schema.

All routes are prefixed `/v1/enrollment/`.

### Route map

| Prefix | File | Description |
|---|---|---|
| `GET /health` | inline | Health check |
| `/v1/enrollment/packets` | `routes/packets.ts` | Packet CRUD + status transitions |
| `/v1/enrollment/packets/:id/documents` | `routes/documents.ts` | Document upload + review |
| `/v1/enrollment/packets/:id/answers` | `routes/answers.ts` | Section answers |
| `/v1/enrollment/packets/:id/notes` | `routes/notes.ts` | Navigator notes |
| `/v1/enrollment/packets/:id/fields` | `routes/fields.ts` | Extracted field review |
| `/v1/enrollment/packets/:id/document-items` | `routes/document-items.ts` | Required document checklist |
| `/v1/enrollment/packets/:id/missing-items` | `routes/missing-items.ts` | Navigator missing-item requests |
| `/v1/enrollment/packets/:id/handoff` | `routes/handoff.ts` | Handoff export |
| `/v1/enrollment/applicants/:id/consents` | `routes/consents.ts` | Consent capture |
| `/v1/enrollment/me` | `routes/me.ts` | Applicant profile |
| `/v1/enrollment/me/packets` | `routes/me-packets.ts` | Applicant packet list |
| `/v1/enrollment/me/inbox` | `routes/me-inbox.ts` | Applicant missing-item inbox |

### Auth model

- All routes (except `/health`) protected by `authMiddleware` which verifies a Supabase JWT.
- JWT carries `user_id`, `role` (`applicant` | `navigator` | `staff`), extracted by `middleware/auth.ts`.
- Role-based guards enforced per-route (e.g. applicant-only for `/me/*`, staff-only for `/packets/:id/notes`).
- Supabase RLS provides defense-in-depth: anon-key client (`makeAnonClient`) is scoped to the caller's JWT; service-role client (`makeServiceClient` / `withActorContext`) used only for mutations that need audit context.

### Audit trail

All mutating routes (`PATCH`, `POST` that write to `snap_enrollment.*`) must go through `withActorContext(c)` from `middleware/actorContext.ts`. This sets Postgres transaction-local settings (`snap_enrollment.actor_kind`, `snap_enrollment.actor_id`, `snap_enrollment.request_id`) consumed by the `audit_row_change()` trigger, which writes to `snap_enrollment.audit_log_events`.

**Never call `makeServiceClient` directly for mutations** — use `withActorContext` so the audit trigger captures the actor.

### Database

- Connects to Supabase via bindings in `wrangler.toml` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Uses the Supabase JS client (no Kysely — CF Workers runtime constraint).
- All tables live in the `snap_enrollment` schema; never touches `public.snap_*`.
- DB types generated from `packages/db-types/snap_enrollment.ts`.

### Config files

- `apps/enrollment-api/wrangler.toml` — CF Workers config
- `apps/enrollment-api/tsconfig.json` — `"types": ["@cloudflare/workers-types"]`

---

## Deciding where to add a new endpoint

Use this decision tree:

```
Is the route part of the SNAP enrollment lifecycle?
  (packet CRUD, document upload, field review, consents, handoff, navigator notes)
    → apps/enrollment-api (CF Workers)

Does the route call an external API with complex auth?
  (OpenStates, OCR providers, civic data APIs)
    → apps/api (Fly Node) — Node.js networking is easier here

Does the route need to read public.snap_sessions or FastAPI-owned tables?
    → apps/api (Fly Node) — enrollment-api only touches snap_enrollment.*

Is it a webhook from a third party (OCR, payment, etc.)?
    → apps/api (Fly Node) — HMAC verification is simpler in Node

Is it applicant self-service for their own enrollment packet?
    → apps/enrollment-api /v1/enrollment/me/* — isolated from staff routes
```

---

## Schema ownership

| Schema | Owned by | Written by |
|---|---|---|
| `public.snap_sessions` | FastAPI engine (`backend/`) | FastAPI only |
| `public.snap_missing_item_requests` | apps/api (navigator flow) | Hono gateway |
| `public.snap_handoff_exports` | apps/api (handoff) | Hono gateway |
| `snap_enrollment.*` | Supabase migrations | apps/enrollment-api only |

Do not write to `public.snap_*` from `apps/enrollment-api`, and do not write to `snap_enrollment.*` from `apps/api`.

---

## Related

- [enrollment_readiness_db_README.md](../enrollment_readiness_db_README.md) — snap_enrollment schema overview
- [security_model.md](../security_model.md) — RLS and JWT security
- `supabase/migrations/` — canonical DB schema history
