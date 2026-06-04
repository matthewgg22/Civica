// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockInsert = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabase", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: mockInsert })),
  })),
}));

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");

import { POST } from "../route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/request-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/request-access", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("returns 200 with valid payload", async () => {
    const res = await POST(makeRequest({
      name: "Jane Smith",
      organization: "Project Bread",
      email: "jane@projectbread.org",
      note: "Navigator for a food bank",
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      name: "Jane Smith",
      organization: "Project Bread",
      email: "jane@projectbread.org",
    }));
  });

  it("returns 200 with no note field", async () => {
    const res = await POST(makeRequest({
      name: "Bob",
      organization: "SEIU",
      email: "bob@seiu.org",
    }));
    expect(res.status).toBe(200);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({ organization: "Org", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when organization is missing", async () => {
    const res = await POST(makeRequest({ name: "Jane", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ name: "Jane", organization: "Org" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(makeRequest({ name: "Jane", organization: "Org", email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when Supabase insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "DB error" } });
    const res = await POST(makeRequest({
      name: "Jane",
      organization: "Org",
      email: "jane@org.com",
    }));
    expect(res.status).toBe(500);
  });
});
