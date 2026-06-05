// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const mockExchange = vi.hoisted(() => vi.fn());
const mockGetAll = vi.hoisted(() => vi.fn().mockReturnValue([]));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: mockGetAll, set: vi.fn() }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { exchangeCodeForSession: mockExchange },
  })),
}));

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

import { beforeEach } from "vitest";
import { GET } from "../route";

describe("GET /auth/callback", () => {
  beforeEach(() => mockExchange.mockReset());
  it("exchanges code and redirects to /packets on success", async () => {
    mockExchange.mockResolvedValueOnce({ error: null });
    const req = new NextRequest("http://localhost/auth/callback?code=abc123");
    const res = await GET(req);
    expect(mockExchange).toHaveBeenCalledWith("abc123");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/packets");
  });

  it("redirects to /login?error=auth_failed when no code param", async () => {
    const req = new NextRequest("http://localhost/auth/callback");
    const res = await GET(req);
    expect(res.headers.get("location")).toContain("auth_failed");
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("redirects to /login?error=auth_failed when exchange fails", async () => {
    mockExchange.mockResolvedValueOnce({ error: new Error("invalid code") });
    const req = new NextRequest("http://localhost/auth/callback?code=bad");
    const res = await GET(req);
    expect(res.headers.get("location")).toContain("auth_failed");
  });

  it("respects ?next= param on success", async () => {
    mockExchange.mockResolvedValueOnce({ error: null });
    const req = new NextRequest(
      "http://localhost/auth/callback?code=xyz&next=/cdss",
    );
    const res = await GET(req);
    expect(res.headers.get("location")).toContain("/cdss");
  });
});
