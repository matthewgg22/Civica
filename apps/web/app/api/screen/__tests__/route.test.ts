import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// The engine (screenHousehold) and the store are both independently tested
// elsewhere — this is about the ROUTE's own contract: gating, ownership
// resolution, request validation, and settling spend.

const mockGate = vi.hoisted(() => vi.fn());
const mockSettle = vi.hoisted(() => vi.fn());
const mockResolveIdentity = vi.hoisted(() => vi.fn());
const mockLoad = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockSave = vi.hoisted(() => vi.fn());
const mockScreenHousehold = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void>>);

vi.mock("@civica/demeter-engine", () => ({ screenHousehold: mockScreenHousehold }));
vi.mock("../../../../lib/demeter-usage", () => ({
  checkUsageGate: mockGate,
  settleSpend: mockSettle,
  costUsd: (i: number, o: number) => i * 0.000015 + o * 0.000075,
  estimateTokensFromChars: (c: number) => Math.ceil(c / 4),
}));
vi.mock("../../../../lib/screening-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/screening-auth")>();
  return { ...actual, resolveScreeningIdentity: mockResolveIdentity };
});
vi.mock("../../../../lib/screening-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/screening-store")>();
  return { ...actual, loadScreening: mockLoad, createScreening: mockCreate, saveScreeningTurn: mockSave };
});
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => Promise<void>) => afterCallbacks.push(fn) };
});

import { POST } from "../route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/screen", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const GUEST = { kind: "guest" as const, guestToken: "g1", screeningsUsed: 0 };
const ORG = {
  kind: "org" as const,
  userId: "u1",
  orgId: "org1",
  orgName: "Franklin County Food Alliance",
  stateCode: "OH",
  casePrefix: "FCFA",
};
const FRESH_SCREENING = {
  id: "s1",
  caseLabel: null,
  stateCode: "CA",
  facts: {},
  messages: [],
  outcome: null,
  status: "active" as const,
};

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  mockGate.mockReset().mockResolvedValue({ allowed: true });
  mockSettle.mockReset().mockResolvedValue(undefined);
  mockResolveIdentity.mockReset().mockResolvedValue(GUEST);
  mockLoad.mockReset();
  mockCreate.mockReset().mockResolvedValue(FRESH_SCREENING);
  mockSave.mockReset().mockResolvedValue(undefined);
  mockScreenHousehold.mockReset().mockResolvedValue({
    facts: { household: [{ member_id: "a", age: 62, role: "head" }] },
    extractedNothing: false,
    classification: { outcome: "not_enough_information", summary: "x", completeness: { computable: false, stillNeeded: [], rawErrors: [] } },
    usage: { inputTokens: 50, outputTokens: 30 },
  });
  afterCallbacks.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/screen", () => {
  it("creates a fresh screening when no screeningId is given", async () => {
    const res = await POST(makeReq({ message: "She's 62.", state: "CA" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { screeningId: string };
    expect(json.screeningId).toBe("s1");
    expect(mockCreate).toHaveBeenCalledWith(GUEST, "CA");
  });

  it("an ORG member defaults to the org's own state when none is given", async () => {
    mockResolveIdentity.mockResolvedValue(ORG);
    await POST(makeReq({ message: "She's 62." }));
    expect(mockCreate).toHaveBeenCalledWith(ORG, "OH");
  });

  it("a guest with no state and no org default is rejected — never silently defaults", async () => {
    const res = await POST(makeReq({ message: "hi" }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("continues an existing screening by id instead of creating a new one", async () => {
    mockLoad.mockResolvedValue({ ...FRESH_SCREENING, id: "existing", messages: [{ role: "user", content: "prior" }] });
    const res = await POST(makeReq({ screeningId: "existing", message: "more info" }));
    expect(res.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    const passedMessages = mockScreenHousehold.mock.calls[0]![0].messages;
    expect(passedMessages).toHaveLength(2); // prior + new
  });

  it("404s when the screening isn't found or isn't owned by this identity", async () => {
    mockLoad.mockResolvedValue(null);
    const res = await POST(makeReq({ screeningId: "not-mine", message: "hi" }));
    expect(res.status).toBe(404);
  });

  it("a guest at the cap gets a distinct, actionable error", async () => {
    const { GuestCapReachedError } = await import("../../../../lib/screening-store");
    mockCreate.mockRejectedValue(new GuestCapReachedError());
    const res = await POST(makeReq({ message: "hi", state: "CA" }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { reason: string }).reason).toBe("guest_cap_reached");
  });

  it("persists the turn's result before responding", async () => {
    await POST(makeReq({ message: "She's 62.", state: "CA" }));
    expect(mockSave).toHaveBeenCalledWith(
      "s1",
      GUEST,
      expect.objectContaining({ outcome: "not_enough_information" }),
    );
  });

  it("settles spend via after() using real usage when the engine reports it", async () => {
    const res = await POST(makeReq({ message: "She's 62.", state: "CA" }));
    await res.text();
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]!();
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockSettle.mock.calls[0]![0]).toBeGreaterThan(0);
  });

  it("returns an honest 503 when the API key is absent", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(makeReq({ message: "hi", state: "CA" }));
    expect(res.status).toBe(503);
  });

  it("rate-limits through the shared durable gate", async () => {
    mockGate.mockResolvedValue({ allowed: false, reason: "rate_limited" });
    const res = await POST(makeReq({ message: "hi", state: "CA" }));
    expect(res.status).toBe(429);
  });

  it("rejects an empty message before touching the engine or the store", async () => {
    const res = await POST(makeReq({ message: "   ", state: "CA" }));
    expect(res.status).toBe(400);
    expect(mockScreenHousehold).not.toHaveBeenCalled();
  });

  it("REGRESSION: a store failure on create (e.g. Supabase unconfigured) returns a clean 503, not an unhandled exception", async () => {
    // Caught live: createScreening() threw a bare Error (Supabase env unset)
    // with nothing catching it above resolveScreeningIdentity's own guard —
    // it escaped POST entirely as an unhandled rejection, producing Next's
    // generic error page instead of this route's own JSON error shape.
    mockCreate.mockRejectedValue(new Error("Missing Supabase admin config: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."));
    const res = await POST(makeReq({ message: "hi", state: "CA" }));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { reason: string };
    expect(json.reason).toBe("store_unavailable");
    expect(mockScreenHousehold).not.toHaveBeenCalled();
  });

  it("REGRESSION: a store failure on load also returns a clean 503, not an unhandled exception", async () => {
    mockLoad.mockRejectedValue(new Error("Missing Supabase admin config."));
    const res = await POST(makeReq({ screeningId: "s1", message: "hi" }));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { reason: string }).reason).toBe("store_unavailable");
  });

  it("even a mid-turn engine failure still settles an estimated spend — never unmetered", async () => {
    mockScreenHousehold.mockRejectedValue(new Error("anthropic blew up"));
    const res = await POST(makeReq({ message: "She's 62.", state: "CA" }));
    expect(res.status).toBe(500);
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]!();
    expect(mockSettle).toHaveBeenCalled();
  });
});
