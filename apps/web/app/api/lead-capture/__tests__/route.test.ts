import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @supabase/supabase-js BEFORE importing the route.
const insertMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

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

describe("POST /api/lead-capture", () => {
  beforeEach(() => {
    insertMock.mockReset();
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
    const res = await POST(
      makeReq({
        email: "student@cccd.edu",
        phone: "5551234567",
        campus: "Santa Monica College",
      }),
    );
    expect(res.status).toBe(201);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(row.email).toBe("student@cccd.edu");
    expect(row.organization).toBe("Santa Monica College");
    expect(row.qc_process).toBe("5551234567");
    expect(row.source).toBe("student-lpie-web");
  });

  it("returns 422 on invalid email", async () => {
    const res = await POST(makeReq({ email: "not-an-email" }));
    expect(res.status).toBe(422);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 422 on missing email", async () => {
    const res = await POST(makeReq({ phone: "5551234567" }));
    expect(res.status).toBe(422);
  });

  it("returns 503 when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(makeReq({ email: "student@cccd.edu" }));
    expect(res.status).toBe(503);
    expect(insertMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns 500 when Supabase insert fails", async () => {
    insertMock.mockResolvedValue({
      error: { message: "permission denied" },
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeReq({ email: "student@cccd.edu" }));
    expect(res.status).toBe(500);
    err.mockRestore();
  });

  it("rate-limits after 5 requests from the same IP", async () => {
    insertMock.mockResolvedValue({ error: null });
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) {
      const ok = await POST(makeReq({ email: `s${i}@cccd.edu` }, ip));
      expect(ok.status).toBe(201);
    }
    const blocked = await POST(makeReq({ email: "s5@cccd.edu" }, ip));
    expect(blocked.status).toBe(429);
  });
});
