import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  signPayload,
  emitEvent,
  balanceUpdated,
  transactionsUpdated,
  scrapeError,
} from "../src/events.js";

const SECRET = "test-gateway-secret";

describe("signPayload", () => {
  it("matches the canonical HMAC-SHA256 hex digest", () => {
    const body = '{"hello":"world"}';
    const expected = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(signPayload(body, SECRET)).toBe(expected);
  });
});

describe("event constructors", () => {
  it("balanceUpdated wraps balance under payload.balance with the right type", () => {
    const ev = balanceUpdated("card-1", "ebt-ca", {
      foodBalanceCents: 1000,
      cashBalanceCents: 0,
      lastUpdatedAt: null,
    });
    expect(ev.type).toBe("balance_updated");
    expect(ev.cardId).toBe("card-1");
    expect(ev.processor).toBe("ebt-ca");
    expect(ev.payload.balance).toBeDefined();
  });

  it("transactionsUpdated includes nextCursor", () => {
    const ev = transactionsUpdated("card-1", "ebt-ca", [], "cursor-100");
    expect(ev.type).toBe("transactions_updated");
    expect(ev.payload.nextCursor).toBe("cursor-100");
  });

  it("scrapeError maps codes to event types", () => {
    expect(scrapeError("c", "ebt-ca", { code: "sessionExpired", message: "x" }).type).toBe("session_expired");
    expect(scrapeError("c", "ebt-ca", { code: "captcha", message: "x" }).type).toBe("captcha");
    expect(scrapeError("c", "ebt-ca", { code: "portalDown", message: "x" }).type).toBe("portal_down");
    expect(scrapeError("c", "ebt-ca", { code: "parseError", message: "x" }).type).toBe("parse_error");
    expect(scrapeError("c", "ebt-ca", { code: "pinLocked", message: "x" }).type).toBe("parse_error");
    expect(scrapeError("c", "ebt-ca", { code: "cardClosed", message: "x" }).type).toBe("parse_error");
  });
});

describe("emitEvent", () => {
  it("signs the body and POSTs to the gateway URL", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const event = balanceUpdated("card-1", "ebt-ca", {
      foodBalanceCents: 1000,
      cashBalanceCents: 0,
      lastUpdatedAt: null,
    });

    const res = await emitEvent(
      { gatewayUrl: "https://gateway.example/webhooks/ebt-scraper", secret: SECRET, fetchImpl: fakeFetch },
      event,
    );

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://gateway.example/webhooks/ebt-scraper");
    expect(calls[0]!.init.method).toBe("POST");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-scraper-signature"]).toBeDefined();
    expect(headers["x-scraper-signature"]).toBe(signPayload(calls[0]!.init.body as string, SECRET));
  });
});
