#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REPORT_DIR="${REPORT_DIR:-reports/reps_checks}"
mkdir -p "$REPORT_DIR"

GOV_XLSX_DEFAULT="$HOME/Downloads/governor_office_constituent_phone_list.xlsx"
GOV_XLSX="${GOV_XLSX:-$GOV_XLSX_DEFAULT}"

echo "[1/2] Running reps contact audit (phones + websites)"
audit_args=(
  --markdown-report "$REPORT_DIR/reps_contact_audit.md"
  --csv-report "$REPORT_DIR/reps_contact_audit.csv"
)

if [[ "${SKIP_LIVE_URL_CHECK:-0}" == "1" ]]; then
  audit_args+=(--skip-live-url-check)
fi

if [[ -f "$GOV_XLSX" ]]; then
  echo "Using governor XLSX parity check: $GOV_XLSX"
  audit_args+=(--governor-phone-xlsx "$GOV_XLSX")
else
  echo "Governor XLSX not found at '$GOV_XLSX'; skipping XLSX parity check."
fi

python3 scripts/audit_reps_contacts.py "${audit_args[@]}"

echo "[2/2] Running federal roster review (Congress.gov)"
if [[ -n "${CONGRESS_GOV_API_KEY:-}" ]]; then
  python3 scripts/review_reps_updates.py \
    --review \
    --report-file "$REPORT_DIR/reps_federal_roster_review.md"
  echo "Federal roster review complete."
else
  echo "CONGRESS_GOV_API_KEY is not set; skipping federal roster review."
fi

echo "All reps checks complete."
echo "Reports written to: $REPORT_DIR"
