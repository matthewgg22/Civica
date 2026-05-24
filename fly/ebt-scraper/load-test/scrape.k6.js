// k6 load test for the EBT scraper.
//
// Measures cold-start + concurrency cost of /scrape — NOT real portal
// behavior. Uses ?stub=1 to short-circuit the Playwright launch and return
// a synthetic balance so we can hammer the endpoint without sending traffic
// at ebt.ca.gov.
//
// Thresholds:
//   - p95 latency < 10s (scrape normally includes browser startup + portal nav)
//   - error rate < 1%
//
// Stages (total ~5 min):
//   0-60s   : ramp 0 → 5 RPS    (warm machine baseline)
//   60-180s : hold 5 RPS         (steady state)
//   180-240s: ramp 5 → 50 RPS    (burst — simulates issuance-day fan-out)
//   240-300s: hold 50 RPS        (sustained burst)
//   300-360s: cool down to 0
//
// Run:
//   SCRAPER_URL=https://civica-ebt-scraper.fly.dev k6 run load-test/scrape.k6.js
//
// See load-test/README.md for full instructions + how to read the output.

import http from "k6/http";
import { check } from "k6";

const SCRAPER_URL = __ENV.SCRAPER_URL || "http://localhost:8080";
// SCRAPER_SECRET is accepted for future use (real-cookie load tests) but
// the stub-mode path does NOT verify the HMAC, so it's optional today.
const SCRAPER_SECRET = __ENV.SCRAPER_SECRET || "";

export const options = {
  scenarios: {
    scrape_load: {
      executor: "ramping-arrival-rate",
      // Start at 1 RPS to avoid divide-by-zero in the first ramp step
      // (some k6 versions reject startRate=0 on ramping-arrival-rate).
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: "60s", target: 5 },     // warm baseline
        { duration: "120s", target: 5 },    // hold steady
        { duration: "60s", target: 50 },    // burst
        { duration: "60s", target: 50 },    // hold burst
        { duration: "60s", target: 0 },     // cool down
      ],
    },
  },
  thresholds: {
    // p95 < 10s. Stub mode should be ~1-100ms; real mode would be 5-30s.
    // The 10s threshold is the user-facing target either way.
    http_req_duration: ["p(95)<10000"],
    // <1% error rate.
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  // Use stub mode — see fly/ebt-scraper/src/server.ts STUB_SCRAPE_RESPONSE.
  // This skips HMAC verification AND skips the Playwright launch, so we
  // measure the HTTP+Node baseline + concurrency cost of the Fly machines,
  // not real portal latency.
  const url = `${SCRAPER_URL}/scrape?stub=1`;
  const payload = JSON.stringify({
    processor: "ebt-ca",
    cardId: "loadtest-stub",
    action: "balance",
    login: { cookieHandoff: [] },
  });
  const res = http.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      // Stub mode ignores this, but include for parity with the prod path
      // so the request shape matches real traffic. SCRAPER_SECRET unused.
      "X-Civica-Signature": "stub-mode",
    },
    tags: { name: "scrape_stub" },
  });
  check(res, {
    "status is 200": (r) => r.status === 200,
    "body has result.processor": (r) => {
      try {
        const json = r.json();
        return json && json.result && json.result.processor === "ebt-ca";
      } catch {
        return false;
      }
    },
  });
}

// Suppress unused-import warning in environments that lint k6 scripts.
void SCRAPER_SECRET;
