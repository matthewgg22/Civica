import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// classifyScreening and the PDF renderer both run FOR REAL here (only
// identity resolution and the store are mocked) — this is the boundary
// this route actually owns: does it gate correctly, and does it produce
// real PDF bytes from real facts, not just call the right mocks.

const mockResolveIdentity = vi.hoisted(() => vi.fn());
const mockLoad = vi.hoisted(() => vi.fn());
const mockMarkExported = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../lib/screening-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../lib/screening-auth")>();
  return { ...actual, resolveScreeningIdentity: mockResolveIdentity };
});
vi.mock("../../../../../../lib/screening-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../lib/screening-store")>();
  return { ...actual, loadScreening: mockLoad, markScreeningExported: mockMarkExported };
});

import { GET } from "../route";

const ORG = {
  kind: "org" as const,
  userId: "u1",
  orgId: "org1",
  orgName: "Franklin County Food Alliance",
  stateCode: "OH",
  casePrefix: "FCFA",
};
const GUEST = { kind: "guest" as const, guestToken: "g1", screeningsUsed: 2 };

const COMPUTABLE_FACTS = {
  household: [{ member_id: "a", age: 62, role: "head" as const, citizen_or_eligible_noncitizen: true }],
  income: [{ member_id: "a", type: "social_security" as const, monthly_amount: 1180 }],
  shelter: { rent: 900, sua_tier: "none" as const },
  deductions: {},
  assets: 500,
  cat_elig: "NPA" as const,
};

function makeReq(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost/api/screen/${id}/export`),
    { params: Promise.resolve({ id }) },
  ];
}

beforeEach(() => {
  mockResolveIdentity.mockReset().mockResolvedValue(ORG);
  mockLoad.mockReset().mockResolvedValue({
    id: "s1",
    caseLabel: "FCFA-4127",
    stateCode: "OH",
    facts: COMPUTABLE_FACTS,
    messages: [],
    outcome: "likely_eligible",
    status: "active",
  });
  mockMarkExported.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/screen/:id/export", () => {
  it("a guest is refused — export needs an account", async () => {
    mockResolveIdentity.mockResolvedValue(GUEST);
    const res = await GET(...makeReq("s1"));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { reason: string }).reason).toBe("requires_account");
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("404s when the screening isn't found or isn't owned by this org", async () => {
    mockLoad.mockResolvedValue(null);
    const res = await GET(...makeReq("not-mine"));
    expect(res.status).toBe(404);
  });

  it("an org member with a real screening gets back real PDF bytes", async () => {
    const res = await GET(...makeReq("s1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("FCFA-4127.pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(buf.byteLength).toBeGreaterThan(500);
  });

  it("marks the screening exported after a successful render", async () => {
    await GET(...makeReq("s1"));
    expect(mockMarkExported).toHaveBeenCalledWith("s1", ORG);
  });

  it("REGRESSION: a store failure returns a clean 503, not an unhandled exception", async () => {
    mockLoad.mockRejectedValue(new Error("Missing Supabase admin config."));
    const res = await GET(...makeReq("s1"));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { reason: string }).reason).toBe("store_unavailable");
  });

  it("an incomplete screening still exports — 'not enough information' is a real, printable state", async () => {
    mockLoad.mockResolvedValue({
      id: "s2",
      caseLabel: "FCFA-4128",
      stateCode: "OH",
      facts: {},
      messages: [],
      outcome: null,
      status: "active",
    });
    const res = await GET(...makeReq("s2"));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
