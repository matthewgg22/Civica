# @civica/api-types

Shared TypeScript types for the SNAP API surface.

Will contain:
- Kysely-generated DB row types (from `supabase/migrations/`)
- Mirrored audit-action enum (in sync with `backend/civic_api/snap/audit/logger.py`)
- The published `openapi.json` so iOS / web / dashboard threads can codegen clients

Empty until Phases 4 and 16.
