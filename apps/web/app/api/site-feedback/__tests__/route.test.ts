import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockInsert = vi.hoisted(() => vi.fn());
const durableRateLimit = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabase-server", () => ({
  supabaseAdmin: vi.fn(() => ({
    schema: () => ({ from: () => ({ insert: mockInsert }) }),
  })),
}));
vi.mock("../../../../lib/durable-rate-limit", () => ({ durableRateLimit }));

import { POST } from "../route";
import { __resetRateLimitForTests } from "../../lead-capture/rate-limit";

function makeReq(body: unknown, ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://localhost/api/site-feedback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
  });
}

const VALID = {
  category: "suggestion",
  message: "It would help if the map showed transit directions too.",
  contact_email: "reader@example.org",
  page_url: "https://demeter.example/screen/ask",
  company_fax: "",
};

describe("POST /api/site-feedback", () => {
  beforeEach(() => {
    mockInsert.mockReset().mockResolvedValue({ error: null });
    durableRateLimit.mockReset().mockResolvedValue(true);
    __resetRateLimitForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores a valid message", async () => {
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "suggestion",
        message: VALID.message,
        contact_email: VALID.contact_email,
        page_url: VALID.page_url,
      }),
    );
  });

  it("accepts a message with no category and no email — both optional", async () => {
    const res = await POST(makeReq({ message: "Just wanted to say thanks." }));
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ category: null, contact_email: null, message: "Just wanted to say thanks." }),
    );
  });

  it("rejects an empty or oversized message", async () => {
    expect((await POST(makeReq({ ...VALID, message: "" }))).status).toBe(400);
    expect((await POST(makeReq({ ...VALID, message: "x".repeat(2001) }))).status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid category or email", async () => {
    expect((await POST(makeReq({ ...VALID, category: "praise" }))).status).toBe(400);
    expect((await POST(makeReq({ ...VALID, contact_email: "not-an-email" }))).status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // THE BUG THIS GUARDS AGAINST: the
  // honeypot field is capped at length 0 in the schema itself, so a bot that
  // actually fills it fails validation before the route's own honeypot
  // branch ever runs. Confirmed real behavior, not the "silent 200" the
  // route's comment might suggest at a glance.
  it("rejects a filled honeypot field via schema validation, before the store is touched", async () => {
    const res = await POST(makeReq({ ...VALID, company_fax: "bot filled this" }));
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rate-limits per IP, independent of lead-capture and the per-answer feedback route", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await POST(makeReq(VALID, "9.9.9.9"))).status).toBe(200);
    }
    expect((await POST(makeReq(VALID, "9.9.9.9"))).status).toBe(429);
    // A different IP is unaffected.
    expect((await POST(makeReq(VALID, "1.1.1.1"))).status).toBe(200);
  });

  // Regression (launch audit 2026-08-28): the in-memory limiter above is
  // per-instance and resets on cold start; the durable counter is the ceiling
  // that actually holds on serverless. A first request from a fresh IP passes
  // the in-memory line but must still be blocked when the durable counter trips.
  it("blocks when the durable cross-instance limiter trips", async () => {
    durableRateLimit.mockResolvedValue(false);
    const res = await POST(makeReq(VALID, "5.5.5.5"));
    expect(res.status).toBe(429);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns a graceful 503 when the store is down — never reads as the message being rejected", async () => {
    mockInsert.mockResolvedValue({ error: new Error("db down") });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(503);
    err.mockRestore();
  });
});
