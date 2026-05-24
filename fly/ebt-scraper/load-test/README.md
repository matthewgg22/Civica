# EBT scraper load test

k6 load test that measures the Fly cluster's cold-start + concurrency cost
before issuance-day burst (~160K scrapes in 2h per `docs/plans/ebt-tracker-propel-parity.md`
§4.4 / D13).

The goal is to validate that:

1. `min_machines_running = 5` warm pool absorbs the initial burst without
   cold-starts cascading into user-visible latency.
2. The scale-out from 5 → 50 machines stays under the p95 < 10s target.
3. Error rate stays below 1% across the full ramp.

This test does **not** drive real portal traffic. It hits `/scrape?stub=1`
(see `src/server.ts` `STUB_SCRAPE_RESPONSE`), which returns a synthetic
balance without launching Playwright. That's deliberate: the test exists to
measure the **infrastructure** behavior of the Fly cluster, not ebt.ca.gov's
behavior. A real-portal load test would be unfriendly to ebt.ca.gov and
probably get our IP blocked by Akamai.

## Setup

Install k6 (one-time):

```bash
brew install k6
```

The scraper must be deployed (or running locally) with `NODE_ENV !== production`,
because stub mode is gated:

```ts
const app = buildApp({
  secret: env.EBT_SCRAPER_WEBHOOK_SECRET,
  allowStub: env.NODE_ENV !== "production",
});
```

For a Fly staging run, deploy a separate `civica-ebt-scraper-staging` app with
`NODE_ENV=staging` set. **Never** flip `allowStub` on in production —
`/scrape?stub=1` would silently return fake balances to real users.

## Running the test

Against local dev (default `http://localhost:8080`):

```bash
cd fly/ebt-scraper
npm run loadtest
```

Against a staging deploy:

```bash
SCRAPER_URL=https://civica-ebt-scraper-staging.fly.dev npm run loadtest
```

## Reading the output

k6 prints a summary table at the end. The lines you care about:

```
http_req_duration..............: avg=…  med=…  p(90)=…  p(95)=…  max=…
http_req_failed................: 0.XX%
checks.........................: XX.XX% ✓ N ✗ M
```

Pass criteria (the `thresholds` block in `scrape.k6.js`):

| Metric | Threshold | Why |
| --- | --- | --- |
| `http_req_duration` p95 | < 10 000 ms | User-facing target (real-mode max) |
| `http_req_failed` rate | < 1% | Issuance-day SLA |

If p95 stays under 10s through the 50 RPS sustain stage and error rate is
under 1%, the warm-pool sizing is correct for the current architecture.

If p95 climbs into seconds during the 5→50 ramp, raise `min_machines_running`
in `fly.toml` until the ramp clears the threshold.

## Stages explained

| Window | RPS | Why |
| --- | --- | --- |
| 0-60s | 0 → 5 | Warm baseline — should hit the warm machines only |
| 60-180s | 5 | Steady state — establishes the no-scale baseline |
| 180-240s | 5 → 50 | Burst ramp — forces the auto-scaler to spin up cold machines |
| 240-300s | 50 | Sustained burst — measures the post-scale steady state |
| 300-360s | 50 → 0 | Cool down |

The 5 → 50 ramp is the most useful window. If you only have time to look
at one section of the output, scroll to the metrics breakdown for
`scenarios.scrape_load.stages[2]`.

## Don't ship the warm pool to production until the load test passes

The `min_machines_running = 5` bump in `fly.toml` is what makes the warm
pool exist. If you bump it and the load test still shows p95 > 10s during
the ramp, the pool size is too low. Iterate before promoting to prod.
