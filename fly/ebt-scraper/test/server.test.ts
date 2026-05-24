import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";

// Mock @sentry/node BEFORE importing modules that import it — otherwise the
// real Sentry export descriptors are read-only and `vi.spyOn` blows up
// ("Cannot redefine property: captureException"). The mock factory returns
// fresh vi.fn()s we can introspect with `vi.mocked(...)` below.
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: { setTag: (k: string, v: string) => void }) => void) => {
    cb({ setTag: () => {} });
  }),
  init: vi.fn(),
}));

import * as Sentry from "@sentry/node";
import { buildApp, verifySignature, loadEnv } from "../src/server.js";
import type { ScrapeRequest } from "../src/scrape.js";
import { ScrapeErrorException } from "../src/errors.js";
import type { ProbeFingerprintResult } from "../src/probe-fingerprint.js";

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
      headers: { "content-type": "application/json", "x-civica-signature": "0".repeat(64) },
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
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
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
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const body = "{not json";
    const res = await app.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
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
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
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
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
    });
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: { type: string; code: string } };
    expect(json.error.code).toBe("parseError");
  });

  it("sets scrape.* Sentry tags when an unexpected error is captured", async () => {
    // captureScrapeException → withScope → setTag → captureException. We mock
    // the whole module above so we can re-bind withScope per-test to a
    // setTag implementation that records into `tags`. mockClear() resets
    // the call-count accumulator from earlier tests in this file.
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.withScope).mockClear();
    const tags: Record<string, string> = {};
    vi.mocked(Sentry.withScope).mockImplementationOnce(
      (cb: (scope: { setTag: (k: string, v: string) => void }) => void) => {
        cb({ setTag: (k, v) => { tags[k] = v; } });
      },
    );

    const crashingApp = buildApp({
      secret: SECRET,
      runScrape: async () => {
        throw new Error("oom");
      },
    });
    const body = JSON.stringify({
      processor: "ebt-ca",
      cardId: "card-tags",
      action: "transactions",
      login: { card: "4111111111111111" },
    });
    const res = await crashingApp.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
    });
    expect(res.status).toBe(500);
    expect(tags["scrape.code"]).toBe("unknown");
    expect(tags["scrape.processor"]).toBe("ebt-ca");
    expect(tags["scrape.state"]).toBe("CA");
    expect(tags["scrape.action"]).toBe("transactions");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("does NOT re-capture ScrapeErrorException at the 422 path (already tagged at throw site)", async () => {
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.withScope).mockClear();

    const failingApp = buildApp({
      secret: SECRET,
      runScrape: async () => {
        throw new ScrapeErrorException("pinLocked", "PIN is locked");
      },
    });
    const body = JSON.stringify({
      processor: "ebt-ca",
      cardId: "card-002",
      action: "balance",
      login: { card: "4111111111111111" },
    });
    const res = await failingApp.request("/scrape", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
    });
    expect(res.status).toBe(422);
    // ScrapeErrorException is captured at the throw site, NOT by the
    // /scrape catch block — so withScope MUST NOT be called for this path.
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe("GET /scrape stub mode", () => {
  it("returns a synthetic balance when allowStub is true and ?stub=1", async () => {
    const app = buildApp({ secret: SECRET, allowStub: true });
    const res = await app.request("/scrape?stub=1", { method: "POST" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; result: { processor: string } };
    expect(json.ok).toBe(true);
    expect(json.result.processor).toBe("ebt-ca");
  });

  it("ignores ?stub=1 when allowStub is false", async () => {
    const app = buildApp({ secret: SECRET, allowStub: false });
    const res = await app.request("/scrape?stub=1", { method: "POST" });
    // Falls through to the HMAC check — empty body, no sig → 401.
    expect(res.status).toBe(401);
  });
});

describe("POST /probe-selectors-authed", () => {
  function buildFingerprint(overrides: Partial<ProbeFingerprintResult> = {}): ProbeFingerprintResult {
    return {
      balance: {
        url: "https://www.ebt.ca.gov/cardholder/Home",
        status: 200,
        inputNames: [],
        tableColumnCounts: [3],
        anchorTextPresence: { "Available Balance": true, "Food Benefits": true, "Cash Benefits": true },
      },
      transactions: {
        url: "https://www.ebt.ca.gov/cardholder/transactions",
        status: 200,
        inputNames: [],
        tableColumnCounts: [3],
        anchorTextPresence: { "Transaction History": true, Posted: true, Amount: true },
      },
      capturedAt: "2026-05-24T14:00:00.000Z",
      ...overrides,
    };
  }

  it("rejects unsigned requests with 401", async () => {
    const app = buildApp({ secret: SECRET, runAuthedProbe: async () => buildFingerprint() });
    const body = JSON.stringify({ cookieHandoff: [{ name: "x", value: "y", domain: "ebt.ca.gov", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" }] });
    const res = await app.request("/probe-selectors-authed", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects empty cookieHandoff with 400", async () => {
    const app = buildApp({ secret: SECRET, runAuthedProbe: async () => buildFingerprint() });
    const body = JSON.stringify({ cookieHandoff: [] });
    const res = await app.request("/probe-selectors-authed", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
    });
    expect(res.status).toBe(400);
  });

  it("returns the fingerprint result when the probe succeeds", async () => {
    let received: unknown = null;
    const app = buildApp({
      secret: SECRET,
      runAuthedProbe: async (cookieHandoff) => {
        received = cookieHandoff;
        return buildFingerprint();
      },
    });
    const cookieHandoff = [
      { name: "JSESSIONID", value: "abc", domain: "ebt.ca.gov", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" as const },
    ];
    const body = JSON.stringify({ cookieHandoff });
    const res = await app.request("/probe-selectors-authed", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as ProbeFingerprintResult;
    expect(json.balance.url).toContain("ebt.ca.gov");
    expect(json.transactions.anchorTextPresence["Transaction History"]).toBe(true);
    expect(received).toEqual(cookieHandoff);
  });

  it("captures probe failures with action='probe' tag and returns 500", async () => {
    vi.mocked(Sentry.captureException).mockClear();
    const tags: Record<string, string> = {};
    vi.mocked(Sentry.withScope).mockImplementationOnce(
      (cb: (scope: { setTag: (k: string, v: string) => void }) => void) => {
        cb({ setTag: (k, v) => { tags[k] = v; } });
      },
    );
    const app = buildApp({
      secret: SECRET,
      runAuthedProbe: async () => {
        throw new Error("net timeout");
      },
    });
    const cookieHandoff = [
      { name: "JSESSIONID", value: "abc", domain: "ebt.ca.gov", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" as const },
    ];
    const body = JSON.stringify({ cookieHandoff });
    const res = await app.request("/probe-selectors-authed", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-civica-signature": sign(body) },
    });
    expect(res.status).toBe(500);
    expect(tags["scrape.action"]).toBe("probe");
    expect(tags["scrape.processor"]).toBe("ebt-ca");
    expect(tags["scrape.state"]).toBe("CA");
    expect(tags["scrape.code"]).toBe("unknown");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
