// @vitest-environment node
// NextRequest requires a proper Headers implementation that jsdom doesn't provide.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Must be hoisted so vi.mock factory can reference them.
const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Prevent the supabase env-var guard from throwing during module load.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

import { middleware } from "../middleware";

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`));
}

describe("middleware", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  describe("unauthenticated", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it("redirects protected routes to /login", async () => {
      const res = await middleware(makeRequest("/packets"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("passes through /login without redirect", async () => {
      const res = await middleware(makeRequest("/login"));
      expect(res.status).toBe(200);
    });

    it("passes through /compliance/county/[slug] without auth", async () => {
      // Public share-out artifact — must be reachable by a council member
      // who clicked a forwarded link without ever signing in.
      const res = await middleware(makeRequest("/compliance/county/los-angeles"));
      expect(res.status).toBe(200);
      // Supabase auth lookup must NOT have been called for a fully-public route.
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("still redirects /compliance (no /county/ suffix) to /login", async () => {
      // /compliance itself remains staff-gated; only /compliance/county/* is public.
      const res = await middleware(makeRequest("/compliance"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  });

  describe("authenticated applicant (no staff role)", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { app_metadata: { role: "applicant" }, email: "a@b.com" } },
      });
    });

    it("redirects to /login?error=staff_only", async () => {
      const res = await middleware(makeRequest("/packets"));
      expect(res.status).toBe(307);
      const location = res.headers.get("location") ?? "";
      expect(location).toContain("/login");
      expect(location).toContain("staff_only");
    });

    it("passes through /login even for non-staff", async () => {
      const res = await middleware(makeRequest("/login"));
      expect(res.status).toBe(200);
    });
  });

  describe("authenticated navigator (operational staff)", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { app_metadata: { role: "navigator" }, email: "nav@civica.co" } },
      });
    });

    it("passes through /packets", async () => {
      const res = await middleware(makeRequest("/packets"));
      expect(res.status).toBe(200);
    });

    it("redirects / to /packets", async () => {
      const res = await middleware(makeRequest("/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/packets");
    });

    it("passes through /dashboard", async () => {
      const res = await middleware(makeRequest("/dashboard"));
      expect(res.status).toBe(200);
    });
  });

  describe("authenticated state_deputy (restricted audience role)", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { app_metadata: { role: "state_deputy" }, email: "dep@ca.gov" } },
      });
    });

    it("passes through /cdss", async () => {
      const res = await middleware(makeRequest("/cdss"));
      expect(res.status).toBe(200);
    });

    it("redirects /packets to role home /cdss", async () => {
      const res = await middleware(makeRequest("/packets"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/cdss");
    });

    it("redirects / to /cdss", async () => {
      const res = await middleware(makeRequest("/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/cdss");
    });
  });
});
