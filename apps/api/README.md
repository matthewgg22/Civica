# @civica/api

Hono API gateway for the SNAP enrollment-readiness system.

## Role

Public-internet-facing gateway. Sits in front of the existing FastAPI engine at `backend/civic_api/snap/`.

**This server owns:**
- Supabase JWT verification (applicant + staff, two-class wall)
- Transactional audit logging
- Rate limiting (per-user for applicants, per-IP for staff)
- Navigator dashboard endpoints (assignment, status, notes, missing items, handoff)
- OpenAPI spec generation at `/openapi.json`

**This server delegates to FastAPI engine for:**
- LLM conversation orchestration (turns, extraction)
- Document classification + extraction
- Eligibility rules engine
- PDF generation
- Fernet encryption of PII columns

## Status

Phase 1 (monorepo scaffold) complete. Phase 2 (Hono skeleton) is next.

See `project_snap_api_architecture.md` in auto-memory for the full architecture decision.
