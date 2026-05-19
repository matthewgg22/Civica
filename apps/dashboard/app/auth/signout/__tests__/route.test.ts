// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Hoist mock factories so they're available inside vi.mock() closures.
const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockGetAll = vi.hoisted(() => vi.fn().mockReturnValue([]));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: mockGetAll }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { signOut: mockSignOut },
  })),
}));

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

import { POST } from "../route";

describe("POST /auth/signout", () => {
  it("calls supabase.auth.signOut()", async () => {
    const req = new NextRequest("http://localhost/auth/signout", { method: "POST" });
    await POST(req);
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("redirects to /login with HTTP 303 See Other", async () => {
    const req = new NextRequest("http://localhost/auth/signout", { method: "POST" });
    const res = await POST(req);
    // 303 is required so the browser follows the redirect as a GET.
    // 307 (NextResponse.redirect default) would repeat the POST to /login.
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login");
  });
});
