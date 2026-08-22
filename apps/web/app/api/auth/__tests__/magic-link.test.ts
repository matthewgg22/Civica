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

  it("sends a redirect URL with NO query string — it must match the allow list exactly", async () => {
    // A `?next=` here made Supabase's Redirect URL match fail, so it fell back
    // to the project Site URL — the staff dashboard — and applicants signing in
    // to save a conversation landed in software they cannot use. Observed in
    // production 2026-08-11. The destination rides a cookie now.
    await POST(req({ email: "a@example.com", next: "/screen/ask?state=CA" }));
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(
      "https://demeter.test/auth/callback",
    );
  });

  it("carries the destination in a cookie instead", async () => {
    const res = await POST(req({ email: "a@example.com", next: "/screen/ask?state=CA" }));
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("demeter_auth_next=");
    expect(decodeURIComponent(cookie)).toContain("/screen/ask?state=CA");
    // HttpOnly so page scripts cannot read or steer it; Lax because clicking a
    // link in an email is a cross-site top-level GET and Strict would withhold
    // the cookie on exactly the request it exists for.
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("refuses to stash an off-origin destination", async () => {
    // The value round-trips through the user's inbox, so an open redirect is a
    // phishing primitive: a genuine Demeter sign-in email landing on
    // evil.example. Clamped before it is ever written.
    for (const bad of ["https://evil.example/x", "//evil.example/x", "/\\evil.example"]) {
      const res = await POST(req({ email: "a@example.com", next: bad }));
      const cookie = decodeURIComponent(res.headers.get("set-cookie") ?? "");
      expect(cookie).not.toContain("evil.example");
      expect(cookie).toContain("/screen/ask");
    }
  });
});
