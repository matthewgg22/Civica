import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { buildApp, verifySignature, loadEnv } from "../src/server.js";
import type { ScrapeRequest } from "../src/scrape.js";
import { ScrapeErrorException } from "../src/errors.js";

const SECRET = "test-scraper-secret-32-bytes-pad!!";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("verifySignature", () => {
  it("accepts a valid HMAC", () => {
    const body = '{"hello":"world"}';
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a bad signature", () => {
    expect(verifySignature("body", "deadbeef", SECRET)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifySignature("body", "", SECRET)).toBe(false);
  });

  it("rejects a signature with the wrong length", () => {
    expect(verifySignature("body", "abc", SECRET)).toBe(false);
  });

  it("rejects a signature for a different payload", () => {
    expect(verifySignature("different-body", sign("body"), SECRET)).toBe(false);
  });
});

describe("loadEnv", () => {
  it("throws when EBT_SCRAPER_WEBHOOK_SECRET is missing", () => {
    expect(() => loadEnv({ PORT: "8080" } as NodeJS.ProcessEnv)).toThrow(/Missing required env var/);
  });

  it("loads required + optional vars", () => {
    const env = loadEnv({
      EBT_SCRAPER_WEBHOOK_SECRET: "s",
      PORT: "9000",
      SENTRY_DSN: "https://x@sentry.io/1",
    } as NodeJS.ProcessEnv);
    expect(env.PORT).toBe("9000");
    expect(env.SENTRY_DSN).toBe("https://x@sentry.io/1");
  });

  it("defaults PORT to 8080", () => {
    const env = loadEnv({ EBT_SCRAPER_WEBHOOK_SECRET: "s" } as NodeJS.ProcessEnv);
    expect(env.PORT).toBe("8080");
  });
});

describe("GET /healthz", () => {
  it("returns 200 {ok:true}", async () => {
    const app = buildApp({ secret: SECRET });
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /scrape", () => {
  let invocations: ScrapeRequest[];
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    invocations = [];
    app = buildApp({
      secret: SECRET,
      runScrape: async (request) => {
        invocations.push(request);
        return { received: request };
      },
    });
  });

  it("rejects requests with no signature header", async () => {
    const body = JSON.stringify({ processor: "ebt-ca", cardId: "c1", action: "balance" });
    const res = await app.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(401);
    expect(invocations).toHaveLength(0);
  });

  it("rejects requests with a bad signature", async () => {
    const body = JSON.stringify({ processor: "ebt-ca", cardId: "c1", action: "balance" });
    const res = await app.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-scraper-signature": "0".repeat(64) },
    });
    expect(res.status).toBe(401);
    expect(invocations).toHaveLength(0);
  });

  it("accepts a valid signed request and dispatches to runScrape", async () => {
    const body = JSON.stringify({
      processor: "ebt-ca",
      cardId: "card-001",
      action: "balance",
      login: { card: "4111111111111111", cookieHandoff: [] },
    });
    const res = await app.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-scraper-signature": sign(body) },
    });
    expect(res.status).toBe(200);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]!.processor).toBe("ebt-ca");
    expect(invocations[0]!.cardId).toBe("card-001");
  });

  it("rejects requests missing required fields", async () => {
    const body = JSON.stringify({ processor: "ebt-ca" });
    const res = await app.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-scraper-signature": sign(body) },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const body = "{not json";
    const res = await app.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-scraper-signature": sign(body) },
    });
    expect(res.status).toBe(400);
  });

  it("translates ScrapeErrorException into typed wire format (422)", async () => {
    const failingApp = buildApp({
      secret: SECRET,
      runScrape: async () => {
        throw new ScrapeErrorException("captcha", "Portal returned captcha");
      },
    });
    const body = JSON.stringify({
      processor: "ebt-ca",
      cardId: "card-001",
      action: "balance",
      login: { card: "4111111111111111" },
    });
    const res = await failingApp.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-scraper-signature": sign(body) },
    });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: { type: string; code: string; message: string } };
    expect(json.error.type).toBe("ebt_scrape_error");
    expect(json.error.code).toBe("captcha");
  });

  it("translates unexpected errors into a parseError wire payload (500)", async () => {
    const crashingApp = buildApp({
      secret: SECRET,
      runScrape: async () => {
        throw new Error("kaboom");
      },
    });
    const body = JSON.stringify({
      processor: "ebt-ca",
      cardId: "card-001",
      action: "balance",
      login: { card: "4111111111111111" },
    });
    const res = await crashingApp.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-scraper-signature": sign(body) },
    });
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: { type: string; code: string } };
    expect(json.error.code).toBe("parseError");
  });
});
