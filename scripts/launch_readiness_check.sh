#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/5] Local static/unit checks"
RUN_XCODEBUILD=0 ./scripts/run_local_checks.sh

echo "[2/5] Debug build"
set -o pipefail
xcodebuild -project "VoteNow.xcodeproj" -scheme "VoteNow" -configuration Debug -destination "generic/platform=iOS" \
  -derivedDataPath "$ROOT_DIR/build/launch-debug-derived" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build \
  2>&1 | rg -n "BUILD SUCCEEDED|BUILD FAILED|error:|warning:"

echo "[3/5] Release build"
xcodebuild -project "VoteNow.xcodeproj" -scheme "VoteNow" -configuration Release -destination "generic/platform=iOS" \
  -derivedDataPath "$ROOT_DIR/build/launch-release-derived" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build \
  2>&1 | rg -n "BUILD SUCCEEDED|BUILD FAILED|error:|warning:"

echo "[4/5] Required Supabase migrations present"
required_migrations=(
  "supabase/migrations/20260308_mapv_notification_suppression.sql"
  "supabase/migrations/20260325_harden_identity_and_rls.sql"
  "supabase/migrations/20260327_add_mapc_call_analytics.sql"
)

for path in "${required_migrations[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing migration: $path"
    exit 1
  fi
done

echo "[5/5] Launch artifacts present"
required_artifacts=(
  "supabase/sql/launch_bundle.sql"
  "docs/launch_smoke_checklist.md"
  "docs/launch_runbook.md"
)

for path in "${required_artifacts[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing launch artifact: $path"
    exit 1
  fi
done

echo "Launch readiness checks passed."
