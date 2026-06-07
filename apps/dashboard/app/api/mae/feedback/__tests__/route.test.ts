import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));

vi.mock("../../../../../lib/supabase", () => ({
  createServerClientFromCookies: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
  createServiceClient: vi.fn(() => ({
    schema: () => ({ from: () => ({ insert: mockInsert }) }),
  })),
}));

import { POST } from "../route";

const staff = { data: { user: { id: "u-1", app_metadata: { role: "navigator" } } } };
const makeReq = (body: unknown) =>
  new NextRequest("http://localhost/api/mae/feedback", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("POST /api/mae/feedback", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("401 unauthenticated / 403 non-staff", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(makeReq({ rating: "up" }))).status).toBe(401);
    mockGetUser.mockResolvedValue({ data: { user: { id: "x", app_metadata: { role: "applicant" } } } });
    expect((await POST(makeReq({ rating: "up" }))).status).toBe(403);
  });

  it("400 on a bad rating", async () => {
    mockGetUser.mockResolvedValue(staff);
    expect((await POST(makeReq({ rating: "meh" }))).status).toBe(400);
  });

  it("stores a thumbs-down with reason, PII-scrubbed", async () => {
    mockGetUser.mockResolvedValue(staff);
    const res = await POST(
      makeReq({
        rating: "down",
        reason: "citation_wrong",
        note: "wrong for client SSN 123-45-6789",
        question: "client SSN 123-45-6789 over income?",
        answer: "cites 7 CFR 273.9",
      }),
    );
    expect(res.status).toBe(201);
    const row = mockInsert.mock.calls.at(-1)![0];
    expect(row).toMatchObject({ staff_user_id: "u-1", rating: "down", reason: "citation_wrong" });
    expect(row.note).toContain("[SSN]");
    expect(row.note).not.toContain("123-45-6789");
    expect(row.question_redacted).toContain("[SSN]");
  });

  it("500 when the insert fails", async () => {
    mockGetUser.mockResolvedValue(staff);
    mockInsert.mockResolvedValue({ error: new Error("db") });
    expect((await POST(makeReq({ rating: "up" }))).status).toBe(500);
  });
});
