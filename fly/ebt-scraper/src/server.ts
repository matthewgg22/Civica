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
}

export function buildApp(deps: BuildAppDeps): Hono {
  const app = new Hono();
  const runner = deps.runScrape ?? (runStandaloneScrape as (r: ScrapeRequest) => Promise<unknown>);

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.post("/scrape", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-scraper-signature") ?? "";

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
      // Unexpected — capture to Sentry, return generic parseError so clients
      // get a typed code instead of a 500.
      Sentry.captureException(err);
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

// ─────────────────────────────────────────────────────────────────────────────
// Entrypoint — only runs when started directly (not when imported by tests).
// ─────────────────────────────────────────────────────────────────────────────

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const env = loadEnv();

  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV ?? "development" });
  }

  const app = buildApp({ secret: env.EBT_SCRAPER_WEBHOOK_SECRET });
  const port = parseInt(env.PORT, 10);

  serve({ fetch: app.fetch, port }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`[ebt-scraper] listening on :${info.port}`);
  });
}
