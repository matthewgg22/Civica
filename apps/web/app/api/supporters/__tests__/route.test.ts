import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockInsert = vi.hoisted(() => vi.fn());
const mockGate = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabase-server", () => ({
  supabaseAdmin: vi.fn(() => ({
    schema: () => ({ from: () => ({ insert: mockInsert }) }),
  })),
}));
vi.mock("../../../../lib/demeter-usage", () => ({
  checkUsageGate: mockGate,
}));

import { POST } from "../route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/supporters", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID = {
  org_name: "Central Texas Food Bank",
  contact_email: "outreach@ctfb.example.org",
  website: "https://ctfb.example.org",
  state: "TX",
  note: "",
  company_fax: "",
};

describe("POST /api/supporters (moderated sign-on, eng F1)", () => {
  beforeEach(() => {
    mockInsert.mockReset().mockResolvedValue({ error: null });
    mockGate.mockReset().mockResolvedValue({ allowed: true });
  });

  it("stores a valid sign-on as PENDING (never auto-listed)", async () => {
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "pending" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ org_name: VALID.org_name, status: "pending" }),
    );
  });

  it("silently drops honeypot submissions without touching the store", async () => {
    const res = await POST(makeReq({ ...VALID, company_fax: "x" }));
    expect(res.status).toBe(400); // schema caps honeypot at length 0 → rejected as invalid
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects invalid emails and short names", async () => {
    expect((await POST(makeReq({ ...VALID, contact_email: "nope" }))).status).toBe(400);
    expect((await POST(makeReq({ ...VALID, org_name: "x" }))).status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rate-limits through the shared durable gate", async () => {
    mockGate.mockResolvedValue({ allowed: false, reason: "rate_limited" });
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns a graceful 503 when the store is down", async () => {
    mockInsert.mockResolvedValue({ error: new Error("db down") });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(503);
    err.mockRestore();
  });
});
