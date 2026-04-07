#!/usr/bin/env bash
set -euo pipefail

# End-to-end sync:
# 1) Ingest Open States -> normalized JSON
# 2) Upsert normalized JSON -> Supabase

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python3 scripts/ingest_openstates_legislators.py "$@"
python3 scripts/upsert_openstates_legislators.py
