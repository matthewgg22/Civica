#!/usr/bin/env bash
# Apply all supabase/migrations/*.sql files in chronological order.
# Requires psql on PATH and a running Postgres at DATABASE_URL.
#
# Usage:
#   DATABASE_URL=postgres://civica:civica@127.0.0.1:5432/civica_dev ./scripts/apply-snap-migrations.sh
#   make db-migrate   # shorthand

set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://civica:civica@127.0.0.1:5432/civica_dev}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"

echo "Applying migrations from $MIGRATIONS_DIR → $DB_URL"

for f in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  echo "  → $(basename "$f")"
  psql "$DB_URL" -f "$f" --quiet --single-transaction
done

echo "Done."
