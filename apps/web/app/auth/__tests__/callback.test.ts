import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeCodeForSession = vi.fn();
vi.mock("../../../lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
}));

import { GET } from "../callback/route";

const req = (qs: string) =>
  new Request(`https://civica-applicant.vercel.app/auth/callback${qs}`);

describe("GET /auth/callback", () => {
  beforeEach(() => exchangeCodeForSession.mockReset());

  it("exchanges the code and redirects to next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(req("?code=abc&next=/apply/household"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://civica-applicant.vercel.app/apply/household",
    );
  });

  it("redirects to sign-in with an error when the provider sends no code", async () => {
    const res = await GET(req("?error=access_denied"));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/sign-in?error=oauth_callback");
  });

  it("redirects to sign-in when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });
    const res = await GET(req("?code=abc"));
    expect(res.headers.get("location")).toContain("/sign-in?error=oauth_exchange");
  });

  it("ignores an off-site next (open-redirect guard)", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(req("?code=abc&next=https://evil.example"));
    expect(res.headers.get("location")).toBe(
      "https://civica-applicant.vercel.app/apply",
    );
  });
});
