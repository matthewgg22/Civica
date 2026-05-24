# EBT Real-Card Test Runbook

First end-to-end validation of the EBT tracker stack against a live ebt.ca.gov card. Written 2026-05-24 after the Tier-1 ship-readiness sprint closed.

## What this validates

In one card-link flow, every layer that's been built in isolation gets exercised together for the first time:

1. iOS WebView opens ebt.ca.gov → user logs in locally → `WKHTTPCookieStore` captures session cookie
2. iOS `EBTBalanceAPIClient.linkCard()` POSTs cookie to `https://civica-enrollment-api.civica-api.workers.dev/ebt/link`
3. Gateway encrypts cookie via `snap_enrollment.encrypt_session_cookie` RPC (pgsodium) → stores `pgs1:...` ciphertext in `ebt_cards.session_cookie_encrypted`
4. Gateway dispatches `POST /scrape` to `https://civica-ebt-scraper.fly.dev/scrape` with cookie payload (decrypted just-in-time via `decrypt_session_cookie` RPC)
5. Fly scraper logs in with the cookie via `verifyCookieHandoff`, scrapes balance + 30 days of transactions
6. Scraper POSTs `balance_updated` event to gateway `/webhooks/ebt-scraper` (HMAC signed)
7. Gateway writes `balance_cents` + `transactions` to Supabase
8. iOS pulls `/ebt/balance` and `/ebt/transactions` → dashboard renders real numbers
9. If scraper detects a `deposit_posted` event, gateway calls `sendDepositLanded` → APNs → iOS receives push notification

## Pre-flight checks (do these first)

```bash
cd ~/Developer/Civica

# 1. All four secrets named correctly in prod worker
npx wrangler secret list --config apps/enrollment-api/wrangler.toml 2>&1 | grep "APNS_"
# Expect: APNS_ENV, APNS_KEY_ID, APNS_KEY_P8, APNS_TEAM_ID, APNS_TOPIC (5 lines)

# 2. Scraper has SENTRY_DSN + EBT_SCRAPER_WEBHOOK_SECRET
fly secrets list --app civica-ebt-scraper 2>&1 | grep -E "SENTRY_DSN|EBT_SCRAPER_WEBHOOK_SECRET"
# Expect: both present, status Deployed

# 3. Scraper health
curl -s https://civica-ebt-scraper.fly.dev/healthz
# Expect: {"ok":true}

# 4. Gateway health (no /healthz; just confirm 404 from a known-bad path)
curl -s -o /dev/null -w "%{http_code}\n" https://civica-enrollment-api.civica-api.workers.dev/ebt/_health
# Expect: 401 (auth-required path) — NOT 503 / 530

# 5. Cookie encryption migration is applied
# Run in Supabase SQL editor (project zgqphgcqfxsgviofsccs):
#   SELECT proname FROM pg_proc
#    WHERE pronamespace = 'snap_enrollment'::regnamespace
#      AND proname IN ('encrypt_session_cookie', 'decrypt_session_cookie');
# Expect: 2 rows
```

If any check fails, fix before proceeding — the live test will surface confusing symptoms if the infra is half-wired.

## Run the test (iOS, ~5 min)

1. **Open the app** on your iPhone (currently TestFlight or local build)
2. **Toggle the feature flag ON**:
   - Settings (in-app dev settings) → enable `ebtRealData` flag
   - OR via Xcode debugger: `defaults write co.civica.benefits co.civica.ebt.realData -bool YES`
3. **Tap "Link a card"** → ebt.ca.gov loads in the WebView
4. **Log in with your real card credentials** — User ID + Password
5. **Wait for the WebView to close** (cookie handoff happens automatically once login succeeds)
6. **Dashboard should show**:
   - `stale: true` initially while scrape runs (~10-30s on cold-start, ~3-5s on warm machine)
   - Real balance + transactions after the scrape webhook fires

**If you see "Coming soon" or stuck on loading for more than 60s**, jump to the troubleshooting section below.

## Tail logs while testing

Open three terminals before tapping "Link a card":

**Terminal 1 — Fly scraper logs** (shows real-time scrape activity):
```bash
fly logs --app civica-ebt-scraper
```

**Terminal 2 — Worker tail** (shows gateway requests + Supabase calls):
```bash
cd ~/Developer/Civica
npx wrangler tail --config apps/enrollment-api/wrangler.toml --format pretty
```

**Terminal 3 — Sentry dashboard** (browser): https://civica-gl.sentry.io/issues/?project=4511406841069568

## Expected log sequence (happy path)

| Order | Where | Log line |
|---|---|---|
| 1 | wrangler tail | `POST /ebt/link 200` — body sanitized; cookie encryption RPC called |
| 2 | wrangler tail | dispatch log: `EBT scrape dispatched` with cardId + reason `first_link` |
| 3 | fly logs | `POST /scrape` arrived; HMAC verified |
| 4 | fly logs | Playwright launch + navigate to `https://www.ebt.ca.gov/cardholder/` |
| 5 | fly logs | parse-balance result; parse-transactions returns N rows |
| 6 | fly logs | `POST https://civica-enrollment-api.civica-api.workers.dev/webhooks/ebt-scraper` (HMAC signed) |
| 7 | wrangler tail | `POST /webhooks/ebt-scraper 200`, `action: balance_updated` (or `transactions_added`) |
| 8 | iOS | dashboard balance updates from "Loading..." to actual number |
| 9 | (if deposit) | `POST /webhooks/ebt-scraper 200`, `action: deposit_landed_pushed` (no `no-tokens` reason — your device should be registered) |
| 10 | iPhone | APNs push notification appears within 5-10s |

## After the test succeeds

```sql
-- In Supabase SQL editor: flip the linked card to test-probe so the daily cron starts running
UPDATE snap_enrollment.ebt_cards
   SET is_test_probe_card = true
 WHERE user_id = '<your auth user uuid>'
 LIMIT 1;
```

Then verify the cron picks it up at the next 14:00 UTC (6 AM PT) — check `apps/enrollment-api`'s wrangler tail for `ebt-probe` log lines.

## Troubleshooting

### "Coming soon" banner appears
- iOS decoded a `cardLockUnsupported` typed error
- Not a real failure — this is the graceful CA stub (`apps/enrollment-api/src/routes/ebt/lock.ts`); ignore unless you tapped "Lock card"

### Dashboard stuck on "Loading…" for >60s
- Check `wrangler tail` for the `/ebt/balance` request
- If `stale: true` returned but no scrape ever ran, look for dispatch errors: most likely `EBT_SCRAPER_DISPATCH_URL` unset or wrong on the worker
  - Verify: `npx wrangler secret list --config apps/enrollment-api/wrangler.toml | grep EBT_SCRAPER_DISPATCH_URL`
- If scrape ran but webhook never came back, check `fly logs` for HMAC errors or Playwright timeouts

### `sessionExpired` typed error in iOS
- The cookie expired before the scrape completed (race condition on first link)
- Re-tap "Link a card" — the new cookie has a fresh ~30min TTL

### `captcha` typed error
- Akamai detected the scraper despite stealth
- Check Sentry for a captured event with `scrape.code:captcha` tag
- Mitigation: rotate user agent, retry; if persistent, scraper needs additional stealth tuning (separate work item)

### `parseError`
- ebt.ca.gov changed HTML structure → selectors no longer match
- The daily authed-probe cron should have caught this within 24h (check Slack `#ops` if Slack webhook is wired, otherwise check Sentry directly)
- Fix: re-run `/probe-selectors` to discover new field names, update `EBT_CA_SELECTORS` in `fly/ebt-scraper/src/processors/ebt-ca/login.ts`

### Push never arrives
- Check `wrangler tail` for the `ebt push` log line — look for `status` field
- `status: "not-configured"` → APNS_* secrets still wrong (verify with pre-flight check 1)
- `status: "no-tokens"` → device hasn't registered an APNs token yet. Force-quit and reopen the app; ensure notification permission is granted. The `EBTPushHandler` should POST to `/ebt/notifications/register` on cold start.
- `status: "skipped", reason: "inside quiet hours"` → APNs honoring your quiet-hours pref; expected if testing late at night
- `status: "skipped", reason: "deposit muted by user prefs"` → toggle deposit_on=true in `ebt_notification_prefs` table

## What this test does NOT cover

- **Issuance-day burst** — need to either wait for day-1 of next month or run `npm run loadtest` in `fly/ebt-scraper/` (script exists, never exercised against live infra)
- **Card lock real wire** — CA portal doesn't expose it; we ship the 501 stub gracefully
- **Receipts OCR** — separate sheet in the app; requires manual scan of a grocery receipt
- **Anomaly detector** — would only fire on >$50 in 2-min spend; not part of the link/scrape test
- **Multi-state** — deferred 6 months per scope decision A1

## Cleanup / unlinking after test

If you want to unlink the card and re-test from scratch:

```sql
DELETE FROM snap_enrollment.ebt_cards WHERE user_id = '<your auth user uuid>';
DELETE FROM snap_enrollment.ebt_transactions WHERE card_id = '<card uuid>';
```

Or via iOS: Settings → EBT → Unlink card (if that UI exists yet).

## Authoring notes

- Last updated: 2026-05-24 (Tier-1 ship-readiness sprint)
- Related plan: `docs/plans/ebt-tracker-propel-parity.md` §5 Phase 1
- Test plan artifact: `~/.gstack/projects/matthewgg22-Civica/matthewgreer-gentis-codex-rebuild-feb18-eng-review-test-plan-20260524-150528.md`
- Last validated end-to-end: never (this runbook is the first execution)
