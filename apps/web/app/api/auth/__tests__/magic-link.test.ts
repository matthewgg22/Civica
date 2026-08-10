import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithOtp = vi.hoisted(() => vi.fn());
const durable = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { signInWithOtp } })),
}));
vi.mock("../../../../lib/durable-rate-limit", () => ({ durableRateLimit: durable }));

import { POST } from "../magic-link/route";

function req(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("https://demeter.test/api/auth/magic-link", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/magic-link", () => {
  beforeEach(() => {
    signInWithOtp.mockReset().mockResolvedValue({ error: null });
    durable.mockReset().mockResolvedValue(true);
  });

  it("sends the link and reports success", async () => {
    const res = await POST(req({ email: "Someone@Example.com " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // Normalised before it reaches Supabase, so "A@x.com" and "a@x.com " are
    // one account rather than two.
    expect(signInWithOtp.mock.calls[0][0].email).toBe("someone@example.com");
  });

  it("gives the SAME answer for a send failure — the endpoint must not be an oracle", async () => {
    // A different response for a known vs unknown address would let anyone
    // test whether a given person has used a benefits service.
    signInWithOtp.mockResolvedValue({ error: { message: "user not found" } });
    const res = await POST(req({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects anything that cannot be an address", async () => {
    for (const email of ["", "not-an-email", "a@b", "a b@c.com"]) {
      expect((await POST(req({ email }))).status).toBe(400);
    }
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("limits per ADDRESS, not just per IP — inbox bombing is the real abuse", async () => {
    // The recipient pays for this one, so it must hold even when each request
    // arrives from a different IP.
    durable.mockImplementation(async (ns: string) => ns !== "mlem");
    const res = await POST(req({ email: "victim@example.com" }, "9.9.9.9"));
    expect(res.status).toBe(429);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("limits per IP too", async () => {
    durable.mockImplementation(async (ns: string) => ns !== "mlip");
    expect((await POST(req({ email: "a@example.com" }))).status).toBe(429);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("refuses to bounce the user off-origin after the inbox round trip", async () => {
    // `next` survives a trip through email, so an open redirect here is a
    // phishing primitive: a real Demeter sign-in mail landing on evil.example.
    await POST(req({ email: "a@example.com", next: "https://evil.example/x" }));
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toContain(
      encodeURIComponent("/screen/ask"),
    );
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).not.toContain("evil.example");
  });

  it("keeps a same-origin next", async () => {
    await POST(req({ email: "a@example.com", next: "/screen/ask?state=CA" }));
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toContain(
      encodeURIComponent("/screen/ask?state=CA"),
    );
  });
});
