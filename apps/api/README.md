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

## Local dev

Two workflows. Pick whichever matches your habits.

### Host-only (fastest iteration)

```sh
make compose-postgres   # Postgres only, in container
cp .env.example .env.local && $EDITOR .env.local
make api-dev            # Hono with hot reload, talks to compose Postgres
```

The FastAPI engine (when needed) runs separately via `uvicorn` on the host.

### Fully containerized

```sh
make compose-up         # Postgres + Hono in containers
```

Source is bind-mounted, so file edits hot-reload via `tsx watch` inside the container. Anonymous volumes preserve `node_modules` against arch mismatches between host (darwin-arm64) and container (linux). Do not remove the `node_modules` volume declarations in `docker-compose.yml` — builds will fail with native-binary errors (esbuild, etc.) if you do.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Hot-reload dev server on `$PORT` (default 3000) |
| `pnpm test` | Vitest run |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | Compile to `dist/` |

## Status

Phase 3 (local dev environment) complete. Phase 4 (Kysely + DB type codegen) is next.

See `project_snap_api_architecture.md` in auto-memory for the full architecture decision.
