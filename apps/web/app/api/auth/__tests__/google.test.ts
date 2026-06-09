import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithOAuth = vi.fn();
vi.mock("../../../../lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { signInWithOAuth } })),
}));

import { GET } from "../google/route";

const req = (qs = "") =>
  new Request(`https://civica-applicant.vercel.app/api/auth/google${qs}`);

describe("GET /api/auth/google", () => {
  beforeEach(() => signInWithOAuth.mockReset());

  it("redirects the browser to the Google consent URL", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
      error: null,
    });
    const res = await GET(req("?next=/apply"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("accounts.google.com");

    const opts = signInWithOAuth.mock.calls[0]![0];
    expect(opts.provider).toBe("google");
    expect(opts.options.skipBrowserRedirect).toBe(true);
    expect(opts.options.redirectTo).toContain("/auth/callback?next=%2Fapply");
  });

  it("rejects an off-site next (open-redirect guard)", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/x" },
      error: null,
    });
    await GET(req("?next=https://evil.example"));
    const opts = signInWithOAuth.mock.calls[0]![0];
    expect(opts.options.redirectTo).toContain("/auth/callback?next=%2Fapply");
  });

  it("falls back to /sign-in?error when the provider URL is missing", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "boom" } });
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in?error=oauth_init");
  });
});
