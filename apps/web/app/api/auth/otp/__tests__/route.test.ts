import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The OTP send route forwards to Supabase's /auth/v1/otp. Its contract here:
// on an upstream failure it must NOT relay the provider's raw response body to
// the client (GoTrue error text can carry internal config/identifier detail) —
// the caller only needs "it failed." The detail is kept server-side.

const otpRateLimit = vi.hoisted(() => vi.fn());

vi.mock("../../rate-limit", () => ({ otpRateLimit }));
vi.mock("../../../../../lib/env", () => ({
  publicEnv: () => ({ supabaseUrl: "https://stub.supabase.co", supabaseAnonKey: "anon-key" }),
}));

import { POST } from "../route";

function req(phone: string): Request {
  return new Request("http://localhost/api/auth/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify({ phone }),
  });
}

beforeEach(() => {
  otpRateLimit.mockReturnValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/auth/otp", () => {
  it("does NOT relay the upstream's raw response body to the client", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => "GoTrue internal error: secret-detail-xyz",
      })),
    );
    const res = await POST(req("5551234567"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: "upstream_failed" });
    expect(body).not.toHaveProperty("detail");
    expect(JSON.stringify(body)).not.toContain("secret-detail-xyz");
    // Kept server-side for diagnosis, not lost.
    expect(warn.mock.calls.flat().join(" ")).toContain("secret-detail-xyz");
  });

  it("returns the normalized phone on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => "" })));
    const res = await POST(req("5551234567"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ phone: "+15551234567" });
  });
});
