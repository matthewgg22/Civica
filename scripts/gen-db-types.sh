#!/usr/bin/env bash
# Regenerate apps/api/src/db/schema.ts from the live Postgres schema.
# Run after applying migrations or after any schema change.
#
# Usage:
#   DATABASE_URL=postgres://civica:civica@127.0.0.1:5432/civica_dev ./scripts/gen-db-types.sh
#   make db-gen-types

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL="${DATABASE_URL:-postgres://civica:civica@127.0.0.1:5432/civica_dev}"
OUT="$REPO_ROOT/apps/api/src/db/schema.ts"

echo "Generating DB types from $DB_URL → $OUT"

pnpm --filter @civica/api exec kysely-codegen \
  --url="$DB_URL" \
  --out-file="$OUT"

echo "Done. Review and commit src/db/schema.ts."
