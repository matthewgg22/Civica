# `fly/ebt-scraper`

Fly machine + Playwright headless Chromium. Civica's substrate for turning recipient EBT session cookies into real balance + transactions.

Status: Phase 1 Lane B skeleton (per [docs/plans/ebt-tracker-propel-parity.md](../../docs/plans/ebt-tracker-propel-parity.md), §16.7).

---

## What this service does

1. Receives `POST /scrape` from the Civica gateway (`apps/enrollment-api/`) with HMAC signature.
2. Decrypts the recipient's session cookie (key held in Fly secret, not in code).
3. Drives Playwright Chromium against `ebt.ca.gov` (or other processor portal).
4. Parses balance + transactions out of the response HTML.
5. POSTs typed events (`balance_updated`, `transactions_updated`, `session_expired`, `captcha`, `parse_error`) back to gateway `/webhooks/ebt-scraper`.

**Critical posture (per plan D4 / CMT-1):** PINs are never on Civica infrastructure. The iOS app collects card + PIN inside an in-app WebView; only the resulting session cookie (and optional "remember me" cookie) ever reaches this service. Counsel posture: "expiring session token," not "credential storage."

---

## Local dev

```bash
cd fly/ebt-scraper
npm install
npx playwright install chromium   # one-time
npm run dev                       # tsx src/server.ts on :8080
npm test                          # vitest against fixture HTML
```

Smoke-test the local server (no auth, will be rejected by HMAC verify):

```bash
curl -s -X POST http://localhost:8080/scrape \
  -H "content-type: application/json" \
  -H "x-scraper-signature: bogus" \
  -d '{"processor":"ebt-ca","action":"balance"}'
# Expect: 401 {"error":"invalid signature"}

curl -s http://localhost:8080/healthz
# Expect: 200 {"ok":true}
```

---

## Deploy

> **Important:** Always run `flyctl deploy` from the repo root (`~/Developer/Civica`), NOT from a worktree. Fly's BuildKit chokes on the worktree's `.git` file (which is a pointer, not a directory). See memory `feedback_fly_deploy_worktree`.

First-time launch:

```bash
cd ~/Developer/Civica
fly launch --copy-config --no-deploy --config fly/ebt-scraper/fly.toml
```

Set secrets:

```bash
fly secrets set --app civica-ebt-scraper \
  EBT_SCRAPER_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  GATEWAY_WEBHOOK_URL="https://civica-snap-api.fly.dev/webhooks/ebt-scraper" \
  GATEWAY_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  COOKIE_DECRYPT_KEY="<paste from Supabase Vault>" \
  SENTRY_DSN="<paste from Sentry project>"
```

Both `EBT_SCRAPER_WEBHOOK_SECRET` (inbound, gateway → scraper) and `GATEWAY_WEBHOOK_SECRET` (outbound, scraper → gateway) must match the secrets configured on the gateway in `apps/enrollment-api/`.

Subsequent deploys:

```bash
cd ~/Developer/Civica
flyctl deploy --config fly/ebt-scraper/fly.toml
```

Watch logs:

```bash
flyctl logs --app civica-ebt-scraper
```

---

## PoC reconnaissance (Phase 1 prereq)

Two probes live in [`poc/`](poc/) — see [`poc/README.md`](poc/README.md):

- **`poc/probe.ts`** — UNAUTH'd. Hits the `ebt.ca.gov` login page once and records DOM shape, Set-Cookie patterns, anti-bot signals (Cloudflare, captcha, JS challenge). Run by anyone, no secrets needed.
- **`poc/probe-authed.ts`** — AUTHENTICATED. Skeleton only. Matthew runs this with his CA EBT test card to measure session timeout (CMT-1), transaction history depth (CMT-4), and "remember me" cookie TTL.

These probes resolve the two open eng-review questions before P3 backfill is sized.

---

## File layout

```
fly/ebt-scraper/
├── Dockerfile              # mcr.microsoft.com/playwright base, multi-stage
├── fly.toml                # sjc, auto-stop, max 50 machines
├── package.json            # hono, playwright, @sentry/node
├── tsconfig.json           # ES2023, NodeNext, strict
├── README.md               # this file
├── .gitignore
├── src/
│   ├── server.ts           # Hono POST /scrape; HMAC verify; GET /healthz
│   ├── processor.ts        # Processor interface
│   ├── scrape.ts           # Dispatcher (switch on body.processor)
│   ├── events.ts           # emitEvent() — HMAC-signed POST to gateway
│   ├── errors.ts           # ScrapeError union (matches iOS EBTScrapeError)
│   └── processors/
│       └── ebt-ca/
│           ├── index.ts
│           ├── login.ts
│           ├── parse-balance.ts
│           ├── parse-transactions.ts
│           ├── errors.ts
│           └── fixtures/
│               ├── login-success.html
│               ├── login-expired.html
│               ├── balance-page.html
│               └── captcha.html
├── test/
│   ├── server.test.ts
│   └── processors/ebt-ca/
│       ├── login.test.ts
│       ├── parse-balance.test.ts
│       ├── parse-transactions.test.ts
│       └── errors.test.ts
└── poc/
    ├── README.md
    ├── probe.ts            # unauth recon (run anywhere)
    └── probe-authed.ts     # AUTH skeleton (Matthew runs locally)
```

---

## Adding a new processor

Per plan §16.4. Three-step contract:

1. New subdir `src/processors/<name>/` implementing the `Processor` interface from `src/processor.ts`.
2. Register the case in `src/scrape.ts`.
3. Drop fixture HTML samples into `src/processors/<name>/fixtures/` + co-located tests.

Plan §16.4 also covers the gateway + iOS sides.
