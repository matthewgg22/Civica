/**
 * HTTP entrypoint for the scraper.
 *
 * Routes:
 *   GET  /healthz   — liveness probe (Fly health check + container HEALTHCHECK)
 *   POST /scrape    — HMAC-verified scrape request from gateway
 *
 * Concurrency model: the Fly machine handles ONE scrape per request. The
 * gateway's queue consumer is what controls parallelism (per plan §4.4 D13).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import * as Sentry from "@sentry/node";
import { ScrapeErrorException, isScrapeErrorCode } from "./errors.js";
import { runStandaloneScrape, type ScrapeRequest } from "./scrape.js";
import { captureScrapeException, DEFAULT_STATE, type ScrapeActionTag } from "./sentry-tags.js";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { IPHONE_CONTEXT } from "./processors/ebt-ca/login.js";
import type { SessionCookie } from "./processor.js";
import { fingerprintPage, PROBE_PAGES, type ProbeFingerprintResult } from "./probe-fingerprint.js";
chromium.use(StealthPlugin());

interface Env {
  PORT: string;
  EBT_SCRAPER_WEBHOOK_SECRET: string;
  GATEWAY_WEBHOOK_URL?: string;
  GATEWAY_WEBHOOK_SECRET?: string;
  SENTRY_DSN?: string;
  NODE_ENV?: string;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const required = (key: keyof Env): string => {
    const v = env[key];
    if (!v) throw new Error(`Missing required env var: ${String(key)}`);
    return v;
  };
  return {
    PORT: env.PORT ?? "8080",
    EBT_SCRAPER_WEBHOOK_SECRET: required("EBT_SCRAPER_WEBHOOK_SECRET"),
    GATEWAY_WEBHOOK_URL: env.GATEWAY_WEBHOOK_URL,
    GATEWAY_WEBHOOK_SECRET: env.GATEWAY_WEBHOOK_SECRET,
    SENTRY_DSN: env.SENTRY_DSN,
    NODE_ENV: env.NODE_ENV,
  };
}

/**
 * HMAC verify in constant time. Returns true if `signature` is a valid
 * sha256 HMAC of `payload` keyed by `secret`.
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || signature.length === 0) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    // Buffer.from throws on odd-length hex; treat as mismatch.
    return false;
  }
}

export interface BuildAppDeps {
  secret: string;
  /** Override for tests — runStandaloneScrape by default. */
  runScrape?: (request: ScrapeRequest) => Promise<unknown>;
  /**
   * Override for /probe-selectors-authed tests. Receives the cookieHandoff
   * payload and returns the structural fingerprint. Default fires up Chromium
   * and visits the real portal.
   */
  runAuthedProbe?: (cookieHandoff: SessionCookie[]) => Promise<ProbeFingerprintResult>;
  /**
   * When true, /scrape?stub=1 returns a synthetic balance without spinning
   * up Playwright. Used by the k6 load test to measure cold-start +
   * concurrency cost without sending traffic at ebt.ca.gov. Defaults to
   * `NODE_ENV !== "production"` at the entrypoint so stub mode is never
   * available in prod even if a caller passes `?stub=1`.
   */
  allowStub?: boolean;
}

/**
 * Synthetic balance returned by `?stub=1` mode. Same shape as a real scrape
 * result so the gateway side stays unchanged. Numbers are obviously fake.
 */
const STUB_SCRAPE_RESPONSE = {
  ok: true,
  result: {
    processor: "ebt-ca",
    cardId: "stub-card",
    action: "balance",
    balance: {
      foodBalanceCents: 12345,
      cashBalanceCents: 0,
      lastUpdatedAt: "2026-05-24T00:00:00.000Z",
    },
    session: {
      cookies: [],
      expiresAt: null,
      rememberMeCookieName: null,
    },
  },
} as const;

export function buildApp(deps: BuildAppDeps): Hono {
  const app = new Hono();
  const runner = deps.runScrape ?? (runStandaloneScrape as (r: ScrapeRequest) => Promise<unknown>);

  app.get("/healthz", (c) => c.json({ ok: true }));

  // GET /probe-selectors — navigates to the ebt.ca.gov login page and returns
  // the form HTML + discovered input[name] values. NO form submission; safe to
  // call without a real card. Use to verify selectors before a live card test.
  // Protected by the same HMAC secret (query param ?sig=sha256=... or header).
  app.get("/probe-selectors", async (c) => {
    const sig = c.req.header("x-civica-signature") ?? c.req.query("sig") ?? "";
    const probePayload = "probe-selectors";
    if (!verifySignature(probePayload, sig.replace(/^sha256=/, ""), deps.secret)) {
      return c.json({ error: "invalid signature" }, 401);
    }
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext(IPHONE_CONTEXT);
      const page = await context.newPage();
      // Navigate to base cardholder URL and follow redirects to discover real login page.
      const response = await page.goto("https://www.ebt.ca.gov/cardholder/", { waitUntil: "domcontentloaded" });
      const html = await page.content();
      // Extract input field names + types for selector verification
      const inputs = await page.$$eval("input", (els) =>
        els.map((el) => ({
          name: el.getAttribute("name"),
          type: el.getAttribute("type"),
          id: el.getAttribute("id"),
          placeholder: el.getAttribute("placeholder"),
        })),
      );
      const buttons = await page.$$eval("button,input[type=submit]", (els) =>
        els.map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type"),
          text: el.textContent?.trim().slice(0, 80),
        })),
      );
      await context.close();
      return c.json({
        url: page.url(),
        status: response?.status(),
        inputs,
        buttons,
        htmlLength: html.length,
        htmlSnippet: html.slice(0, 2000),
      });
    } finally {
      await browser.close();
    }
  });

  // POST /probe-selectors-authed — daily cron-driven structural probe.
  // Body: { cookieHandoff: SessionCookie[] }. HMAC-signed via x-civica-signature.
  // The handler navigates the balance + transactions pages READ-ONLY, never
  // submits a form, and returns a structural fingerprint the cron diffs against
  // a committed baseline. See docs/sentry-alerts.md for the drift response.
  app.post("/probe-selectors-authed", async (c) => {
    const rawBody = await c.req.text();
    const sig = (c.req.header("x-civica-signature") ?? "").replace(/^sha256=/, "");
    if (!verifySignature(rawBody, sig, deps.secret)) {
      return c.json({ error: "invalid signature" }, 401);
    }
    let body: { cookieHandoff?: SessionCookie[] };
    try {
      body = JSON.parse(rawBody) as { cookieHandoff?: SessionCookie[] };
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }
    if (!Array.isArray(body.cookieHandoff) || body.cookieHandoff.length === 0) {
      return c.json({ error: "cookieHandoff is required and must be a non-empty array" }, 400);
    }
    try {
      const probe = deps.runAuthedProbe
        ? await deps.runAuthedProbe(body.cookieHandoff)
        : await runAuthedProbeLive(body.cookieHandoff);
      return c.json(probe);
    } catch (err) {
      captureScrapeException(err, {
        processor: "ebt-ca",
        state: DEFAULT_STATE,
        action: "probe",
      });
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: "probe_failed", message }, 500);
    }
  });

  app.post("/scrape", async (c) => {
    // Stub mode for load testing: short-circuits BEFORE HMAC verification so
    // the k6 script can hit /scrape?stub=1 without burning a real signature
    // generation step on every request. Only enabled when deps.allowStub is
    // true (i.e. NODE_ENV !== "production" at the entrypoint).
    if (deps.allowStub && c.req.query("stub") === "1") {
      return c.json(STUB_SCRAPE_RESPONSE);
    }

    const rawBody = await c.req.text();
    const signature = (c.req.header("x-civica-signature") ?? "").replace(/^sha256=/, "");

    if (!verifySignature(rawBody, signature, deps.secret)) {
      return c.json({ error: "invalid signature" }, 401);
    }

    let request: ScrapeRequest;
    try {
      request = JSON.parse(rawBody) as ScrapeRequest;
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    if (!request.processor || !request.cardId || !request.action) {
      return c.json({ error: "missing required fields", required: ["processor", "cardId", "action"] }, 400);
    }

    try {
      const result = await runner(request);
      return c.json({ ok: true, result });
    } catch (err) {
      if (err instanceof ScrapeErrorException) {
        return c.json(
          {
            error: {
              type: "ebt_scrape_error",
              code: err.code,
              message: err.message,
            },
          },
          422,
        );
      }
      // Unexpected — capture to Sentry with scrape.* tags, return generic
      // parseError so clients get a typed code instead of a 500.
      // `ScrapeErrorException` returned at 422 above; the dispatcher already
      // captured it with tags at the throw site, so we only get here for
      // truly unexpected throws (eg playwright timeout, OOM kill).
      const action: ScrapeActionTag =
        request.action === "balance" || request.action === "transactions" || request.action === "full"
          ? request.action
          : "full";
      captureScrapeException(err, {
        processor: request.processor,
        state: DEFAULT_STATE,
        action,
      });
      const code = "parseError";
      const message = err instanceof Error ? err.message : String(err);
      if (!isScrapeErrorCode(code)) {
        // Defensive — should be impossible given the literal above.
        return c.json({ error: "internal" }, 500);
      }
      return c.json(
        { error: { type: "ebt_scrape_error", code, message } },
        500,
      );
    }
  });

  return app;
}

/**
 * Live implementation of the daily authed probe — drives Playwright through
 * the balance + transactions pages with the supplied cookies and returns the
 * structural fingerprint. Read-only: never submits a form.
 */
async function runAuthedProbeLive(cookieHandoff: SessionCookie[]): Promise<ProbeFingerprintResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(IPHONE_CONTEXT);
    await context.addCookies(cookieHandoff);
    try {
      const balance = await fingerprintPage(
        context,
        PROBE_PAGES.balance.url,
        // Spread because anchorText is a readonly tuple in PROBE_PAGES.
        [...PROBE_PAGES.balance.anchorText],
      );
      const transactions = await fingerprintPage(
        context,
        PROBE_PAGES.transactions.url,
        [...PROBE_PAGES.transactions.anchorText],
      );
      return { balance, transactions, capturedAt: new Date().toISOString() };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrypoint — only runs when started directly (not when imported by tests).
// ─────────────────────────────────────────────────────────────────────────────

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const env = loadEnv();

  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV ?? "development" });
  }

  const app = buildApp({
    secret: env.EBT_SCRAPER_WEBHOOK_SECRET,
    // Stub mode for the k6 load test — never enabled in production, even if
    // someone passes ?stub=1, because we hard-gate on NODE_ENV here.
    allowStub: env.NODE_ENV !== "production",
  });
  const port = parseInt(env.PORT, 10);

  serve({ fetch: app.fetch, port }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`[ebt-scraper] listening on :${info.port}`);
  });
}
