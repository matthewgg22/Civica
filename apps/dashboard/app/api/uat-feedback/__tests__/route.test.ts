import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockSchema = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ getAll: () => [], set: vi.fn() })
  ),
}));

vi.mock("../../../../lib/supabase", () => ({
  createServerClientFromCookies: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    schema: mockSchema,
  })),
}));

// Wire schema().from().insert() chain.
beforeEach(() => {
  mockInsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ insert: mockInsert });
  mockSchema.mockReturnValue({ from: mockFrom });
});

import { POST } from "../route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/uat-feedback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/uat-feedback", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq({ message: "great" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as non-staff", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com", app_metadata: { role: "applicant" } } },
    });
    const res = await POST(makeReq({ message: "great" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when message is empty", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "nav@civica.co", app_metadata: { role: "navigator" } } },
    });
    const res = await POST(makeReq({ message: "  " }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("message is required");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "nav@civica.co", app_metadata: { role: "navigator" } } },
    });
    const req = new NextRequest("http://localhost/api/uat-feedback", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("inserts into uat_feedback and returns 201", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "nav@civica.co", app_metadata: { role: "navigator" } } },
    });
    const res = await POST(makeReq({ message: "Looks good!", page_path: "/packets" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mockSchema).toHaveBeenCalledWith("public");
    expect(mockFrom).toHaveBeenCalledWith("uat_feedback");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        navigator_email: "nav@civica.co",
        message: "Looks good!",
        page_path: "/packets",
      })
    );
  });

  it("returns 500 when Supabase insert fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "nav@civica.co", app_metadata: { role: "navigator" } } },
    });
    mockInsert.mockResolvedValue({ error: new Error("db error") });
    const res = await POST(makeReq({ message: "fail test" }));
    expect(res.status).toBe(500);
  });

  it("accepts all staff roles", async () => {
    for (const role of ["navigator", "supervisor", "admin", "state_deputy", "county_director", "cbo_preview"]) {
      mockGetUser.mockResolvedValue({
        data: { user: { email: "staff@civica.co", app_metadata: { role } } },
      });
      const res = await POST(makeReq({ message: "test" }));
      expect(res.status, `role ${role} should be accepted`).toBe(201);
    }
  });
});
