import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getSession: mockGetSession } })),
}));

import { middleware } from "../middleware";

const req = (path: string) => new NextRequest(`https://civica.app${path}`);

describe("web auth middleware — login-first apply gate", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    mockGetSession.mockReset();
  });

  it("redirects an unauthenticated visitor from /apply to sign-in (account-first)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const res = await middleware(req("/apply"));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location")!;
    expect(loc).toContain("/sign-in");
    expect(loc).toContain("next=%2Fapply");
  });

  it("preserves the deep wizard step in the next param", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const res = await middleware(req("/apply/household"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("next=%2Fapply%2Fhousehold");
  });

  it("lets an authenticated applicant into /apply", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    const res = await middleware(req("/apply"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still gates /documents and /status", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    for (const p of ["/documents", "/status"]) {
      const res = await middleware(req(p));
      expect(res.status, p).toBe(307);
      expect(res.headers.get("location")).toContain("/sign-in");
    }
  });

  it("leaves public marketing routes (and /status?demo=1) open", async () => {
    const welcome = await middleware(req("/welcome"));
    expect(welcome.status).toBe(200);
    expect(welcome.headers.get("location")).toBeNull();

    const demo = await middleware(req("/status?demo=1"));
    expect(demo.status).toBe(200);
    expect(demo.headers.get("location")).toBeNull();
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});
