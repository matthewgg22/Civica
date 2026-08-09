import { describe, it, expect, vi, beforeEach } from "vitest";

// A minimal chainable stub matching exactly the query shapes
// screening-store.ts actually calls: .schema().from().select().eq().eq()
// .maybeSingle() / .insert().select().single() / .update().eq().eq(), plus
// .schema().rpc(). Each test configures what the terminal call resolves to.

function makeChain(terminal: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.maybeSingle = vi.fn(async () => terminal);
  chain.single = vi.fn(async () => terminal);
  // .update()/.insert() without a further .select() resolve directly too —
  // saveScreeningTurn awaits the update chain without selecting anything back.
  chain.then = (resolve: (v: unknown) => void) => resolve(terminal);
  return chain;
}

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockAdmin = vi.hoisted(() => vi.fn());
vi.mock("../supabase-server", () => ({
  supabaseAdmin: mockAdmin,
}));

import { loadScreening, createScreening, saveScreeningTurn, GuestCapReachedError } from "../screening-store";
import { GUEST_CAP } from "../screening-auth";

const ORG_IDENTITY = {
  kind: "org" as const,
  userId: "u1",
  orgId: "org1",
  orgName: "Franklin County Food Alliance",
  stateCode: "OH",
  casePrefix: "FCFA",
};
const GUEST_IDENTITY = { kind: "guest" as const, guestToken: "g1", screeningsUsed: 0 };

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockAdmin.mockReset().mockReturnValue({ schema: () => ({ from: mockFrom, rpc: mockRpc }) });
});

describe("loadScreening", () => {
  it("scopes the query to the ORG's own screenings", async () => {
    const chain = makeChain({ data: { id: "s1", case_label: "FCFA-1", state_code: "OH", facts: {}, messages: [], outcome: null, status: "active" }, error: null });
    mockFrom.mockReturnValue(chain);
    const r = await loadScreening("s1", ORG_IDENTITY);
    expect(r?.caseLabel).toBe("FCFA-1");
    expect(chain.eq).toHaveBeenCalledWith("org_id", "org1");
  });

  it("scopes the query to the GUEST's own token, never another guest's", async () => {
    const chain = makeChain({ data: { id: "s1", case_label: null, state_code: "OH", facts: {}, messages: [], outcome: null, status: "active" }, error: null });
    mockFrom.mockReturnValue(chain);
    await loadScreening("s1", GUEST_IDENTITY);
    expect(chain.eq).toHaveBeenCalledWith("guest_token", "g1");
  });

  it("returns null rather than throwing when the row isn't found or isn't owned by this identity", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    expect(await loadScreening("nope", GUEST_IDENTITY)).toBeNull();
  });
});

describe("createScreening", () => {
  it("issues a real case label for an org, via the atomic RPC", async () => {
    mockRpc.mockResolvedValue({ data: "FCFA-5", error: null });
    mockFrom.mockReturnValue(
      makeChain({ data: { id: "s2", case_label: "FCFA-5", state_code: "OH", facts: {}, messages: [], outcome: null, status: "active" }, error: null }),
    );
    const r = await createScreening(ORG_IDENTITY, "OH");
    expect(r.caseLabel).toBe("FCFA-5");
    expect(mockRpc).toHaveBeenCalledWith("demeter_next_case_label", { p_org_id: "org1" });
  });

  it("a guest UNDER the cap creates fine, with no case label", async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null }); // 3 of 5 used
    mockFrom.mockReturnValue(
      makeChain({ data: { id: "s3", case_label: null, state_code: "CA", facts: {}, messages: [], outcome: null, status: "active" }, error: null }),
    );
    const r = await createScreening(GUEST_IDENTITY, "CA");
    expect(r.caseLabel).toBeNull();
  });

  it("a guest AT the cap is refused BEFORE any insert is attempted", async () => {
    mockRpc.mockResolvedValue({ data: GUEST_CAP, error: null });
    await expect(createScreening(GUEST_IDENTITY, "CA")).rejects.toBeInstanceOf(GuestCapReachedError);
    expect(mockFrom).not.toHaveBeenCalled(); // never reached the insert
  });

  it("an org member has NO cap even far past the guest limit", async () => {
    // Org path never calls the guest-count RPC at all.
    mockRpc.mockResolvedValue({ data: "FCFA-99", error: null });
    mockFrom.mockReturnValue(
      makeChain({ data: { id: "s4", case_label: "FCFA-99", state_code: "OH", facts: {}, messages: [], outcome: null, status: "active" }, error: null }),
    );
    await expect(createScreening(ORG_IDENTITY, "OH")).resolves.toBeTruthy();
  });
});

describe("saveScreeningTurn", () => {
  it("writes only to the caller's own scoped row", async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);
    await saveScreeningTurn("s1", GUEST_IDENTITY, {
      facts: { assets: 500 },
      messages: [{ role: "user", content: "hi" }],
      outcome: "not_enough_information",
    });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ facts: { assets: 500 }, outcome: "not_enough_information" }),
    );
    expect(chain.eq).toHaveBeenCalledWith("guest_token", "g1");
  });
});
