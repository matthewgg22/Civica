import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateServerClient = vi.hoisted(() =>
  vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
);
const mockAdmin = vi.hoisted(() => vi.fn());
const mockOrgFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

const cookieStore = vi.hoisted(() => new Map<string, string>());
const mockCookieSet = vi.hoisted(() => vi.fn((name: string, value: string) => cookieStore.set(name, value)));

vi.mock("../supabase-server", () => ({
  createSupabaseServerClient: mockCreateServerClient,
  supabaseAdmin: mockAdmin,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
    set: mockCookieSet,
  })),
}));

import { resolveScreeningIdentity, GUEST_COOKIE } from "../screening-auth";

function orgQueryChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

beforeEach(() => {
  mockGetUser.mockReset().mockResolvedValue({ data: { user: null } });
  mockOrgFrom.mockReset();
  mockRpc.mockReset().mockResolvedValue({ data: 0, error: null });
  mockAdmin.mockReset().mockReturnValue({ schema: () => ({ from: mockOrgFrom, rpc: mockRpc }) });
  cookieStore.clear();
  mockCookieSet.mockClear();
});

describe("resolveScreeningIdentity", () => {
  it("an authenticated user WITH org membership resolves to that org", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockOrgFrom.mockReturnValue(
      orgQueryChain({
        data: {
          org_id: "org1",
          demeter_orgs: { name: "Franklin County Food Alliance", state_code: "OH", case_label_prefix: "FCFA" },
        },
        error: null,
      }),
    );
    const id = await resolveScreeningIdentity();
    expect(id.kind).toBe("org");
    if (id.kind === "org") {
      expect(id.orgName).toBe("Franklin County Food Alliance");
      expect(id.stateCode).toBe("OH");
    }
  });

  it("an authenticated user with NO org membership falls back to guest, not an error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockOrgFrom.mockReturnValue(orgQueryChain({ data: null, error: null }));
    const id = await resolveScreeningIdentity();
    expect(id.kind).toBe("guest");
  });

  it("no session at all → a fresh guest identity, never blocked", async () => {
    const id = await resolveScreeningIdentity();
    expect(id.kind).toBe("guest");
    if (id.kind === "guest") expect(id.guestToken).toMatch(/^[0-9a-f]{32}$/);
  });

  it("a NEW guest token is written as an HttpOnly cookie", async () => {
    await resolveScreeningIdentity();
    expect(mockCookieSet).toHaveBeenCalledWith(
      GUEST_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("an EXISTING guest cookie is reused, not replaced", async () => {
    cookieStore.set(GUEST_COOKIE, "existing-token-123");
    const id = await resolveScreeningIdentity();
    expect(id.kind).toBe("guest");
    if (id.kind === "guest") expect(id.guestToken).toBe("existing-token-123");
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("guest screeningsUsed reads the real lifetime count via RPC", async () => {
    cookieStore.set(GUEST_COOKIE, "t1");
    mockRpc.mockResolvedValue({ data: 3, error: null });
    const id = await resolveScreeningIdentity();
    if (id.kind === "guest") expect(id.screeningsUsed).toBe(3);
    expect(mockRpc).toHaveBeenCalledWith("demeter_guest_screening_count", { p_guest_token: "t1" });
  });

  it("fails OPEN on the read — a store outage never blocks resolving an identity", async () => {
    cookieStore.set(GUEST_COOKIE, "t1");
    mockRpc.mockRejectedValue(new Error("db down"));
    const id = await resolveScreeningIdentity();
    expect(id.kind).toBe("guest");
    if (id.kind === "guest") expect(id.screeningsUsed).toBe(0);
  });
});
