# PoC reconnaissance — ebt.ca.gov

Two scripts. One anyone can run; one only Matthew can run (needs a CA EBT test card).

Together they resolve two open eng-review questions from [docs/plans/ebt-tracker-propel-parity.md](../../../docs/plans/ebt-tracker-propel-parity.md):

- **CMT-1** — Session cookie names + lifetime; does a "remember me" cookie exist?
- **CMT-4** — Transaction history depth (60-day window or 10-txn cap?)

---

## What we measured automatically (`probe.ts`)

```bash
cd fly/ebt-scraper
npm install
npx playwright install chromium    # one-time, ~150MB Chromium download
npm run probe                       # or: npx tsx poc/probe.ts
```

Records to `poc/findings.md` (committed). Each run **appends** a new section so we can diff portal changes over time.

Captured per target URL (root, cardholder, login):
- Final URL after redirects + HTTP status
- All cookies set on initial GET (name, domain, expiry, httpOnly, secure, sameSite)
- Anti-bot signals (Cloudflare challenge, captcha widget, JS challenge)
- Login form structure (input names, hidden fields, CSRF tokens)
- Response headers (Server, X-Frame-Options, CSP, etc.)

If the probe gets blocked (403, captcha, Cloudflare interstitial) — that **is** the finding. It tells us whether the production scraper will need residential-proxy fallback (per plan risk table).

---

## What you (Matthew) need to measure with a real test card (`probe-authed.ts`)

> Don't commit `findings-authed.md` — it's in `.gitignore`. Contains balance + card-derived cookies.

```bash
cd fly/ebt-scraper
export CARD_NUMBER="<your 16-digit test card>"
export PIN="<your 4-digit PIN>"

# Optional knobs:
export IDLE_MINUTES="5,15,30,60"   # poll intervals to measure session decay
export REMEMBER_ME="true"          # set false to test bare session lifetime

npm run probe:authed
```

Outputs to `poc/findings-authed.md` (gitignored). Refuses to run in CI.

### What gets measured

1. **Session lifetime (CMT-1):**
   - Initial cookie TTLs after a successful login
   - Polls home page after configurable idle intervals
   - Logs the exact bracket where the session dies (e.g., "alive at T+30min, dead at T+60min")
   - Identifies "remember me" cookie (any non-session cookie with expiry > 7d)

2. **Transaction history depth (CMT-4):**
   - Pages through the transactions endpoint until `nextCursor` is null
   - Logs total transactions returned + span in days
   - Auto-classifies as: fixed-cap (≤10 txns, span >60d), 60-day window (span 55-65d, >12 txns), or "mixed signal — measure again"

3. **Balance snapshot** (one-time, for cross-reference with what the iOS app should display)

### Expected output format

`poc/findings-authed.md` will gain a section like:

```markdown
## Run @ 2026-05-23T17:42:00.000Z

### Session lifetime probe (rememberMe=true)
- Initial cookies (count=4):
  - `JSESSIONID` (domain=`.ebt.ca.gov`, expires=session)
  - `remember_me_token` (domain=`.ebt.ca.gov`, expires=2026-06-22T17:42:00.000Z)
  - …
- Inferred expiresAt: `2026-06-22T17:42:00.000Z`
- Remember-me cookie detected: `remember_me_token`

- T+5min: status=200, finalUrl=`https://www.ebt.ca.gov/cardholder/`, sessionExpired=**false**
- T+15min: status=200, finalUrl=`https://www.ebt.ca.gov/cardholder/`, sessionExpired=**false**
- T+30min: status=200, finalUrl=`https://www.ebt.ca.gov/cardholder/`, sessionExpired=**false**
- T+60min: status=200, finalUrl=`https://www.ebt.ca.gov/cardholder/login`, sessionExpired=**true**
  - Session died between T+30min and T+60min.

### Transaction history depth probe (CMT-4)
- Page 1: 10 txns, nextCursor=`null`

**Total transactions returned:** 10
**Earliest postedAt:** `2026-02-14T00:00:00.000Z`
**Latest postedAt:** `2026-05-21T22:42:00.000Z`
**Span (days):** ~96

**Conclusion:** likely **fixed transaction count cap** (≤10 txns regardless of date range).
```

---

## Expected output format for `findings.md` (unauth'd run)

`probe.ts` appends a timestamped section per run. For each target URL:
- A `### name — url` heading
- Anti-bot detection summary (Cloudflare / captcha / JS challenge — booleans)
- Cookie table (name, domain, expiry, flags)
- Form inputs + hidden fields (CSRF candidates)
- Notable response headers (Server, X-Frame-Options, CSP, etc.)

Plus a per-run summary at the end:
- Cloudflare detected on any target (bool)
- All targets returned 2xx (bool)
- Total unique cookies observed

---

## What happens after PoC results land

The findings drive these downstream decisions:

| Finding | If | Then |
|---|---|---|
| CMT-1 session timeout | <30min | Pre-emptive re-link prompt; event-driven scrape requires a recent cookie handoff |
| CMT-1 session timeout | >24h | "Remember me" cookie is reliable; daily-open refresh stays cheap |
| CMT-1 remember-me cookie | exists, TTL ≥30d | Plan D4 is robust; minor changes |
| CMT-1 remember-me cookie | absent | Need to bake in re-link UX as a routine moment |
| CMT-4 transaction depth | 60-day window | P3 backfill = 60d for free; plan stands |
| CMT-4 transaction depth | 10-txn cap | P3 backfill needs N-page paginated sweep; size accordingly + revisit cost model |
| Cloudflare blocks probe | yes | Need residential proxy or Browserless.io residential plan; cost+ATO review |
| Cloudflare doesn't block probe | yes | Phase-1 ships scraper from Fly machines (sjc IPs) without proxy |
