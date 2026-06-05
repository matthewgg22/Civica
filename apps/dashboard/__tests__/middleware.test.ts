// @vitest-environment node
// NextRequest requires a proper Headers implementation that jsdom doesn't provide.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Must be hoisted so vi.mock factory can reference them.
const mockGetUser = vi.hoisted(() => vi.fn());
// MFA gate: default to aal1/aal1 (no MFA enrolled) so existing tests are unaffected.
const mockGetAAL = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" } })
);

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      mfa: { getAuthenticatorAssuranceLevel: mockGetAAL },
    },
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

    it("passes through /sign-up without auth", async () => {
      // Request-access form must be reachable by unauthenticated visitors —
      // they haven't signed in yet and are trying to get an account.
      const res = await middleware(makeRequest("/sign-up"));
      expect(res.status).toBe(200);
    });

    it("passes through /auth/reset-password without auth", async () => {
      // Supabase password reset email links land here with ?code=. The visitor
      // is unauthenticated by definition when resetting their password.
      const res = await middleware(makeRequest("/auth/reset-password"));
      expect(res.status).toBe(200);
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

    it("redirects / to navigator home (/outreach)", async () => {
      const res = await middleware(makeRequest("/"));
      expect(res.status).toBe(307);
      // ROLE_HOMES.navigator = "/outreach" (queue-driven daily-driver, see roleRouting.ts).
      expect(res.headers.get("location")).toContain("/outreach");
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

  describe("authenticated operator (corporate /ops access)", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { app_metadata: { role: "operator" }, email: "op@civica.co" } },
      });
    });

    it("passes through /ops", async () => {
      const res = await middleware(makeRequest("/ops"));
      expect(res.status).toBe(200);
    });

    it("passes through /ops/ebt-aggregates", async () => {
      const res = await middleware(makeRequest("/ops/ebt-aggregates"));
      expect(res.status).toBe(200);
    });

    it("redirects / to /ops", async () => {
      const res = await middleware(makeRequest("/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/ops");
    });

    it("redirects /packets to /ops (operator is restricted to /ops)", async () => {
      const res = await middleware(makeRequest("/packets"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/ops");
    });
  });

  describe("/ops route — staff allowed, audience roles blocked", () => {
    it("allows navigator (operational staff) to /ops", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { app_metadata: { role: "navigator" }, email: "nav@civica.co" } },
      });
      const res = await middleware(makeRequest("/ops"));
      expect(res.status).toBe(200);
    });

    it("allows admin to /ops", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { app_metadata: { role: "admin" }, email: "admin@civica.co" } },
      });
      const res = await middleware(makeRequest("/ops"));
      expect(res.status).toBe(200);
    });

    it("blocks county_director (audience role) from /ops", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { app_metadata: { role: "county_director" }, email: "cd@county.ca.gov" } },
      });
      const res = await middleware(makeRequest("/ops"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/county");
    });

    it("blocks state_deputy (audience role) from /ops", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { app_metadata: { role: "state_deputy" }, email: "sd@cdss.ca.gov" } },
      });
      const res = await middleware(makeRequest("/ops"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/cdss");
    });

    it("redirects unauthenticated from /ops to /login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const res = await middleware(makeRequest("/ops"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  });
});
