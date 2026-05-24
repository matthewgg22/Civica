# Sentry alert configuration — EBT scraper

This document walks through the Sentry UI steps to wire the metric alert that
the scraper's Sentry tags are designed for. The scraper code (T6) is already
shipped; this is the operator-side configuration the user does once.

## Tag schema (set by `src/sentry-tags.ts`)

Every `Sentry.captureException` call from the scraper goes through
`captureScrapeException` / `throwAndCapture`, which sets these scope tags:

| Tag | Values | What it means |
| --- | --- | --- |
| `scrape.code` | `networkTimeout` `portalDown` `sessionExpired` `captcha` `pinLocked` `cardClosed` `parseError` `unknown` | The typed `ScrapeErrorException` code, or `unknown` for unexpected throws |
| `scrape.processor` | `ebt-ca` (and the requested-but-unregistered id for "unknown processor" cases) | Which portal adapter was running |
| `scrape.state` | `CA` | Two-letter state code (CA-only at launch) |
| `scrape.action` | `balance` `transactions` `full` `probe` | Which pipeline stage was running |

`probe` is set only by the daily authed-probe handler, so a `scrape.action:probe`
event always means the structural drift detector itself failed (network,
captcha, expired test card) — distinct from real-user scrape failures.

## Recommended metric alert: failure-rate spike

**Goal:** page on-call when ANY `scrape.code` value is generated at a sustained
rate above background noise (currently <1/min) — that's the signal a real
failure mode is kicking in, not a one-off transient.

### UI walkthrough

1. **Sentry → Alerts → Create Alert → Metric Alert**.
2. **Set conditions**:
   - Dataset: **Errors**
   - Metric: **Count of events**
   - Filter: `scrape.code:* AND scrape.processor:ebt-ca`
     - The `scrape.code:*` wildcard matches any value of the tag, which means
       "any captured scraper exception" (events with no `scrape.code` tag —
       e.g. a Sentry event from some other service in the same project — are
       excluded).
3. **Threshold**:
   - **Trigger** (Critical): `count > 5 / minute for 5 minutes`
   - Rationale: background error rate from sessionExpired-on-stale-cookie and
     captcha-during-Akamai-tantrums sits well under 1/min on a normal day.
     5/min sustained for 5 min = one of the buckets (e.g. `parseError` from a
     portal redesign, or `captcha` from a new Akamai rollout) has gone real.
   - **Resolve**: `count < 1 / minute for 5 minutes` (auto-resolve when the
     rate drops back to baseline).
4. **Notification channel**: select the **#ops** Slack workspace integration.
   - If `#ops` isn't connected yet: Sentry → Settings → Integrations → Slack
     → Add Workspace → pick `#ops` from the channel picker.
5. **Name**: `EBT scraper — failure rate spike`.
6. **Save**.

### Optional second alert: per-code split

Once you have ~2 weeks of baseline data, consider adding a per-code alert so
the on-call message tells you WHICH bucket spiked (parseError vs captcha vs
sessionExpired). The split alert uses the same threshold but groups by
`scrape.code`:

- Dataset: Errors
- Filter: `scrape.processor:ebt-ca`
- **Group by**: `scrape.code`
- Threshold: `count > 5 / minute for 5 minutes` (per group)
- Title template: `{tag.scrape.code} spike on {tag.scrape.processor}`

That message is much more actionable: "captcha spike on ebt-ca" → look at
Akamai. "parseError spike on ebt-ca" → run the structural probe (T5) and
diff the baseline.

### Drift alert (T5 cron)

The daily authed probe (`apps/enrollment-api/src/cron/ebt-probe.ts`) posts
to Slack directly via incoming-webhook when it detects HTML drift. That's
separate from the metric alerts here — Slack post happens at 14:00 UTC ±1min
when the cron fires, NOT via Sentry. Make sure the operator has set
`SLACK_OBSERVABILITY_WEBHOOK_URL` via `wrangler secret put` for that path
to surface.

## Test that the alert wiring works

Once the alert is saved:

```bash
# Send a test exception with the scrape.* tags set
curl -X POST https://civica-ebt-scraper.fly.dev/scrape \
  -H 'content-type: application/json' \
  -H 'x-civica-signature: invalid' \
  -d '{"processor":"ebt-ca","cardId":"test","action":"balance"}'
```

That returns 401 (no Sentry event — by design). To actually generate a tagged
event, deploy a temporary `/throw-test` route or trigger a real scrape against
an invalid cookie. The alert should fire within ~5min if you breach the 5/min
threshold.

## Rotating thresholds

- If background noise creeps above 1/min sustained, raise the trigger to
  `count > 10 / min` to keep the alert specific.
- If a particular code is consistently noisy (e.g. `sessionExpired` during
  the JSESSIONID re-link window), add a per-code mute or lower its weight
  in the grouped alert.
