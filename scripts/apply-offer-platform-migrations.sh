#!/usr/bin/env bash
# Apply the 6 migrations that ship the EBT offer-moment platform.
# Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md.
#
# These migrations are additive + idempotent (CREATE TABLE IF NOT EXISTS,
# DO $$ ... EXCEPTION duplicate_object guards on enums, ALTER TABLE ... ADD
# COLUMN IF NOT EXISTS). Re-running is safe but the operator should still
# inspect the staging diff before pointing this at production.
#
# Usage:
#   # 1) staging dry-run (read-only, just prints the SQL)
#   ./scripts/apply-offer-platform-migrations.sh --dry-run
#
#   # 2) staging apply
#   DATABASE_URL=postgres://...staging... ./scripts/apply-offer-platform-migrations.sh
#
#   # 3) production apply (after staging smoke)
#   DATABASE_URL=postgres://...prod... ./scripts/apply-offer-platform-migrations.sh
#
# After apply, run the smoke checks at the bottom of this file.

set -euo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

DB_URL="${DATABASE_URL:-postgres://civica:civica@127.0.0.1:5432/civica_dev}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"

MIGRATIONS=(
  "20260584_user_savings_tally.sql"
  "20260585_user_redemptions.sql"
  "20260586_user_push_log.sql"
  "20260587_partner_offers_tier_state_category.sql"
  "20260588_record_redemption_fn.sql"
  "20260589_distress_flags.sql"
)

if [ "$DRY_RUN" = true ]; then
  echo "DRY RUN — would apply against $DB_URL:"
  for f in "${MIGRATIONS[@]}"; do
    echo "  → $f"
  done
  echo
  echo "Combined diff (review before applying):"
  echo "═══════════════════════════════════════════════════════════"
  for f in "${MIGRATIONS[@]}"; do
    echo
    echo "── $f ─────────────────────────────────"
    cat "$MIGRATIONS_DIR/$f"
  done
  exit 0
fi

echo "Applying 6 offer-platform migrations → $DB_URL"
for f in "${MIGRATIONS[@]}"; do
  echo "  → $f"
  psql "$DB_URL" -f "$MIGRATIONS_DIR/$f" --quiet --single-transaction
done

echo
echo "──────────── Smoke checks ────────────"

psql "$DB_URL" --quiet -c "
SELECT
  (SELECT count(*) FROM snap_enrollment.user_savings_tally) AS savings_tally_rows,
  (SELECT count(*) FROM snap_enrollment.user_redemptions) AS redemption_rows,
  (SELECT count(*) FROM snap_enrollment.user_push_log) AS push_log_rows,
  (SELECT count(*) FROM snap_enrollment.distress_flags) AS distress_flag_rows;
"

psql "$DB_URL" --quiet -c "
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'snap_enrollment'
  AND table_name = 'partner_offers'
  AND column_name IN ('tier', 'state_code', 'category_tags', 'merchant_id', 'merchant_name_normalized')
ORDER BY column_name;
"

psql "$DB_URL" --quiet -c "
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'snap_enrollment'
  AND (
    indexname LIKE 'idx_user_push_log_perk_offer_daily%' OR
    indexname LIKE 'idx_partner_offers_category_tags%' OR
    indexname LIKE 'idx_distress_flags_active_user%'
  )
ORDER BY indexname;
"

psql "$DB_URL" --quiet -c "
SELECT
  proname,
  prosecdef AS security_definer
FROM pg_proc
WHERE pronamespace = 'snap_enrollment'::regnamespace
  AND proname = 'record_redemption';
"

echo
echo "✓ Apply complete. Spot-check the smoke output above:"
echo "  - 4 row counts (all should be 0 immediately after first apply)"
echo "  - 5 new partner_offers columns (tier, state_code, category_tags, merchant_id, merchant_name_normalized)"
echo "  - 3 new indexes (perk_offer_daily unique partial, category_tags gin, distress_flags_active_user partial)"
echo "  - 1 SECURITY DEFINER function (record_redemption)"
echo
echo "Then test the unique partial index race-safety:"
echo "  psql \"\$DATABASE_URL\" -c \"INSERT INTO snap_enrollment.user_push_log (user_id, category) VALUES ('00000000-0000-0000-0000-000000000001', 'perk_offer') ON CONFLICT DO NOTHING RETURNING push_id;\""
echo "  -- second run should return 0 rows (suppressed)."
