#!/usr/bin/env bash
#
# EBT webhook smoke test — simulate a Fly scraper event against the live worker.
#
# Proves the route end-to-end:
#   1. HMAC verification (computes sha256 with EBT_SCRAPER_WEBHOOK_SECRET)
#   2. Schema validation (zod discriminatedUnion)
#   3. DB persistence + card_id -> user_id lookup
#   4. APNs send path (best-effort; logged but never fails the response)
#
# Push delivery to a physical device still requires:
#   - A registered apns_token in snap_enrollment.ebt_device_tokens for the
#     user that owns the card_id below.
#   - APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID / APNS_TOPIC / APNS_ENV bound
#     as worker secrets (already done in prod).
#
# Usage:
#   export EBT_SCRAPER_WEBHOOK_SECRET="<value from wrangler secret>"
#   ./scripts/ebt-webhook-smoke.sh session_expired <card-uuid>
#   ./scripts/ebt-webhook-smoke.sh low_balance <card-uuid> [threshold-cents]
#   ./scripts/ebt-webhook-smoke.sh deposit <card-uuid> [amount-cents] [scheduled-for]
#
# Examples:
#   ./scripts/ebt-webhook-smoke.sh session_expired c0000000-0000-0000-0000-000000000001
#   ./scripts/ebt-webhook-smoke.sh low_balance c0000000-0000-0000-0000-000000000001 2500
#   ./scripts/ebt-webhook-smoke.sh deposit c0000000-0000-0000-0000-000000000001 23200 2026-06-01

set -euo pipefail

# Auto-load EBT_SCRAPER_WEBHOOK_SECRET from .dev.vars (gitignored) if the
# env var isn't already set. Avoids having to `export` it on every shell.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_VARS="${SCRIPT_DIR}/../.dev.vars"
if [[ -z "${EBT_SCRAPER_WEBHOOK_SECRET:-}" && -f "$DEV_VARS" ]]; then
  value=$(grep -E '^EBT_SCRAPER_WEBHOOK_SECRET=' "$DEV_VARS" | head -1 | cut -d= -f2-)
  if [[ -n "$value" ]]; then
    export EBT_SCRAPER_WEBHOOK_SECRET="$value"
  fi
fi

URL="${EBT_WEBHOOK_URL:-https://civica-enrollment-api.civica-api.workers.dev/webhooks/ebt-scraper}"
SECRET="${EBT_SCRAPER_WEBHOOK_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "ERROR: EBT_SCRAPER_WEBHOOK_SECRET is not set and no usable value found in .dev.vars." >&2
  echo "Either export it explicitly or add a line to apps/enrollment-api/.dev.vars:" >&2
  echo "  EBT_SCRAPER_WEBHOOK_SECRET=<the-value>" >&2
  exit 2
fi

EVENT="${1:-}"
CARD_ID="${2:-}"

if [[ -z "$EVENT" || -z "$CARD_ID" ]]; then
  echo "Usage: $0 <event-type> <card-uuid> [extra args]" >&2
  echo "  event-type: session_expired | low_balance | deposit" >&2
  exit 2
fi

case "$EVENT" in
  session_expired)
    BODY=$(printf '{"type":"session_expired","card_id":"%s"}' "$CARD_ID")
    ;;
  low_balance)
    THRESHOLD="${3:-2500}"
    BALANCE="${4:-1000}"
    BODY=$(printf '{"type":"low_balance_crossed","card_id":"%s","balance_cents":%s,"threshold_cents":%s}' \
      "$CARD_ID" "$BALANCE" "$THRESHOLD")
    ;;
  deposit)
    AMOUNT="${3:-23200}"
    SCHEDULED="${4:-$(date -u +%Y-%m-%d)}"
    POSTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    BODY=$(printf '{"type":"deposit_posted","card_id":"%s","scheduled_for":"%s","amount_cents":%s,"posted_at":"%s"}' \
      "$CARD_ID" "$SCHEDULED" "$AMOUNT" "$POSTED_AT")
    ;;
  *)
    echo "ERROR: unknown event type '$EVENT'." >&2
    echo "Expected: session_expired | low_balance | deposit" >&2
    exit 2
    ;;
esac

# Compute sha256 HMAC the same way verifyHmac() in webhooks.ts does:
# hex digest of HMAC-SHA256(secret, body).
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')

echo "POST $URL"
echo "Body: $BODY"
echo "Signature: sha256=$SIG"
echo "---"

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Civica-Signature: sha256=$SIG" \
  -d "$BODY" \
  -w "\n---\nHTTP %{http_code}  (%{time_total}s)\n"
