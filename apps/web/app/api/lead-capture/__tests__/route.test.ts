import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @supabase/supabase-js BEFORE importing the route.
const insertMock = vi.fn();
const durableRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));
vi.mock("../../../../lib/durable-rate-limit", () => ({ durableRateLimit }));

// next/server is a thin wrapper around the global Response — we just need
// NextResponse.json available in the node test env. Use the real module.
// (Vitest in node env can resolve next/server's response helpers.)

import { POST } from "../route";
import { __resetRateLimitForTests } from "../rate-limit";

function makeReq(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/lead-capture", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

function studentLead(overrides: Record<string, unknown> = {}) {
  return {
    email: "student@cccd.edu",
    phone: "5551234567",
    campus: "Santa Monica College",
    ...overrides,
  };
}

describe("POST /api/lead-capture", () => {
  beforeEach(() => {
    insertMock.mockReset();
    durableRateLimit.mockReset().mockResolvedValue(true);
    __resetRateLimitForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("inserts and returns 201 on happy path", async () => {
    insertMock.mockResolvedValue({ error: null });
    const res = await POST(makeReq(studentLead()));
    expect(res.status).toBe(201);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(row.email).toBe("student@cccd.edu");
    expect(row.phone).toBe("5551234567");
    expect(row.campus).toBe("Santa Monica College");
    expect(row.source).toBe("student-lpie-web");
    // Migration 20260556 removed the qc_process workaround; the row should
    // not synthesize name/organization or stash phone into qc_process.
    expect(row.name).toBeUndefined();
    expect(row.organization).toBeUndefined();
    expect(row.qc_process).toBeUndefined();
  });

  it("returns 422 on invalid email", async () => {
    const res = await POST(makeReq(studentLead({ email: "not-an-email" })));
    expect(res.status).toBe(422);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 422 on missing email", async () => {
    const res = await POST(
      makeReq({ phone: "5551234567", campus: "Santa Monica College" }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 on missing campus (pilot_leads CHECK constraint requires it)", async () => {
    const res = await POST(
      makeReq({ email: "student@cccd.edu", phone: "5551234567" }),
    );
    expect(res.status).toBe(422);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(makeReq(studentLead()));
    expect(res.status).toBe(503);
    expect(insertMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns 500 when Supabase insert fails", async () => {
    insertMock.mockResolvedValue({
      error: { message: "permission denied" },
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeReq(studentLead()));
    expect(res.status).toBe(500);
    err.mockRestore();
  });

  it("rate-limits after 5 requests from the same IP", async () => {
    insertMock.mockResolvedValue({ error: null });
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) {
      const ok = await POST(
        makeReq(studentLead({ email: `s${i}@cccd.edu` }), ip),
      );
      expect(ok.status).toBe(201);
    }
    const blocked = await POST(
      makeReq(studentLead({ email: "s5@cccd.edu" }), ip),
    );
    expect(blocked.status).toBe(429);
  });

  // Regression (launch audit 2026-08-28): the in-memory limiter above resets on
  // cold start and is per-serverless-instance, so on its own it barely bounds a
  // distributed flood of the leads table. The durable counter is the ceiling
  // that holds across instances — a fresh IP that clears the in-memory line is
  // still blocked when the durable counter trips.
  it("blocks when the durable cross-instance limiter trips", async () => {
    insertMock.mockResolvedValue({ error: null });
    durableRateLimit.mockResolvedValue(false);
    const res = await POST(makeReq(studentLead(), "5.5.5.5"));
    expect(res.status).toBe(429);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
